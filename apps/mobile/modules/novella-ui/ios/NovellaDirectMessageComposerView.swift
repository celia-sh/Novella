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
  private var isKeyboardVisible = false
  private var placeholder = ""
  private var maxLength = 2_000

  let onDraftChange = EventDispatcher()
  let onSend = EventDispatcher()
  let onHeightChange = EventDispatcher()

  // The pill sits above the keyboard and reports its occupied height so the
  // transcript can reserve exactly that much scroll padding.
  private let minimumSurfaceHeight: CGFloat = 44
  private let minimumHorizontalInset: CGFloat = 12
  private let restingHorizontalInset: CGFloat = 16
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
    textView.tintColor = .systemBlue
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

    surfaceLeadingConstraint = glassView.leadingAnchor.constraint(
      equalTo: leadingAnchor,
      constant: restingHorizontalInset
    )
    surfaceTrailingConstraint = glassView.trailingAnchor.constraint(
      equalTo: trailingAnchor,
      constant: -restingHorizontalInset
    )
    surfaceBottomConstraint = glassView.bottomAnchor.constraint(
      equalTo: keyboardLayoutGuide.topAnchor,
      constant: -keyboardBottomSpacing
    )
    surfaceHeightConstraint = glassView.heightAnchor.constraint(equalToConstant: minimumSurfaceHeight)
    textHeightConstraint = textView.heightAnchor.constraint(equalToConstant: 30)

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

    updateKeyboardGeometry()
    if abs(lastMeasuredWidth - textView.bounds.width) > 0.5 {
      lastMeasuredWidth = textView.bounds.width
      updateHeight(animated: false)
    }
    glassView.layoutIfNeeded()
    sendButton.layer.cornerRadius = sendButton.bounds.height / 2
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
    sendButton.backgroundColor = active ? .systemBlue : .tertiarySystemFill
    sendButton.tintColor = active ? .white : .tertiaryLabel
  }

  private func updateSendAccessibility() {
    sendButton.isAccessibilityElement = true
    sendButton.accessibilityLabel = "Send message"
    sendButton.accessibilityTraits = isEnabled ? .button : [.button, .notEnabled]
  }

  private func updateHeight(animated: Bool) {
    guard textView.bounds.width > 0 else { return }

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

    let animations = {
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

  private func updateKeyboardGeometry() {
    let guideFrame = keyboardLayoutGuide.layoutFrame
    let visible = guideFrame.minY < bounds.maxY - 1
    let bottomSpacing = visible
      ? keyboardBottomSpacing
      : max(keyboardBottomSpacing, safeAreaInsets.bottom)
    // The pill tightens toward the screen edges once the keyboard is up, the way
    // the system input accessory does.
    let horizontalInset = visible ? minimumHorizontalInset : restingHorizontalInset

    isKeyboardVisible = visible

    if abs(surfaceLeadingConstraint.constant - horizontalInset) > 0.5 {
      surfaceLeadingConstraint.constant = horizontalInset
    }
    if abs(surfaceTrailingConstraint.constant + horizontalInset) > 0.5 {
      surfaceTrailingConstraint.constant = -horizontalInset
    }
    if abs(surfaceBottomConstraint.constant + bottomSpacing) > 0.5 {
      surfaceBottomConstraint.constant = -bottomSpacing
    }
  }

  /// A single line reads as a capsule; once the text wraps the pill keeps a
  /// constant radius instead of ballooning into a circle.
  private func updateCorners() {
    let lineHeight = textView.font?.lineHeight ?? 22
    let isMultiline = textHeightConstraint.constant > lineHeight + textVerticalInset * 2 + 0.5
    let radius: CGFloat = isMultiline ? 20 : min(20, glassView.bounds.height / 2)
    glassView.layer.cornerRadius = radius
  }

  private func reportOccupiedHeightIfNeeded() {
    let bottomSpacing = isKeyboardVisible
      ? keyboardBottomSpacing
      : max(keyboardBottomSpacing, safeAreaInsets.bottom)
    let height = surfaceHeightConstraint.constant + bottomSpacing
    guard abs(height - lastReportedHeight) > 0.5 else { return }
    lastReportedHeight = height
    onHeightChange(["height": Double(height)])
  }
}
