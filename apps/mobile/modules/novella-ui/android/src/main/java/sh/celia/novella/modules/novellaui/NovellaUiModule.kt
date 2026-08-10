package sh.celia.novella.modules.novellaui

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.ui.ExpoUIView

class NovellaUiModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("NovellaUi")

    ExpoUIView<BlurHashProps>("BlurHash") {
      Content { props -> BlurHashContent(props) }
    }

    ExpoUIView<BottomSheetProps>("BottomSheet") {
      val onDismissRequest by Event<BottomSheetDismissEvent>()

      Content { props ->
        BottomSheetContent(props) { onDismissRequest(BottomSheetDismissEvent()) }
      }
    }

    ExpoUIView<TopAppBarScaffoldProps>("TopAppBarScaffold") {
      val onActionPressed by Event<TopAppBarActionEvent>()
      val onBackPressed by Event<BackPressedEvent>()

      Content { props ->
        TopAppBarScaffoldContent(
          props,
          onBackPressed = { onBackPressed(BackPressedEvent()) },
          onActionPressed = { onActionPressed(it) }
        )
      }
    }

    ExpoUIView<SegmentedControlProps>("SegmentedControl") {
      val onValueChange by Event<SegmentedControlChangeEvent>()

      Content { props ->
        SegmentedControlContent(props) { onValueChange(it) }
      }
    }

    ExpoUIView<SearchBarProps>("SearchBar") {
      val onQueryChange by Event<SearchTextEvent>()
      val onSearch by Event<SearchTextEvent>()

      Content { props ->
        SearchBarContent(
          props,
          onQueryChange = { onQueryChange(it) },
          onSearch = { onSearch(it) }
        )
      }
    }

    ExpoUIView<BottomAppBarProps>("BottomAppBar") {
      val onPreviousPressed by Event<BottomBarPressEvent>()
      val onNextPressed by Event<BottomBarPressEvent>()

      Content { props ->
        BottomAppBarContent(
          props,
          onPreviousPressed = { onPreviousPressed(BottomBarPressEvent()) },
          onNextPressed = { onNextPressed(BottomBarPressEvent()) }
        )
      }
    }

    ExpoUIView<SelectionMenuProps>("SelectionMenu") {
      val onExpandedChange by Event<ExpandedChangeEvent>()
      val onItemSelected by Event<DropdownItemSelectedEvent>()

      Content { props ->
        SelectionMenuContent(
          props,
          onExpandedChange = { onExpandedChange(ExpandedChangeEvent(it)) },
          onItemSelected = { onItemSelected(DropdownItemSelectedEvent(it)) }
        )
      }
    }
  }
}
