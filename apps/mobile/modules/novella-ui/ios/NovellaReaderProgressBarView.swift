import ExpoModulesCore
import UIKit

final class NovellaReaderProgressBarView: ExpoView {
  private let slider = NovellaReaderProgressSlider()
  private let currentPageLabel = UILabel()
  private let remainingPagesLabel = UILabel()

  private var currentPage = 0
  private var totalPages = 0
  private var progressLabel: String?
  private var isProgressDisabled = false

  let onProgressChange = EventDispatcher()

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    isUserInteractionEnabled = true

    currentPageLabel.font = .monospacedDigitSystemFont(ofSize: 10, weight: .regular)
    currentPageLabel.textAlignment = .center
    currentPageLabel.textColor = .label

    remainingPagesLabel.font = .monospacedDigitSystemFont(ofSize: 10, weight: .regular)
    remainingPagesLabel.textAlignment = .right
    remainingPagesLabel.textColor = .secondaryLabel

    slider.addTarget(self, action: #selector(handleProgressChange), for: .valueChanged)
    addSubview(slider)
    addSubview(currentPageLabel)
    addSubview(remainingPagesLabel)

    slider.translatesAutoresizingMaskIntoConstraints = false
    currentPageLabel.translatesAutoresizingMaskIntoConstraints = false
    remainingPagesLabel.translatesAutoresizingMaskIntoConstraints = false
    NSLayoutConstraint.activate([
      slider.leadingAnchor.constraint(equalTo: leadingAnchor),
      slider.trailingAnchor.constraint(equalTo: trailingAnchor),
      slider.topAnchor.constraint(equalTo: topAnchor, constant: 10),
      slider.heightAnchor.constraint(equalToConstant: 12),

      currentPageLabel.centerXAnchor.constraint(equalTo: centerXAnchor),
      currentPageLabel.bottomAnchor.constraint(equalTo: bottomAnchor),

      remainingPagesLabel.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -12),
      remainingPagesLabel.bottomAnchor.constraint(equalTo: bottomAnchor),
    ])
  }

  func setProgress(_ progress: Double) {
    slider.value = Float(min(max(progress, 0), 1))
  }

  func setDisabled(_ disabled: Bool) {
    isProgressDisabled = disabled
    slider.isUserInteractionEnabled = !disabled
  }

  func setCurrentPage(_ page: Int) {
    currentPage = page
    updatePageLabels()
  }

  func setTotalPages(_ pages: Int) {
    totalPages = pages
    updatePageLabels()
  }

  func setProgressLabel(_ text: String?) {
    progressLabel = text
    updatePageLabels()
  }

  func setRemainingText(_ text: String) {
    remainingPagesLabel.text = text.isEmpty ? nil : text
  }

  func setDirection(_ direction: String) {
    slider.semanticContentAttribute = direction == "rtl"
      ? .forceRightToLeft
      : .forceLeftToRight
  }

  func setAccentColor(_ color: UIColor?) {
    slider.minimumTrackTintColor = color ?? .systemPink
  }

  @objc
  private func handleProgressChange() {
    guard !isProgressDisabled else { return }
    let snapped = snappedProgress(slider.value)
    slider.setValue(snapped, animated: false)
    onProgressChange(["value": Double(snapped)])
  }

  private func snappedProgress(_ value: Float) -> Float {
    guard totalPages > 1 else { return totalPages == 1 ? 1 : value }
    let step = 1 / Float(totalPages - 1)
    return min(max(round(value / step) * step, 0), 1)
  }

  private func updatePageLabels() {
    if let progressLabel {
      currentPageLabel.text = progressLabel
      return
    }
    guard totalPages > 0 else {
      currentPageLabel.text = nil
      return
    }
    let page = min(max(currentPage, 1), totalPages)
    currentPageLabel.text = "\(page) / \(totalPages)"
  }
}

private final class NovellaReaderProgressSlider: UISlider {
  override init(frame: CGRect) {
    super.init(frame: frame)
    minimumValue = 0
    maximumValue = 1
    isContinuous = true
    isUserInteractionEnabled = true
    maximumTrackTintColor = .secondarySystemFill
    setThumbImage(Self.createThumbImage(), for: .normal)
    setThumbImage(Self.createThumbImage(), for: .highlighted)
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func trackRect(forBounds bounds: CGRect) -> CGRect {
    CGRect(x: bounds.minX + 5, y: bounds.midY - 1.5, width: max(0, bounds.width - 10), height: 3)
  }

  private static func createThumbImage() -> UIImage {
    let size = CGSize(width: 18, height: 12)
    return UIGraphicsImageRenderer(size: size).image { context in
      let rect = CGRect(origin: .zero, size: size)
      context.cgContext.setShadow(
        offset: CGSize(width: 0, height: 1),
        blur: 1.5,
        color: UIColor.black.withAlphaComponent(0.16).cgColor
      )
      UIColor.white.setFill()
      UIBezierPath(roundedRect: rect, cornerRadius: 6).fill()
    }
  }
}
