import ExpoModulesCore
import ReadiumNavigator
import ReadiumShared
import ReadiumStreamer
import UIKit
import WebKit

final class NovellaReadiumView: ExpoView, EPUBNavigatorDelegate, WKScriptMessageHandler {
  let onReady = EventDispatcher()
  let onLocatorChange = EventDispatcher()
  let onLink = EventDispatcher()
  let onImage = EventDispatcher()
  let onError = EventDispatcher()
  let onStatus = EventDispatcher()

  private var publicationUri: String?
  private var publicationId: String?
  private var declaredHrefs: [String] = []
  private var initialLocator: [String: Any]?
  private var preferences: [String: Any] = [:]
  private var contentInsets: [String: Double] = [:]
  private var navigator: EPUBNavigatorViewController?
  private var directionalNavigationAdapter: DirectionalNavigationAdapter?
  private var scrollNavigationObserver: InputObservableToken?
  private var scrollEdgeEffectObservations: [NSKeyValueObservation] = []
  private var observedScrollEdgeEffectIds: Set<ObjectIdentifier> = []
  private var openTask: Task<Void, Never>?
  private var isReady = false

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
    installDirectionalNavigationAdapter()
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
          preloadPreviousPositionCount: 0,
          preloadNextPositionCount: 0
        )
      )
      controller.delegate = self
      detachNavigator()
      navigator = controller
      installDirectionalNavigationAdapter()
      guard let parent = parentViewController else { throw PublicationViewError.missingParentController }
      parent.addChild(controller)
      addSubview(controller.view)
      controller.didMove(toParent: parent)
      controller.view.frame = bounds
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
    EPUBPreferences(
      backgroundColor: (preferences["backgroundColor"] as? String).flatMap(Color.init(hex:)),
      fontSize: preferences["fontSize"] as? Double,
      lineHeight: preferences["lineHeight"] as? Double,
      pageMargins: preferences["pageMargins"] as? Double,
      paragraphIndent: preferences["paragraphIndent"] as? Double,
      publisherStyles: false,
      scroll: (preferences["mode"] as? String) == "scroll",
      textColor: (preferences["textColor"] as? String).flatMap(Color.init(hex:))
    )
  }

  private func applyPreferences() {
    navigator?.submitPreferences(makePreferences())
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

  @MainActor private func installDirectionalNavigationAdapter() {
    guard let navigator else { return }
    directionalNavigationAdapter?.unbind()
    directionalNavigationAdapter = nil
    if let scrollNavigationObserver {
      navigator.removeObserver(scrollNavigationObserver)
      self.scrollNavigationObserver = nil
    }
    if (preferences["mode"] as? String) == "scroll" {
      scrollNavigationObserver = navigator.addObserver(.tap { [weak navigator] event in
        guard let navigator else { return false }
        let height = navigator.view.bounds.height
        let direction: Int
        if event.location.y <= height * 0.3 {
          direction = -1
        } else if event.location.y >= height * 0.7 {
          direction = 1
        } else {
          return false
        }
        _ = await navigator.evaluateJavaScript(
          "window.scrollBy({top:window.innerHeight * 0.5 * \(direction),behavior:'auto'});true;"
        )
        return true
      })
      return
    }
    let adapter = DirectionalNavigationAdapter(
      pointerPolicy: .init(
        types: [.touch, .mouse],
        edges: .horizontal,
        ignoreWhileScrolling: true
      ),
      animatedTransition: false
    )
    adapter.bind(to: navigator)
    directionalNavigationAdapter = adapter
  }

  func navigator(_ navigator: Navigator, locationDidChange locator: Locator) {
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
    locator.jsonObject.mapValues(\.any)
  }

  private func detachNavigator() {
    scrollEdgeEffectObservations.forEach { $0.invalidate() }
    scrollEdgeEffectObservations.removeAll()
    observedScrollEdgeEffectIds.removeAll()
    directionalNavigationAdapter?.unbind()
    directionalNavigationAdapter = nil
    if let controller = navigator, let scrollNavigationObserver {
      controller.removeObserver(scrollNavigationObserver)
    }
    scrollNavigationObserver = nil
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
