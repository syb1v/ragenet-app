import Foundation
import NetworkExtension

final class PacketTunnelProvider: NEPacketTunnelProvider, @unchecked Sendable {
  private let mtu = 1500
  private let lifecycleLock = NSLock()
  private var startTask: Task<Void, Never>?

  override func startTunnel(
    options: [String: NSObject]?,
    completionHandler: @escaping @Sendable (Error?) -> Void
  ) {
    let optionConfig = options?["xrayConfig"] as? String
    let providerConfig = (protocolConfiguration as? NETunnelProviderProtocol)?
      .providerConfiguration?["xrayConfig"] as? String
    guard let config = optionConfig ?? providerConfig, !config.isEmpty else {
      completionHandler(TunnelError.missingConfiguration)
      return
    }

    lifecycleLock.lock()
    let previous = startTask
    startTask = Task { [weak self] in
      guard let self else {
        completionHandler(TunnelError.providerReleased)
        return
      }
      self.reasserting = true
      do {
        try await self.applyNetworkSettings()
        let fd = try await self.waitForTunnelDescriptor()
        let runtimeConfig = try self.configWithDescriptor(config, fd: fd)
        try LibXrayRuntime.start(configJSON: runtimeConfig)
        guard try LibXrayRuntime.isRunning() else {
          throw TunnelError.xrayNotRunning
        }
        self.reasserting = false
        completionHandler(nil)
      } catch {
        try? LibXrayRuntime.stop()
        self.reasserting = false
        completionHandler(error)
      }
    }
    lifecycleLock.unlock()
    previous?.cancel()
  }

  override func stopTunnel(
    with reason: NEProviderStopReason,
    completionHandler: @escaping @Sendable () -> Void
  ) {
    lifecycleLock.lock()
    startTask?.cancel()
    startTask = nil
    lifecycleLock.unlock()

    Task {
      try? LibXrayRuntime.stop()
      self.reasserting = false
      completionHandler()
    }
  }

  private func applyNetworkSettings() async throws {
    let settings = NEPacketTunnelNetworkSettings(tunnelRemoteAddress: "127.0.0.1")
    settings.mtu = NSNumber(value: mtu)

    let ipv4 = NEIPv4Settings(
      addresses: ["198.18.0.1"],
      subnetMasks: ["255.254.0.0"]
    )
    ipv4.includedRoutes = [NEIPv4Route.default()]
    settings.ipv4Settings = ipv4

    let ipv6 = NEIPv6Settings(
      addresses: ["fc00::1"],
      networkPrefixLengths: [64]
    )
    ipv6.includedRoutes = [NEIPv6Route.default()]
    settings.ipv6Settings = ipv6

    let dns = NEDNSSettings(servers: ["1.1.1.1", "2606:4700:4700::1111"])
    dns.matchDomains = [""]
    settings.dnsSettings = dns

    try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
      setTunnelNetworkSettings(settings) { error in
        if let error {
          continuation.resume(throwing: error)
        } else {
          continuation.resume()
        }
      }
    }
  }

  private func waitForTunnelDescriptor(maxAttempts: Int = 20) async throws -> Int32 {
    for attempt in 0...maxAttempts {
      if let descriptor = findTunnelDescriptor() {
        return descriptor
      }
      guard attempt < maxAttempts else { break }
      try await Task.sleep(nanoseconds: 50_000_000)
    }
    throw TunnelError.missingDescriptor
  }

  /// NetworkExtension creates the utun socket in the extension process. Scan the
  /// open descriptors for the utun control interface and hand that fd to Xray.
  private func findTunnelDescriptor() -> Int32? {
    for descriptor in Int32(0)...Int32(1024) {
      var name = [CChar](repeating: 0, count: Int(IFNAMSIZ))
      var length = socklen_t(name.count)
      let result = name.withUnsafeMutableBytes { buffer in
        getsockopt(descriptor, 2, 2, buffer.baseAddress, &length)
      }
      guard result == 0 else { continue }
      let bytes = name.prefix { $0 != 0 }.map { UInt8(bitPattern: $0) }
      if String(decoding: bytes, as: UTF8.self).hasPrefix("utun") {
        return descriptor
      }
    }
    return nil
  }

  private func configWithDescriptor(_ configJSON: String, fd: Int32) throws -> String {
    guard
      let data = configJSON.data(using: .utf8),
      var config = try JSONSerialization.jsonObject(with: data) as? [String: Any]
    else {
      throw TunnelError.invalidConfiguration
    }

    var environment = config["env"] as? [String: Any] ?? [:]
    environment["xray.tun.fd"] = String(fd)
    config["env"] = environment

    guard
      let patched = try? JSONSerialization.data(withJSONObject: config),
      let patchedJSON = String(data: patched, encoding: .utf8)
    else {
      throw TunnelError.invalidConfiguration
    }
    return patchedJSON
  }
}

private enum TunnelError: LocalizedError {
  case missingConfiguration
  case providerReleased
  case invalidConfiguration
  case missingDescriptor
  case xrayNotRunning

  var errorDescription: String? {
    switch self {
    case .missingConfiguration:
      return "Не передан Xray-конфиг"
    case .providerReleased:
      return "Packet Tunnel был освобождён"
    case .invalidConfiguration:
      return "Некорректный Xray-конфиг"
    case .missingDescriptor:
      return "Не удалось получить utun-дескриптор"
    case .xrayNotRunning:
      return "Xray не запустился"
    }
  }
}
