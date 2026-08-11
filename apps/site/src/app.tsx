import { useEffect, useState } from 'react';

type Page = 'home' | 'download';
type ReleasePlatform = 'android' | 'windows' | 'macos' | 'linux' | 'ios' | 'other';

interface ReleaseAsset {
  contentType: string;
  downloadCount: number;
  name: string;
  platform: ReleasePlatform;
  size: number;
  updatedAt: string;
  url: string;
}

interface SiteData {
  contributors: Array<{
    avatarUrl: string;
    contributions: number;
    login: string;
    profileUrl: string;
  }>;
  generatedAt: string;
  latestRelease: {
    assets: ReleaseAsset[];
    bodyMarkdown: string;
    excerpt: string;
    name: string;
    publishedAt: string;
    tagName: string;
    url: string;
  };
  repository: {
    description: string;
    forks: number;
    fullName: string;
    name: string;
    openIssues: number;
    owner: string;
    stars: number;
    url: string;
    watchers: number;
  };
}

const repositoryFallback = 'https://github.com/celia-sh/Novella';
const pages: ReadonlyArray<{ id: Page; label: string }> = [
  { id: 'home', label: 'Home' },
  { id: 'download', label: 'Download' },
];

export function App() {
  const [page, setPage] = useState<Page>(() => pageFromPath(window.location.pathname));
  const [siteData, setSiteData] = useState<SiteData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sourcesOpen, setSourcesOpen] = useState(false);

  useEffect(() => {
    fetch(siteAsset('site_data.json'))
      .then(async (response) => {
        if (!response.ok) throw new Error(`site_data.json (${response.status})`);
        return response.json() as Promise<SiteData>;
      })
      .then(setSiteData)
      .catch((error: unknown) => {
        setLoadError(error instanceof Error ? error.message : 'site data unavailable');
      });
  }, []);

  useEffect(() => {
    const handlePopState = () => setPage(pageFromPath(window.location.pathname));
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    if (sourcesOpen) document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [sourcesOpen]);

  const navigate = (nextPage: Page) => {
    const path = nextPage === 'home' ? '/' : `/${nextPage}`;
    window.history.pushState({}, '', path);
    setPage(nextPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="site-shell">
      <header className="site-header">
        <div className="site-header-inner">
          <button className="brand" type="button" onClick={() => navigate('home')}>
            <img src={siteAsset('assets/brand/Novella.svg')} alt="" />
            <span>Novella</span>
          </button>
          <nav aria-label="主导航">
            {pages.map((item) => (
              <button
                className={item.id === page ? 'nav-link active' : 'nav-link'}
                key={item.id}
                type="button"
                onClick={() => navigate(item.id)}
              >
                {item.label}
              </button>
            ))}
          </nav>
          <a className="github-link" href={siteData?.repository.url || repositoryFallback} target="_blank" rel="noreferrer" aria-label="Open Novella on GitHub">
            <svg className="github-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" /></svg>
            <span>{formatCompactNumber(siteData?.repository.stars || 0)}</span>
          </a>
        </div>
      </header>

      <main>
        {loadError && !siteData ? <SiteDataError message={loadError} /> : null}
        {!siteData && !loadError ? <LoadingState /> : null}
        {siteData && page === 'home' ? (
          <HomePage siteData={siteData} onNavigate={navigate} />
        ) : null}
        {siteData && page === 'download' ? <DownloadPage siteData={siteData} onOpenSources={() => setSourcesOpen(true)} /> : null}
      </main>

      <footer className="site-footer">
        <div className="site-footer-inner">
          <div className="footer-copy">
            <strong>Novella</strong>
            <p>开源小说阅读器，轻书架第三方客户端。<br />网页通过 Cloudflare Pages 发布。</p>
          </div>
          <div className="footer-right">
            <div className="footer-links">
              <a href={siteData?.repository.url || repositoryFallback} target="_blank" rel="noreferrer">GitHub</a>
              <a href={`${siteData?.repository.url || repositoryFallback}/releases`} target="_blank" rel="noreferrer">Changelogs</a>
              <a href={`${siteData?.repository.url || repositoryFallback}/discussions`} target="_blank" rel="noreferrer">Discussions</a>
              <a href="https://www.lightnovel.app" target="_blank" rel="noreferrer">LightNovelShelf</a>
            </div>
          </div>
        </div>
      </footer>

      {sourcesOpen ? <AppSourcesModal onClose={() => setSourcesOpen(false)} /> : null}
    </div>
  );
}

function HomePage({
  onNavigate,
  siteData,
}: {
  onNavigate: (page: Page) => void;
  siteData: SiteData;
}) {
  const featured = featuredAssets(siteData.latestRelease.assets);
  const platforms = featured.length > 0 ? featured.slice(0, 4).map((asset) => platformLabel(asset.platform)) : ['Android', 'iOS'];

  return (
    <>
      <section className="hero-band">
        <div className="hero-copy">
          <div className="pill-row"><span className="pill">Open Source</span><span className="pill">AGPL-3.0</span></div>
          <h1><span className="accent">Novella,</span><br /><span className="hero-subtitle">为轻书架而作。</span></h1>
          <div className="platform-row"><span className="platform-label">AVAILABLE ON</span>{platforms.map((platform) => <span className="platform-pill" key={platform}>{platform}</span>)}</div>
          <p className="hero-description">轻书架第三方客户端，提供高度个性化的阅读体验。</p>
          <div className="hero-actions">
            <button className="button primary" type="button" onClick={() => onNavigate('download')}>立即下载</button>
            <a className="button secondary" href={siteData.repository.url} target="_blank" rel="noreferrer">查看源代码</a>
          </div>
        </div>
        <div className="hero-visual">
          <img src={siteAsset('assets/screenshots/Novella_hero.png')} alt="Novella app preview" />
        </div>
      </section>

      <section className="feature-band content-band">
        <div className="feature-grid">
          <Feature index="01" title="沉浸式阅读体验" detail="支持字号、行间距和背景色调节，为长时间阅读场景而设计。" />
          <Feature index="02" title="动态主题" detail="适配浅色、深色与纯黑模式，详情页支持从封面提取主色调。" />
          <Feature index="03" title="跨设备同步" detail="书架、阅读进度和状态标记在设备间同步，随时继续阅读。" />
        </div>
      </section>

      <section className="contributor-band content-band">
        <div className="section-heading centered"><span className="eyebrow">CONTRIBUTORS</span><h2>开源贡献者</h2><p>感谢每一位为 Novella 贡献代码的开发者。</p></div>
        <div className="contributor-grid">
          {siteData.contributors.length === 0 ? <div className="empty-state">暂无贡献者数据。</div> : siteData.contributors.map((contributor) => (
            <a className="contributor" href={contributor.profileUrl} target="_blank" rel="noreferrer" key={contributor.login}>
              <img src={contributor.avatarUrl} alt={contributor.login} loading="lazy" />
              <span><strong>{contributor.login}</strong><small>{contributor.contributions} commits</small></span>
            </a>
          ))}
        </div>
      </section>
    </>
  );
}

function DownloadPage({ onOpenSources, siteData }: { onOpenSources: () => void; siteData: SiteData }) {
  const android = assetForPlatform(siteData.latestRelease.assets, 'android');
  const ios = assetForPlatform(siteData.latestRelease.assets, 'ios');
  const version = siteData.latestRelease.tagName.toUpperCase();

  return (
    <section className="download-page content-band">
      <div className="download-heading">
        <div>
          <span className="download-kicker"><span className="download-kicker-mark" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 2 13.8 10.2 22 12l-8.2 1.8L12 22l-1.8-8.2L2 12l8.2-1.8L12 2Z" /></svg></span> Downloads</span>
          <h1>Start Reading with Novella</h1>
        </div>
        <button className="sideload-button" type="button" onClick={onOpenSources}><span aria-hidden="true">↯</span> OR Sideload</button>
      </div>

      <div className="download-cards">
        <DownloadCard
          asset={android}
          className="download-card--android"
          image="assets/screenshots/Novella_reader.png"
          label="For Android"
          meta=".APK"
          statLabel="下载次数"
          statValue={android ? formatDownloadCount(android.downloadCount) : '—'}
          title="Android"
        />
        <DownloadCard
          className="download-card--reader"
          href={siteData.latestRelease.url}
          label="Latest Release"
          meta="GitHub"
          statLabel="当前版本"
          statValue={version}
          title="Powerful Reader"
        />
        <DownloadCard
          asset={ios}
          className="download-card--ios"
          image="assets/screenshots/Novella_hero.png"
          label="For iOS"
          meta=".IPA"
          statLabel="下载次数"
          statValue={ios ? formatDownloadCount(ios.downloadCount) : '—'}
          title="iOS"
        />
      </div>

    </section>
  );
}

function AppSourcesModal({ onClose }: { onClose: () => void }) {
  const repositoryUrl = new URL(siteAsset('repository.json'), window.location.href).toString();
  const targets = [
    { id: 'altstore', title: 'AltStore', description: 'Alternative app store for non-jailbroken iOS devices.', href: `altstore-classic://source?url=${repositoryUrl}`, icon: 'assets/sideloaders/altstore.png' },
    { id: 'sidestore', title: 'SideStore', description: "A fork of AltStore that doesn't require an AltServer.", href: `sidestore://source?url=${repositoryUrl}`, icon: 'assets/sideloaders/sidestore.png' },
    { id: 'feather', title: 'Feather', description: 'On-device iOS installer using Apple Developer certificates.', href: `feather://source/${repositoryUrl}`, icon: 'assets/sideloaders/feather.png' },
  ];
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div className="sources-modal" role="dialog" aria-modal="true" aria-labelledby="app-sources-title"><div className="modal-header"><div><h2 id="app-sources-title">添加 App Source</h2><p>选择侧载工具，自动导入源。</p></div><button className="icon-button" type="button" aria-label="关闭" onClick={onClose}>×</button></div><div className="source-list">{targets.map((target) => <a className="source-target" href={target.href} data-app-source-target={target.id} key={target.id}><img src={siteAsset(target.icon)} alt="" /><span><strong>{target.title}</strong><small>{target.description}</small></span><b aria-hidden="true">→</b></a>)}</div><div className="source-url"><code>{repositoryUrl}</code><a href={repositoryUrl}>打开</a></div></div></div>;
}

function DownloadCard({ asset, className, href, image, label, meta, statLabel, statValue, title }: { asset?: ReleaseAsset | undefined; className: string; href?: string; image?: string | undefined; label: string; meta: string; statLabel: string; statValue: string; title: string }) {
  const target = href || asset?.url || '#';
  return (
    <article className={`download-card ${className}`}>
      {image ? <img className="download-card-image" src={siteAsset(image)} alt="" aria-hidden="true" /> : null}
      <div className="download-card-shade" aria-hidden="true" />
      <div className="download-card-content">
        <div className="download-stat"><strong>{statValue}</strong><span>{statLabel}</span></div>
        <div className="download-card-title">
          {image ? <span>{title}</span> : <span className="download-update-icon" aria-hidden="true" />}
        </div>
        <div className="download-card-footer"><div><span>{label}</span><strong>{meta}</strong></div><a className="download-card-link" href={target} target="_blank" rel="noreferrer" aria-label={`Download ${label}`}>↗</a></div>
      </div>
    </article>
  );
}

function Feature({ detail, index, title }: { detail: string; index: string; title: string }) {
  return <article className="feature-item"><span className="feature-number">{index}</span><h3>{title}</h3><p>{detail}</p></article>;
}

function LoadingState() { return <div className="page-state"><span className="eyebrow">NOVELLA</span><p>正在加载站点数据…</p></div>; }
function SiteDataError({ message }: { message: string }) { return <div className="page-state"><span className="eyebrow">SITE DATA</span><h1>站点数据暂不可用</h1><p>构建时数据文件缺失或无法读取：{message}</p></div>; }

function pageFromPath(pathname: string): Page {
  if (pathname === '/download') return 'download';
  return 'home';
}

function siteAsset(path: string) {
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`;
}

function featuredAssets(assets: ReleaseAsset[]) {
  const order: ReleasePlatform[] = ['android', 'windows', 'macos', 'linux', 'ios', 'other'];
  const picked = new Map<ReleasePlatform, ReleaseAsset>();
  for (const asset of assets) if (!picked.has(asset.platform)) picked.set(asset.platform, asset);
  return order.flatMap((platform) => picked.get(platform) ? [picked.get(platform)!] : []);
}

function assetForPlatform(assets: ReleaseAsset[], platform: ReleasePlatform) {
  return assets.find((asset) => asset.platform === platform);
}

function platformLabel(platform: ReleasePlatform) {
  return { android: 'Android', windows: 'Windows', macos: 'macOS', linux: 'Linux', ios: 'iOS', other: '其他文件' }[platform];
}

function formatCompactNumber(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
  if (value >= 10_000) return `${(value / 10_000).toFixed(value >= 100_000 ? 0 : 1)} 万`;
  return String(value);
}

function formatDownloadCount(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}
