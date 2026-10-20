import ExpoModulesCore
import UIKit

/// Reports the size UIKit actually gives the view.
///
/// A React view hosted as a bar button item's custom view is resized by the
/// bar to fit its platter, and Yoga is never told: the children keep the
/// layout computed for the requested width. Rendering at the reported width
/// makes the two agree.
final class NovellaBoundsReporterView: ExpoView {
  let onBoundsChange = EventDispatcher()

  private var reportedSize: CGSize = .zero

  override func layoutSubviews() {
    super.layoutSubviews()
    let size = bounds.size
    guard size.width > 0, size.height > 0 else { return }
    guard abs(size.width - reportedSize.width) >= 0.5
      || abs(size.height - reportedSize.height) >= 0.5 else { return }
    reportedSize = size
    onBoundsChange(["height": size.height, "width": size.width])
  }
}
