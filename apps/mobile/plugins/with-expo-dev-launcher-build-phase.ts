import { withXcodeProject } from '@expo/config-plugins';
import type { ConfigPlugin } from '@expo/config-plugins';

const buildPhaseName = '[Expo Dev Launcher] Strip Local Network Keys for Release';

type ShellScriptBuildPhase = {
  alwaysOutOfDate?: number;
  isa?: string;
  name?: string;
};

const unquote = (value: string | undefined): string =>
  value?.replace(/^"(.*)"$/, '$1') ?? '';

/**
 * The Expo Dev Launcher script intentionally checks the built Info.plist on
 * every build, but its generated Xcode phase declares neither inputs nor
 * outputs. Marking it always out of date is equivalent to unchecking Xcode's
 * "Based on dependency analysis" option and removes the ambiguous dependency
 * warning without changing when the script runs.
 */
const withExpoDevLauncherBuildPhase: ConfigPlugin = (config) =>
  withXcodeProject(config, (cfg) => {
    const phases = cfg.modResults.hash.project.objects.PBXShellScriptBuildPhase;
    const phase = Object.values(phases ?? {}).find((candidate) => {
      if (!candidate || typeof candidate !== 'object') {
        return false;
      }

      const shellPhase = candidate as ShellScriptBuildPhase;
      return shellPhase.isa === 'PBXShellScriptBuildPhase'
        && unquote(shellPhase.name) === buildPhaseName;
    }) as ShellScriptBuildPhase | undefined;

    if (!phase) {
      console.warn(`Could not find Xcode build phase: ${buildPhaseName}`);
      return cfg;
    }

    phase.alwaysOutOfDate = 1;
    return cfg;
  });

export default withExpoDevLauncherBuildPhase;
