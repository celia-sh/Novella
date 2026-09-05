import ExpoModulesCore
import UIKit

final class PencilTapDelegate: NSObject, UIPencilInteractionDelegate {
  weak var module: NovellaPencilModule?

  func pencilInteractionDidTap(_ interaction: UIPencilInteraction) {
    module?.sendEvent("onPencilTap", [:])
  }
}

/// Keeps the shared interaction and its delegate alive for the whole app run,
/// independent of window and route lifetimes.
private final class PencilInteractionHost {
  let delegate = PencilTapDelegate()
  let interaction = UIPencilInteraction()
  weak var attachedWindow: UIWindow?

  init() {
    interaction.delegate = delegate
  }
}

public final class NovellaPencilModule: Module {
  private static var host: PencilInteractionHost?
  private static let windowRetryCount = 20

  public func definition() -> ModuleDefinition {
    Name("NovellaPencil")

    Events("onPencilTap")

    // Attaches one app-wide pencil interaction to the key window. Reader
    // screens decide whether an incoming tap turns a page, so the module
    // itself carries no reading state.
    Function("activate") { () in
      Self.install(module: self)
    }
  }

  private static func install(module: NovellaPencilModule) {
    DispatchQueue.main.async {
      let currentHost: PencilInteractionHost
      if let existing = host {
        currentHost = existing
      } else {
        let newHost = PencilInteractionHost()
        newHost.delegate.module = module
        host = newHost
        currentHost = newHost
      }
      installWhenWindowAvailable(currentHost, attemptsLeft: windowRetryCount)
    }
  }

  /// The key window may still be missing while the first route mounts, so
  /// attachment retries on a short bounded loop instead of failing silently.
  private static func installWhenWindowAvailable(
    _ currentHost: PencilInteractionHost,
    attemptsLeft: Int
  ) {
    guard let window = keyWindow() else {
      guard attemptsLeft > 0 else { return }
      DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) {
        installWhenWindowAvailable(currentHost, attemptsLeft: attemptsLeft - 1)
      }
      return
    }
    guard currentHost.attachedWindow !== window else { return }
    window.addInteraction(currentHost.interaction)
    currentHost.attachedWindow = window
  }

  private static func keyWindow() -> UIWindow? {
    UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .compactMap { $0.keyWindow }
      .first
  }
}
