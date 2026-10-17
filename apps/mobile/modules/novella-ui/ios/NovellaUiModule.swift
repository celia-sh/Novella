import ExpoModulesCore
import UIKit

public final class NovellaUiModule: Module {
  public func definition() -> ModuleDefinition {
    Name("NovellaUi")

    AsyncFunction("rasterizeReaderImage") { (uri: String, maxPixelSize: Int) async throws -> String in
      try await ReaderImageRasterizer.rasterize(uri: uri, maxPixelSize: maxPixelSize)
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
}
