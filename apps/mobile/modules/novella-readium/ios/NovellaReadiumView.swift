import ExpoModulesCore
import ReadiumNavigator
import ReadiumShared
import ReadiumStreamer
import UIKit

final class NovellaReadiumView: ExpoView, EPUBNavigatorDelegate {
  let onReady = EventDispatcher()
  let onLocatorChange = EventDispatcher()
  let onLink = EventDispatcher()
  let onError = EventDispatcher()

  private var publicationUri: String?
  private var publicationId: String?
  private var declaredHrefs: [String] = []
  private var initialLocator: [String: Any]?
  private var preferences: [String: Any] = [:]
  private var contentInsets: [String: Double] = [:]
  private var navigator: EPUBNavigatorViewController?
  private var openTask: Task<Void, Never>?

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
  }

  func setContentInsets(_ value: [String: Double]) {
    contentInsets = value
    navigator?.view.setNeedsLayout()
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
  }

  private func scheduleOpen() {
    openTask?.cancel()
    guard
      publicationId?.isEmpty == false,
      !declaredHrefs.isEmpty,
      let uri = publicationUri,
      let url = URL(string: uri)
    else { return }
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
      let controller = try EPUBNavigatorViewController(
        publication: publication,
        initialLocation: location,
        config: EPUBNavigatorViewController.Configuration(
          preferences: makePreferences(),
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
      onReady([:])
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

  func navigator(_ navigator: Navigator, locationDidChange locator: Locator) {
    onLocatorChange(locator.jsonObject)
  }

  func navigator(_ navigator: Navigator, didJumpTo locator: Locator) {}

  func navigator(_ navigator: Navigator, presentError error: NavigatorError) {
    onError(["code": "navigator_error", "message": String(describing: error), "recoverable": true])
  }

  func navigator(_ navigator: VisualNavigator, presentationDidChange presentation: VisualNavigatorPresentation) {}

  func navigator(_ navigator: VisualNavigator, didTapAt point: CGPoint) {}

  func navigator(_ navigator: VisualNavigator, didPressKey event: KeyEvent) {}

  func navigator(_ navigator: VisualNavigator, didReleaseKey event: KeyEvent) {}

  func navigator(_ navigator: VisualNavigator, shouldNavigateToLink link: ReadiumShared.Link) -> Bool {
    onLink(["href": link.href.description, "title": link.title])
    return false
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

  private func detachNavigator() {
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
}
