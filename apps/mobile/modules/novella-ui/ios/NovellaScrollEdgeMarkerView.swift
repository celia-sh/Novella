import ExpoModulesCore
import UIKit

final class NovellaScrollEdgeMarkerView: ExpoView {
  private var scheduledAttempts = 0

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    isUserInteractionEnabled = false
    isAccessibilityElement = false
    backgroundColor = .clear
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    guard window != nil else {
      scheduledAttempts = 0
      return
    }
    scheduledAttempts = 0
    applyToNearestScrollView()
    scheduleRetry()
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    applyToNearestScrollView()
  }

  private func scheduleRetry() {
    guard scheduledAttempts < 3 else { return }
    scheduledAttempts += 1
    DispatchQueue.main.async { [weak self] in
      guard let self, self.window != nil else { return }
      if !self.applyToNearestScrollView() {
        self.scheduleRetry()
      }
    }
  }

  @discardableResult
  private func applyToNearestScrollView() -> Bool {
    guard #available(iOS 26.0, *) else { return true }
    guard let scrollView = nearestScrollView() else { return false }
    if #available(iOS 27.0, *) {
      scrollView.topEdgeEffect.style = .hard
    } else {
      scrollView.topEdgeEffect.style = .soft
    }
    scrollView.topEdgeEffect.isHidden = false
    return true
  }

  private func nearestScrollView() -> UIScrollView? {
    var ancestor = superview
    while let current = ancestor {
      if let scrollView = firstScrollView(in: current, excluding: self) {
        return scrollView
      }
      ancestor = current.superview
    }
    return nil
  }

  private func firstScrollView(in root: UIView, excluding excluded: UIView) -> UIScrollView? {
    var pending = root.subviews.filter { $0 !== excluded }
    while !pending.isEmpty {
      let view = pending.removeFirst()
      if let scrollView = view as? UIScrollView {
        return scrollView
      }
      pending.append(contentsOf: view.subviews)
    }
    return nil
  }
}
