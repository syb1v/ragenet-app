import Foundation

/// Small shared log sink for the Packet Tunnel extension.
/// The host app reads the same file through the App Group container.
enum TunnelLogStore {
  static let appGroup = "group.net.ragenet.vpn"
  static let fileName = "tunnel.log"
  private static let lock = NSLock()

  static func info(_ message: String) { append("info", message) }
  static func warn(_ message: String) { append("warn", message) }
  static func error(_ message: String) { append("error", message) }

  private static func append(_ level: String, _ message: String) {
    lock.lock()
    defer { lock.unlock() }

    guard
      let directory = FileManager.default.containerURL(
        forSecurityApplicationGroupIdentifier: appGroup
      )
    else { return }

    let url = directory.appendingPathComponent(fileName)
    let timestamp = Int(Date().timeIntervalSince1970 * 1000)
    let safeMessage = message.replacingOccurrences(of: "\n", with: " ")
    let line = "\(timestamp)|\(level)|\(safeMessage)\n"
    guard let data = line.data(using: .utf8) else { return }

    if FileManager.default.fileExists(atPath: url.path) {
      if let handle = try? FileHandle(forWritingTo: url) {
        defer { try? handle.close() }
        _ = try? handle.seekToEnd()
        try? handle.write(contentsOf: data)
      }
    } else {
      try? data.write(to: url, options: .atomic)
    }
  }
}
