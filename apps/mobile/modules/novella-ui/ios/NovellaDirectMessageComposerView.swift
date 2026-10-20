import ExpoModulesCore
import UIKit

/// Native liquid-glass message composer.
///
/// The RN side owns nothing but the draft string and the enabled flag; all
/// geometry, growth, corner rounding and keyboard tracking happen here so the
/// pill behaves like a system input rather than a JS layout that re-measures on
/// every keystroke.
final class NovellaDirectMessageComposerView: ExpoView, UITextViewDelegate {
  private let glassView: UIVisualEffectView
  private let textView = UITextView(frame: .zero)
  private let placeholderLabel = UILabel(frame: .zero)
  private let sendButton = UIButton(type: .system)

  private var surfaceHeightConstraint: NSLayoutConstraint!
  private var textHeightConstraint: NSLayoutConstraint!
  private var surfaceLeadingConstraint: NSLayoutConstraint!
  private var surfaceTrailingConstraint: NSLayoutConstraint!
  private var surfaceBottomConstraint: NSLayoutConstraint!

  private var lastMeasuredWidth: CGFloat = 0
  private var lastReportedHeight: CGFloat = 0
  private var isEnabled = true
  private weak var transcriptScrollView: UIScrollView?
  private var placeholder = ""
  private var maxLength = 2_000
  private var accentColor: UIColor = .systemBlue

  let onDraftChange = EventDispatcher()
  let onSend = EventDispatcher()
  let onHeightChange = EventDispatcher()

  // The pill sits above the keyboard and reports its occupied height so the
  // transcript can reserve exactly that much scroll padding.
  private let minimumSurfaceHeight: CGFloat = 44
  /// Lines the pill up with the transcript's bubbles, which are inset 16 pt
  /// from the same safe area.
  private let horizontalInset: CGFloat = 16
  private let keyboardBottomSpacing: CGFloat = 10
  private let sendButtonDiameter: CGFloat = 32
  private let textRightInset: CGFloat = 44
  private let textVerticalInset: CGFloat = 8
  private let textLeftInset: CGFloat = 14
  private let textSurfaceVerticalInset: CGFloat = 4
  private let maximumVisibleLines: CGFloat = 6

  required init(appContext: AppContext? = nil) {
    if #available(iOS 26.0, *) {
      let inputEffect = UIGlassEffect(style: .regular)
      inputEffect.isInteractive = true
      glassView = UIVisualEffectView(effect: inputEffect)
    } else {
      glassView = UIVisualEffectView(effect: UIBlurEffect(style: .systemThinMaterial))
    }

    super.init(appContext: appContext)

    backgroundColor = .clear
    isUserInteractionEnabled = true

    glassView.translatesAutoresizingMaskIntoConstraints = false
    glassView.layer.cornerCurve = .continuous
    glassView.layer.masksToBounds = true
    glassView.contentView.backgroundColor = .clear

    textView.translatesAutoresizingMaskIntoConstraints = false
    textView.backgroundColor = .clear
    textView.delegate = self
    textView.font = .preferredFont(forTextStyle: .body)
    textView.textColor = .label
    textView.tintColor = accentColor
    textView.isScrollEnabled = false
    textView.alwaysBounceVertical = false
    textView.showsVerticalScrollIndicator = false
    textView.keyboardDismissMode = .interactive
    textView.returnKeyType = .default
    textView.textContainer.lineFragmentPadding = 0
    textView.textContainerInset = UIEdgeInsets(
      top: textVerticalInset,
      left: textLeftInset,
      bottom: textVerticalInset,
      right: textRightInset
    )
    textView.adjustsFontForContentSizeCategory = true

    placeholderLabel.translatesAutoresizingMaskIntoConstraints = false
    placeholderLabel.font = textView.font
    placeholderLabel.textColor = .placeholderText
    placeholderLabel.numberOfLines = 1
    placeholderLabel.isUserInteractionEnabled = false

    sendButton.translatesAutoresizingMaskIntoConstraints = false
    sendButton.tintColor = .tertiaryLabel
    sendButton.backgroundColor = .tertiarySystemFill
    sendButton.layer.cornerCurve = .continuous
    sendButton.clipsToBounds = true
    // Fixed size, so derive the radius here rather than in `layoutSubviews`,
    // where `bounds` is still .zero on the first pass and leaves the button a
    // rounded square until something else triggers a re-layout.
    sendButton.layer.cornerRadius = sendButtonDiameter / 2
    sendButton.contentHorizontalAlignment = .center
    sendButton.contentVerticalAlignment = .center
    sendButton.setImage(
      UIImage(
        systemName: "arrow.up",
        withConfiguration: UIImage.SymbolConfiguration(pointSize: 16, weight: .bold)
      ),
      for: .normal
    )
    sendButton.accessibilityTraits = .button
    sendButton.addTarget(self, action: #selector(sendButtonPressed), for: .touchUpInside)

    addSubview(glassView)
    glassView.contentView.addSubview(textView)
    glassView.contentView.addSubview(placeholderLabel)
    glassView.contentView.addSubview(sendButton)

    // The view fills the chat, so its safe area is the screen's own: it covers
    // the window edges and the vertical navigation bar on iPhone Duo.
    surfaceLeadingConstraint = glassView.leadingAnchor.constraint(
      equalTo: safeAreaLayoutGuide.leadingAnchor,
      constant: horizontalInset
    )
    surfaceTrailingConstraint = glassView.trailingAnchor.constraint(
      equalTo: safeAreaLayoutGuide.trailingAnchor,
      constant: -horizontalInset
    )
    surfaceBottomConstraint = glassView.bottomAnchor.constraint(
      equalTo: keyboardLayoutGuide.topAnchor,
      constant: -keyboardBottomSpacing
    )
    surfaceHeightConstraint = glassView.heightAnchor.constraint(equalToConstant: minimumSurfaceHeight)
    // Start at the one-line height the first measurement will settle on, so
    // the send button (centered on the text view) is in place before then.
    let initialLineHeight = textView.font?.lineHeight ?? 22
    textHeightConstraint = textView.heightAnchor.constraint(
      equalToConstant: ceil(initialLineHeight + textVerticalInset * 2)
    )

    NSLayoutConstraint.activate([
      surfaceLeadingConstraint,
      surfaceTrailingConstraint,
      surfaceBottomConstraint,
      surfaceHeightConstraint,

      textView.leadingAnchor.constraint(equalTo: glassView.contentView.leadingAnchor),
      textView.trailingAnchor.constraint(equalTo: glassView.contentView.trailingAnchor),
      textView.topAnchor.constraint(
        equalTo: glassView.contentView.topAnchor,
        constant: textSurfaceVerticalInset
      ),
      textHeightConstraint,

      placeholderLabel.leadingAnchor.constraint(equalTo: textView.leadingAnchor, constant: textLeftInset),
      placeholderLabel.topAnchor.constraint(equalTo: textView.topAnchor, constant: textVerticalInset),
      placeholderLabel.trailingAnchor.constraint(lessThanOrEqualTo: sendButton.leadingAnchor, constant: -8),

      sendButton.widthAnchor.constraint(equalToConstant: sendButtonDiameter),
      sendButton.heightAnchor.constraint(equalToConstant: sendButtonDiameter),
      sendButton.trailingAnchor.constraint(
        equalTo: glassView.contentView.trailingAnchor,
        constant: -(textRightInset - sendButtonDiameter) / 2 - 6
      ),
      sendButton.centerYAnchor.constraint(equalTo: textView.centerYAnchor)
    ])

    updatePlaceholder()
    updateSendButton()
  }

  // MARK: - RN props

  func setDraft(_ draft: String) {
    // Never overwrite an active IME composition with a delayed JS prop: doing so
    // clears markedTextRange and commits partial pinyin/zhuyin.
    guard textView.markedTextRange == nil, textView.text != draft else { return }
    textView.text = draft
    updatePlaceholder()
    updateSendButton()
    updateHeight(animated: false)
  }

  func setPlaceholder(_ value: String?) {
    placeholder = value ?? ""
    placeholderLabel.text = placeholder
    updatePlaceholder()
  }

  func setEnabled(_ value: Bool) {
    isEnabled = value
    textView.isEditable = value
    textView.isUserInteractionEnabled = value
    sendButton.isUserInteractionEnabled = value
    updateSendButton()
    updateSendAccessibility()
  }

  func setMaxLength(_ value: Int) {
    maxLength = max(1, value)
  }

  func setAccentColor(_ color: UIColor?) {
    accentColor = color ?? .systemBlue
    textView.tintColor = accentColor
    updateSendButton()
  }

  // MARK: - Imperative handle

  func focus() {
    textView.becomeFirstResponder()
  }

  func blur() {
    textView.resignFirstResponder()
  }

  // MARK: - Layout

  override func layoutSubviews() {
    super.layoutSubviews()

    // Lay the pill out first: the text view only gets its width there, and
    // measuring before that skipped the first pass entirely, leaving the
    // placeholder height (and a send button sitting too high) until a later
    // layout such as focusing happened to measure again.
    glassView.layoutIfNeeded()
    if abs(lastMeasuredWidth - textView.bounds.width) > 0.5 {
      lastMeasuredWidth = textView.bounds.width
      updateHeight(animated: false)
      glassView.layoutIfNeeded()
    }
    updateCorners()
    reportOccupiedHeightIfNeeded()
  }

  /// Touches outside the pill fall through to the transcript behind it, so the
  /// composer never steals a tap meant for a message.
  override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
    guard glassView.frame.insetBy(dx: -4, dy: -4).contains(point) else { return nil }
    return super.hitTest(point, with: event)
  }

  // MARK: - UITextViewDelegate

  func textViewDidChange(_ textView: UITextView) {
    updatePlaceholder()
    updateSendButton()
    updateHeight(animated: true)
    // Emit the exact composing text; trimming is the caller's business.
    onDraftChange(["value": textView.text ?? ""])
  }

  func textView(
    _ textView: UITextView,
    shouldChangeTextIn range: NSRange,
    replacementText text: String
  ) -> Bool {
    // Let UIKit finish marked composition before applying the character limit.
    guard textView.markedTextRange == nil else { return true }
    let current = textView.text ?? ""
    let next = (current as NSString).replacingCharacters(in: range, with: text)
    return Array(next).count <= maxLength
  }

  @objc
  private func sendButtonPressed() {
    guard isEnabled, textView.markedTextRange == nil else { return }
    let value = textView.text ?? ""
    guard !value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }

    textView.text = ""
    updatePlaceholder()
    updateSendButton()
    updateHeight(animated: true)
    onDraftChange(["value": ""])
    onSend(["value": value])
  }

  // MARK: - State

  private func updatePlaceholder() {
    let isEmpty = (textView.text ?? "").isEmpty
    placeholderLabel.isHidden = !isEmpty || placeholder.isEmpty
  }

  private func updateSendButton() {
    let hasText = textView.markedTextRange == nil
      && !((textView.text ?? "").trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
    let active = isEnabled && hasText
    sendButton.isEnabled = active
    sendButton.backgroundColor = active ? accentColor : .tertiarySystemFill
    sendButton.tintColor = active ? .white : .tertiaryLabel
  }

  private func updateSendAccessibility() {
    sendButton.isAccessibilityElement = true
    sendButton.accessibilityLabel = "Send message"
    sendButton.accessibilityTraits = isEnabled ? .button : [.button, .notEnabled]
  }

  private func updateHeight(animated: Bool) {
    guard textView.bounds.width > 0 else { return }

    let previousOccupiedHeight = occupiedHeight
    let wasScrollEnabled = textView.isScrollEnabled
    let previousOffset = textView.contentOffset
    textView.isScrollEnabled = false
    let fittingHeight = textView.sizeThatFits(
      CGSize(width: textView.bounds.width, height: .greatestFiniteMagnitude)
    ).height
    let lineHeight = textView.font?.lineHeight ?? 22
    let minimumTextHeight = ceil(lineHeight + textVerticalInset * 2)
    let maximumTextHeight = ceil(lineHeight * maximumVisibleLines + textVerticalInset * 2)
    let textHeight = min(max(fittingHeight, minimumTextHeight), maximumTextHeight)
    let shouldScroll = fittingHeight > maximumTextHeight + 0.5

    textHeightConstraint.constant = textHeight
    surfaceHeightConstraint.constant = max(
      minimumSurfaceHeight,
      textHeight + textSurfaceVerticalInset * 2
    )
    textView.isScrollEnabled = shouldScroll
    if !shouldScroll && wasScrollEnabled {
      textView.setContentOffset(.zero, animated: false)
    } else if shouldScroll {
      textView.setContentOffset(previousOffset, animated: false)
    }

    let delta = occupiedHeight - previousOccupiedHeight
    let animations = {
      // Only typing animates. The first measurement and drafts set from JS
      // establish the inset there; nothing on screen is following yet.
      if animated && self.lastReportedHeight > 0 && abs(delta) > 0.5 {
        self.shiftTranscript(by: delta)
      }
      self.superview?.layoutIfNeeded()
      self.layoutIfNeeded()
      self.updateCorners()
      self.reportOccupiedHeightIfNeeded()
    }
    if animated {
      UIView.animate(
        withDuration: 0.2,
        delay: 0,
        options: [.beginFromCurrentState, .curveEaseInOut, .allowUserInteraction],
        animations: animations
      )
    } else {
      animations()
    }
  }

  /// Moves the transcript with the pill, inside the pill's own animation, so
  /// the newest message rises and falls in the same frames as the pill edge.
  /// Its bottom inset grows by the same amount, and a transcript resting at its
  /// end stays there. JS mirrors the final inset and offset when the height
  /// event arrives; those equal what is already set, so nothing moves twice.
  private func shiftTranscript(by delta: CGFloat) {
    guard let scrollView = findTranscriptScrollView() else { return }
    let endOffset = { (bottomInset: CGFloat) in
      max(0, scrollView.contentSize.height - scrollView.bounds.height + bottomInset)
    }
    var inset = scrollView.contentInset
    let following = !scrollView.isDragging && !scrollView.isDecelerating
      && scrollView.contentOffset.y >= endOffset(inset.bottom) - 20
    inset.bottom = max(0, inset.bottom + delta)
    let offset = CGPoint(x: scrollView.contentOffset.x, y: endOffset(inset.bottom))
    // Keep the offset inside the range at every step: grow the range before
    // moving down into it, move up before shrinking it.
    if delta > 0 {
      scrollView.contentInset = inset
      if following { scrollView.contentOffset = offset }
    } else {
      if following { scrollView.contentOffset = offset }
      scrollView.contentInset = inset
    }
  }

  /// The transcript is the scroll view among this view's siblings. Searching
  /// each sibling from the outside in finds it before any scrolling text inside.
  private func findTranscriptScrollView() -> UIScrollView? {
    if let cached = transcriptScrollView, cached.window != nil { return cached }
    func search(_ view: UIView) -> UIScrollView? {
      if let scrollView = view as? UIScrollView { return scrollView }
      for subview in view.subviews {
        if let found = search(subview) { return found }
      }
      return nil
    }
    for sibling in superview?.subviews ?? [] where sibling !== self {
      if let found = search(sibling) {
        transcriptScrollView = found
        return found
      }
    }
    return nil
  }

  /// A single line reads as a capsule; once the text wraps the pill keeps a
  /// constant radius instead of ballooning into a circle.
  private func updateCorners() {
    let lineHeight = textView.font?.lineHeight ?? 22
    let isMultiline = textHeightConstraint.constant > lineHeight + textVerticalInset * 2 + 0.5
    let radius: CGFloat = isMultiline ? 20 : min(20, glassView.bounds.height / 2)
    glassView.layer.cornerRadius = radius
  }

  /// Report one number regardless of keyboard state: the scroll view already
  /// accounts for the safe area on its own, so folding it in here double-counts
  /// and pushes the transcript further than the pill actually covers.
  private var occupiedHeight: CGFloat {
    surfaceHeightConstraint.constant + keyboardBottomSpacing
  }

  private func reportOccupiedHeightIfNeeded() {
    let height = occupiedHeight
    guard abs(height - lastReportedHeight) > 0.5 else { return }
    lastReportedHeight = height
    onHeightChange(["height": Double(height)])
  }
}
