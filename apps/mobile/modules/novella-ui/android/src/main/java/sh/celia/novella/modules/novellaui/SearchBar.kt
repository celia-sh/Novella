@file:OptIn(
  androidx.compose.material3.ExperimentalMaterial3Api::class,
  androidx.compose.material3.ExperimentalMaterial3ExpressiveApi::class
)

package sh.celia.novella.modules.novellaui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.text.input.rememberTextFieldState
import androidx.compose.material3.DockedSearchBar
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.SearchBarDefaults
import androidx.compose.material3.SearchBarValue
import androidx.compose.material3.rememberSearchBarState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.res.painterResource
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import expo.modules.kotlin.types.OptimizedRecord
import expo.modules.kotlin.views.ComposeProps
import expo.modules.kotlin.views.FunctionalComposableScope
import expo.modules.kotlin.views.OptimizedComposeProps
import expo.modules.ui.ModifierList
import expo.modules.ui.ModifierRegistry

@OptimizedRecord
data class SearchTextEvent(
  @Field val value: String = ""
) : Record

@OptimizedComposeProps
data class SearchBarProps(
  val query: String = "",
  val placeholder: String = "",
  val clearAccessibilityLabel: String = "",
  val enabled: Boolean = true,
  val modifiers: ModifierList = emptyList()
) : ComposeProps

@Composable
fun FunctionalComposableScope.SearchBarContent(
  props: SearchBarProps,
  onQueryChange: (SearchTextEvent) -> Unit,
  onSearch: (SearchTextEvent) -> Unit
) {
  val searchBarState = rememberSearchBarState(initialValue = SearchBarValue.Collapsed)
  val textFieldState = rememberTextFieldState(props.query)
  val focusManager = LocalFocusManager.current

  LaunchedEffect(props.query) {
    val current = textFieldState.text.toString()
    if (current != props.query) {
      textFieldState.edit { replace(0, length, props.query) }
    }
  }

  LaunchedEffect(textFieldState) {
    snapshotFlow { textFieldState.text.toString() }
      .collect { value -> onQueryChange(SearchTextEvent(value)) }
  }

  val submit: (String) -> Unit = { value ->
    onSearch(SearchTextEvent(value))
    focusManager.clearFocus()
  }
  val inputField = @Composable {
    SearchBarDefaults.InputField(
      textFieldState = textFieldState,
      searchBarState = searchBarState,
      onSearch = submit,
      enabled = props.enabled,
      placeholder = { androidx.compose.material3.Text(props.placeholder) },
      leadingIcon = {
        Icon(
          contentDescription = null,
          painter = painterResource(R.drawable.ic_tabler_search_24)
        )
      },
      trailingIcon = if (textFieldState.text.isNotEmpty()) {
        {
          IconButton(onClick = { textFieldState.edit { replace(0, length, "") } }) {
            Icon(
              contentDescription = props.clearAccessibilityLabel,
              painter = painterResource(R.drawable.ic_tabler_x_24)
            )
          }
        }
      } else {
        null
      }
    )
  }

  Box(
    modifier = ModifierRegistry
      .applyModifiers(props.modifiers, appContext, composableScope, globalEventDispatcher)
      .fillMaxWidth()
  ) {
    // The collapsed SearchBar intentionally suppresses the IME and expects a
    // separate expanded search surface. This screen keeps results in React
    // Native, so use the docked container as an always-editable input instead.
    @Suppress("DEPRECATION")
    DockedSearchBar(
      expanded = false,
      onExpandedChange = {},
      inputField = inputField,
      modifier = Modifier.fillMaxWidth()
    ) {}
  }
}
