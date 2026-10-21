/** Cloudflare Turnstile site key shared with the web client (web-master `TURNSTILE_SITEKEY`). */
export const TURNSTILE_SITE_KEY = '0x4AAAAAAADgWLX3ngufVh5F';

/**
 * Document origin of the challenge page. Turnstile validates the page hostname
 * against the site key's allow-list, so the inline HTML is loaded as if it were
 * served by the web deployment.
 */
export const TURNSTILE_ORIGIN = 'https://www.lightnovel.app/';

/** Height of a `flexible` Turnstile widget while it asks for interaction. */
export const TURNSTILE_WIDGET_HEIGHT = 65;

/** Action names must match what the backend expects for each endpoint. */
export type TurnstileAction = 'register' | 'reset_password';

export type TurnstileLanguage = 'zh-cn' | 'zh-tw';

/**
 * `interaction-only` keeps the widget blank unless Cloudflare needs a click
 * (the hidden prefetch); `always` shows progress and the checkbox (the sheet).
 */
export type TurnstileAppearance = 'always' | 'interaction-only';

export type TurnstileMessage =
  | { type: 'token'; token: string }
  | { type: 'expired' }
  | { type: 'interactive'; visible: boolean }
  | { type: 'error'; code: string };

/** Raised when a token cannot be produced. The challenge view shows its own retry UI. */
export class TurnstileError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(`Human verification failed (${code}).`);
    this.name = 'TurnstileError';
    this.code = code;
  }
}

/** Error codes the page reports for failures outside Turnstile's numeric codes. */
export const TURNSTILE_LOAD_ERROR_CODES: ReadonlySet<string> = new Set(['script', 'timeout', 'webview']);

/** Codes for requests that ended without a token but without a challenge failure. */
export const TURNSTILE_CANCELLED = 'cancelled';

export function buildTurnstileHtml(options: {
  action: TurnstileAction;
  appearance: TurnstileAppearance;
  language: TurnstileLanguage;
  theme: 'light' | 'dark';
}): string {
  const config = JSON.stringify({
    sitekey: TURNSTILE_SITE_KEY,
    action: options.action,
    language: options.language,
    theme: options.theme,
    size: 'flexible',
    appearance: options.appearance,
    // Retries and expiry refreshes are driven by the app, so hidden screens
    // left on the navigation stack do no background work.
    retry: 'never',
    'refresh-expired': 'manual',
    'feedback-enabled': false,
  });
  // `</` cannot appear inside JSON produced from these inputs, but keep the
  // script block safe if a future option carries user text.
  const safeConfig = config.replace(/</g, '\\u003c');
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>html,body{margin:0;padding:0;background:transparent;overflow:hidden}#widget{display:flex;justify-content:center}</style>
</head>
<body>
<div id="widget"></div>
<script>
(function () {
  function post(message) { window.ReactNativeWebView.postMessage(JSON.stringify(message)); }
  var widgetId = null;
  var config = ${safeConfig};
  config.callback = function (token) { post({ type: 'token', token: token }); };
  config['expired-callback'] = function () { post({ type: 'expired' }); };
  config['error-callback'] = function (code) { post({ type: 'error', code: String(code) }); return true; };
  config['unsupported-callback'] = function () { post({ type: 'error', code: 'unsupported' }); };
  config['before-interactive-callback'] = function () { post({ type: 'interactive', visible: true }); };
  config['after-interactive-callback'] = function () { post({ type: 'interactive', visible: false }); };
  window.novellaTurnstileLoaded = function () { widgetId = turnstile.render('#widget', config); };
  window.novellaTurnstileFailed = function () { post({ type: 'error', code: 'script' }); };
  window.novellaTurnstileReset = function () {
    if (widgetId === null) return post({ type: 'error', code: 'script' });
    turnstile.reset(widgetId);
  };
})();
</script>
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=novellaTurnstileLoaded" async defer onerror="novellaTurnstileFailed()"></script>
</body>
</html>`;
}

export function parseTurnstileMessage(data: string): TurnstileMessage | null {
  let value: unknown;
  try {
    value = JSON.parse(data);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null) return null;
  const message = value as Record<string, unknown>;
  switch (message.type) {
    case 'token':
      return typeof message.token === 'string' && message.token
        ? { type: 'token', token: message.token }
        : null;
    case 'expired':
      return { type: 'expired' };
    case 'interactive':
      return { type: 'interactive', visible: message.visible === true };
    case 'error':
      return { type: 'error', code: typeof message.code === 'string' ? message.code : 'unknown' };
    default:
      return null;
  }
}
