import ExpoModulesCore
import UIKit

/** Applies UIKit's public light interface trait to this React subtree only. */
final class NovellaLightAppearanceScopeView: ExpoView {
  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    overrideUserInterfaceStyle = .light
  }
}
