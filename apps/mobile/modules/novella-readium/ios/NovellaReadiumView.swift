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

  private var publicationUri: String?
  private var publicationId: String?
  private var declaredHrefs: [String] = []
  private var initialLocator: [String: Any]?
  private var preferences: [String: Any] = [:]
  private var contentInsets: [String: Double] = [:]
  private var navigator: EPUBNavigatorViewController?
  private var tapObserver: InputObservableToken?
  private var boundaryPanGesture: UIPanGestureRecognizer?
  private var scrollEdgeEffectObservations: [NSKeyValueObservation] = []
  private var observedScrollEdgeEffectIds: Set<ObjectIdentifier> = []
  private var openTask: Task<Void, Never>?
  private var isReady = false
  private var suppressNextTap = false
  private var boundaryCandidate: String?
  private var lastBoundaryEventTime: TimeInterval = 0

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
  }

  func setContentInsets(_ value: [String: Double]) {
    contentInsets = value
    navigator?.view.setNeedsLayout()
    DispatchQueue.main.async { [weak self] in
      self?.hideSystemScrollEdgeEffects()
    }
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
    navigator?.view.frame = bounds
    hideSystemScrollEdgeEffects()
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    guard window != nil else { return }
    hideSystemScrollEdgeEffects()
    DispatchQueue.main.async { [weak self] in
      self?.hideSystemScrollEdgeEffects()
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
      let controller = try EPUBNavigatorViewController(
        publication: publication,
        initialLocation: location,
        readingOrder: navigatorReadingOrder,
        config: EPUBNavigatorViewController.Configuration(
          preferences: makePreferences(),
          disablePageTurnsWhileScrolling: true,
          preloadPreviousPositionCount: 0,
          preloadNextPositionCount: 0
        )
      )
      controller.delegate = self
      detachNavigator()
      navigator = controller
      guard let parent = parentViewController else { throw PublicationViewError.missingParentController }
      parent.addChild(controller)
      addSubview(controller.view)
      controller.didMove(toParent: parent)
      controller.view.frame = bounds
      installInputObservers()
      hideSystemScrollEdgeEffects()
      DispatchQueue.main.async { [weak self] in
        self?.hideSystemScrollEdgeEffects()
      }
      var installedStatus: [String: Any] = ["stage": "navigatorInstalled"]
      if let href = location?.href.description { installedStatus["href"] = href }
      onStatus(installedStatus)
      applyPreferences()
    } catch {
      onError(["code": "navigator_failed", "message": String(describing: error), "recoverable": true])
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

  private func applyPreferences() {
    guard let navigator else { return }
    navigator.submitPreferences(makePreferences())
    enforceScrollModeLayout(navigator.presentation)
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

  private func hideSystemScrollEdgeEffects() {
    guard #available(iOS 26.0, *), let navigator else { return }
    let scrollViews = descendantScrollViews(of: navigator.view)
    let scrollViewIds = Set(scrollViews.map(ObjectIdentifier.init))
    if scrollViewIds != observedScrollEdgeEffectIds {
      scrollEdgeEffectObservations.forEach { $0.invalidate() }
      scrollEdgeEffectObservations.removeAll()
      observedScrollEdgeEffectIds = scrollViewIds
      for scrollView in scrollViews {
        scrollEdgeEffectObservations.append(
          scrollView.observe(\.contentOffset, options: [.new]) { [weak self, weak scrollView] _, _ in
            guard let self, let scrollView else { return }
            self.hideSystemScrollEdgeEffects(on: scrollView)
          }
        )
        scrollEdgeEffectObservations.append(
          scrollView.observe(\.adjustedContentInset, options: [.new]) { [weak self, weak scrollView] _, _ in
            guard let self, let scrollView else { return }
            self.hideSystemScrollEdgeEffects(on: scrollView)
          }
        )
      }
    }
    scrollViews.forEach { hideSystemScrollEdgeEffects(on: $0) }
  }

  private func hideSystemScrollEdgeEffects(on scrollView: UIScrollView) {
    guard #available(iOS 26.0, *) else { return }
    scrollView.topEdgeEffect.isHidden = true
    scrollView.bottomEdgeEffect.isHidden = true
    scrollView.leftEdgeEffect.isHidden = true
    scrollView.rightEdgeEffect.isHidden = true
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

    let scrollViews = descendantScrollViews(of: navigator.view)
    let scrollView = scrollViews
      .filter { scrollView in
        if isHorizontal {
          return scrollView.contentSize.width > scrollView.bounds.width + 2
        }
        return scrollView.contentSize.height > scrollView.bounds.height + 2
      }
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
    if let epubNavigator = self.navigator {
      enforceScrollModeLayout(epubNavigator.presentation)
    }
    hideSystemScrollEdgeEffects()
    if !isReady {
      isReady = true
      onStatus(["stage": "resourceLoaded", "href": locator.href.description])
      onReady([:])
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
    hideSystemScrollEdgeEffects()
    DispatchQueue.main.async { [weak self] in
      self?.hideSystemScrollEdgeEffects()
    }
  }

  func navigator(_ navigator: VisualNavigator, didTapAt point: CGPoint) {}

  func navigator(_ navigator: VisualNavigator, didPressKey event: KeyEvent) {}

  func navigator(_ navigator: VisualNavigator, didReleaseKey event: KeyEvent) {}

  func navigator(_ navigator: VisualNavigator, shouldNavigateToLink link: ReadiumShared.Link) -> Bool {
    onLink(["href": link.href.description, "title": link.title])
    return false
  }

  func navigator(_ navigator: EPUBNavigatorViewController, setupUserScripts userContentController: WKUserContentController) {
    userContentController.add(self, name: "novellaReader")
  }

  func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
    guard
      message.name == "novellaReader",
      let payload = message.body as? [String: Any],
      payload["type"] as? String == "image",
      let uri = payload["uri"] as? String,
      let gesture = payload["gesture"] as? String
    else { return }
    let expectsLongPress = (preferences["imagePreviewOpenOnLongPress"] as? Bool) == true
    guard gesture == (expectsLongPress ? "longPress" : "tap") else { return }
    suppressNextTap = true
    DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in
      self?.suppressNextTap = false
    }
    var event: [String: Any] = ["uri": uri]
    if let alt = payload["alt"] as? String, !alt.isEmpty { event["alt"] = alt }
    onImage(event)
  }

  func navigator(_ navigator: Navigator, shouldNavigateToNoteAt link: ReadiumShared.Link, content: String, referrer: String?) -> Bool {
    onLink(["href": link.href.description, "title": link.title, "content": content, "referrer": referrer])
    return false
  }

  func navigatorContentInset(_ navigator: VisualNavigator) -> UIEdgeInsets? {
    UIEdgeInsets(
      top: contentInsets["top"] ?? 0,
      left: contentInsets["left"] ?? 0,
      bottom: contentInsets["bottom"] ?? 0,
      right: contentInsets["right"] ?? 0
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
    // progress (offset / maximumOffset).
    locations["progression"] = resource.progression.upperBound
    object["locations"] = locations
    return object
  }

  private func detachNavigator() {
    scrollEdgeEffectObservations.forEach { $0.invalidate() }
    scrollEdgeEffectObservations.removeAll()
    observedScrollEdgeEffectIds.removeAll()
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

private enum PublicationViewError: Error {
  case invalidDirectory
  case missingParentController
  case missingReadingOrder
}
