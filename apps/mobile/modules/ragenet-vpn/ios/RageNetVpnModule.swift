import ExpoModulesCore
import Network
import NetworkExtension

public final class RageNetVpnModule: Module {
  private var manager: NETunnelProviderManager?
  private var statusObserver: NSObjectProtocol?

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
      return true
    }

    AsyncFunction("getStatus") { () async -> [String: Any] in
      if manager == nil {
        manager = try? await loadManager()
      }
      return statusPayload()
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

    Function("getLogs") { () -> [[String: Any]] in
      guard
        let directory = FileManager.default.containerURL(
          forSecurityApplicationGroupIdentifier: "group.net.ragenet.vpn"
        )
      else { return [] }
      let logURL = directory.appendingPathComponent("tunnel.log")
      guard let contents = try? String(contentsOf: logURL, encoding: .utf8) else { return [] }
      return contents
        .split(separator: "\n")
        .compactMap { line -> [String: Any]? in
          let parts = line.split(separator: "|", maxSplits: 2, omittingEmptySubsequences: false)
          guard parts.count == 3, let timestamp = Int64(parts[0]) else { return nil }
          return [
            "time": timestamp,
            "level": String(parts[1]),
            "message": String(parts[2]),
          ]
        }
    }

    Function("clearLogs") { () -> Bool in
      guard
        let directory = FileManager.default.containerURL(
          forSecurityApplicationGroupIdentifier: "group.net.ragenet.vpn"
        )
      else { return false }
      let logURL = directory.appendingPathComponent("tunnel.log")
      try? FileManager.default.removeItem(at: logURL)
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
      Task { [weak self] in
        guard let self else { return }
        self.manager = try? await self.loadManager()
        self.emitStatus()
      }
    }

    OnDestroy {
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

  private func loadManager() async throws -> NETunnelProviderManager {
    let managers = try await withCheckedThrowingContinuation {
      (continuation: CheckedContinuation<[NETunnelProviderManager], Error>) in
      NETunnelProviderManager.loadAllFromPreferences { managers, error in
        if let error {
          continuation.resume(throwing: error)
        } else {
          continuation.resume(returning: managers ?? [])
        }
      }
    }

    if let existing = managers.first(where: {
      ($0.protocolConfiguration as? NETunnelProviderProtocol)?.providerBundleIdentifier
        == providerBundleIdentifier
    }) {
      return existing
    }
    return NETunnelProviderManager()
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
