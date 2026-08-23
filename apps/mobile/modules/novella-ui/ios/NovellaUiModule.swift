import ExpoModulesCore
import ExpoUI
import UIKit

public final class NovellaUiModule: Module {
  public func definition() -> ModuleDefinition {
    Name("NovellaUi")

    OnCreate {
      ViewModifierRegistry.register("novellaHiddenTopScrollEdgeEffect") { _, _, _ in
        NovellaHiddenTopScrollEdgeEffectModifier()
      }
    }

    OnDestroy {
      ViewModifierRegistry.unregister("novellaHiddenTopScrollEdgeEffect")
    }

    View(NovellaSearchBarView.self) {
      ViewName("SearchBar")

      Prop("query") { (view: NovellaSearchBarView, query: String) in
        view.setQuery(query)
      }
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
    }

    View(NovellaLightAppearanceScopeView.self) {
      ViewName("LightAppearanceScope")
    }

    View(NovellaScrollEdgeMarkerView.self) {
      ViewName("ScrollEdgeMarker")

      Prop("hidesAllEdgeEffects") { (view: NovellaScrollEdgeMarkerView, value: Bool) in
        view.setHidesAllEdgeEffects(value)
      }
      Prop("observesTopBarOverlap") { (view: NovellaScrollEdgeMarkerView, value: Bool) in
        view.setObservesTopBarOverlap(value)
      }

      Events("topBarBackgroundVisibilityChange")
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
