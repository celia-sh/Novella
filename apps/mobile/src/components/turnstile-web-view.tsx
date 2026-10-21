import { useCallback, useMemo, type ComponentType, type Ref } from 'react';
import { Linking, StyleSheet } from 'react-native';
import WebView from 'react-native-webview';
import type {
  IOSWebViewProps,
  ShouldStartLoadRequest,
  WebViewMessageEvent,
  WebViewOpenWindowEvent,
} from 'react-native-webview/lib/WebViewTypes';

import { useAppLocale } from '@/localization/localization-provider';
import {
  TURNSTILE_ORIGIN,
  TURNSTILE_WIDGET_HEIGHT,
  buildTurnstileHtml,
  parseTurnstileMessage,
  type TurnstileAction,
  type TurnstileAppearance,
  type TurnstileMessage,
} from '@/services/turnstile';
import { useAuthPalette } from '@/theme/auth-theme';

export interface TurnstileWebViewInstance {
  injectJavaScript(script: string): void;
}

/** Starts a new challenge on the rendered widget; a page whose script failed reports an error instead. */
export const TURNSTILE_RESET_SCRIPT = 'window.novellaTurnstileReset && window.novellaTurnstileReset(); true;';

// The package's cross-platform prop intersection collapses to `never` under
// this compiler setup; the app ships on iOS only, so bind the iOS props.
const IOSWebView = WebView as unknown as ComponentType<IOSWebViewProps & { ref?: Ref<TurnstileWebViewInstance> | undefined }>;

/**
 * The Turnstile page itself: inline HTML served as the web origin so hostname
 * validation passes, with widget events forwarded as parsed messages.
 * Theme or language changes reload the page and therefore the challenge.
 */
export function TurnstileWebView({
  action,
  appearance,
  onMessage,
  ref,
}: {
  action: TurnstileAction;
  appearance: TurnstileAppearance;
  onMessage: (message: TurnstileMessage) => void;
  ref?: Ref<TurnstileWebViewInstance>;
}) {
  const palette = useAuthPalette();
  const locale = useAppLocale();
  const theme = palette.isDark ? 'dark' : 'light';
  const source = useMemo(() => ({
    baseUrl: TURNSTILE_ORIGIN,
    html: buildTurnstileHtml({
      action,
      appearance,
      language: locale === 'zh-TW' ? 'zh-tw' : 'zh-cn',
      theme,
    }),
  }), [action, appearance, locale, theme]);

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    const message = parseTurnstileMessage(event.nativeEvent.data);
    if (message) onMessage(message);
  }, [onMessage]);

  const handleWebViewFailure = useCallback(() => {
    onMessage({ type: 'error', code: 'webview' });
  }, [onMessage]);

  const onShouldStartLoadWithRequest = useCallback((request: ShouldStartLoadRequest) => {
    if (!request.isTopFrame || request.url.startsWith(TURNSTILE_ORIGIN) || request.url.startsWith('about:')) {
      return true;
    }
    // Links inside the widget (privacy, help) belong in the browser.
    void Linking.openURL(request.url).catch(() => undefined);
    return false;
  }, []);

  return (
    <IOSWebView
      allowsLinkPreview={false}
      bounces={false}
      hideKeyboardAccessoryView
      onContentProcessDidTerminate={handleWebViewFailure}
      onError={handleWebViewFailure}
      onMessage={handleMessage}
      onOpenWindow={(event: WebViewOpenWindowEvent) => void Linking.openURL(event.nativeEvent.targetUrl).catch(() => undefined)}
      onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
      originWhitelist={['*']}
      ref={ref}
      scrollEnabled={false}
      source={source}
      style={styles.webView}
      textInteractionEnabled={false}
      webviewDebuggingEnabled={__DEV__}
    />
  );
}

const styles = StyleSheet.create({
  webView: { backgroundColor: 'transparent', height: TURNSTILE_WIDGET_HEIGHT },
});
