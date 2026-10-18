import ExpoModulesCore
import QuartzCore
import UIKit

public final class NovellaUiModule: Module {
  private let layoutWillChangeObserver = NovellaLayoutWillChangeObserver()

  public func definition() -> ModuleDefinition {
    Name("NovellaUi")

    /// Fires around a size transition. React Native's `Dimensions` updates
    /// only after the window frame or orientation notification has settled,
    /// which is too late to cover the reader's layout jump.
    Events("onLayoutWillChange", "onLayoutDidChange")

    OnStartObserving("onLayoutWillChange") {
      layoutWillChangeObserver.start(
        onWillChange: { [weak self] in
          self?.sendEvent("onLayoutWillChange")
        },
        onDidChange: { [weak self] in
          self?.sendEvent("onLayoutDidChange")
        }
      )
    }

    OnStopObserving("onLayoutWillChange") {
      layoutWillChangeObserver.stop()
    }

    AsyncFunction("rasterizeReaderImage") { (uri: String, maxPixelSize: Int) async throws -> String in
      try await ReaderImageRasterizer.rasterize(uri: uri, maxPixelSize: maxPixelSize)
    }

    /// The edge on which iOS 27 renders a vertical navigation bar. It is
    /// `unspecified` on hardware and in window contexts that never use one, so
    /// the reader can opt into edge chrome without guessing from screen size.
    AsyncFunction("getVerticalBarEdge") { () async -> String in
      if #available(iOS 27.1, *) {
        return await MainActor.run {
          let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
          let scene = scenes.first { $0.activationState == .foregroundActive } ?? scenes.first
          let window = scene?.windows.first(where: \.isKeyWindow) ?? scene?.windows.first
          let edge = window?.traitCollection.verticalBarEdge
            ?? window?.rootViewController?.traitCollection.verticalBarEdge
            ?? .unspecified
          switch edge {
          case .leading:
            return "leading"
          case .trailing:
            return "trailing"
          default:
            return "unspecified"
          }
        }
      }
      return "unspecified"
    }

    /// Expo Router clears the toolbar items but leaves the now-empty bottom
    /// toolbar on screen when the last `Stack.Toolbar placement="bottom"`
    /// unmounts. In the reader's vertical-bar layout the slider moved into the
    /// side bar, and the empty toolbar still reserves its height plus the home
    /// indicator as a bottom safe area. Hide it explicitly so the text can use
    /// that space and the top/bottom margins match.
    AsyncFunction("setReaderBottomToolbarHidden") { (hidden: Bool) async in
      await MainActor.run {
        for scene in UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene }) {
          for window in scene.windows {
            for navigationController in NovellaUiModule.navigationControllers(
              in: window.rootViewController
            ) {
              navigationController.setToolbarHidden(hidden, animated: false)
            }
          }
        }
      }
    }

    /// A fold moves the system bars between displays and rebuilds the vertical
    /// column from the bar button items UIKit already holds; it does not ask
    /// the screen for them again. Re-assign the item list so the column is laid
    /// out with the new display's width, and keep the reader's items ahead of
    /// the tab bar when the column is short.
    AsyncFunction("refreshReaderSideBar") { () async in
      if #available(iOS 27.1, *) {
        await MainActor.run {
          for scene in UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene }) {
            for window in scene.windows {
              let navigationControllers = NovellaUiModule.navigationControllers(
                in: window.rootViewController
              )
              guard let navigationController = navigationControllers.last(where: {
                $0.viewIfLoaded?.window != nil
                  && $0.topViewController?.viewIfLoaded?.window != nil
              }) else { continue }
              guard let item = navigationController.topViewController?.navigationItem else { continue }
              item.verticalBarCompressionBehavior = .prefersBarItems
              if let items = item.rightBarButtonItems {
                item.rightBarButtonItems = items
              }
              if let items = item.leftBarButtonItems {
                item.leftBarButtonItems = items
              }
              navigationController.navigationBar.setNeedsLayout()
            }
          }
        }
      }
    }

    View(NovellaSearchBarView.self) {
      ViewName("SearchBar")

      Prop("placeholder") { (view: NovellaSearchBarView, placeholder: String?) in
        view.setPlaceholder(placeholder)
      }
      Prop("enabled") { (view: NovellaSearchBarView, enabled: Bool) in
        view.setEnabled(enabled)
      }
      // Applied by the mounting layer, unlike an AsyncFunction, which resolves
      // the view by tag and can race with the first commit or a remount.
      Prop("query") { (view: NovellaSearchBarView, query: String?) in
        view.setQuery(query ?? "")
      }

      Events("onQueryChange", "onSearch")

      AsyncFunction("focus") { (view: NovellaSearchBarView) in
        view.focus()
      }
      AsyncFunction("blur") { (view: NovellaSearchBarView) in
        view.blur()
      }
      AsyncFunction("clear") { (view: NovellaSearchBarView) in
        view.clear()
      }
      AsyncFunction("setQuery") { (view: NovellaSearchBarView, query: String) in
        view.setQuery(query)
      }
    }

    View(NovellaDirectMessageComposerView.self) {
      ViewName("DirectMessageComposer")

      Prop("draft") { (view: NovellaDirectMessageComposerView, draft: String?) in
        view.setDraft(draft ?? "")
      }
      Prop("placeholder") { (view: NovellaDirectMessageComposerView, placeholder: String?) in
        view.setPlaceholder(placeholder)
      }
      Prop("enabled") { (view: NovellaDirectMessageComposerView, enabled: Bool) in
        view.setEnabled(enabled)
      }
      Prop("maxLength") { (view: NovellaDirectMessageComposerView, maxLength: Int) in
        view.setMaxLength(maxLength)
      }
      Prop("accentColor") { (view: NovellaDirectMessageComposerView, accentColor: UIColor?) in
        view.setAccentColor(accentColor)
      }

      Events("onDraftChange", "onSend", "onHeightChange")

      AsyncFunction("focus") { (view: NovellaDirectMessageComposerView) in
        view.focus()
      }
      AsyncFunction("blur") { (view: NovellaDirectMessageComposerView) in
        view.blur()
      }
    }

    View(NovellaSegmentedControlView.self) {
      ViewName("SegmentedControl")

      Prop("options") { (view: NovellaSegmentedControlView, options: [SegmentedControlOption]) in
        view.setOptions(options)
      }
      Prop("selectedValue") { (view: NovellaSegmentedControlView, selectedValue: String) in
        view.setSelectedValue(selectedValue)
      }
      Prop("enabled") { (view: NovellaSegmentedControlView, enabled: Bool) in
        view.setEnabled(enabled)
      }

      Events("onValueChange")
    }
  }

  private static func navigationControllers(
    in root: UIViewController?
  ) -> [UINavigationController] {
    guard let root else { return [] }
    var controllers: [UINavigationController] = []
    if let navigationController = root as? UINavigationController {
      controllers.append(navigationController)
    }
    for child in root.children {
      controllers.append(contentsOf: navigationControllers(in: child))
    }
    if let presented = root.presentedViewController, presented !== root {
      controllers.append(contentsOf: navigationControllers(in: presented))
    }
    return controllers
  }

}

/// Reports the start and end of any window size transition.
///
/// Two sources are combined because neither covers every case:
/// - `viewWillTransitionToSize:` is posted by `NovellaLayoutTransitionNotifier`
///   and runs before UIKit begins the transition, including fold/unfold display
///   changes and rotation.
/// - KVO on the key window's frame covers interactive iPad resizing and any
///   view controller that overrides the transition method (an override would
///   bypass the base-class swizzle).
private final class NovellaLayoutWillChangeObserver {
  private var willChangeToken: NSObjectProtocol?
  private var didChangeToken: NSObjectProtocol?
  private var keyWindowToken: NSObjectProtocol?
  private var frameObservation: NSKeyValueObservation?
  private weak var observedWindow: UIWindow?
  private var lastStart: CFTimeInterval = 0
  private var onWillChange: (() -> Void)?
  private var onDidChange: (() -> Void)?

  func start(onWillChange: @escaping () -> Void, onDidChange: @escaping () -> Void) {
    stop()
    self.onWillChange = onWillChange
    self.onDidChange = onDidChange
    willChangeToken = NotificationCenter.default.addObserver(
      forName: Notification.Name("NovellaLayoutWillChangeNotification"),
      object: nil,
      queue: .main
    ) { [weak self] _ in
      self?.emitStart()
    }
    didChangeToken = NotificationCenter.default.addObserver(
      forName: Notification.Name("NovellaLayoutDidChangeNotification"),
      object: nil,
      queue: .main
    ) { [weak self] _ in
      self?.onDidChange?()
    }
    keyWindowToken = NotificationCenter.default.addObserver(
      forName: UIWindow.didBecomeKeyNotification,
      object: nil,
      queue: .main
    ) { [weak self] notification in
      let window = notification.object as? UIWindow
      Task { @MainActor [weak self] in
        self?.observe(window)
      }
    }
    Task { @MainActor [weak self] in
      self?.observe(Self.keyWindow())
    }
  }

  func stop() {
    onWillChange = nil
    onDidChange = nil
    if let willChangeToken {
      NotificationCenter.default.removeObserver(willChangeToken)
    }
    willChangeToken = nil
    if let didChangeToken {
      NotificationCenter.default.removeObserver(didChangeToken)
    }
    didChangeToken = nil
    if let keyWindowToken {
      NotificationCenter.default.removeObserver(keyWindowToken)
    }
    keyWindowToken = nil
    frameObservation?.invalidate()
    frameObservation = nil
    observedWindow = nil
  }

  @MainActor
  private func observe(_ window: UIWindow?) {
    guard let window, window !== observedWindow else { return }
    frameObservation?.invalidate()
    observedWindow = window
    frameObservation = window.observe(\.frame, options: [.new]) { [weak self] _, _ in
      self?.emitStart()
    }
  }

  private func emitStart() {
    let now = CACurrentMediaTime()
    // A single transition can report through several view controllers and the
    // window KVO at once; the JS overlay only needs one signal per frame.
    guard now - lastStart >= 0.05 else { return }
    lastStart = now
    onWillChange?()
  }

  private static func keyWindow() -> UIWindow? {
    UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .flatMap(\.windows)
      .first(where: \.isKeyWindow)
  }
}
