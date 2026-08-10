/**
 * Builds the XHTML chapter document that Novella renders inside a plain
 * react-native-webview (WKWebView / Android WebView). The page is
 * a normal browser document, so CSS layout, HTML entities, fonts and the
 * footnote layer behave exactly like the web master.
 *
 * The book-level font (one font per book on the backend) is embedded as a
 * base64 WOFF2 data URL inside the document's `@font-face`, so both platforms
 * resolve it without CORS or asset-serving constraints. All theme knobs are
 * exposed as CSS custom properties so the native side can switch themes by
 * injecting JS (setProperty) instead of reloading the page (which would lose
 * the scroll position).
 *
 * Two reading modes:
 * - `scroll`: the document flows normally, vertical scrolling.
 * - `paged`: the document is laid out in CSS columns (one column per screen),
 *   inside a horizontally scrollable sheet. Columns preserve the exact same
 *   typography as scroll mode (no DOM restructuring), so there is no layout
 *   divergence between modes.
 */

export const NOVELLA_CHAPTER_FONT_FAMILY = 'NovellaChapterFont';

export function chapterHrefFor(chapterId: number): string {
  return `chapters/${chapterId}.xhtml`;
}

export type ChapterReadingMode = 'scroll' | 'paged';

export interface ChapterXhtmlOptions {
  /** base64 data URL of the book font (WOFF2 from the shared font cache). */
  fontDataUrl?: string | null;
  /** Chapter images with relative URLs are rebased onto the API origin. */
  imageBaseUrl?: string | null;
  /** Reader theme: page background (hex). */
  backgroundColor?: string;
  /** Reader theme: text color (hex). */
  textColor?: string;
  /** Body font size in px. */
  fontSize?: number;
  /** Body line height in px. */
  lineHeight?: number;
  /** Content top padding (floating toolbar clearance) in px. */
  topPadding?: number;
  /** Content bottom padding in px. */
  bottomPadding?: number;
  /** Horizontal content padding in px (readerSidePadding). */
  sidePadding?: number;
  /** Indent the first line of every paragraph (readerFirstLineIndent). */
  firstLineIndent?: boolean;
  /** Layout mode: vertical scroll or CSS-column paging. */
  readingMode?: ChapterReadingMode;
  /** Enable native full-screen image previews. */
  imagePreviewEnabled?: boolean;
  /** Open enabled image previews with a long press instead of a tap. */
  imagePreviewOpenOnLongPress?: boolean;
  /** Paged mode: snap page turns instantly instead of animating. */
  pagedNoAnimation?: boolean;
}

const IMAGE_SRC_PATTERN = /(<img\b[^>]*\bsrc=)("|')(?![a-z][a-z0-9+.-]*:|#|\/\/)([^"']*)\2/gi;

export function buildChapterXhtml(
  chapterHtml: string,
  options: ChapterXhtmlOptions = {},
): string {
  let body = chapterHtml;
  if (options.imageBaseUrl) {
    body = body.replace(IMAGE_SRC_PATTERN, (_match, prefix, quote, src) => {
      const rebased = `${options.imageBaseUrl}${src.startsWith('/') ? '' : '/'}${src}`;
      return `${prefix}${quote}${rebased}${quote}`;
    });
  }

  const fontFace = options.fontDataUrl
    ? `<style>@font-face{font-family:'${NOVELLA_CHAPTER_FONT_FAMILY}';font-display:block;src:url(${options.fontDataUrl});}</style>`
    : '';
  const fontFamily = options.fontDataUrl
    ? `'${NOVELLA_CHAPTER_FONT_FAMILY}', -apple-system, 'PingFang SC', 'Noto Sans SC', sans-serif`
    : `-apple-system, 'PingFang SC', 'Noto Sans SC', sans-serif`;

  const backgroundColor = options.backgroundColor ?? '#F2F2F7';
  const textColor = options.textColor ?? '#111827';
  const fontSize = options.fontSize ?? 16;
  const lineHeight = options.lineHeight ?? fontSize * 1.6;
  const topPadding = options.topPadding ?? 0;
  const bottomPadding = options.bottomPadding ?? 0;
  const sidePadding = options.sidePadding ?? 16;
  const firstLineIndent = options.firstLineIndent ?? false;
  const readingMode: ChapterReadingMode = options.readingMode ?? 'scroll';
  const isPaged = readingMode === 'paged';
  const imagePreviewEnabled = options.imagePreviewEnabled ?? false;
  // Preserve the original imagePreviewEnabled=true behavior for callers that
  // have not adopted the explicit gesture option yet.
  const imagePreviewOpenOnLongPress = options.imagePreviewOpenOnLongPress ?? imagePreviewEnabled;
  const pagedNoAnimation = options.pagedNoAnimation ?? false;

  // Theme values are exposed as CSS custom properties so the native side can
  // switch themes by injecting JS (setProperty) instead of reloading the page
  // (which would lose the scroll position).
  const pageCss = [
    '<style>',
    `:root { --nv-bg: ${backgroundColor}; --nv-fg: ${textColor}; --nv-font: ${fontSize}px; --nv-line: ${lineHeight}px; --nv-top: ${topPadding}px; --nv-bottom: ${bottomPadding}px; --nv-hpad: ${sidePadding}px; --nv-hpad2: ${2 * sidePadding}px; --nv-indent: ${firstLineIndent ? '2em' : '0'}; }`,
    'html, body { margin: 0; padding: 0; background: var(--nv-bg); color: var(--nv-fg); }',
    `body { font-family: ${fontFamily}; font-size: var(--nv-font); line-height: var(--nv-line); word-break: break-word; overflow-wrap: break-word; -webkit-text-size-adjust: 100%; }`,
    'p { margin: 0 0 0.8em; text-indent: var(--nv-indent); }',
    'img { max-width: 100%; height: auto; }',
    'ruby rt { font-size: 0.5em; color: var(--nv-fg); }',
    'a { color: inherit; text-decoration: none; }',
    '* { -webkit-user-select: none !important; user-select: none !important; -webkit-touch-callout: none; }',
    ...(isPaged ? [
      // Paged layout: CSS columns on the root element; body has no
      // overflow:hidden (it breaks pagination in Safari/Firefox), and the root
      // gets position: relative so horizontal scrolling works on WKWebView.
      // Safe areas go on the HTML element (the column container): its content
      // box shrinks by top/bottom padding, so EVERY column starts after the
      // top inset and ends before the bottom inset. Putting top/bottom
      // padding on body would only affect the first/last column (standard
      // multi-column behavior); body keeps only the per-column side padding.
      'html { position: relative; min-width: 100%; width: 100%; max-width: 100%; min-height: 100vh; height: 100vh; max-height: 100vh; margin: 0 !important; padding: var(--nv-top) 0 var(--nv-bottom) !important; box-sizing: border-box; column-width: 100vw; column-gap: 0; column-fill: auto; }',
      'body { width: 100%; max-width: 100%; margin: 0 auto !important; box-sizing: border-box; padding: 0 var(--nv-hpad); }',
      'html, body { touch-action: none; }',
    ] : [
      // Safe areas are handled by the native WebView inset (marginTop/Bottom
      // on the RN side) for both modes; the body only carries the side
      // padding here.
      `body { padding: var(--nv-top) var(--nv-hpad) var(--nv-bottom); }`,
    ]),
    '</style>',
  ].join('');

  // Footnotes (server emits `<a class="duokan-footnote" href="#id">` with a
  // `<sup><img/></sup>` marker) and scroll/column-position reporting. This
  // runs in a plain browser document, so the footnote layer uses a <dialog>
  // in the top layer.
  const footnoteScript = `
  <script>
  (function () {
    var isPaged = ${isPaged ? 'true' : 'false'};
    function initFootnotes() {
      // Tap a note marker -> tell React Native to present the note in a
      // native sheet. The note bodies were already extracted server-side
      // equivalent (processNovelFootnotes) before the document was built, so
      // there is nothing to look up here — just forward the marker id.
      var links = document.querySelectorAll('a.duokan-footnote, a[data-reader-footnote-id]');
      var index = 0;
      for (var i = 0; i < links.length; i++) {
        var link = links[i];
        var id = link.getAttribute('data-reader-footnote-id') || (link.getAttribute('href') || '').replace('#', '');
        if (!id) continue;
        index++;
        link.innerHTML = '<sup style="font-size:0.7em;line-height:0;color:inherit;vertical-align:super">[' + index + ']</sup>';
        (function (noteId) {
          link.addEventListener('click', function (e) {
            e.preventDefault();
            if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'footnote', id: noteId }));
            }
          });
        })(id);
      }
    }

    function getScrollProgress() {
      if (isPaged) {
        var el = document.scrollingElement || document.documentElement;
        var max = Math.max(1, (el.scrollWidth || 0) - (el.clientWidth || 0));
        return Math.min(1, Math.max(0, (el.scrollLeft || 0) / max));
      }
      var docEl = document.documentElement;
      var maxY = Math.max(1, (docEl.scrollHeight || 0) - (window.innerHeight || 0));
      return Math.min(1, Math.max(0, (window.pageYOffset || docEl.scrollTop || 0) / maxY));
    }

    // Scroll-position reporting: progression (0-1) plus the text visible near
    // the top of the viewport, used as an anchor for precise restoration.
    var lastReport = 0;
    function currentAnchor() {
      try {
        var el = document.elementFromPoint(Math.floor(window.innerWidth / 2), 14);
        while (el && el !== document.body) {
          var text = (el.textContent || '').replace(/\\s+/g, ' ').trim();
          if (text.length > 4) return text.slice(0, 80);
          el = el.parentElement;
        }
      } catch (e) {}
      return '';
    }
    function reportPosition() {
      var now = Date.now();
      if (now - lastReport < 250) return;
      lastReport = now;
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'position',
          progression: getScrollProgress(),
          anchor: currentAnchor(),
        }));
      }
    }
    window.addEventListener('scroll', reportPosition, { passive: true });
    window.addEventListener('resize', reportPosition);

    function initPaged() {
      // Paged model: the chapter is laid out by the browser as CSS columns
      // on the <html> root (column-width: 100vw), and paging is native
      // horizontal scrolling — no JS pagination, no DOM moves, no measured
      // heights. Page turns happen by tapping the edges (JS scrollTo) or by
      // swiping (native scroll, follows the finger with rubber-band edges).
      var scrollEl = document.scrollingElement || document.documentElement;
      var pageW = window.innerWidth || 0;

      function maxScroll() {
        return Math.max(0, (scrollEl.scrollWidth || 0) - (scrollEl.clientWidth || 0));
      }
      function scrollToLeft(left, animated) {
        animating = animated;
        scrollEl.scrollTo({ left: Math.max(0, Math.min(maxScroll(), left)), behavior: animated ? 'smooth' : 'auto' });
      }

      // The page the user is currently "on". Scroll events keep it in sync
      // with free swipes, but while a programmatic smooth animation is
      // running the intermediate scrollLeft must NOT update it — otherwise a
      // rapid second tap computes its target from the animation's midpoint
      // and lands on a half page (e.g. two taps => 1.5 pages).
      var stablePage = Math.round((scrollEl.scrollLeft || 0) / pageW) || 0;
      var animating = false;
      var animTimer = null;
      scrollEl.addEventListener('scroll', function () {
        if (animating) {
          clearTimeout(animTimer);
          animTimer = setTimeout(function () {
            animating = false;
            stablePage = Math.round((scrollEl.scrollLeft || 0) / pageW);
          }, 120);
          return;
        }
        stablePage = Math.round((scrollEl.scrollLeft || 0) / pageW);
      }, { passive: true });

      // Finger drag: JS drives scrollLeft directly so the page follows the
      // finger exactly (native scrollView drag on WKWebView neither tracks
      // columns well nor snaps to a full page). No DOM work — just scrollLeft.
      var dragging = false, startX = 0, startLeft = 0, lastX = 0, lastT = 0, velocity = 0, moved = false;
      document.addEventListener('touchstart', function (e) {
        if (e.touches.length !== 1) return;
        if (e.target && e.target.closest && e.target.closest('dialog')) return; // footnote dialog: leave native scroll/tap alone
        dragging = true; moved = false;
        startX = e.touches[0].clientX;
        startLeft = scrollEl.scrollLeft;
        lastX = startX; lastT = Date.now(); velocity = 0;
      }, { passive: false });
      document.addEventListener('touchmove', function (e) {
        if (!dragging || e.touches.length !== 1) return;
        e.preventDefault();
        var x = e.touches[0].clientX;
        var dx = x - startX;
        if (Math.abs(dx) > 8) moved = true;
        var now = Date.now();
        var dt = now - lastT;
        if (dt > 0) velocity = velocity * 0.7 + ((x - lastX) / dt) * 0.3;
        lastX = x; lastT = now;
        scrollEl.scrollLeft = startLeft - dx;
      }, { passive: false });
      document.addEventListener('touchend', function (e) {
        if (!dragging) return;
        if (e.target && e.target.closest && e.target.closest('dialog')) { dragging = false; return; }
        dragging = false;
        var pageW = scrollEl.clientWidth || 1;
        var cur = scrollEl.scrollLeft;
        var dist = e.changedTouches[0].clientX - startX;
        // Decide from the START page, not the current (finger-tracked)
        // position, otherwise a tracked drag of e.g. 0.3 page plus one more
        // page overshoots by 1.3 pages.
        var startPage = Math.round(startLeft / pageW);
        var targetPage;
        if (Math.abs(dist) > pageW * 0.18 || Math.abs(velocity) > 0.4) {
          // Flick / big drag: exactly one page from where the drag began.
          targetPage = startPage - Math.sign(dist || velocity);
        } else {
          // Small drag: settle back on the nearest page boundary.
          targetPage = Math.round(cur / pageW);
        }
        var target = Math.max(0, Math.min(maxScroll(), targetPage * pageW));
        if (target !== cur) {
          scrollToLeft(target, ${pagedNoAnimation ? 'false' : 'true'});
        }
      }, { passive: true });

      // Tap the left/right edges of the screen to turn pages.
      scrollEl.addEventListener('click', function (e) {
        if (moved) return; // a drag just ended — don't also treat it as a tap
        if (e.target && e.target.closest) {
          // Never hijack clicks inside the footnote dialog or on links/buttons.
          if (e.target.closest('dialog') || e.target.closest('a') || e.target.closest('button') || e.target.closest('img')) return;
        }
        var w = scrollEl.clientWidth;
        var x = e.clientX;
        var maxPage = Math.max(0, Math.round(maxScroll() / w));
        if (x < w * 0.22) {
          e.preventDefault();
          stablePage = Math.max(0, stablePage - 1);
          scrollToLeft(stablePage * w, ${pagedNoAnimation ? 'false' : 'true'});
        } else if (x > w * 0.78) {
          e.preventDefault();
          stablePage = Math.min(maxPage, stablePage + 1);
          scrollToLeft(stablePage * w, ${pagedNoAnimation ? 'false' : 'true'});
        }
      });

      // Exposed for native-side restoration: 0-1 progression -> page.
      window.__nvSetPage = function (progression) {
        var left = Math.max(0, Math.min(1, progression)) * maxScroll();
        // Snap to the nearest page boundary so we never rest on a half page.
        left = Math.round(left / pageW) * pageW;
        stablePage = Math.round(left / pageW);
        scrollToLeft(left, false);
        setTimeout(reportPosition, 50);
      };

      // No re-pagination needed when the theme changes: the browser reflows
      // the columns on its own; just re-report the current position.
      window.__nvRepaginate = function () {
        setTimeout(reportPosition, 50);
      };

      // After the book font settles, column count changes — re-report so the
      // native side keeps a valid progression.
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(function () {
          setTimeout(reportPosition, 200);
        });
      }
    }
    function initImagePreview(openOnLongPress) {
      var timer = null;
      function cancel() { if (timer) { clearTimeout(timer); timer = null; } }
      function findImage(target) {
        var current = target;
        while (current && current !== document.body) {
          if (current.tagName === 'IMG') {
            return current.classList && current.classList.contains('no-preview') ? null : current;
          }
          current = current.parentElement;
        }
        return null;
      }
      function sendPreview(image, event) {
        if (!image) return;
        var src = image.getAttribute('src');
        if (!src) return;
        if (event) {
          event.preventDefault();
          event.stopPropagation();
        }
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'image-preview',
            src: src,
            alt: image.getAttribute('alt') || '',
          }));
        }
      }
      if (openOnLongPress) {
        document.addEventListener('touchstart', function (e) {
          cancel();
          var image = findImage(e.target);
          if (image && image.getAttribute('src')) {
            timer = setTimeout(function () {
              timer = null;
              sendPreview(image, null);
            }, 500);
          }
        }, { passive: true });
        document.addEventListener('touchmove', cancel, { passive: true });
        document.addEventListener('touchend', cancel, { passive: true });
      } else {
        document.addEventListener('click', function (e) {
          var image = findImage(e.target);
          if (image) sendPreview(image, e);
        });
      }
      document.addEventListener('contextmenu', function (e) {
        if (findImage(e.target)) e.preventDefault();
      });
    }

    function init() {
      initFootnotes();
      if (isPaged) initPaged();
      ${imagePreviewEnabled ? 'initImagePreview(' + (imagePreviewOpenOnLongPress ? 'true' : 'false') + ');' : '// image preview disabled'}
      setTimeout(reportPosition, 300);
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  })();
  </script>
  `;

  // Paged mode: the <html> root itself is the column container, so the body
  // flows directly — no wrapper elements.
  const bodyMarkup = body;

  return [
    '<!DOCTYPE html>',
    '<html>',
    '<head>',
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />',
    fontFace,
    pageCss,
    footnoteScript,
    '</head>',
    `<body>${bodyMarkup}</body>`,
    '</html>',
  ].join('');
}

/** Converts an ArrayBuffer to a base64 string without any Node polyfill. */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}
