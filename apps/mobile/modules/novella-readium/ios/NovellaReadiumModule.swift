import ExpoModulesCore

public final class NovellaReadiumModule: Module {
  public func definition() -> ModuleDefinition {
    Name("NovellaReadium")

    View(NovellaReadiumView.self) {
      ViewName("Reader")

      Prop("publicationUri") { (view: NovellaReadiumView, value: String) in
        view.setPublicationUri(value)
      }
      Prop("publicationId") { (view: NovellaReadiumView, value: String) in
        view.setPublicationId(value)
      }
      Prop("declaredHrefs") { (view: NovellaReadiumView, value: [String]) in
        view.setDeclaredHrefs(value)
      }
      Prop("initialLocator") { (view: NovellaReadiumView, value: [String: Any]?) in
        view.setInitialLocator(value)
      }
      Prop("preferences") { (view: NovellaReadiumView, value: [String: Any]) in
        view.setPreferences(value)
      }
      Prop("contentInsets") { (view: NovellaReadiumView, value: [String: Double]) in
        view.setContentInsets(value)
      }

      Events("onReady", "onLocatorChange", "onLink", "onImage", "onError", "onStatus")

      AsyncFunction("getCurrentLocator") { (view: NovellaReadiumView) async -> [String: Any]? in
        await view.getCurrentLocator()
      }
      AsyncFunction("goToLocator") { (view: NovellaReadiumView, locator: [String: Any]) async throws -> Bool in
        try await view.goToLocator(locator)
      }
      AsyncFunction("goForward") { (view: NovellaReadiumView) async -> Bool in
        await view.goForward()
      }
      AsyncFunction("goBackward") { (view: NovellaReadiumView) async -> Bool in
        await view.goBackward()
      }
    }
  }
}
