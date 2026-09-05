export type JsonPrimitive = boolean | null | number | string;
export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface Clock {
  now(): Date;
}

export interface KeyValueStore {
  delete(key: string): Promise<void>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

export interface CredentialStore {
  delete(key: string): Promise<void>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

export interface Sha256Hasher {
  sha256(value: string): Promise<string>;
}

export interface PasswordHasher extends Sha256Hasher {}

export interface HttpRequest {
  body?: JsonValue | string;
  headers?: Readonly<Record<string, string>>;
  method: 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT';
  responseType?: 'json' | 'text';
  signal?: AbortSignal;
  url: string;
}

export interface HttpResponse<T> {
  body: T;
  headers: Readonly<Record<string, string>>;
  status: number;
}

export interface HttpTransport {
  request<T>(request: HttpRequest): Promise<HttpResponse<T>>;
}

/**
 * Platform-neutral SignalR operation transport.
 *
 * The concrete connection belongs to the host application because token
 * storage, WebSocket availability, and lifecycle handling differ between
 * mobile and desktop.
 */
export interface SignalRTransport {
  connect(): Promise<void>;
  invoke<T>(methodName: string, args: readonly unknown[]): Promise<T>;
  subscribe(methodName: string, listener: (payload: unknown) => void): Unsubscribe;
  close(): Promise<void>;
}

export interface Logger {
  debug(message: string, metadata?: Readonly<Record<string, JsonPrimitive>>): void;
  error(message: string, metadata?: Readonly<Record<string, JsonPrimitive>>): void;
  info(message: string, metadata?: Readonly<Record<string, JsonPrimitive>>): void;
  warn(message: string, metadata?: Readonly<Record<string, JsonPrimitive>>): void;
}

export type Unsubscribe = () => void;
export type AppLifecycleState = 'foreground' | 'background';

export interface AppLifecycle {
  getCurrentState(): AppLifecycleState;
  subscribe(listener: (state: AppLifecycleState) => void): Unsubscribe;
}
