import CryptoKit
import ExpoModulesCore
import Foundation
import ImageIO
import UniformTypeIdentifiers

enum ReaderImageRasterizer {
  private static let maximumPixelSize = 2048
  private static let cacheDirectoryName = "NovellaReaderImageRasterizer"

  static func rasterize(uri: String, maxPixelSize: Int) async throws -> String {
    let boundedPixelSize = min(max(1, maxPixelSize), maximumPixelSize)
    let cacheDirectory = try makeCacheDirectory()
    let cacheBaseURL = cacheDirectory.appendingPathComponent(cacheFileName(
      uri: uri,
      maxPixelSize: boundedPixelSize
    ))

    if let cachedURL = existingCacheURL(for: cacheBaseURL) {
      return cachedURL.absoluteString
    }

    let sourceData = try await loadSourceData(uri: uri)
    let sourceOptions: [CFString: Any] = [
      kCGImageSourceShouldCache: false,
    ]
    guard let source = CGImageSourceCreateWithData(
      sourceData as CFData,
      sourceOptions as CFDictionary
    ) else {
      throw ReaderImageRasterizerError.invalidImage
    }

    let thumbnailOptions: [CFString: Any] = [
      kCGImageSourceCreateThumbnailFromImageAlways: true,
      kCGImageSourceCreateThumbnailWithTransform: true,
      kCGImageSourceShouldCache: false,
      kCGImageSourceThumbnailMaxPixelSize: boundedPixelSize,
    ]
    guard let image = CGImageSourceCreateThumbnailAtIndex(
      source,
      0,
      thumbnailOptions as CFDictionary
    ) else {
      throw ReaderImageRasterizerError.thumbnailCreationFailed
    }

    let preservesAlpha = imageHasAlpha(image)
    let fileExtension = preservesAlpha ? "png" : "jpg"
    let cacheURL = cacheBaseURL.appendingPathExtension(fileExtension)
    if FileManager.default.fileExists(atPath: cacheURL.path) {
      return cacheURL.absoluteString
    }

    let temporaryURL = cacheDirectory.appendingPathComponent(
      "\(cacheBaseURL.lastPathComponent).\(UUID().uuidString).tmp"
    )
    defer {
      try? FileManager.default.removeItem(at: temporaryURL)
    }

    let typeIdentifier = (preservesAlpha ? UTType.png : UTType.jpeg).identifier as CFString
    guard let destination = CGImageDestinationCreateWithURL(
      temporaryURL as CFURL,
      typeIdentifier,
      1,
      nil
    ) else {
      throw ReaderImageRasterizerError.cacheWriteFailed
    }

    let properties: [CFString: Any] = preservesAlpha
      ? [:]
      : [kCGImageDestinationLossyCompressionQuality: 0.88]
    CGImageDestinationAddImage(destination, image, properties as CFDictionary)
    guard CGImageDestinationFinalize(destination) else {
      throw ReaderImageRasterizerError.cacheWriteFailed
    }

    do {
      try FileManager.default.moveItem(at: temporaryURL, to: cacheURL)
    } catch {
      if !FileManager.default.fileExists(atPath: cacheURL.path) {
        throw error
      }
    }
    return cacheURL.absoluteString
  }

  private static func loadSourceData(uri: String) async throws -> Data {
    guard let url = URL(string: uri) else {
      throw ReaderImageRasterizerError.invalidURL
    }
    if url.isFileURL {
      return try Data(contentsOf: url, options: .mappedIfSafe)
    }

    let (data, response) = try await URLSession.shared.data(from: url)
    if let httpResponse = response as? HTTPURLResponse,
       !(200..<400).contains(httpResponse.statusCode) {
      throw ReaderImageRasterizerError.httpFailure(httpResponse.statusCode)
    }
    return data
  }

  private static func makeCacheDirectory() throws -> URL {
    guard let cachesURL = FileManager.default.urls(
      for: .cachesDirectory,
      in: .userDomainMask
    ).first else {
      throw ReaderImageRasterizerError.cacheDirectoryUnavailable
    }
    let directory = cachesURL.appendingPathComponent(cacheDirectoryName, isDirectory: true)
    try FileManager.default.createDirectory(
      at: directory,
      withIntermediateDirectories: true
    )
    return directory
  }

  private static func cacheFileName(uri: String, maxPixelSize: Int) -> String {
    let input = Data("\(uri)|\(maxPixelSize)".utf8)
    let digest = SHA256.hash(data: input)
    return digest.map { String(format: "%02x", $0) }.joined()
  }

  private static func existingCacheURL(for baseURL: URL) -> URL? {
    for fileExtension in ["jpg", "png"] {
      let candidate = baseURL.appendingPathExtension(fileExtension)
      if FileManager.default.fileExists(atPath: candidate.path) {
        return candidate
      }
    }
    return nil
  }

  private static func imageHasAlpha(_ image: CGImage) -> Bool {
    switch image.alphaInfo {
    case .none, .noneSkipFirst, .noneSkipLast:
      return false
    default:
      return true
    }
  }
}

private enum ReaderImageRasterizerError: LocalizedError {
  case cacheDirectoryUnavailable
  case cacheWriteFailed
  case httpFailure(Int)
  case invalidImage
  case invalidURL
  case thumbnailCreationFailed

  var errorDescription: String? {
    switch self {
    case .cacheDirectoryUnavailable:
      return "Reader image cache directory is unavailable"
    case .cacheWriteFailed:
      return "Reader image thumbnail could not be written"
    case let .httpFailure(statusCode):
      return "Reader image request failed with HTTP status \(statusCode)"
    case .invalidImage:
      return "Reader image data is not supported by ImageIO"
    case .invalidURL:
      return "Reader image URL is invalid"
    case .thumbnailCreationFailed:
      return "Reader image thumbnail could not be created"
    }
  }
}
