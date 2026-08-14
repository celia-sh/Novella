import ExpoModulesCore
import UIKit

private struct ScrollEdgeEffectVisibility {
  let top: Bool
  let bottom: Bool
  let left: Bool
  let right: Bool
}

/** Owns system edge suppression and top-bar visibility for one React screen. */
final class NovellaScrollEdgeMarkerView: ExpoView {
  let topBarBackgroundVisibilityChange = EventDispatcher()

  private var scheduledAttempts = 0
  private weak var observedScrollView: UIScrollView?
  private var contentOffsetObservation: NSKeyValueObservation?
  private var adjustedContentInsetObservation: NSKeyValueObservation?
  private var visibilityEvaluationScheduled = false
  private var hidesAllEdgeEffects = false
  private var hidAllEdgeEffectsOnObservedScrollView = false
  private var originalEdgeEffectVisibility: ScrollEdgeEffectVisibility?
  private var observesTopBarOverlap = false
  private var lastReportedVisibility: Bool?

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    isUserInteractionEnabled = false
    isAccessibilityElement = false
    backgroundColor = .clear
  }

  deinit {
    unbindObservedScrollView()
  }

  func setHidesAllEdgeEffects(_ value: Bool) {
    guard hidesAllEdgeEffects != value else { return }
    if !value {
      restoreSecondaryEdgeEffects()
    }
    hidesAllEdgeEffects = value
    bindNearestScrollView()
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
      unbindObservedScrollView()
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
    guard let scrollView = nearestScrollView() else {
      unbindObservedScrollView()
      return false
    }

    if observedScrollView !== scrollView {
      unbindObservedScrollView()
      observedScrollView = scrollView
      originalEdgeEffectVisibility = edgeEffectVisibility(of: scrollView)
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
    }

    hideSystemEdgeEffects(on: scrollView)
    scheduleVisibilityEvaluation()
    return true
  }

  private func scheduleVisibilityEvaluation() {
    guard !visibilityEvaluationScheduled else { return }
    visibilityEvaluationScheduled = true
    DispatchQueue.main.async { [weak self] in
      guard let self else { return }
      self.visibilityEvaluationScheduled = false
      guard let scrollView = self.observedScrollView else { return }
      self.hideSystemEdgeEffects(on: scrollView)
      self.reportVisibility(
        self.observesTopBarOverlap
          ? self.shouldShowBackground(for: scrollView)
          : true
      )
    }
  }

  private func hideSystemEdgeEffects(on scrollView: UIScrollView) {
    guard #available(iOS 26.0, *) else { return }
    scrollView.topEdgeEffect.isHidden = true
    guard hidesAllEdgeEffects else { return }
    scrollView.bottomEdgeEffect.isHidden = true
    scrollView.leftEdgeEffect.isHidden = true
    scrollView.rightEdgeEffect.isHidden = true
    hidAllEdgeEffectsOnObservedScrollView = true
  }

  private func edgeEffectVisibility(of scrollView: UIScrollView) -> ScrollEdgeEffectVisibility? {
    guard #available(iOS 26.0, *) else { return nil }
    return ScrollEdgeEffectVisibility(
      top: scrollView.topEdgeEffect.isHidden,
      bottom: scrollView.bottomEdgeEffect.isHidden,
      left: scrollView.leftEdgeEffect.isHidden,
      right: scrollView.rightEdgeEffect.isHidden
    )
  }

  private func restoreSecondaryEdgeEffects() {
    guard
      #available(iOS 26.0, *),
      hidAllEdgeEffectsOnObservedScrollView,
      let scrollView = observedScrollView,
      let originalEdgeEffectVisibility
    else { return }
    scrollView.bottomEdgeEffect.isHidden = originalEdgeEffectVisibility.bottom
    scrollView.leftEdgeEffect.isHidden = originalEdgeEffectVisibility.left
    scrollView.rightEdgeEffect.isHidden = originalEdgeEffectVisibility.right
    hidAllEdgeEffectsOnObservedScrollView = false
  }

  private func unbindObservedScrollView() {
    if
      #available(iOS 26.0, *),
      let scrollView = observedScrollView,
      let originalEdgeEffectVisibility
    {
      scrollView.topEdgeEffect.isHidden = originalEdgeEffectVisibility.top
      if hidAllEdgeEffectsOnObservedScrollView {
        scrollView.bottomEdgeEffect.isHidden = originalEdgeEffectVisibility.bottom
        scrollView.leftEdgeEffect.isHidden = originalEdgeEffectVisibility.left
        scrollView.rightEdgeEffect.isHidden = originalEdgeEffectVisibility.right
      }
    }
    contentOffsetObservation?.invalidate()
    contentOffsetObservation = nil
    adjustedContentInsetObservation?.invalidate()
    adjustedContentInsetObservation = nil
    observedScrollView = nil
    originalEdgeEffectVisibility = nil
    hidAllEdgeEffectsOnObservedScrollView = false
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
      // A root view whose next responder is a view controller bounds this
      // marker to its own React screen during native navigation transitions.
      if current.next is UIViewController {
        break
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
