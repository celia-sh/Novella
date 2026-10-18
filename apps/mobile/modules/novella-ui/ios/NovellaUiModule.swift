import ExpoModulesCore
import UIKit

public final class NovellaUiModule: Module {
  public func definition() -> ModuleDefinition {
    Name("NovellaUi")

    AsyncFunction("rasterizeReaderImage") { (uri: String, maxPixelSize: Int) async throws -> String in
      try await ReaderImageRasterizer.rasterize(uri: uri, maxPixelSize: maxPixelSize)
    }

    /// The edge on which iOS 27 renders a vertical navigation bar. It is
    /// `unspecified` on hardware and in window contexts that never use one, so
    /// the reader can opt into edge chrome without guessing from screen size.
    AsyncFunction("getVerticalBarEdge") { () async -> String in
      if #available(iOS 27.1, *) {
        return await MainActor.run {
          let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
          let scene = scenes.first { $0.activationState == .foregroundActive } ?? scenes.first
          let window = scene?.windows.first(where: \.isKeyWindow) ?? scene?.windows.first
          let edge = window?.traitCollection.verticalBarEdge
            ?? window?.rootViewController?.traitCollection.verticalBarEdge
            ?? .unspecified
          switch edge {
          case .leading:
            return "leading"
          case .trailing:
            return "trailing"
          default:
            return "unspecified"
          }
        }
      }
      return "unspecified"
    }

    /// Expo Router clears the toolbar items but leaves the now-empty bottom
    /// toolbar on screen when the last `Stack.Toolbar placement="bottom"`
    /// unmounts. In the reader's vertical-bar layout the slider moved into the
    /// side bar, and the empty toolbar still reserves its height plus the home
    /// indicator as a bottom safe area. Hide it explicitly so the text can use
    /// that space and the top/bottom margins match.
    AsyncFunction("setReaderBottomToolbarHidden") { (hidden: Bool) async in
      await MainActor.run {
        for scene in UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene }) {
          for window in scene.windows {
            for navigationController in NovellaUiModule.navigationControllers(
              in: window.rootViewController
            ) {
              navigationController.setToolbarHidden(hidden, animated: false)
            }
          }
        }
      }
    }

    /// A fold moves the system bars between displays and rebuilds the vertical
    /// column from the bar button items UIKit already holds; it does not ask
    /// the screen for them again. Re-assign the item list so the column is laid
    /// out with the new display's width, and keep the reader's items ahead of
    /// the tab bar when the column is short.
    AsyncFunction("refreshReaderSideBar") { () async in
      if #available(iOS 27.1, *) {
        await MainActor.run {
          for scene in UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene }) {
            for window in scene.windows {
              let navigationControllers = NovellaUiModule.navigationControllers(
                in: window.rootViewController
              )
              guard let navigationController = navigationControllers.last(where: {
                $0.viewIfLoaded?.window != nil
                  && $0.topViewController?.viewIfLoaded?.window != nil
              }) else { continue }
              guard let item = navigationController.topViewController?.navigationItem else { continue }
              item.verticalBarCompressionBehavior = .prefersBarItems
              if let items = item.rightBarButtonItems {
                item.rightBarButtonItems = items
              }
              if let items = item.leftBarButtonItems {
                item.leftBarButtonItems = items
              }
              navigationController.navigationBar.setNeedsLayout()
            }
          }
        }
      }
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

  private static func navigationControllers(
    in root: UIViewController?
  ) -> [UINavigationController] {
    guard let root else { return [] }
    var controllers: [UINavigationController] = []
    if let navigationController = root as? UINavigationController {
      controllers.append(navigationController)
    }
    for child in root.children {
      controllers.append(contentsOf: navigationControllers(in: child))
    }
    if let presented = root.presentedViewController, presented !== root {
      controllers.append(contentsOf: navigationControllers(in: presented))
    }
    return controllers
  }

}
