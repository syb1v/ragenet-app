import Foundation
import LibXray

enum LibXrayRuntimeError: LocalizedError {
  case invalidRequest
  case invalidResponse
  case invocationFailed(String)

  var errorDescription: String? {
    switch self {
    case .invalidRequest:
      return "Не удалось сформировать запрос к Xray"
    case .invalidResponse:
      return "Xray вернул некорректный ответ"
    case .invocationFailed(let message):
      return message
    }
  }
}

/// Small Swift wrapper around the libXray C ABI (`CGoInvoke`/`CGoFree`).
enum LibXrayRuntime {
  private static let apiVersion = 3
  private static let lock = NSLock()

  static func start(configJSON: String) throws {
    _ = try invoke(method: "runXray", payload: ["xrayJson": configJSON])
  }

  static func stop() throws {
    _ = try invoke(method: "stopXray")
  }

  static func isRunning() throws -> Bool {
    let data = try invoke(method: "getXrayState")
    return data["running"] as? Bool ?? false
  }

  private static func invoke(
    method: String,
    payload: [String: Any]? = nil
  ) throws -> [String: Any] {
    lock.lock()
    defer { lock.unlock() }

    var request: [String: Any] = [
      "apiVersion": apiVersion,
      "method": method,
    ]
    if let payload {
      request["payload"] = payload
    }

    let requestData: Data
    do {
      requestData = try JSONSerialization.data(withJSONObject: request)
    } catch {
      throw LibXrayRuntimeError.invalidRequest
    }
    let requestJSON = String(decoding: requestData, as: UTF8.self)

    let responsePointer = requestJSON.withCString { pointer in
      CGoInvoke(UnsafeMutablePointer(mutating: pointer))
    }
    guard let responsePointer else {
      throw LibXrayRuntimeError.invalidResponse
    }
    defer { CGoFree(responsePointer) }

    let responseJSON = String(cString: responsePointer)
    guard
      let responseData = responseJSON.data(using: .utf8),
      let response = try? JSONSerialization.jsonObject(with: responseData) as? [String: Any]
    else {
      throw LibXrayRuntimeError.invalidResponse
    }

    guard response["success"] as? Bool == true else {
      let message = (response["error"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines)
      throw LibXrayRuntimeError.invocationFailed(
        message?.isEmpty == false ? message! : "Xray \(method) завершился с ошибкой"
      )
    }

    return response["data"] as? [String: Any] ?? [:]
  }
}
