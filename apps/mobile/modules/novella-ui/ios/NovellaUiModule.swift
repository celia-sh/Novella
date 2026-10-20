import CoreFoundation
import ExpoModulesCore
import QuartzCore
import UIKit

public final class NovellaUiModule: Module {
  private let layoutWillChangeObserver = NovellaLayoutWillChangeObserver()

  public func definition() -> ModuleDefinition {
    Name("NovellaUi")

    /// Fires around a size transition. React Native's `Dimensions` updates
    /// only after the window frame or orientation notification has settled,
    /// which is too late to cover the layout jump.
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

    /// Full-window transition cover. A React view is laid out from the old
    /// Dimensions while UIKit is already transforming the root view, so its
    /// edges expose the background during a rotation. This overlay lives on
    /// the window above the root controller and keeps the window's bounds.
    AsyncFunction("setReaderLayoutTransitionAppearance") { (dark: Bool) async in
      await MainActor.run {
        NovellaLayoutTransitionOverlay.shared.setAppearance(dark: dark)
      }
    }

    AsyncFunction("showReaderLayoutTransition") { (dark: Bool) async in
      await MainActor.run {
        NovellaLayoutTransitionOverlay.shared.show(dark: dark)
      }
    }

    AsyncFunction("hideReaderLayoutTransition") { () async in
      await MainActor.run {
        NovellaLayoutTransitionOverlay.shared.hide()
      }
    }

    /// Insert U+2060 WORD JOINER between the Han characters of every word
    /// token, so CoreText's line-breaker treats each word as one unit instead
    /// of breaking Chinese text between any two characters. See
    /// `NovellaWordJoiner` below for how the word boundaries are found.
    AsyncFunction("applyWordJoiners") { (text: String, locale: String) -> String in
      NovellaWordJoiner.apply(to: text, locale: locale)
    }

    AsyncFunction("rasterizeReaderImage") { (uri: String, maxPixelSize: Int) async throws -> String in
      try await ReaderImageRasterizer.rasterize(uri: uri, maxPixelSize: maxPixelSize)
    }

    /// The radius of the display's own rounded corners, in points. UIKit only
    /// exposes it through concentric corner resolution (iOS 26+): a probe that
    /// fills the window and asks for a container-concentric radius resolves to
    /// the window's corners, which follow the display. 0 before iOS 26 or when
    /// no window is attached.
    AsyncFunction("getDisplayCornerRadius") { () async -> Double in
      if #available(iOS 26.0, *) {
        return await MainActor.run {
          let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
          let scene = scenes.first { $0.activationState == .foregroundActive } ?? scenes.first
          guard let window = scene?.windows.first(where: \.isKeyWindow) ?? scene?.windows.first else {
            return 0
          }
          let probe = UIView(frame: window.bounds)
          probe.isUserInteractionEnabled = false
          probe.isHidden = true
          probe.cornerConfiguration = .uniformCorners(radius: .containerConcentric())
          window.addSubview(probe)
          probe.layoutIfNeeded()
          let radius = probe.effectiveRadius(corner: .topLeft)
          probe.removeFromSuperview()
          return Double(radius)
        }
      }
      return 0
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
              // Re-assigning the list makes iOS re-insert the custom title and
              // progress views. The fold is covered, but the retries are not
              // guaranteed to be, so apply them without the item transition.
              UIView.performWithoutAnimation {
                item.verticalBarCompressionBehavior = .prefersBarItems
                if let items = item.rightBarButtonItems {
                  item.rightBarButtonItems = items
                }
                if let items = item.leftBarButtonItems {
                  item.leftBarButtonItems = items
                }
                navigationController.navigationBar.setNeedsLayout()
                navigationController.navigationBar.layoutIfNeeded()
              }
            }
          }
        }
      }
    }

    /// The reader's background can be the opposite brightness of the app
    /// scheme, and liquid glass only follows the trait collection. The header
    /// config overrides the navigation bar, but iOS 26+ hosts the bottom
    /// toolbar (and, on a vertical-bar layout, the side column) in a floating
    /// bar container that is a sibling of the navigation bar. Override that
    /// container so the reader's bars share one scheme. `unspecified` resets it
    /// for the screens below the reader.
    AsyncFunction("setReaderBarInterfaceStyle") { (style: String) async in
      await MainActor.run {
        let interfaceStyle: UIUserInterfaceStyle
        switch style {
        case "dark": interfaceStyle = .dark
        case "light": interfaceStyle = .light
        default: interfaceStyle = .unspecified
        }
        for scene in UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene }) {
          for window in scene.windows {
            for navigationController in NovellaUiModule.navigationControllers(
              in: window.rootViewController
            ) where navigationController.viewIfLoaded?.window != nil {
              // Only the stack showing the reader gets an explicit style; the
              // others are reset so a stale override cannot linger.
              let isReaderStack = navigationController.topViewController?.viewIfLoaded?.window != nil
              let applied: UIUserInterfaceStyle = isReaderStack ? interfaceStyle : .unspecified
              for container in NovellaUiModule.floatingBarContainers(in: navigationController.view) {
                container.overrideUserInterfaceStyle = applied
              }
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

    View(NovellaBoundsReporterView.self) {
      ViewName("BoundsReporter")

      Events("onBoundsChange")
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

  /// UIKit's private host for floating bars. It sits a few levels below the
  /// navigation controller's view, beside the navigation bar; screens nested
  /// in it are not searched, since their own stacks are visited separately.
  private static func floatingBarContainers(in root: UIView?, depth: Int = 0) -> [UIView] {
    guard let root, depth < 4 else { return [] }
    var containers: [UIView] = []
    for subview in root.subviews {
      if NSStringFromClass(type(of: subview)) == "_UIFloatingBarContainerView" {
        containers.append(subview)
      } else {
        containers.append(contentsOf: floatingBarContainers(in: subview, depth: depth + 1))
      }
    }
    return containers
  }

}

/// Inserts U+2060 WORD JOINER inside CJK words.
///
/// iOS breaks Chinese text between any two characters; `lineBreakStrategyIOS`
/// only moves an orphaned word off the last line and cannot keep words intact
/// mid-paragraph. CoreText does honour U+2060, so joining a word's characters
/// pushes the break to the next word boundary.
///
/// The boundaries come from `CFStringTokenizer` with the word-boundary unit,
/// which uses the on-device linguistic model for the locale (BCP 47 tag such
/// as "zh-CN") and handles scripts without spaces. Only adjacent Han
/// characters are joined: a token like "iPhone" keeps its normal breaking
/// rules, and whitespace and punctuation between tokens are copied verbatim.
private enum NovellaWordJoiner {
  private static let wordJoiner: Unicode.Scalar = "\u{2060}"

  static func apply(to text: String, locale: String) -> String {
    let nsText = text as NSString
    guard nsText.length > 1 else { return text }
    guard let tokenizer = CFStringTokenizerCreate(
      kCFAllocatorDefault,
      text as CFString,
      CFRangeMake(0, nsText.length),
      kCFStringTokenizerUnitWordBoundary,
      Locale(identifier: locale) as CFLocale
    ) else { return text }

    var result = ""
    var cursor = 0
    while CFStringTokenizerAdvanceToNextToken(tokenizer) != [] {
      let range = CFStringTokenizerGetCurrentTokenRange(tokenizer)
      // Tokens are ordered but may be separated by punctuation or whitespace,
      // which is copied as-is.
      guard range.location >= cursor else { continue }
      if range.location > cursor {
        result += nsText.substring(
          with: NSRange(location: cursor, length: range.location - cursor)
        )
      }
      let token = nsText.substring(
        with: NSRange(location: range.location, length: range.length)
      )
      result += joiningHanCharacters(in: token)
      cursor = range.location + range.length
    }
    if cursor < nsText.length {
      result += nsText.substring(from: cursor)
    }
    return result
  }

  private static func joiningHanCharacters(in token: String) -> String {
    let scalars = Array(token.unicodeScalars)
    guard scalars.count > 1 else { return token }
    var result = ""
    for (index, scalar) in scalars.enumerated() {
      if index > 0, isHan(scalars[index - 1]), isHan(scalar) {
        result.unicodeScalars.append(wordJoiner)
      }
      result.unicodeScalars.append(scalar)
    }
    return result
  }

  private static func isHan(_ scalar: Unicode.Scalar) -> Bool {
    switch scalar.value {
    case 0x3400...0x4DBF,   // CJK Unified Ideographs Extension A
         0x4E00...0x9FFF,   // CJK Unified Ideographs
         0xF900...0xFAFF,   // CJK Compatibility Ideographs
         0x20000...0x2FA1F: // Extensions B–F and compatibility supplement
      return true
    default:
      return false
    }
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
  private var boundsObservation: NSKeyValueObservation?
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
      // `nil` delivers synchronously on the posting thread, which is the main
      // thread and is still inside `viewWillTransitionToSize:`. The cover must
      // be in the window before UIKit starts the rotation animation.
      queue: nil
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
    // A physical rotation is not a start signal: the Duo outer display keeps
    // the interface in one orientation, so the device still reports a rotation
    // while the window never resizes and nothing needs covering. The Will
    // swizzle and the key-window bounds KVO below only fire on a real size
    // transition.
    Task { @MainActor [weak self] in
      self?.observe(novellaKeyWindow())
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
    boundsObservation?.invalidate()
    boundsObservation = nil
    observedWindow = nil
  }

  @MainActor
  private func observe(_ window: UIWindow?) {
    guard let window, window !== observedWindow else { return }
    frameObservation?.invalidate()
    boundsObservation?.invalidate()
    observedWindow = window
    frameObservation = window.observe(\.frame, options: [.new]) { [weak self] _, _ in
      self?.emitStart()
    }
    // Rotation can change the bounds without a frame change on some window
    // contexts (the origin stays at zero while only the size swaps).
    boundsObservation = window.observe(\.bounds, options: [.new]) { [weak self] _, _ in
      self?.emitStart()
    }
  }

  private func emitStart() {
    let now = CACurrentMediaTime()
    // A single transition can report through several view controllers and the
    // window KVO at once; the JS overlay only needs one signal per frame.
    guard now - lastStart >= 0.05 else { return }
    lastStart = now
    // Raise the cover here as well as from JS. The event crosses the bridge,
    // and a rotation can start before the JS handler runs.
    if #available(iOS 17.0, *), Thread.isMainThread {
      MainActor.assumeIsolated {
        NovellaLayoutTransitionOverlay.shared.showCurrentAppearance()
      }
    } else {
      Task { @MainActor in
        NovellaLayoutTransitionOverlay.shared.showCurrentAppearance()
      }
    }
    onWillChange?()
  }
}

@MainActor
private func novellaKeyWindow() -> UIWindow? {
  UIApplication.shared.connectedScenes
    .compactMap { $0 as? UIWindowScene }
    .flatMap(\.windows)
    .first(where: \.isKeyWindow)
}

/// The cover used while the app re-lays out after a size transition.
///
/// It is a direct subview of the key window, above the whole controller
/// hierarchy. React views keep the previous `Dimensions` while UIKit already
/// re-lays out the screen, so a JS cover exposes the content during a
/// rotation; the window-level view follows `window.bounds` through its
/// autoresizing mask instead.
@MainActor
final class NovellaLayoutTransitionOverlay {
  static let shared = NovellaLayoutTransitionOverlay()

  private static let fadeDuration: TimeInterval = 0.22

  private let container = UIView()
  private let blurView = UIVisualEffectView(effect: nil)
  private let scrimView = UIView()
  private var blurStyle: UIBlurEffect.Style?
  private var appearanceIsDark = false

  private init() {
    container.isUserInteractionEnabled = false
    container.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    container.alpha = 0

    blurView.isUserInteractionEnabled = false
    blurView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    scrimView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    scrimView.backgroundColor = UIColor.systemGroupedBackground.withAlphaComponent(0.26)

    container.addSubview(blurView)
    container.addSubview(scrimView)
  }

  func setAppearance(dark: Bool) {
    appearanceIsDark = dark
  }

  /// Raised from the native transition observer, before the JS event can
  /// cross the bridge.
  func showCurrentAppearance() {
    show(dark: appearanceIsDark)
  }

  func show(dark: Bool) {
    appearanceIsDark = dark
    guard let window = novellaKeyWindow() else { return }
    let wasCovering = container.superview != nil && container.alpha > 0
    if container.superview !== window {
      container.removeFromSuperview()
      window.addSubview(container)
    }
    window.bringSubviewToFront(container)
    container.frame = window.bounds
    let style: UIBlurEffect.Style = dark ? .dark : .light
    if !wasCovering || blurStyle != style {
      blurStyle = style
      // A direct effect always renders. expo-blur's intensity trick (a
      // property animator held at a fraction) is invisible when it is created
      // from an async call instead of a render pass, which left the reader
      // with only the faint scrim.
      blurView.effect = UIBlurEffect(style: style)
    }
    // A fade-out still in flight belongs to the previous change.
    container.layer.removeAllAnimations()
    container.alpha = 1
  }

  func hide() {
    guard container.superview != nil else { return }
    UIView.animate(
      withDuration: Self.fadeDuration,
      delay: 0,
      options: [.beginFromCurrentState, .curveEaseOut]
    ) { [container] in
      container.alpha = 0
    } completion: { [container] _ in
      // Another change raised the cover while this fade was running.
      guard container.alpha == 0, container.superview != nil else { return }
      container.removeFromSuperview()
      container.alpha = 1
    }
  }
}
