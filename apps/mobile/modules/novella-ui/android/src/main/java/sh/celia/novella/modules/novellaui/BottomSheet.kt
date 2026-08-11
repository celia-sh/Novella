package sh.celia.novella.modules.novellaui

import android.graphics.Color
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.material3.BottomSheet
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SheetState
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.runtime.Stable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import expo.modules.kotlin.types.OptimizedRecord
import expo.modules.kotlin.views.ComposeProps
import expo.modules.kotlin.views.FunctionalComposableScope
import expo.modules.kotlin.views.OptimizedComposeProps
import expo.modules.ui.UIComposableScope
import expo.modules.ui.composeOrNull
import kotlinx.coroutines.launch

@OptimizedComposeProps
data class BottomSheetProps(
  val containerColor: Color? = null,
  val supportsPartialExpansion: Boolean = false
) : ComposeProps

@OptimizedRecord
data class BottomSheetDismissEvent(
  @Field val value: Boolean = true
) : Record

@Stable
@OptIn(ExperimentalMaterial3Api::class)
private class BottomSheetWindowInsets(
  private val state: SheetState
) : WindowInsets {
  override fun getLeft(density: Density, layoutDirection: LayoutDirection) = 0

  override fun getTop(density: Density): Int = try {
    state.requireOffset().toInt().coerceAtLeast(0)
  } catch (_: IllegalStateException) {
    0
  }

  override fun getRight(density: Density, layoutDirection: LayoutDirection) = 0

  override fun getBottom(density: Density) = 0

  override fun equals(other: Any?): Boolean =
    this === other || (other is BottomSheetWindowInsets && state == other.state)

  override fun hashCode(): Int = state.hashCode()
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FunctionalComposableScope.BottomSheetContent(
  props: BottomSheetProps,
  onDismissRequest: () -> Unit
) {
  val state = rememberModalBottomSheetState(
    skipPartiallyExpanded = !props.supportsPartialExpansion
  )
  val scope = rememberCoroutineScope()
  val sheetWindowInsets = remember(state) { BottomSheetWindowInsets(state) }
  val containerColor = props.containerColor.composeOrNull ?: MaterialTheme.colorScheme.surface
  var isReady by remember { mutableStateOf(false) }
  var isDismissing by remember { mutableStateOf(false) }

  fun dismiss() {
    if (!isReady || isDismissing) return
    isDismissing = true
    scope.launch {
      state.hide()
      onDismissRequest()
    }
  }

  Dialog(
    onDismissRequest = ::dismiss,
    properties = DialogProperties(
      dismissOnBackPress = false,
      dismissOnClickOutside = false,
      usePlatformDefaultWidth = false,
      decorFitsSystemWindows = false
    )
  ) {
    // This Dialog is edge-to-edge, so the activity's adjustResize policy does
    // not resize it for the IME. Constrain the native sheet above the keyboard
    // before measuring its anchors and the hosted React Native content.
    Box(
      modifier = Modifier
        .fillMaxSize()
        .imePadding()
    ) {
      Box(
        modifier = Modifier
          .fillMaxSize()
          .clickable(onClick = ::dismiss)
      )
      BottomSheet(
        modifier = Modifier
          .align(Alignment.TopCenter)
          .consumeWindowInsets(sheetWindowInsets),
        state = state,
        onDismissRequest = ::dismiss,
        containerColor = containerColor,
        contentColor = MaterialTheme.colorScheme.onSurface,
        contentWindowInsets = {
          WindowInsets.safeDrawing.only(WindowInsetsSides.Top)
        },
        gesturesEnabled = true,
        backHandlerEnabled = true
      ) {
        Children(UIComposableScope())
      }
    }
  }

  LaunchedEffect(state, props.supportsPartialExpansion) {
    if (props.supportsPartialExpansion) {
      state.partialExpand()
    } else {
      state.show()
    }
    isReady = true
  }
}
