import ExpoModulesCore
import LibXray
import Network
import NetworkExtension
import Security
import UIKit

public final class RageNetVpnModule: Module {
  private var manager: NETunnelProviderManager?
  private var statusObserver: NSObjectProtocol?
  private let pathMonitor = NWPathMonitor()
  private let pathLock = NSLock()
  private var underlyingInterface: String?

  private var providerBundleIdentifier: String {
    (Bundle.main.bundleIdentifier ?? "net.ragenet.vpn") + ".tunnel"
  }

  public func definition() -> ModuleDefinition {
    Name("RageNetVpn")
    Events("onVpnStatus")

    AsyncFunction("prepare") { () async throws -> Bool in
      true
    }

    AsyncFunction("start") { (config: String, _: [String: Any]) async throws -> Bool in
      // A previous extension can remain stuck after disconnect. Starting from
      // a fresh NetworkExtension profile is the only reliable recovery short
      // of rebooting the phone.
      let existing = try await loadManager()
      manager = existing
      let existingStatus = existing.connection.status
      if existingStatus == .connected ||
        existingStatus == .connecting ||
        existingStatus == .reasserting ||
        existingStatus == .disconnecting {
        existing.connection.stopVPNTunnel()
        _ = await waitForStatus(.disconnected, timeout: 2.5)
      }
      if existing.connection.status == .disconnected {
        try await resetTunnel()
      }

      let tunnel = try await loadManager()
      let proto = NETunnelProviderProtocol()
      proto.providerBundleIdentifier = providerBundleIdentifier
      proto.serverAddress = "RageNet"
      proto.providerConfiguration = ["xrayConfig": config]

      tunnel.protocolConfiguration = proto
      tunnel.localizedDescription = "RageNet VPN"
      tunnel.isEnabled = true
      try await save(tunnel)
      try await reload(tunnel)

      manager = tunnel
      try tunnel.connection.startVPNTunnel(options: ["xrayConfig": config as NSObject])
      return true
    }

    AsyncFunction("stop") { () async throws -> Bool in
      if manager == nil {
        manager = try await loadManager()
      }
      manager?.connection.stopVPNTunnel()
      _ = await waitForStatus(.disconnected, timeout: 2.5)
      return true
    }

    /// Clear a stale NetworkExtension profile. This is safe to call while the
    /// provider is hung: stop, remove the matching profile, and let the next
    /// start create a fresh manager.
    AsyncFunction("reset") { () async throws -> Bool in
      try await resetTunnel()
      return true
    }

    AsyncFunction("getStatus") { () async -> [String: Any] in
      if manager == nil {
        manager = try? await loadManager()
      }
      return statusPayload()
    }

    /// Physical interface used to bypass the active utun while pingBatch runs
    /// in the main app process.
    Function("getPingInterface") { () -> String? in
      self.pathLock.lock()
      defer { self.pathLock.unlock() }
      return self.underlyingInterface
    }

    /// Keychain items survive app deletion/reinstall on iOS, unlike
    /// UserDefaults. Keep one generated UUID for the lifetime of the device.
    Function("getStableDeviceId") { () -> String in
      let service = "net.ragenet.vpn.hwid"
      let account = "device"
      let lookup: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: service,
        kSecAttrAccount as String: account,
        kSecReturnData as String: true,
        kSecMatchLimit as String: kSecMatchLimitOne,
      ]
      var item: CFTypeRef?
      if SecItemCopyMatching(lookup as CFDictionary, &item) == errSecSuccess,
         let data = item as? Data,
         let value = String(data: data, encoding: .utf8),
         !value.isEmpty {
        return value.uppercased()
      }

      let generated = UUID().uuidString.uppercased()
      let insert: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: service,
        kSecAttrAccount as String: account,
        kSecValueData as String: Data(generated.utf8),
        kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
      ]
      if SecItemAdd(insert as CFDictionary, nil) == errSecSuccess {
        return generated
      }

      // Last-resort fallback if the Keychain is unavailable.
      if let vendorId = UIDevice.current.identifierForVendor?.uuidString {
        return vendorId.uppercased()
      }
      return generated
    }

    /// Measure the real end-to-end HTTPS round trip through the active tunnel.
    /// A new ephemeral URLSession forces a fresh TCP/TLS handshake instead of
    /// reusing a keep-alive connection (which would produce unrealistically
    /// small values).
    AsyncFunction("measureHttpLatency") { (urlString: String, timeoutMs: Int) async -> Int? in
      guard let url = URL(string: urlString) else { return nil }
      let timeout = Double(min(max(timeoutMs, 500), 15_000)) / 1000
      let configuration = URLSessionConfiguration.ephemeral
      configuration.urlCache = nil
      configuration.requestCachePolicy = .reloadIgnoringLocalAndRemoteCacheData
      configuration.timeoutIntervalForRequest = timeout
      configuration.timeoutIntervalForResource = timeout
      configuration.waitsForConnectivity = false
      configuration.httpMaximumConnectionsPerHost = 1
      let session = URLSession(configuration: configuration)

      var request = URLRequest(url: url)
      request.httpMethod = "GET"
      request.cachePolicy = .reloadIgnoringLocalAndRemoteCacheData
      request.timeoutInterval = timeout
      request.setValue("*/*", forHTTPHeaderField: "Accept")
      request.setValue("no-cache, no-store, max-age=0", forHTTPHeaderField: "Cache-Control")
      request.setValue("no-cache", forHTTPHeaderField: "Pragma")
      request.setValue("close", forHTTPHeaderField: "Connection")
      request.setValue("RageNet/latency", forHTTPHeaderField: "User-Agent")

      let started = DispatchTime.now().uptimeNanoseconds
      do {
        let (_, response) = try await session.data(for: request)
        session.finishTasksAndInvalidate()
        guard
          let http = response as? HTTPURLResponse,
          (200...399).contains(http.statusCode)
        else {
          return nil
        }
        let elapsed = Int((DispatchTime.now().uptimeNanoseconds - started) / 1_000_000)
        return elapsed
      } catch {
        session.invalidateAndCancel()
        return nil
      }
    }

    AsyncFunction("measureLatency") { (host: String, port: Int, timeoutMs: Int) async -> Int? in
      guard let endpointPort = NWEndpoint.Port(rawValue: UInt16(clamping: port)) else {
        return nil
      }
      return await withCheckedContinuation { (continuation: CheckedContinuation<Int?, Never>) in
        let started = DispatchTime.now().uptimeNanoseconds
        let connection = NWConnection(
          host: NWEndpoint.Host(host),
          port: endpointPort,
          using: .tcp
        )
        let lock = NSLock()
        var finished = false

        func finish(_ value: Int?) {
          lock.lock()
          if finished {
            lock.unlock()
            return
          }
          finished = true
          lock.unlock()
          connection.cancel()
          continuation.resume(returning: value)
        }

        connection.stateUpdateHandler = { state in
          switch state {
          case .ready:
            let elapsed = Int((DispatchTime.now().uptimeNanoseconds - started) / 1_000_000)
            finish(elapsed)
          case .failed, .cancelled:
            finish(nil)
          default:
            break
          }
        }
        connection.start(queue: .global(qos: .userInitiated))
        DispatchQueue.global().asyncAfter(deadline: .now() + Double(timeoutMs) / 1000) {
          finish(nil)
        }
      }
    }

    /// The main app has no managed Xray instance, so libXray can create an
    /// isolated temporary core here and probe up to five outbounds at once.
    AsyncFunction("pingBatch") { (payload: String, _: Int) async -> String? in
      await withCheckedContinuation { (continuation: CheckedContinuation<String?, Never>) in
        DispatchQueue.global(qos: .userInitiated).async {
          let response = payload.withCString { pointer in
            CGoInvoke(UnsafeMutablePointer(mutating: pointer))
          }
          guard let response else {
            continuation.resume(returning: nil)
            return
          }
          defer { CGoFree(response) }
          continuation.resume(returning: String(cString: response))
        }
      }
    }

    Function("getLogs") { () -> [[String: Any]] in
      guard
        let directory = FileManager.default.containerURL(
          forSecurityApplicationGroupIdentifier: "group.net.ragenet.vpn"
        )
      else { return [] }
      var output: [[String: Any]] = []
      for (name, isCore) in [("tunnel.log", false), ("xray.log", true)] {
        let logURL = directory.appendingPathComponent(name)
        guard let contents = try? String(contentsOf: logURL, encoding: .utf8) else { continue }
        let modified = (try? logURL.resourceValues(forKeys: [.contentModificationDateKey])
          .contentModificationDate?.timeIntervalSince1970) ?? Date().timeIntervalSince1970
        let lines = contents.split(separator: "\n")
        for (index, line) in lines.enumerated() {
          if isCore {
            let message = String(line).trimmingCharacters(in: .whitespacesAndNewlines)
            guard !message.isEmpty else { continue }
            let level = message.localizedCaseInsensitiveContains("[error]")
              ? "error"
              : message.localizedCaseInsensitiveContains("[warning]") ? "warn" : "info"
            output.append([
              "time": Int64(modified * 1000) + Int64(index),
              "level": level,
              "message": message,
            ])
          } else {
            let parts = line.split(separator: "|", maxSplits: 2, omittingEmptySubsequences: false)
            guard parts.count == 3, let timestamp = Int64(parts[0]) else { continue }
            output.append([
              "time": timestamp,
              "level": String(parts[1]),
              "message": String(parts[2]),
            ])
          }
        }
      }
      return output
    }

    Function("clearLogs") { () -> Bool in
      guard
        let directory = FileManager.default.containerURL(
          forSecurityApplicationGroupIdentifier: "group.net.ragenet.vpn"
        )
      else { return false }
      for name in ["tunnel.log", "xray.log"] {
        try? FileManager.default.removeItem(at: directory.appendingPathComponent(name))
      }
      return true
    }

    OnCreate {
      statusObserver = NotificationCenter.default.addObserver(
        forName: .NEVPNStatusDidChange,
        object: nil,
        queue: .main
      ) { [weak self] _ in
        self?.emitStatus()
      }
      pathMonitor.pathUpdateHandler = { [weak self] path in
        let candidates = path.availableInterfaces
        let interface =
          candidates.first(where: { $0.type == .wifi }) ??
          candidates.first(where: { $0.type == .cellular }) ??
          candidates.first(where: { $0.type == .wiredEthernet })
        self?.pathLock.lock()
        self?.underlyingInterface = interface?.name
        self?.pathLock.unlock()
      }
      pathMonitor.start(queue: DispatchQueue(label: "net.ragenet.path-monitor"))

      Task { [weak self] in
        guard let self else { return }
        self.manager = try? await self.loadManager()
        self.emitStatus()
      }
    }

    OnDestroy {
      pathMonitor.cancel()
      if let statusObserver {
        NotificationCenter.default.removeObserver(statusObserver)
      }
      statusObserver = nil
    }
  }

  private func statusPayload() -> [String: Any] {
    [
      "state": statusString(),
      "error": NSNull(),
    ]
  }

  private func statusString() -> String {
    switch manager?.connection.status {
    case .connected:
      return "connected"
    case .connecting, .reasserting:
      return "connecting"
    case .disconnecting:
      return "disconnecting"
    case .invalid, .disconnected, .none:
      return "disconnected"
    @unknown default:
      return "disconnected"
    }
  }

  private func emitStatus() {
    let payload = statusPayload()
    DispatchQueue.main.async { [weak self] in
      self?.sendEvent("onVpnStatus", payload)
    }
  }

  private func loadManagers() async throws -> [NETunnelProviderManager] {
    try await withCheckedThrowingContinuation {
      (continuation: CheckedContinuation<[NETunnelProviderManager], Error>) in
      NETunnelProviderManager.loadAllFromPreferences { managers, error in
        if let error {
          continuation.resume(throwing: error)
        } else {
          continuation.resume(returning: managers ?? [])
        }
      }
    }
  }

  private func matchingManagers() async throws -> [NETunnelProviderManager] {
    try await loadManagers().filter {
      ($0.protocolConfiguration as? NETunnelProviderProtocol)?.providerBundleIdentifier
        == providerBundleIdentifier
    }
  }

  private func loadManager() async throws -> NETunnelProviderManager {
    let managers = try await matchingManagers()
    return managers.first ?? NETunnelProviderManager()
  }

  private func waitForStatus(
    _ expected: NEVPNStatus,
    timeout: TimeInterval
  ) async -> Bool {
    let deadline = Date().addingTimeInterval(timeout)
    while Date() < deadline {
      if manager?.connection.status == expected {
        return true
      }
      try? await Task.sleep(nanoseconds: 100_000_000)
    }
    return manager?.connection.status == expected
  }

  private func removeFromPreferences(_ tunnel: NETunnelProviderManager) async throws {
    try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
      tunnel.removeFromPreferences { error in
        if let error {
          continuation.resume(throwing: error)
        } else {
          continuation.resume()
        }
      }
    }
  }

  private func resetTunnel() async throws {
    let managers = try await matchingManagers()
    manager = managers.first
    for tunnel in managers {
      tunnel.connection.stopVPNTunnel()
    }
    _ = await waitForStatus(.disconnected, timeout: 2.0)
    for tunnel in managers {
      tunnel.isEnabled = false
      try? await save(tunnel)
      try? await removeFromPreferences(tunnel)
    }
    manager = nil
  }

  private func save(_ tunnel: NETunnelProviderManager) async throws {
    try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
      tunnel.saveToPreferences { error in
        if let error {
          continuation.resume(throwing: error)
        } else {
          continuation.resume()
        }
      }
    }
  }

  private func reload(_ tunnel: NETunnelProviderManager) async throws {
    try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
      tunnel.loadFromPreferences { error in
        if let error {
          continuation.resume(throwing: error)
        } else {
          continuation.resume()
        }
      }
    }
  }
}
