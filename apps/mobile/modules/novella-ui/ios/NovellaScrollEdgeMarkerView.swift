import ExpoModulesCore
import UIKit

/** Locates the hosted content UIScrollView and reports large-title collapse state. */
final class NovellaScrollEdgeMarkerView: ExpoView {
  let topBarBackgroundVisibilityChange = EventDispatcher()

  private var scheduledAttempts = 0
  private weak var observedScrollView: UIScrollView?
  private var contentOffsetObservation: NSKeyValueObservation?
  private var adjustedContentInsetObservation: NSKeyValueObservation?
  private var visibilityEvaluationScheduled = false
  private var observesTopBarOverlap = false
  private var lastReportedVisibility: Bool?

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    isUserInteractionEnabled = false
    isAccessibilityElement = false
    backgroundColor = .clear
  }

  deinit {
    contentOffsetObservation?.invalidate()
    adjustedContentInsetObservation?.invalidate()
  }

  func setObservesTopBarOverlap(_ value: Bool) {
    guard observesTopBarOverlap != value else { return }
    observesTopBarOverlap = value
    lastReportedVisibility = nil
    bindNearestScrollView()
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    guard window != nil else {
      scheduledAttempts = 0
      observedScrollView = nil
      contentOffsetObservation?.invalidate()
      contentOffsetObservation = nil
      adjustedContentInsetObservation?.invalidate()
      adjustedContentInsetObservation = nil
      return
    }
    scheduledAttempts = 0
    bindNearestScrollView()
    scheduleRetry()
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    bindNearestScrollView()
  }

  private func scheduleRetry() {
    guard scheduledAttempts < 3 else { return }
    scheduledAttempts += 1
    DispatchQueue.main.async { [weak self] in
      guard let self, self.window != nil else { return }
      if !self.bindNearestScrollView() {
        self.scheduleRetry()
      }
    }
  }

  @discardableResult
  private func bindNearestScrollView() -> Bool {
    guard let scrollView = nearestScrollView() else { return false }

    if #available(iOS 26.0, *) {
      scrollView.topEdgeEffect.isHidden = true
    }

    guard observesTopBarOverlap else {
      contentOffsetObservation?.invalidate()
      contentOffsetObservation = nil
      adjustedContentInsetObservation?.invalidate()
      adjustedContentInsetObservation = nil
      observedScrollView = nil
      reportVisibility(true)
      return true
    }

    if observedScrollView !== scrollView {
      contentOffsetObservation?.invalidate()
      adjustedContentInsetObservation?.invalidate()
      observedScrollView = scrollView
      contentOffsetObservation = scrollView.observe(
        \.contentOffset,
        options: [.initial, .new]
      ) { [weak self] _, _ in
        self?.scheduleVisibilityEvaluation()
      }
      adjustedContentInsetObservation = scrollView.observe(
        \.adjustedContentInset,
        options: [.initial, .new]
      ) { [weak self] _, _ in
        self?.scheduleVisibilityEvaluation()
      }
    } else {
      scheduleVisibilityEvaluation()
    }
    return true
  }

  private func scheduleVisibilityEvaluation() {
    guard !visibilityEvaluationScheduled else { return }
    visibilityEvaluationScheduled = true
    DispatchQueue.main.async { [weak self] in
      guard let self else { return }
      self.visibilityEvaluationScheduled = false
      guard self.observesTopBarOverlap, let scrollView = self.observedScrollView else { return }
      self.reportVisibility(self.shouldShowBackground(for: scrollView))
    }
  }

  private func shouldShowBackground(for scrollView: UIScrollView) -> Bool {
    // UIKit updates contentOffset and adjustedContentInset separately while a
    // large title collapses. Evaluate their stable pair on the next run loop:
    // it remains zero through the title transition and becomes positive only
    // when content starts moving beneath the compact navigation bar.
    scrollView.contentOffset.y + scrollView.adjustedContentInset.top >= 1
  }

  private func reportVisibility(_ visible: Bool) {
    guard lastReportedVisibility != visible else { return }
    lastReportedVisibility = visible
    topBarBackgroundVisibilityChange(["visible": visible])
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
