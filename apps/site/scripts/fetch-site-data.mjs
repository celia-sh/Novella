import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const repositorySlug = process.env.GITHUB_REPOSITORY || 'celia-sh/Novella';
const outputPath = process.env.SITE_DATA_OUTPUT || 'public/site_data.json';
const token = process.env.GITHUB_TOKEN;
const headers = {
  Accept: 'application/vnd.github+json',
  'User-Agent': 'novella-site-builder',
  'X-GitHub-Api-Version': '2022-11-28',
};

if (token) headers.Authorization = `Bearer ${token}`;

const repository = await github(`/repos/${repositorySlug}`);
const release = await github(`/repos/${repositorySlug}/releases/latest`);
const contributors = await github(`/repos/${repositorySlug}/contributors?per_page=100`);

const bodyMarkdown = typeof release.body === 'string' ? release.body : '';
const releaseDate = release.published_at || release.created_at;
// Keep the complete release asset classification for historical metadata. The
// download page intentionally selects only the iOS asset for the current app.
const assets = Array.isArray(release.assets)
  ? release.assets.map((asset) => ({
      contentType: stringValue(asset.content_type),
      downloadCount: numberValue(asset.download_count),
      name: stringValue(asset.name),
      platform: detectReleasePlatform(asset.name, asset.browser_download_url),
      size: numberValue(asset.size),
      updatedAt: asset.updated_at || releaseDate,
      url: stringValue(asset.browser_download_url),
    }))
  : [];

const siteData = {
  repository: {
    description: stringValue(repository.description) || 'Novella 开源轻小说阅读器。',
    forks: numberValue(repository.forks_count),
    fullName: stringValue(repository.full_name) || repositorySlug,
    name: stringValue(repository.name),
    openIssues: numberValue(repository.open_issues_count),
    owner: stringValue(repository.owner?.login),
    stars: numberValue(repository.stargazers_count),
    url: stringValue(repository.html_url) || `https://github.com/${repositorySlug}`,
    watchers: numberValue(repository.subscribers_count || repository.watchers_count),
  },
  latestRelease: {
    assets,
    bodyMarkdown,
    excerpt: extractExcerpt(bodyMarkdown) || '最新版本已经发布，可直接从官网或 GitHub Release 下载。',
    name: stringValue(release.name) || stringValue(release.tag_name) || 'Latest Release',
    publishedAt: releaseDate,
    tagName: stringValue(release.tag_name) || 'latest',
    url: stringValue(release.html_url),
  },
  contributors: Array.isArray(contributors)
    ? contributors
        .filter((item) => item?.type === 'User' && stringValue(item.login))
        .map((item) => ({
          avatarUrl: stringValue(item.avatar_url),
          contributions: numberValue(item.contributions),
          login: stringValue(item.login),
          profileUrl: stringValue(item.html_url),
        }))
    : [],
  generatedAt: new Date().toISOString(),
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(siteData, null, 2)}\n`, 'utf8');
console.log(`Fetched release data for ${repositorySlug} -> ${outputPath}`);

async function github(path) {
  const response = await fetch(`https://api.github.com${path}`, { headers });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`GitHub API request failed (${response.status}) for ${path}: ${body}`);
  }
  return JSON.parse(body);
}

function stringValue(value) {
  return typeof value === 'string' ? value : '';
}

function numberValue(value) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : 0;
}

function detectReleasePlatform(name, url = '') {
  const haystack = `${name || ''} ${url || ''}`.toLowerCase();
  if (haystack.includes('.apk') || haystack.includes('android')) return 'android';
  if (haystack.includes('.ipa') || haystack.includes('ios')) return 'ios';
  if (/\.exe|\.msi|\.msix|windows|win64|win32/.test(haystack)) return 'windows';
  if (/\.dmg|\.pkg|macos|darwin|osx/.test(haystack)) return 'macos';
  if (/\.appimage|\.deb|\.rpm|linux/.test(haystack)) return 'linux';
  return 'other';
}

function extractExcerpt(markdown) {
  for (const line of markdown.split('\n').map((item) => item.trim()).filter(Boolean)) {
    const cleaned = line
      .replace(/^[#>*\-\d.\s]+/, '')
      .replace(/[`*_~\[\]()!]/g, '')
      .trim();
    if (cleaned.length >= 8 && !/^(what'?s changed|update|updates)$/i.test(cleaned)) {
      return cleaned;
    }
  }
  return '';
}
