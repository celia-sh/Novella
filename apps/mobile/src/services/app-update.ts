const LATEST_RELEASE_URL =
  'https://api.github.com/repos/celia-sh/Novella/releases/latest';

const RELEASE_URL_PREFIX = '/celia-sh/Novella/releases/';
const VERSION_PATTERN =
  /^[vV]?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

interface ParsedVersion {
  core: readonly [number, number, number];
  prerelease: readonly (number | string)[];
}

interface LatestReleaseResponse {
  htmlUrl: string;
  version: string;
}

export type AppUpdateCheckResult =
  | {
      currentVersion: string;
      latestVersion: string;
      status: 'current';
    }
  | {
      currentVersion: string;
      latestVersion: string;
      releaseUrl: string;
      status: 'available';
    };

export async function checkForAppUpdate(
  currentVersion: string,
  options: {
    fetchImpl?: typeof fetch;
    signal?: AbortSignal;
  } = {},
): Promise<AppUpdateCheckResult> {
  const normalizedCurrentVersion = normalizeVersion(currentVersion);
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(LATEST_RELEASE_URL, {
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    ...(options.signal ? { signal: options.signal } : {}),
  });
  if (!response.ok) throw new Error(`GitHub release HTTP ${response.status}.`);

  const release = decodeLatestRelease(await response.json());
  const normalizedLatestVersion = normalizeVersion(release.version);
  if (compareAppVersions(normalizedCurrentVersion, normalizedLatestVersion) >= 0) {
    return {
      currentVersion: normalizedCurrentVersion,
      latestVersion: normalizedLatestVersion,
      status: 'current',
    };
  }
  return {
    currentVersion: normalizedCurrentVersion,
    latestVersion: normalizedLatestVersion,
    releaseUrl: release.htmlUrl,
    status: 'available',
  };
}

/** SemVer precedence; build metadata is intentionally ignored. */
export function compareAppVersions(left: string, right: string): -1 | 0 | 1 {
  const leftVersion = parseVersion(left);
  const rightVersion = parseVersion(right);
  for (let index = 0; index < leftVersion.core.length; index += 1) {
    const comparison = compareNumbers(
      leftVersion.core[index]!,
      rightVersion.core[index]!,
    );
    if (comparison !== 0) return comparison;
  }

  const leftPrerelease = leftVersion.prerelease;
  const rightPrerelease = rightVersion.prerelease;
  if (leftPrerelease.length === 0 && rightPrerelease.length === 0) return 0;
  if (leftPrerelease.length === 0) return 1;
  if (rightPrerelease.length === 0) return -1;

  const length = Math.max(leftPrerelease.length, rightPrerelease.length);
  for (let index = 0; index < length; index += 1) {
    const leftIdentifier = leftPrerelease[index];
    const rightIdentifier = rightPrerelease[index];
    if (leftIdentifier === undefined) return -1;
    if (rightIdentifier === undefined) return 1;
    if (leftIdentifier === rightIdentifier) continue;
    if (typeof leftIdentifier === 'number' && typeof rightIdentifier === 'number') {
      return compareNumbers(leftIdentifier, rightIdentifier);
    }
    if (typeof leftIdentifier === 'number') return -1;
    if (typeof rightIdentifier === 'number') return 1;
    return leftIdentifier < rightIdentifier ? -1 : 1;
  }
  return 0;
}

function decodeLatestRelease(value: unknown): LatestReleaseResponse {
  if (!isRecord(value)) throw new Error('Invalid GitHub release response.');
  const version = typeof value.tag_name === 'string' ? value.tag_name.trim() : '';
  const htmlUrl = typeof value.html_url === 'string' ? value.html_url.trim() : '';
  if (!version || !isRepositoryReleaseUrl(htmlUrl)) {
    throw new Error('Invalid GitHub release response.');
  }
  return { htmlUrl, version };
}

function normalizeVersion(version: string): string {
  const parsed = parseVersion(version);
  const core = parsed.core.join('.');
  return parsed.prerelease.length === 0
    ? core
    : `${core}-${parsed.prerelease.join('.')}`;
}

function parseVersion(version: string): ParsedVersion {
  const match = version.trim().match(VERSION_PATTERN);
  if (!match) throw new Error(`Invalid app version: ${version}.`);
  const core = [Number(match[1]), Number(match[2]), Number(match[3])] as const;
  if (core.some((part) => !Number.isSafeInteger(part))) {
    throw new Error(`Invalid app version: ${version}.`);
  }
  const prerelease = match[4]
    ? match[4].split('.').map((identifier): number | string => {
        if (!/^\d+$/.test(identifier)) return identifier;
        if (identifier.length > 1 && identifier.startsWith('0')) {
          throw new Error(`Invalid app version: ${version}.`);
        }
        const number = Number(identifier);
        if (!Number.isSafeInteger(number)) {
          throw new Error(`Invalid app version: ${version}.`);
        }
        return number;
      })
    : [];
  return { core, prerelease };
}

function isRepositoryReleaseUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:'
      && url.hostname === 'github.com'
      && url.pathname.startsWith(RELEASE_URL_PREFIX);
  } catch {
    return false;
  }
}

function compareNumbers(left: number, right: number): -1 | 0 | 1 {
  return left === right ? 0 : left < right ? -1 : 1;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
