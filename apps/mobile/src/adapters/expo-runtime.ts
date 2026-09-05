import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as SQLite from 'expo-sqlite';
import { AppState, type AppStateStatus } from 'react-native';
import {
  HubConnectionBuilder,
  HubConnectionState,
  HttpTransportType,
  LogLevel,
  type HubConnection,
  type IRetryPolicy,
  type RetryContext,
} from '@microsoft/signalr';
import { MessagePackHubProtocol } from '@microsoft/signalr-protocol-msgpack';

import type {
  AppLifecycle,
  AppLifecycleState,
  CredentialStore,
  HttpRequest,
  HttpResponse,
  HttpTransport,
  KeyValueStore,
  SignalRTransport,
  PasswordHasher,
  Unsubscribe,
} from '@novella/platform-contracts';

import { SERVICE_ENDPOINTS } from '@novella/api-client';
import { AUTH_CREDENTIAL_KEYS } from '@novella/client-core';

const BACKEND_HOST = 'api.lightnovel.life';
const REQUEST_TIMEOUT_MS = 30_000;
const VISITOR_ID_KEY = 'novella.visitor-id';
type SignalREventListener = (payload: unknown) => void;

const SIGNALR_RETRY_POLICY: IRetryPolicy = Object.freeze({
  nextRetryDelayInMilliseconds({ previousRetryCount }: RetryContext) {
    return [0, 5_000, 10_000, 20_000][previousRetryCount] ?? 30_000;
  },
});

export class ExpoCredentialStore implements CredentialStore {
  get(key: string): Promise<string | null> {
    return SecureStore.getItemAsync(key);
  }

  set(key: string, value: string): Promise<void> {
    return SecureStore.setItemAsync(key, value);
  }

  delete(key: string): Promise<void> {
    return SecureStore.deleteItemAsync(key);
  }
}

class ExpoKeyValueStore implements KeyValueStore {
  readonly #database = SQLite.openDatabaseAsync('novella.db');
  readonly #initialized: Promise<void>;

  constructor() {
    this.#initialized = this.#database.then((database) =>
      database.execAsync(
        'CREATE TABLE IF NOT EXISTS key_value (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL)',
      ),
    );
  }

  async get(key: string): Promise<string | null> {
    await this.#initialized;
    const database = await this.#database;
    const row = await database.getFirstAsync<{ value: string }>(
      'SELECT value FROM key_value WHERE key = ?',
      key,
    );
    return row?.value ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    await this.#initialized;
    const database = await this.#database;
    await database.runAsync(
      'INSERT OR REPLACE INTO key_value (key, value) VALUES (?, ?)',
      key,
      value,
    );
  }

  async delete(key: string): Promise<void> {
    await this.#initialized;
    const database = await this.#database;
    await database.runAsync('DELETE FROM key_value WHERE key = ?', key);
  }
}

export class ExpoRequestIdentity {
  readonly #credentials: CredentialStore;
  #valuePromise: Promise<string> | null = null;

  constructor(credentials: CredentialStore) {
    this.#credentials = credentials;
  }

  getValue(): Promise<string> {
    if (this.#valuePromise) return this.#valuePromise;
    const valuePromise = this.#loadOrCreate().catch((error: unknown) => {
      if (this.#valuePromise === valuePromise) this.#valuePromise = null;
      throw error;
    });
    this.#valuePromise = valuePromise;
    return valuePromise;
  }

  async #loadOrCreate(): Promise<string> {
    const existing = await this.#credentials.get(VISITOR_ID_KEY);
    if (existing) return existing;
    const generated = Crypto.randomUUID();
    await this.#credentials.set(VISITOR_ID_KEY, generated);
    return generated;
  }
}

export class ExpoHttpTransport implements HttpTransport {
  readonly #credentials: CredentialStore;
  readonly #identity: ExpoRequestIdentity;
  readonly #userAgent: string;

  constructor(
    credentials: CredentialStore,
    identity = new ExpoRequestIdentity(credentials),
    userAgent = getBackendUserAgent(),
  ) {
    this.#credentials = credentials;
    this.#identity = identity;
    this.#userAgent = userAgent;
  }

  async request<T>(request: HttpRequest): Promise<HttpResponse<T>> {
    const headers = new Headers(request.headers);
    headers.set('Accept', 'application/json');
    headers.set('Content-Type', 'application/json');

    if (shouldAttachBackendIdentity(request.url)) {
      headers.set('User-Agent', this.#userAgent);
      headers.set('x-id', await this.#identity.getValue());
      const token = await this.#credentials.get(SESSION_TOKEN_KEY);
      if (token) headers.set('Authorization', `Bearer ${token}`);
    }

    const requestTimeout = createRequestTimeout(request.signal);
    let response: Response;
    try {
      response = await fetch(request.url, {
        method: request.method,
        headers,
        signal: requestTimeout.signal,
        ...(request.body === undefined
          ? {}
          : { body: typeof request.body === 'string' ? request.body : JSON.stringify(request.body) }),
      });
    } finally {
      requestTimeout.dispose();
    }

    const body = (request.responseType === 'text'
      ? await response.text()
      : await response.json().catch(() => undefined)) as T;
    return {
      body,
      headers: Object.fromEntries(response.headers.entries()),
      status: response.status,
    };
  }
}

export class ExpoSignalRTransport implements SignalRTransport {
  readonly #credentials: CredentialStore;
  readonly #endpoint: string;
  readonly #identity: ExpoRequestIdentity;
  readonly #userAgent: string;
  #connection: HubConnection | null = null;
  #connectionPromise: Promise<HubConnection> | null = null;
  #reconnectPromise: Promise<void> | null = null;
  #releaseReconnect: (() => void) | null = null;
  #startPromise: Promise<void> | null = null;
  #stopPromise: Promise<void> | null = null;
  #generation = 0;
  #desiredConnected = false;
  readonly #eventListeners = new Map<string, Set<SignalREventListener>>();

  constructor(
    credentials: CredentialStore,
    identity = new ExpoRequestIdentity(credentials),
    endpoint = SERVICE_ENDPOINTS.signalRHub,
    userAgent = getBackendUserAgent(),
  ) {
    this.#credentials = credentials;
    this.#identity = identity;
    this.#endpoint = endpoint;
    this.#userAgent = userAgent;
  }

  async connect(): Promise<void> {
    this.#desiredConnected = true;
    const generation = this.#generation;
    if (this.#stopPromise) await this.#stopPromise;
    this.#assertConnectionAttempt(generation);
    const connection = await this.#getConnection();
    this.#assertConnectionAttempt(generation);

    if (connection.state === HubConnectionState.Connected) return;
    if (connection.state === HubConnectionState.Reconnecting) {
      await this.#waitForReconnect();
      this.#assertConnectionAttempt(generation);
      if (isHubConnected(connection)) return;
    }
    if (this.#startPromise) {
      await this.#startPromise;
      this.#assertConnectionAttempt(generation);
      return;
    }
    if (connection.state !== HubConnectionState.Disconnected) {
      throw new Error(`SignalR cannot start while ${connection.state}.`);
    }

    const startPromise = this.#startWithTimeout(connection, generation).finally(() => {
      if (this.#startPromise === startPromise) this.#startPromise = null;
    });
    this.#startPromise = startPromise;
    return startPromise;
  }

  async invoke<T>(methodName: string, args: readonly unknown[]): Promise<T> {
    await this.connect();
    const connection = await this.#getConnection();
    return connection.invoke<T>(methodName, ...args);
  }

  subscribe(methodName: string, listener: (payload: unknown) => void): Unsubscribe {
    let listeners = this.#eventListeners.get(methodName);
    if (!listeners) {
      listeners = new Set<SignalREventListener>();
      this.#eventListeners.set(methodName, listeners);
    }
    listeners.add(listener);
    this.#connection?.on(methodName, listener);

    return () => {
      const current = this.#eventListeners.get(methodName);
      if (!current?.delete(listener)) return;
      this.#connection?.off(methodName, listener);
      if (current.size === 0) this.#eventListeners.delete(methodName);
    };
  }

  close(): Promise<void> {
    this.#desiredConnected = false;
    this.#generation += 1;
    this.#releaseReconnectGate();
    if (this.#stopPromise) return this.#stopPromise;

    const stopPromise = (async () => {
      const connection = this.#connection ?? await this.#connectionPromise?.catch(() => null);
      if (connection && connection.state !== HubConnectionState.Disconnected) {
        await connection.stop();
      }
      this.#releaseReconnectGate();
    })().finally(() => {
      if (this.#stopPromise === stopPromise) this.#stopPromise = null;
    });
    this.#stopPromise = stopPromise;
    return stopPromise;
  }

  async #startWithTimeout(
    connection: HubConnection,
    generation: number,
  ): Promise<void> {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const timeoutPromise = new Promise<void>((_, reject) => {
      timeout = setTimeout(() => {
        if (this.#desiredConnected && generation === this.#generation) {
          void this.close().catch(() => undefined);
        }
        reject(new Error('SignalR connection timed out.'));
      }, REQUEST_TIMEOUT_MS);
    });

    try {
      await Promise.race([connection.start(), timeoutPromise]);
      this.#assertConnectionAttempt(generation);
    } finally {
      if (timeout !== null) clearTimeout(timeout);
    }
  }

  #assertConnectionAttempt(generation: number): void {
    if (!this.#desiredConnected || generation !== this.#generation) {
      throw new Error('SignalR connection was cancelled.');
    }
  }

  async #getConnection(): Promise<HubConnection> {
    if (this.#connection) return this.#connection;
    if (this.#connectionPromise) return this.#connectionPromise;

    const connectionPromise = (async () => {
      const requestIdentity = await this.#identity.getValue();
      const connection = new HubConnectionBuilder()
        .withUrl(this.#endpoint, {
          accessTokenFactory: async () =>
            (await this.#credentials.get(SESSION_TOKEN_KEY)) ?? '',
          headers: {
            'User-Agent': this.#userAgent,
            'x-id': requestIdentity,
          },
          skipNegotiation: true,
          timeout: REQUEST_TIMEOUT_MS,
          transport: HttpTransportType.WebSockets,
        })
        .withAutomaticReconnect(SIGNALR_RETRY_POLICY)
        .withHubProtocol(new MessagePackHubProtocol())
        .configureLogging(LogLevel.Warning)
        .build();

      connection.serverTimeoutInMilliseconds = REQUEST_TIMEOUT_MS;
      connection.onreconnecting(() => this.#ensureReconnectGate());
      connection.onreconnected(() => this.#releaseReconnectGate());
      connection.onclose(() => this.#releaseReconnectGate());
      for (const [methodName, listeners] of this.#eventListeners) {
        for (const listener of listeners) connection.on(methodName, listener);
      }
      this.#connection = connection;
      return connection;
    })().finally(() => {
      if (this.#connectionPromise === connectionPromise) this.#connectionPromise = null;
    });

    this.#connectionPromise = connectionPromise;
    return connectionPromise;
  }

  #waitForReconnect(): Promise<void> {
    this.#ensureReconnectGate();
    return this.#reconnectPromise ?? Promise.resolve();
  }

  #ensureReconnectGate(): void {
    if (this.#reconnectPromise) return;
    this.#reconnectPromise = new Promise<void>((resolve) => {
      this.#releaseReconnect = resolve;
    });
  }

  #releaseReconnectGate(): void {
    this.#releaseReconnect?.();
    this.#releaseReconnect = null;
    this.#reconnectPromise = null;
  }
}

export class ExpoPasswordHasher implements PasswordHasher {
  sha256(value: string): Promise<string> {
    return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value);
  }
}

export class ExpoAppLifecycle implements AppLifecycle {
  getCurrentState(): AppLifecycleState {
    return toAppLifecycleState(AppState.currentState);
  }

  subscribe(listener: (state: AppLifecycleState) => void): Unsubscribe {
    let previous = this.getCurrentState();
    const subscription = AppState.addEventListener('change', (status) => {
      const next = toAppLifecycleState(status);
      if (next === previous) return;
      previous = next;
      listener(next);
    });
    return () => subscription.remove();
  }
}

export function createExpoStorage(): KeyValueStore {
  return new ExpoKeyValueStore();
}

export function getBackendUserAgent(): string {
  const appName = Constants.expoConfig?.name?.trim() || 'Novella';
  const normalizedName = appName.replace(/\s+/g, '-');
  const version = Constants.expoConfig?.version?.trim();
  return version ? `${normalizedName}/${version}` : normalizedName;
}

function createRequestTimeout(parentSignal?: AbortSignal): {
  signal: AbortSignal;
  dispose(): void;
} {
  const controller = new AbortController();
  const abortFromParent = () => controller.abort();
  if (parentSignal?.aborted) {
    controller.abort();
  } else {
    parentSignal?.addEventListener('abort', abortFromParent, { once: true });
  }
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  return {
    signal: controller.signal,
    dispose() {
      clearTimeout(timeout);
      parentSignal?.removeEventListener('abort', abortFromParent);
    },
  };
}

function isHubConnected(connection: HubConnection): boolean {
  return connection.state === HubConnectionState.Connected;
}

function shouldAttachBackendIdentity(url: string): boolean {
  try {
    return new URL(url).host === BACKEND_HOST;
  } catch {
    return true;
  }
}

function toAppLifecycleState(status: AppStateStatus): AppLifecycleState {
  return status === 'active' ? 'foreground' : 'background';
}

export const REFRESH_TOKEN_KEY = AUTH_CREDENTIAL_KEYS.refreshToken;
export const SESSION_TOKEN_KEY = AUTH_CREDENTIAL_KEYS.sessionToken;
