export const APP_ANNOUNCEMENT_MANIFEST_URL =
  'https://novella.celia.sh/assets/announcements/index.json';

export interface AppAnnouncement {
  contentUrl: string;
  id: string;
  publishedAt: string;
  summary: string;
  title: string;
}

export interface AppAnnouncementDetail {
  announcement: AppAnnouncement;
  markdown: string;
}

export async function loadAppAnnouncements(
  signal?: AbortSignal,
): Promise<AppAnnouncement[]> {
  const response = await fetch(APP_ANNOUNCEMENT_MANIFEST_URL, {
    headers: { Accept: 'application/json' },
    ...(signal ? { signal } : {}),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const source = await response.text();
  let decoded: unknown;
  try {
    decoded = JSON.parse(source);
  } catch {
    throw new Error('Invalid announcement manifest.');
  }
  return decodeAppAnnouncementManifest(decoded);
}

export async function loadAppAnnouncementDetail(
  id: string,
  signal?: AbortSignal,
): Promise<AppAnnouncementDetail> {
  const announcements = await loadAppAnnouncements(signal);
  const announcement = announcements.find((item) => item.id === id);
  if (!announcement) throw new Error('Announcement not found.');

  const response = await fetch(announcement.contentUrl, {
    headers: { Accept: 'text/markdown, text/plain' },
    ...(signal ? { signal } : {}),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  return {
    announcement,
    markdown: stripMarkdownFrontMatter(await response.text()),
  };
}

export function decodeAppAnnouncementManifest(value: unknown): AppAnnouncement[] {
  if (!isRecord(value) || !Array.isArray(value.announcements)) {
    throw new Error('Invalid announcement manifest.');
  }

  return value.announcements.flatMap((candidate) => {
    if (!isRecord(candidate)) return [];
    const id = getTrimmedString(candidate.id);
    const title = getTrimmedString(candidate.title);
    const path = getTrimmedString(candidate.path);
    const publishedAt = getTrimmedString(candidate.publishedAt);
    if (
      !id
      || !title
      || !path
      || !publishedAt
      || !Number.isFinite(Date.parse(publishedAt))
    ) {
      return [];
    }

    const contentUrl = resolveAppAnnouncementContentUrl(path);
    if (!contentUrl) return [];
    return [{
      contentUrl,
      id,
      publishedAt,
      summary: getTrimmedString(candidate.summary) ?? '',
      title,
    }];
  });
}

export function resolveAppAnnouncementContentUrl(path: string): string | null {
  try {
    const manifestUrl = new URL(APP_ANNOUNCEMENT_MANIFEST_URL);
    const parsed = new URL(path, `${manifestUrl.origin}/`);
    return parsed.protocol === 'https:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export function stripMarkdownFrontMatter(source: string): string {
  const normalized = source.replaceAll('\r\n', '\n');
  const lines = normalized.split('\n');
  if (lines[0]?.trim() !== '---') return source;

  const closingIndex = lines.slice(1).findIndex((line) => line.trim() === '---');
  if (closingIndex < 0) return source;
  return lines.slice(closingIndex + 2).join('\n').trimStart();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getTrimmedString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
