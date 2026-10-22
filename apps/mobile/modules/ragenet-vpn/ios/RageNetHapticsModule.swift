import CoreHaptics
import ExpoModulesCore

/// Continuous particle haptics.
///
/// The phone has one haptic actuator, so individual particles are mixed into a
/// single signal: every active particle contributes its tremor energy to the
/// amplitude and its rate/density to the sharpness. The result follows the
/// actual vibration of the sphere instead of the old fixed hold ramp.
public final class RageNetHapticsModule: Module {
  private let hapticQueue = DispatchQueue(label: "net.ragenet.haptics")
  private var engine: CHHapticEngine?
  private var player: CHHapticAdvancedPatternPlayer?
  private var running = false

  public func definition() -> ModuleDefinition {
    Name("RageNetHaptics")

    Function("isAvailable") { () -> Bool in
      CHHapticEngine.capabilitiesForHardware().supportsHaptics
    }

    Function("start") { () -> Bool in
      guard CHHapticEngine.capabilitiesForHardware().supportsHaptics else {
        return false
      }
      hapticQueue.async {
        _ = self.startLocked()
      }
      return true
    }

    Function("update") { (energy: Double, density: Double, frequency: Double) in
      hapticQueue.async {
        self.updateLocked(energy: energy, density: density, frequency: frequency)
      }
    }

    Function("stop") {
      hapticQueue.async {
        self.stopLocked()
      }
    }

    OnDestroy {
      hapticQueue.async {
        self.stopLocked()
      }
    }
  }

  private func startLocked() -> Bool {
    if running, player != nil { return true }
    running = false

    if engine == nil {
      do {
        let engine = try CHHapticEngine()
        engine.stoppedHandler = { [weak self] _ in
          self?.hapticQueue.async {
            self?.player = nil
            self?.engine = nil
            self?.running = false
          }
        }
        engine.resetHandler = { [weak self] in
          guard let self else { return }
          self.hapticQueue.async {
            guard self.running else { return }
            self.player = nil
            self.engine = nil
            _ = self.startLocked()
          }
        }
        try engine.start()
        self.engine = engine
      } catch {
        return false
      }
    }

    do {
      let event = CHHapticEvent(
        eventType: .hapticContinuous,
        parameters: [
          .init(parameterID: .hapticIntensity, value: 0.5),
          .init(parameterID: .hapticSharpness, value: 0.4),
        ],
        relativeTime: 0,
        duration: 30
      )
      let pattern = try CHHapticPattern(events: [event], parameters: [])
      let player = try engine!.makeAdvancedPlayer(with: pattern)
      player.loopEnabled = true
      try player.start(atTime: CHHapticTimeImmediate)
      self.player = player
      running = true
      updateLocked(energy: 0, density: 0, frequency: 0)
      return true
    } catch {
      stopLocked()
      return false
    }
  }

  private func updateLocked(energy: Double, density: Double, frequency: Double) {
    guard running, let player else { return }

    let intensity = Float(max(0, min(1, energy)))
    let sharpness = Float(max(0, min(1, 0.2 + density * 0.45 + frequency * 0.35)))
    do {
      try player.sendParameters(
        [
          CHHapticDynamicParameter(
            parameterID: .hapticIntensityControl,
            value: intensity,
            relativeTime: 0
          ),
          CHHapticDynamicParameter(
            parameterID: .hapticSharpnessControl,
            value: sharpness,
            relativeTime: 0
          ),
        ],
        atTime: CHHapticTimeImmediate
      )
    } catch {
      // Haptics are optional feedback; never break the gesture.
    }
  }

  private func stopLocked() {
    try? player?.stop(atTime: CHHapticTimeImmediate)
    player = nil
    engine?.stop(completionHandler: nil)
    engine = nil
    running = false
  }
}
