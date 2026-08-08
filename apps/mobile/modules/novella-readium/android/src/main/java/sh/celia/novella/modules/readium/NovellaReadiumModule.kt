package sh.celia.novella.modules.readium

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class NovellaReadiumModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("NovellaReadium")

    View(ComposeReadiumView::class) {
      Name("Reader")

      Prop("publicationUri") { view: ComposeReadiumView, value: String ->
        view.setPublicationUri(value)
      }
      Prop("publicationId") { view: ComposeReadiumView, value: String ->
        view.setPublicationId(value)
      }
      Prop("declaredHrefs") { view: ComposeReadiumView, value: List<String> ->
        view.setDeclaredHrefs(value)
      }
      Prop("initialLocator") { view: ComposeReadiumView, value: Map<String, Any>? ->
        view.setInitialLocator(value)
      }
      Prop("preferences") { view: ComposeReadiumView, value: Map<String, Any> ->
        view.setPreferences(value)
      }
      Prop("contentInsets") { view: ComposeReadiumView, value: Map<String, Double> ->
        view.setContentInsets(value)
      }

      Events("onReady", "onLocatorChange", "onLink", "onError")

      AsyncFunction("goToLocator") { view: ComposeReadiumView, locator: Map<String, Any> ->
        view.goToLocator(locator)
      }
      AsyncFunction("goForward") { view: ComposeReadiumView ->
        view.goForward()
      }
      AsyncFunction("goBackward") { view: ComposeReadiumView ->
        view.goBackward()
      }
    }
  }
}
