import ExpoModulesCore
import ReadiumNavigator
import ReadiumShared
import ReadiumStreamer
import UIKit
import WebKit

final class NovellaReadiumView: ExpoView, EPUBNavigatorDelegate, WKScriptMessageHandler, UIGestureRecognizerDelegate {
  let onReady = EventDispatcher()
  let onLocatorChange = EventDispatcher()
  let onLink = EventDispatcher()
  let onImage = EventDispatcher()
  let onError = EventDispatcher()
  let onStatus = EventDispatcher()
  let onTap = EventDispatcher()
  let onBoundary = EventDispatcher()
  let onProgressMetrics = EventDispatcher()

  private var publicationUri: String?
  private var publicationId: String?
  private var declaredHrefs: [String] = []
  private var initialLocator: [String: Any]?
  private var preferences: [String: Any] = [:]
  private var contentInsets: [String: Double] = [:]
  private var navigator: EPUBNavigatorViewController?
  private var openedPublication: Publication?
  /**
   * Readium's EPUB navigator invalidates pagination for font and margin
   * changes, but not for a column-count change. A fold or rotation can flip a
   * paged reader between one and two columns while the navigator already
   * exists, so the new column count would be written to CSS without ever
   * repaginating. Remember the layout the navigator was built with and rebuild
   * it at the same reading position when that layout changes.
   */
  private var appliedLayoutKey: ReaderLayoutKey?
  private weak var registeredContentScrollView: UIScrollView?
  private weak var registeredContentScrollViewOwner: UIViewController?
  private var tapObserver: InputObservableToken?
  private var boundaryPanGesture: UIPanGestureRecognizer?
  private var openTask: Task<Void, Never>?
  private var isReady = false
  private var suppressNextTap = false
  private var boundaryCandidate: String?
  private var lastBoundaryEventTime: TimeInterval = 0
  private var progressMetricsWorkItem: DispatchWorkItem?
  private var emittedProgressMetrics: String?
  private var lastLayoutSize: CGSize = .zero

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    backgroundColor = .clear
  }

  deinit {
    openTask?.cancel()
    detachNavigator()
  }

  func setPublicationUri(_ value: String) {
    if publicationUri != value { publicationUri = value; scheduleOpen() }
  }

  func setPublicationId(_ value: String) {
    if publicationId != value { publicationId = value; scheduleOpen() }
  }

  func setDeclaredHrefs(_ value: [String]) {
    declaredHrefs = value
    scheduleOpen()
  }

  func setInitialLocator(_ value: [String: Any]?) {
    initialLocator = value
    scheduleOpen()
  }

  func setPreferences(_ value: [String: Any]) {
    preferences = value
    applyPreferences()
    installInputObservers()
    scheduleProgressMetricsUpdate()
  }

  func setContentInsets(_ value: [String: Double]) {
    contentInsets = value
    updateNavigatorFrame()
    navigator?.view.setNeedsLayout()
    scheduleProgressMetricsUpdate()
  }

  func getCurrentLocator() async -> [String: Any]? {
    guard let navigator else { return nil }
    if let locator = await navigator.firstVisibleElementLocator() {
      return bridgeLocator(locator)
    }
    return navigator.currentLocation.map(bridgeLocator)
  }

  func goToLocator(_ value: [String: Any]) async throws -> Bool {
    guard let navigator, let json = JSONValue(value), let locator = try? Locator(json: json, warnings: nil) else { return false }
    return await navigator.go(to: locator, options: .none)
  }

  func goToProgression(_ value: Double) async -> Bool {
    guard let navigator, let current = navigator.currentLocation else { return false }
    let progression = min(max(value, 0), 1)
    let locator = Locator(
      href: current.href,
      mediaType: .xhtml,
      locations: Locator.Locations(progression: progression)
    )
    return await navigator.go(to: locator, options: .none)
  }

  func goForward() async -> Bool {
    guard let navigator else { return false }
    return await navigator.goForward(options: .none)
  }

  func goBackward() async -> Bool {
    guard let navigator else { return false }
    return await navigator.goBackward(options: .none)
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    updateNavigatorFrame()
    registerNavigationContentScrollView()
    if bounds.size != lastLayoutSize {
      lastLayoutSize = bounds.size
      scheduleProgressMetricsUpdate()
    }
  }

  /**
   * Readium only applies the vertical part of navigatorContentInset when it
   * paginates. Inset the web view itself horizontally so paged columns stay
   * clear of edge toolbars, while the reader background behind it still reaches
   * the screen edges.
   */
  private func updateNavigatorFrame() {
    guard let navigator else { return }
    let left = max(0, contentInsets["left"] ?? 0)
    let right = max(0, contentInsets["right"] ?? 0)
    navigator.view.frame = bounds.inset(by: UIEdgeInsets(
      top: 0,
      left: left,
      bottom: 0,
      right: right
    ))
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    guard window != nil else { return }
    registerNavigationContentScrollView()
    scheduleProgressMetricsUpdate()
    DispatchQueue.main.async { [weak self] in
      self?.registerNavigationContentScrollView()
    }
  }

  private func scheduleOpen() {
    openTask?.cancel()
    guard
      publicationId?.isEmpty == false,
      !declaredHrefs.isEmpty,
      let uri = publicationUri,
      let url = URL(string: uri)
    else { return }
    isReady = false
    var openingStatus: [String: Any] = ["stage": "opening"]
    if let href = initialLocator?["href"] as? String { openingStatus["href"] = href }
    onStatus(openingStatus)
    openTask = Task { [weak self] in
      await Task.yield()
      guard !Task.isCancelled else { return }
      do {
        guard let directory = FileURL(url: url) else { throw PublicationViewError.invalidDirectory }
        let entries = Set(self?.declaredHrefs.compactMap { RelativeURL(path: $0) } ?? [])
        let container = DirectoryContainer(directory: directory, entries: entries)
        let httpClient = DefaultHTTPClient()
        let retriever = AssetRetriever(httpClient: httpClient)
        let opener = PublicationOpener(parser: DefaultPublicationParser(httpClient: httpClient, assetRetriever: retriever, pdfFactory: DefaultPDFDocumentFactory()))
        let asset = try await retriever.retrieve(container: container, hints: FormatHints(mediaType: .epub)).get()
        let publication = try await opener.open(asset: asset, allowUserInteraction: false).get()
        guard let self, !Task.isCancelled else { return }
        await MainActor.run { self.install(publication: publication) }
      } catch {
        guard !Task.isCancelled else { return }
        await MainActor.run { [weak self] in
          self?.onError(["code": "open_failed", "message": String(describing: error), "recoverable": true])
        }
      }
    }
  }

  @MainActor private func install(publication: Publication) {
    openedPublication = publication
    appliedLayoutKey = makeLayoutKey()
    do {
      let location = initialLocator.flatMap { value in
        JSONValue(value).flatMap { try? Locator(json: $0, warnings: nil) }
      }
      let navigatorReadingOrder: [ReadiumShared.Link]
      if
        let href = location?.href,
        let index = publication.readingOrder.firstIndexWithHREF(href)
      {
        navigatorReadingOrder = [publication.readingOrder[index]]
      } else if let first = publication.readingOrder.first {
        navigatorReadingOrder = [first]
      } else {
        throw PublicationViewError.missingReadingOrder
      }
      var openedStatus: [String: Any] = [
        "stage": "publicationOpened",
        "detail": "readingOrder=\(publication.readingOrder.count)"
      ]
      if let href = location?.href.description { openedStatus["href"] = href }
      onStatus(openedStatus)
      let controller = try makeNavigator(
        publication: publication,
        initialLocation: location,
        readingOrder: navigatorReadingOrder
      )
      try attachNavigator(controller)
      var installedStatus: [String: Any] = ["stage": "navigatorInstalled"]
      if let href = location?.href.description { installedStatus["href"] = href }
      onStatus(installedStatus)
      applyPreferences()
      scheduleProgressMetricsUpdate()
    } catch {
      onError(["code": "navigator_failed", "message": String(describing: error), "recoverable": true])
    }
  }

  @MainActor private func makeNavigator(
    publication: Publication,
    initialLocation: Locator?,
    readingOrder: [ReadiumShared.Link]
  ) throws -> EPUBNavigatorViewController {
    let controller = try EPUBNavigatorViewController(
      publication: publication,
      initialLocation: initialLocation,
      readingOrder: readingOrder,
      config: EPUBNavigatorViewController.Configuration(
        preferences: makePreferences(),
        disablePageTurnsWhileScrolling: true,
        preloadPreviousPositionCount: 0,
        preloadNextPositionCount: 0
      )
    )
    controller.delegate = self
    return controller
  }

  @MainActor private func attachNavigator(_ controller: EPUBNavigatorViewController) throws {
    detachNavigator()
    navigator = controller
    guard let parent = parentViewController else { throw PublicationViewError.missingParentController }
    parent.addChild(controller)
    addSubview(controller.view)
    controller.didMove(toParent: parent)
    updateNavigatorFrame()
    installInputObservers()
    registerNavigationContentScrollView()
    DispatchQueue.main.async { [weak self] in
      self?.registerNavigationContentScrollView()
    }
  }

  private func makePreferences() -> EPUBPreferences {
    let isPaged = (preferences["mode"] as? String) == "paged"
    let doublePage = (preferences["doublePage"] as? Bool) == true
    return EPUBPreferences(
      backgroundColor: (preferences["backgroundColor"] as? String).flatMap(Color.init(hex:)),
      columnCount: isPaged ? (doublePage ? .two : .one) : nil,
      fontSize: preferences["fontSize"] as? Double,
      lineHeight: preferences["lineHeight"] as? Double,
      pageMargins: preferences["pageMargins"] as? Double,
      paragraphIndent: preferences["paragraphIndent"] as? Double,
      paragraphSpacing: preferences["paragraphSpacing"] as? Double,
      publisherStyles: false,
      scroll: isPaged ? false : true,
      textColor: (preferences["textColor"] as? String).flatMap(Color.init(hex:))
    )
  }

  private func makeLayoutKey() -> ReaderLayoutKey {
    ReaderLayoutKey(
      doublePage: (preferences["doublePage"] as? Bool) == true,
      isPaged: (preferences["mode"] as? String) == "paged"
    )
  }

  private func applyPreferences() {
    guard let navigator else { return }
    let layoutKey = makeLayoutKey()
    if let appliedLayoutKey, appliedLayoutKey != layoutKey {
      let needsColumnRebuild = appliedLayoutKey.isPaged
        && layoutKey.isPaged
        && appliedLayoutKey.doublePage != layoutKey.doublePage
      self.appliedLayoutKey = layoutKey
      if needsColumnRebuild {
        // Preference setters run inside a React prop update. Rebuilding a child
        // view controller there would mutate the view hierarchy mid-update, so
        // defer it by one main-queue turn and read the position then.
        DispatchQueue.main.async { [weak self] in
          guard let self, let navigator = self.navigator else { return }
          self.reinstallNavigator(at: navigator.currentLocation)
        }
        return
      }
      // A paged/scroll switch is already part of Readium's pagination
      // invalidation, so submitPreferences repaginates with the new column
      // count on its own. Reset readiness so the reload applies the column
      // script and reports the new page layout once.
      isReady = false
    }
    appliedLayoutKey = layoutKey
    navigator.submitPreferences(makePreferences())
    enforceScrollModeLayout(navigator.presentation)
  }

  /**
   * Rebuild the navigator after a column-count change so Readium repaginates
   * from scratch with the new layout. The reading position carries over
   * through the current locator.
   */
  private func reinstallNavigator(at location: Locator?) {
    guard let publication = openedPublication else { return }
    do {
      let readingOrder: [ReadiumShared.Link]
      if
        let href = location?.href,
        let index = publication.readingOrder.firstIndexWithHREF(href)
      {
        readingOrder = [publication.readingOrder[index]]
      } else if let first = publication.readingOrder.first {
        readingOrder = [first]
      } else {
        throw PublicationViewError.missingReadingOrder
      }
      let controller = try makeNavigator(
        publication: publication,
        initialLocation: location,
        readingOrder: readingOrder
      )
      isReady = false
      try attachNavigator(controller)
      applyPreferences()
      scheduleProgressMetricsUpdate()
    } catch {
      onError(["code": "navigator_failed", "message": String(describing: error), "recoverable": true])
    }
  }

  private func enforceScrollModeLayout(_ presentation: VisualNavigatorPresentation) {
    guard let navigator else { return }
    let script: String
    if presentation.scroll && presentation.axis == .vertical {
      script = """
      (function(){
        var root=document.documentElement;
        var body=document.body;
        var scroll=document.scrollingElement||root;
        if(!root)return false;
        root.style.setProperty('-webkit-columns','auto auto','important');
        root.style.setProperty('-moz-columns','auto auto','important');
        root.style.setProperty('columns','auto auto','important');
        root.style.setProperty('width','auto','important');
        root.style.setProperty('height','auto','important');
        root.style.setProperty('max-width','none','important');
        root.style.setProperty('max-height','none','important');
        root.style.setProperty('min-width','0','important');
        root.style.setProperty('min-height','0','important');
        root.style.setProperty('overflow-x','hidden','important');
        if(body)body.style.setProperty('overflow-x','hidden','important');
        if(scroll) {
          scroll.style.setProperty('overflow-x','hidden','important');
          scroll.scrollTo({left:0,top:scroll.scrollTop||0,behavior:'instant'});
        }
        return true;
      })()
      """
    } else {
      script = """
      (function(){
        var root=document.documentElement;
        var body=document.body;
        var scroll=document.scrollingElement||root;
        if(!root)return false;
        ['-webkit-columns','-moz-columns','columns','width','height','max-width','max-height','min-width','min-height','overflow-x'].forEach(function(name){root.style.removeProperty(name)});
        [body,scroll].forEach(function(element){if(element)element.style.removeProperty('overflow-x')});
        return true;
      })()
      """
    }
    Task { [weak navigator] in
      _ = await navigator?.evaluateJavaScript(script)
    }
  }

  // Readium inserts an empty view before its pagination scroll view, so RN Screens'
  // first-descendant heuristic cannot discover the actual WebView scroll view. Register it
  // explicitly and leave all UIScrollEdgeEffect instances under UIKit/RN Screens' control.
  @MainActor private func registerNavigationContentScrollView() {
    guard #available(iOS 15.0, *), let navigator else { return }
    guard let webView = descendantWebViews(of: navigator.view).first else { return }
    let scrollView = webView.scrollView
    let owner = parentViewController ?? navigator
    guard registeredContentScrollView !== scrollView || registeredContentScrollViewOwner !== owner else {
      return
    }

    if let previousOwner = registeredContentScrollViewOwner, previousOwner !== owner {
      previousOwner.setContentScrollView(nil, for: .top)
    }
    owner.setContentScrollView(scrollView, for: .top)
    registeredContentScrollView = scrollView
    registeredContentScrollViewOwner = owner
  }

  private func descendantWebViews(of root: UIView) -> [WKWebView] {
    var result: [WKWebView] = []
    var pending = [root]
    while let view = pending.popLast() {
      if let webView = view as? WKWebView {
        result.append(webView)
      }
      pending.append(contentsOf: view.subviews)
    }
    return result
  }

  private func descendantScrollViews(of root: UIView) -> [UIScrollView] {
    var result: [UIScrollView] = []
    var pending = [root]
    while let view = pending.popLast() {
      if let scrollView = view as? UIScrollView {
        result.append(scrollView)
      }
      pending.append(contentsOf: view.subviews)
    }
    return result
  }

  /// Reports how many rendered pages the current chapter has.
  ///
  /// Readium has no page-count API for a reflowable resource, but its WKWebView
  /// has already paginated one: in paged mode the content width is a whole
  /// number of viewport widths, and in scroll mode the content height is a
  /// whole number of screenfuls. This is a measurement of the actual layout,
  /// not an estimate of how the text would fit. The value is emitted only when
  /// it changes, so page turns do not wake React.
  private func scheduleProgressMetricsUpdate() {
    progressMetricsWorkItem?.cancel()
    let item = DispatchWorkItem { [weak self] in
      self?.progressMetricsWorkItem = nil
      self?.emitProgressMetrics()
    }
    progressMetricsWorkItem = item
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.25, execute: item)
    // A spread's content size can still be settling when the first locator
    // arrives; re-read it once the layout has had time to finish.
    DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) { [weak self] in
      self?.emitProgressMetrics()
    }
  }

  private func emitProgressMetrics() {
    guard
      isReady,
      let navigator,
      let scrollView = progressContentScrollView(for: navigator)
    else { return }

    let pageCount: Int
    let isPaged = !navigator.presentation.scroll
    if isPaged {
      let pageWidth = scrollView.bounds.width
      let contentWidth = scrollView.contentSize.width
      guard pageWidth > 1, contentWidth > 1 else { return }
      pageCount = max(1, Int((contentWidth / pageWidth).rounded()))
    } else {
      let visibleHeight = scrollView.bounds.height
        - scrollView.adjustedContentInset.top
        - scrollView.adjustedContentInset.bottom
      let contentHeight = scrollView.contentSize.height
      guard visibleHeight > 1, contentHeight > 1 else { return }
      pageCount = max(1, Int(ceil((contentHeight - 0.5) / visibleHeight)))
    }

    // Page count is a paged-mode concept; scroll mode reports screenfuls and
    // consumers only use them to detect a chapter that fits on one screen.
    let signature = "\(pageCount):\(isPaged)"
    guard signature != emittedProgressMetrics else { return }
    emittedProgressMetrics = signature
    onProgressMetrics(["pageCount": pageCount, "paged": isPaged])
  }

  private func progressContentScrollView(
    for navigator: EPUBNavigatorViewController
  ) -> UIScrollView? {
    if let registeredContentScrollView {
      return registeredContentScrollView
    }
    let isPaged = !navigator.presentation.scroll
    return descendantScrollViews(of: navigator.view).max { left, right in
      let leftExtent = isPaged ? left.contentSize.width : left.contentSize.height
      let rightExtent = isPaged ? right.contentSize.width : right.contentSize.height
      return leftExtent < rightExtent
    }
  }

  @MainActor private func installInputObservers() {
    guard let navigator else { return }
    if let tapObserver {
      navigator.removeObserver(tapObserver)
      self.tapObserver = nil
    }

    tapObserver = navigator.addObserver(.tap { [weak self, weak navigator] event in
      guard let self, let navigator else { return false }
      if self.suppressNextTap {
        self.suppressNextTap = false
        return true
      }

      let isPaged = !navigator.presentation.scroll
      let allowsPageTap = (self.preferences["pagedTapNavigation"] as? Bool) != false
      if isPaged && allowsPageTap {
        let width = navigator.view.bounds.width
        let direction: String?
        if event.location.x <= width * 0.3 {
          direction = "previous"
        } else if event.location.x >= width * 0.7 {
          direction = "next"
        } else {
          direction = nil
        }
        if let direction {
          let moved = direction == "previous"
            ? await navigator.goBackward(options: .init(animated: (self.preferences["pageAnimation"] as? Bool) ?? false))
            : await navigator.goForward(options: .init(animated: (self.preferences["pageAnimation"] as? Bool) ?? false))
          if !moved {
            self.onBoundary(["direction": direction])
          }
          return true
        }
      }

      self.onTap(["x": event.location.x, "y": event.location.y])
      return false
    })
    installBoundaryGesture()
  }

  @MainActor private func installBoundaryGesture() {
    guard boundaryPanGesture == nil else { return }
    let gesture = UIPanGestureRecognizer(target: self, action: #selector(handleBoundaryPan(_:)))
    gesture.cancelsTouchesInView = false
    gesture.delegate = self
    addGestureRecognizer(gesture)
    boundaryPanGesture = gesture
  }

  @objc private func handleBoundaryPan(_ gesture: UIPanGestureRecognizer) {
    switch gesture.state {
    case .began:
      boundaryCandidate = nil
    case .changed:
      boundaryCandidate = navigator.flatMap {
        resolveBoundaryDirection(gesture, navigator: $0)
      }
    case .ended:
      let direction = navigator.flatMap {
        resolveBoundaryDirection(gesture, navigator: $0)
      } ?? boundaryCandidate
      boundaryCandidate = nil
      guard let direction else { return }
      let now = CACurrentMediaTime()
      guard now - lastBoundaryEventTime > 0.35 else { return }
      lastBoundaryEventTime = now
      onBoundary(["direction": direction])
    case .cancelled, .failed:
      boundaryCandidate = nil
    default:
      break
    }
  }

  private func resolveBoundaryDirection(
    _ gesture: UIPanGestureRecognizer,
    navigator: EPUBNavigatorViewController
  ) -> String? {
    let translation = gesture.translation(in: self)
    let velocity = gesture.velocity(in: self)
    let presentation = navigator.presentation
    let isHorizontal = presentation.axis == .horizontal
    let primaryTranslation = isHorizontal ? abs(translation.x) : abs(translation.y)
    let secondaryTranslation = isHorizontal ? abs(translation.y) : abs(translation.x)
    guard primaryTranslation >= secondaryTranslation else { return nil }

    // A short chapter has no scrollable extent, so filtering out contentSize <= bounds
    // would make outward chapter gestures impossible. Prefer the actual WKWebView
    // scroll view registered above; it remains the correct boundary source even when
    // both ends collapse to the same offset.
    let scrollView = registeredContentScrollView ?? descendantScrollViews(of: navigator.view)
      .max { left, right in
        let leftExtent = isHorizontal ? left.contentSize.width : left.contentSize.height
        let rightExtent = isHorizontal ? right.contentSize.width : right.contentSize.height
        return leftExtent < rightExtent
      }
    guard let scrollView else { return nil }

    if isHorizontal {
      let minimum = -scrollView.adjustedContentInset.left
      let maximum = max(
        minimum,
        scrollView.contentSize.width - scrollView.bounds.width + scrollView.adjustedContentInset.right
      )
      let atLeading = scrollView.contentOffset.x <= minimum + 3
      let atTrailing = scrollView.contentOffset.x >= maximum - 3
      return atLeading && (velocity.x > 0 || translation.x > 40)
        ? "previous"
        : atTrailing && (velocity.x < 0 || translation.x < -40)
          ? "next"
          : nil
    }

    let minimum = -scrollView.adjustedContentInset.top
    let maximum = max(
      minimum,
      scrollView.contentSize.height - scrollView.bounds.height + scrollView.adjustedContentInset.bottom
    )
    let atLeading = scrollView.contentOffset.y <= minimum + 3
    let atTrailing = scrollView.contentOffset.y >= maximum - 3
    return atLeading && (velocity.y > 0 || translation.y > 40)
      ? "previous"
      : atTrailing && (velocity.y < 0 || translation.y < -40)
        ? "next"
        : nil
  }

  func gestureRecognizer(
    _ gestureRecognizer: UIGestureRecognizer,
    shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer
  ) -> Bool {
    true
  }

  func navigator(_ navigator: Navigator, locationDidChange locator: Locator) {
    guard
      let epubNavigator = self.navigator,
      (navigator as? EPUBNavigatorViewController) === epubNavigator
    else { return }
    enforceScrollModeLayout(epubNavigator.presentation)
    registerNavigationContentScrollView()
    scheduleProgressMetricsUpdate()
    if !isReady {
      isReady = true
      onStatus(["stage": "resourceLoaded", "href": locator.href.description])
      onReady([:])
      applyDoublePageColumnsIfNeeded()
    }
    onLocatorChange(bridgeLocator(locator))
  }

  func navigator(_ navigator: Navigator, didJumpTo locator: Locator) {}

  func navigator(_ navigator: Navigator, presentError error: NavigatorError) {
    let message = String(describing: error)
    onStatus(["stage": "resourceFailed", "detail": message])
    onError(["code": "navigator_error", "message": message, "recoverable": true])
  }

  func navigator(_ navigator: VisualNavigator, presentationDidChange presentation: VisualNavigatorPresentation) {
    enforceScrollModeLayout(presentation)
    registerNavigationContentScrollView()
  }

  func navigator(_ navigator: VisualNavigator, didTapAt point: CGPoint) {}

  func navigator(_ navigator: VisualNavigator, didPressKey event: KeyEvent) {}

  func navigator(_ navigator: VisualNavigator, didReleaseKey event: KeyEvent) {}

  func navigator(_ navigator: VisualNavigator, shouldNavigateToLink link: ReadiumShared.Link) -> Bool {
    onLink(["href": link.href.description, "title": link.title])
    return false
  }

  private func applyDoublePageColumnsIfNeeded() {
    guard
      (preferences["mode"] as? String) == "paged",
      (preferences["doublePage"] as? Bool) == true,
      let navigator
    else { return }
    Task { [weak self, weak navigator] in
      _ = await navigator?.evaluateJavaScript(Self.doublePageColumnScript)
      DispatchQueue.main.async { self?.scheduleProgressMetricsUpdate() }
    }
  }

  func navigator(_ navigator: EPUBNavigatorViewController, setupUserScripts userContentController: WKUserContentController) {
    userContentController.add(self, name: "novellaReader")
    // Readium CSS only honours --USER__colCount inside a media query whose
    // smallest branch starts at 60em (960 CSS px). The Duo inner display is
    // 951 points wide, so it falls in the gap between the phone-landscape
    // branch (up to 47em) and the 60em branch: the user's two-column
    // preference is never applied. Set the reading-system variable directly
    // on the root so a two-column spread also works at this width.
    let isPaged = (preferences["mode"] as? String) == "paged"
    let doublePage = (preferences["doublePage"] as? Bool) == true
    if isPaged && doublePage {
      userContentController.addUserScript(WKUserScript(
        source: Self.doublePageColumnScript,
        injectionTime: .atDocumentStart,
        forMainFrameOnly: false
      ))
    }
  }


  private static let doublePageColumnScript = """
  (function () {
    function apply() {
      var root = document.documentElement;
      if (!root) return false;
      root.style.setProperty('--RS__colCount', '2', 'important');
      root.style.setProperty('--RS__colWidth', 'auto', 'important');
      return true;
    }
    if (!apply()) {
      document.addEventListener('DOMContentLoaded', apply, { once: true });
    }
  })();
  """

  func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
    guard
      message.name == "novellaReader",
      let payload = message.body as? [String: Any],
      payload["type"] as? String == "image",
      let uri = payload["uri"] as? String,
      let gesture = payload["gesture"] as? String
    else { return }
    let imagePreviewEnabled = (preferences["imagePreviewEnabled"] as? Bool) == true
    guard imagePreviewEnabled, gesture == "longPress" else { return }
    suppressNextTap = true
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in
      self?.suppressNextTap = false
    }
    var event: [String: Any] = ["uri": uri]
    if let alt = payload["alt"] as? String, !alt.isEmpty { event["alt"] = alt }
    if let dataUri = payload["dataUri"] as? String, dataUri.hasPrefix("data:image/") {
      event["dataUri"] = dataUri
    }
    if let width = payload["width"] as? NSNumber, width.doubleValue > 0 {
      event["width"] = width.doubleValue
    }
    if let height = payload["height"] as? NSNumber, height.doubleValue > 0 {
      event["height"] = height.doubleValue
    }
    onImage(event)
  }

  func navigator(_ navigator: Navigator, shouldNavigateToNoteAt link: ReadiumShared.Link, content: String, referrer: String?) -> Bool {
    onLink(["href": link.href.description, "title": link.title, "content": content, "referrer": referrer])
    return false
  }

  func navigatorContentInset(_ navigator: VisualNavigator) -> UIEdgeInsets? {
    // Horizontal safe-area room is applied by insetting the web view frame
    // (see updateNavigatorFrame). Readium only honours left/right content
    // insets in scroll mode, so passing them here would double the inset in
    // scroll mode and still be ignored in paged mode.
    UIEdgeInsets(
      top: contentInsets["top"] ?? 0,
      left: 0,
      bottom: contentInsets["bottom"] ?? 0,
      right: 0
    )
  }

  private func bridgeLocator(_ locator: Locator) -> [String: Any] {
    var object = locator.jsonObject.mapValues(\.any)
    guard
      let resource = navigator?.viewport?.resources.first(where: {
        $0.href.description == locator.href.description
      }) ?? navigator?.viewport?.resources.first,
      var locations = object["locations"] as? [String: Any]
    else {
      return object
    }

    // Readium reports the locator progression at the first visible point.
    // The reader slider follows the visible viewport's trailing point so an
    // exact chapter-end position reaches 100%, matching the old Skia scroll
    // progress (offset / maximumOffset). At the first page, use the leading
    // edge instead so returning to the chapter start reports exactly 0%.
    let visibleProgression = resource.progression
    locations["progression"] = visibleProgression.lowerBound <= 0.0001
      ? 0
      : visibleProgression.upperBound
    object["locations"] = locations
    return object
  }

  private func detachNavigator() {
    progressMetricsWorkItem?.cancel()
    progressMetricsWorkItem = nil
    emittedProgressMetrics = nil
    if let owner = registeredContentScrollViewOwner {
      owner.setContentScrollView(nil, for: .top)
    }
    registeredContentScrollView = nil
    registeredContentScrollViewOwner = nil
    if let controller = navigator, let tapObserver {
      controller.removeObserver(tapObserver)
    }
    tapObserver = nil
    if let boundaryPanGesture {
      removeGestureRecognizer(boundaryPanGesture)
      self.boundaryPanGesture = nil
    }
    guard let controller = navigator else { return }
    controller.willMove(toParent: nil)
    controller.view.removeFromSuperview()
    controller.removeFromParent()
    navigator = nil
  }

  private var parentViewController: UIViewController? {
    var responder: UIResponder? = self
    while let current = responder {
      if let controller = current as? UIViewController { return controller }
      responder = current.next
    }
    return nil
  }
}

private struct ReaderLayoutKey: Equatable {
  let doublePage: Bool
  let isPaged: Bool
}

private enum PublicationViewError: Error {
  case invalidDirectory
  case missingParentController
  case missingReadingOrder
}
