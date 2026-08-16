import ExpoModulesCore
import UIKit

/** Applies UIKit's public light interface trait to this React subtree only. */
final class NovellaLightAppearanceScopeView: ExpoView {
  private weak var overriddenToolbar: UIToolbar?
  private var originalToolbarStyle: UIUserInterfaceStyle = .unspecified
  private var scheduledAppearanceAttempts = 0

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    overrideUserInterfaceStyle = .light
  }

  deinit {
    restoreToolbarAppearance()
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    guard window != nil else {
      scheduledAppearanceAttempts = 0
      restoreToolbarAppearance()
      return
    }

    scheduledAppearanceAttempts = 0
    if !applyToolbarAppearance() {
      scheduleAppearanceRetry()
    }
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    if overriddenToolbar == nil {
      _ = applyToolbarAppearance()
    }
  }

  private func scheduleAppearanceRetry() {
    guard scheduledAppearanceAttempts < 3 else { return }
    scheduledAppearanceAttempts += 1
    DispatchQueue.main.async { [weak self] in
      guard let self, self.window != nil else { return }
      if !self.applyToolbarAppearance() {
        self.scheduleAppearanceRetry()
      }
    }
  }

  @discardableResult
  private func applyToolbarAppearance() -> Bool {
    guard let toolbar = nearestNavigationController()?.toolbar else {
      return false
    }

    if overriddenToolbar !== toolbar {
      restoreToolbarAppearance()
      originalToolbarStyle = toolbar.overrideUserInterfaceStyle
      overriddenToolbar = toolbar
    }
    toolbar.overrideUserInterfaceStyle = .light
    return true
  }

  private func restoreToolbarAppearance() {
    if let toolbar = overriddenToolbar,
       toolbar.overrideUserInterfaceStyle == .light {
      toolbar.overrideUserInterfaceStyle = originalToolbarStyle
    }
    overriddenToolbar = nil
    originalToolbarStyle = .unspecified
  }

  private func nearestNavigationController() -> UINavigationController? {
    var responder: UIResponder? = self
    while let current = responder {
      if let navigationController = current as? UINavigationController {
        return navigationController
      }
      if let viewController = current as? UIViewController,
         let navigationController = viewController.navigationController {
        return navigationController
      }
      responder = current.next
    }
    return nil
  }
}
