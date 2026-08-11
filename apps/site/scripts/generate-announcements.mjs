import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join, basename, extname } from 'node:path';

const announcementsDirectory = 'public/assets/announcements';
const outputPath = join(announcementsDirectory, 'index.json');
const entries = [];

for (const fileName of (await readdir(announcementsDirectory)).filter((name) => name.endsWith('.md'))) {
  const filePath = join(announcementsDirectory, fileName);
  const source = await readFile(filePath, 'utf8');
  const { metadata, body } = parseFrontMatter(source);
  const id = metadata.id || basename(fileName, extname(fileName));
  const title = metadata.title || extractTitle(body);
  const publishedAt = resolvePublishedAt(metadata.publishedAt, fileName);

  if (!title) throw new Error(`Announcement ${filePath} must define title or a level-one heading.`);
  if (!publishedAt) throw new Error(`Announcement ${filePath} must define publishedAt or include YYYY-MM-DD in its filename.`);

  entries.push({
    id,
    path: `assets/announcements/${fileName}`,
    publishedAt,
    summary: metadata.summary || extractSummary(body),
    title,
  });
}

entries.sort((left, right) => right.publishedAt.localeCompare(left.publishedAt));
await mkdir(announcementsDirectory, { recursive: true });
await writeFile(outputPath, `${JSON.stringify({ version: 1, announcements: entries }, null, 2)}\n`, 'utf8');
console.log(`Generated ${entries.length} announcement(s) -> ${outputPath}`);

function parseFrontMatter(source) {
  const normalized = source.replaceAll('\r\n', '\n');
  const lines = normalized.split('\n');
  if (lines[0]?.trim() !== '---') return { body: normalized, metadata: {} };
  const closingIndex = lines.slice(1).findIndex((line) => line.trim() === '---');
  if (closingIndex === -1) throw new Error('Announcement front matter is missing a closing --- line.');
  const metadata = {};
  for (const line of lines.slice(1, closingIndex + 1)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf(':');
    if (separator <= 0) throw new Error(`Invalid announcement front matter line: ${line}`);
    metadata[trimmed.slice(0, separator).trim()] = unquote(trimmed.slice(separator + 1).trim());
  }
  return { body: lines.slice(closingIndex + 2).join('\n'), metadata };
}

function unquote(value) {
  return value.length >= 2 && ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
    ? value.slice(1, -1)
    : value;
}

function extractTitle(body) {
  return body.split('\n').map((line) => line.match(/^\s*#\s+(.+)$/)?.[1]?.trim()).find(Boolean) || '';
}

function extractSummary(body) {
  for (const line of body.split('\n')) {
    if (/^\s{0,3}#{1,6}\s+/.test(line)) continue;
    const cleaned = line.replace(/^\s*[-*+]\s+/, '').replace(/[`*_~]/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').trim();
    if (cleaned) return cleaned.length > 80 ? `${cleaned.slice(0, 80)}...` : cleaned;
  }
  return '';
}

function resolvePublishedAt(value, fileName) {
  if (value) {
    const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00Z`) : new Date(value);
    if (Number.isNaN(date.valueOf())) throw new Error(`Invalid announcement publishedAt: ${value}`);
    return date.toISOString();
  }
  const match = fileName.match(/(20\d{2}-\d{2}-\d{2})/);
  return match ? `${match[1]}T00:00:00.000Z` : null;
}
