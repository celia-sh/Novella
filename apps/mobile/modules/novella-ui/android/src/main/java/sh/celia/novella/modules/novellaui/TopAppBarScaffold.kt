package sh.celia.novella.modules.novellaui

import android.graphics.Color
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LargeTopAppBar
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.res.painterResource
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import expo.modules.kotlin.types.Enumerable
import expo.modules.kotlin.types.OptimizedRecord
import expo.modules.ui.ModifierList
import expo.modules.ui.ModifierRegistry
import expo.modules.ui.UIComposableScope
import expo.modules.ui.composeOrNull
import expo.modules.kotlin.views.ComposeProps
import expo.modules.kotlin.views.FunctionalComposableScope
import expo.modules.kotlin.views.OptimizedComposeProps

@OptimizedRecord
data class BackPressedEvent(
  @Field val value: Boolean = true
) : Record

enum class TopAppBarActionIcon(val value: String) : Enumerable {
  ADJUSTMENTS_HORIZONTAL("adjustmentsHorizontal"),
  BELL("bell"),
  CHECK("check"),
  DOTS("dots"),
  EDIT("edit"),
  FOLDER_MOVE("folderMove"),
  FOLDER_PLUS("folderPlus"),
  LIST_CHECK("listCheck"),
  PENCIL("pencil"),
  SORT_ASCENDING("sortAscending"),
  TRASH("trash"),
  USER_CIRCLE("userCircle"),
  X("x");

  val resourceId: Int
    get() = when (this) {
      ADJUSTMENTS_HORIZONTAL -> R.drawable.ic_tabler_adjustments_horizontal_24
      BELL -> R.drawable.ic_tabler_bell_24
      CHECK -> R.drawable.ic_tabler_check_24
      DOTS -> R.drawable.ic_tabler_dots_24
      EDIT -> R.drawable.ic_tabler_edit_24
      FOLDER_MOVE -> R.drawable.ic_tabler_folder_symlink_24
      FOLDER_PLUS -> R.drawable.ic_tabler_folder_plus_24
      LIST_CHECK -> R.drawable.ic_tabler_list_check_24
      PENCIL -> R.drawable.ic_tabler_pencil_24
      SORT_ASCENDING -> R.drawable.ic_tabler_sort_ascending_24
      TRASH -> R.drawable.ic_tabler_trash_24
      USER_CIRCLE -> R.drawable.ic_tabler_user_circle_24
      X -> R.drawable.ic_tabler_x_24
    }
}

@OptimizedRecord
data class TopAppBarActionMenuItem(
  @Field val id: String = "",
  @Field val label: String = "",
  @Field val enabled: Boolean = true,
  @Field val selected: Boolean = false,
  @Field val icon: SelectionMenuIcon? = null
) : Record

@OptimizedRecord
data class TopAppBarAction(
  @Field val id: String = "",
  @Field val icon: TopAppBarActionIcon = TopAppBarActionIcon.PENCIL,
  @Field val accessibilityLabel: String = "",
  @Field val enabled: Boolean = true,
  @Field val menuItems: List<TopAppBarActionMenuItem> = emptyList()
) : Record

@OptimizedRecord
data class TopAppBarActionEvent(
  @Field val id: String = ""
) : Record

@OptimizedComposeProps
data class TopAppBarScaffoldProps(
  val title: String = "",
  val backAccessibilityLabel: String = "",
  val containerColor: Color? = null,
  val contentColor: Color? = null,
  val largeTitle: Boolean = true,
  val showBackButton: Boolean = false,
  val actions: List<TopAppBarAction> = emptyList(),
  val modifiers: ModifierList = emptyList()
) : ComposeProps

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FunctionalComposableScope.TopAppBarScaffoldContent(
  props: TopAppBarScaffoldProps,
  onBackPressed: () -> Unit,
  onActionPressed: (TopAppBarActionEvent) -> Unit
) {
  val containerColor = props.containerColor.composeOrNull ?: MaterialTheme.colorScheme.surface
  val contentColor = props.contentColor.composeOrNull ?: MaterialTheme.colorScheme.onSurface
  val scrollBehavior = if (props.largeTitle) {
    TopAppBarDefaults.exitUntilCollapsedScrollBehavior()
  } else {
    TopAppBarDefaults.pinnedScrollBehavior()
  }
  val modifier = ModifierRegistry
    .applyModifiers(props.modifiers, appContext, composableScope, globalEventDispatcher)
    .fillMaxSize()
    .nestedScroll(scrollBehavior.nestedScrollConnection)

  Scaffold(
    modifier = modifier,
    containerColor = containerColor,
    contentColor = contentColor,
    contentWindowInsets = WindowInsets(0, 0, 0, 0),
    topBar = {
      if (props.largeTitle) {
        LargeTopAppBar(
          title = { Text(props.title) },
          navigationIcon = {
            BackButton(props.showBackButton, props.backAccessibilityLabel, onBackPressed)
          },
          actions = { TopAppBarActions(props.actions, onActionPressed) },
          colors = topAppBarColors(containerColor, contentColor),
          scrollBehavior = scrollBehavior
        )
      } else {
        TopAppBar(
          title = { Text(props.title) },
          navigationIcon = {
            BackButton(props.showBackButton, props.backAccessibilityLabel, onBackPressed)
          },
          actions = { TopAppBarActions(props.actions, onActionPressed) },
          colors = topAppBarColors(containerColor, contentColor),
          scrollBehavior = scrollBehavior
        )
      }
    }
  ) { innerPadding ->
    Box(
      modifier = Modifier
        .fillMaxSize()
        .padding(innerPadding)
    ) {
      Children(
        UIComposableScope(
          boxScope = this@Box,
          nestedScrollConnection = scrollBehavior.nestedScrollConnection
        )
      )
    }
  }
}

@Composable
private fun TopAppBarActions(
  actions: List<TopAppBarAction>,
  onActionPressed: (TopAppBarActionEvent) -> Unit
) {
  actions.take(4).forEach { action ->
    var menuExpanded by remember(action.id) { mutableStateOf(false) }
    Box {
      IconButton(
        enabled = action.enabled,
        onClick = {
          if (action.menuItems.isEmpty()) {
            onActionPressed(TopAppBarActionEvent(action.id))
          } else {
            menuExpanded = true
          }
        }
      ) {
        Icon(
          contentDescription = action.accessibilityLabel,
          painter = painterResource(action.icon.resourceId)
        )
      }
      SelectionDropdownMenu(
        enabled = action.enabled,
        entries = action.menuItems.map { item ->
          SelectionMenuEntry(
            id = item.id,
            label = item.label,
            enabled = item.enabled,
            selected = item.selected,
            icon = item.icon
          )
        },
        expanded = menuExpanded,
        onDismissRequest = { menuExpanded = false },
        onSelected = { item ->
          menuExpanded = false
          onActionPressed(TopAppBarActionEvent(item.id))
        }
      )
    }
  }
}

@Composable
private fun BackButton(
  showBackButton: Boolean,
  accessibilityLabel: String,
  onBackPressed: () -> Unit
) {
  if (!showBackButton) return
  IconButton(onClick = onBackPressed) {
    Icon(
      contentDescription = accessibilityLabel,
      painter = painterResource(R.drawable.ic_arrow_back_24)
    )
  }
}

@Composable
private fun topAppBarColors(
  containerColor: androidx.compose.ui.graphics.Color,
  contentColor: androidx.compose.ui.graphics.Color
) = TopAppBarDefaults.topAppBarColors(
  containerColor = containerColor,
  scrolledContainerColor = containerColor,
  navigationIconContentColor = contentColor,
  titleContentColor = contentColor,
  actionIconContentColor = contentColor
)
