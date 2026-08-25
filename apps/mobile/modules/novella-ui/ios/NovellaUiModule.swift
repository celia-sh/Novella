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

    View(NovellaLightAppearanceScopeView.self) {
      ViewName("LightAppearanceScope")
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

    View(NovellaReaderProgressBarView.self) {
      ViewName("ReaderProgressBar")

      Prop("progress") { (view: NovellaReaderProgressBarView, progress: Double) in
        view.setProgress(progress)
      }
      Prop("currentPage") { (view: NovellaReaderProgressBarView, currentPage: Int) in
        view.setCurrentPage(currentPage)
      }
      Prop("disabled") { (view: NovellaReaderProgressBarView, disabled: Bool) in
        view.setDisabled(disabled)
      }
      Prop("totalPages") { (view: NovellaReaderProgressBarView, totalPages: Int) in
        view.setTotalPages(totalPages)
      }
      Prop("remainingText") { (view: NovellaReaderProgressBarView, remainingText: String) in
        view.setRemainingText(remainingText)
      }
      Prop("direction") { (view: NovellaReaderProgressBarView, direction: String) in
        view.setDirection(direction)
      }
      Prop("accentColor") { (view: NovellaReaderProgressBarView, accentColor: UIColor?) in
        view.setAccentColor(accentColor)
      }

      Events("onProgressChange")
    }
  }
}
