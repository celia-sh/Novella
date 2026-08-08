import { withAppBuildGradle } from '@expo/config-plugins';
import type { ConfigPlugin } from '@expo/config-plugins';

const desugaringDependency = "coreLibraryDesugaring 'com.android.tools:desugar_jdk_libs:2.0.4'";

const withAndroidDesugaring: ConfigPlugin = (config) =>
  withAppBuildGradle(config, (cfg) => {
    let contents = cfg.modResults.contents;

    if (!contents.includes('coreLibraryDesugaringEnabled true')) {
      contents = contents.replace(
        "    compileSdk rootProject.ext.compileSdkVersion\n",
        "    compileSdk rootProject.ext.compileSdkVersion\n\n    compileOptions {\n        coreLibraryDesugaringEnabled true\n    }\n",
      );
    }

    if (!contents.includes(desugaringDependency)) {
      contents = contents.replace(
        'dependencies {\n',
        `dependencies {\n    ${desugaringDependency}\n`,
      );
    }

    cfg.modResults.contents = contents;
    return cfg;
  });

export default withAndroidDesugaring;
