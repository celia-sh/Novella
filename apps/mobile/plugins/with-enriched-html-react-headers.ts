import { withPodfile } from '@expo/config-plugins';
import type { ConfigPlugin } from '@expo/config-plugins';

const MARKER = '# [Novella] react-native-enriched-html prebuilt React headers';

const PODFILE_INJECTION = `
    ${MARKER}
    # react-native-enriched-html 1.1.1 imports "UIView+React.h" directly. RN 0.88
    # builds React as a prebuilt framework, so that header is no longer published
    # through Pods/Headers/Public and quoted imports fail. Upstream switches the
    # imports to <React/UIView+React.h> in 1.2.0-nightly; drop this once 1.2.0
    # stable ships.
    enriched_html_target = installer.pods_project.targets.find do |target|
      target.name == 'ReactNativeEnrichedHtml'
    end
    if enriched_html_target
      react_framework = '$(PODS_ROOT)/React-Core-prebuilt/React.xcframework'
      enriched_html_target.build_configurations.each do |build_config|
        header_paths = build_config.build_settings['HEADER_SEARCH_PATHS']
        header_paths = header_paths.join(' ') if header_paths.is_a?(Array)
        build_config.build_settings['HEADER_SEARCH_PATHS'] = [
          '$(inherited)',
          header_paths,
          "#{react_framework}/ios-arm64/React.framework/Headers",
          "#{react_framework}/ios-arm64_x86_64-simulator/React.framework/Headers",
        ].compact.reject(&:empty?).join(' ')
      end
    end
`;

/**
 * RN 0.88 ships React as a prebuilt xcframework. `react-native-enriched-html`
 * 1.1.1 still uses quoted imports for React headers, which are not part of the
 * public header symlink tree of the prebuilt framework.
 */
const withEnrichedHtmlReactHeaders: ConfigPlugin = (config) =>
  withPodfile(config, (cfg) => {
    if (cfg.modResults.contents.includes(MARKER)) {
      return cfg;
    }

    const anchor = '\n  end\nend';
    const insertionPoint = cfg.modResults.contents.lastIndexOf(anchor);
    if (insertionPoint === -1) {
      throw new Error(
        'with-enriched-html-react-headers: could not find the Podfile post_install block.',
      );
    }

    cfg.modResults.contents =
      cfg.modResults.contents.slice(0, insertionPoint)
      + PODFILE_INJECTION
      + cfg.modResults.contents.slice(insertionPoint);
    return cfg;
  });

export default withEnrichedHtmlReactHeaders;
