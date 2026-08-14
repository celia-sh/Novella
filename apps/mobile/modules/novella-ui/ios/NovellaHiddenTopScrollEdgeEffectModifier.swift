import SwiftUI

struct NovellaHiddenTopScrollEdgeEffectModifier: ViewModifier {
  @ViewBuilder
  func body(content: Content) -> some View {
    if #available(iOS 26.0, *) {
      content.scrollEdgeEffectHidden(true, for: .top)
    } else {
      content
    }
  }
}
