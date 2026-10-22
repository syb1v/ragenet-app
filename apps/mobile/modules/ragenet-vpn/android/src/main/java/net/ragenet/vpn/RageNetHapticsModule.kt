package net.ragenet.vpn

import android.content.Context
import android.os.Build
import android.os.SystemClock
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.roundToInt
import kotlin.math.sin

/**
 * Continuous particle haptics.
 *
 * Android has one vibration motor, so the active particles are mixed into an
 * amplitude waveform. The waveform is rebuilt from the current energy,
 * density and tremor rate instead of using a fixed hold ramp.
 */
class RageNetHapticsModule : Module() {
  private var running = false
  private var lastUpdateAt = 0L
  private var lastEnergy = -1.0
  private var lastDensity = -1.0

  override fun definition() = ModuleDefinition {
    Name("RageNetHaptics")

    Function("isAvailable") {
      findVibrator()?.hasVibrator() == true
    }

    Function("start") {
      val vibrator = findVibrator()
      if (vibrator == null || !vibrator.hasVibrator()) return@Function false
      running = true
      lastUpdateAt = 0L
      lastEnergy = -1.0
      lastDensity = -1.0
      try {
        vibrator.cancel()
      } catch (_: Exception) {
        // Best effort.
      }
      true
    }

    Function("update") { energy: Double, density: Double, frequency: Double ->
      updateVibration(
        energy = energy.coerceIn(0.0, 1.0),
        density = density.coerceIn(0.0, 1.0),
        frequency = frequency.coerceIn(0.0, 1.0),
      )
    }

    Function("stop") {
      running = false
      try {
        findVibrator()?.cancel()
      } catch (_: Exception) {
        // Best effort.
      }
      true
    }

    OnDestroy {
      running = false
      try {
        findVibrator()?.cancel()
      } catch (_: Exception) {
        // Best effort.
      }
    }
  }

  private fun updateVibration(energy: Double, density: Double, frequency: Double) {
    if (!running) return
    val vibrator = findVibrator() ?: return

    if (energy <= 0.012) {
      if (lastEnergy > 0.012) {
        try {
          vibrator.cancel()
        } catch (_: Exception) {
          // Best effort.
        }
      }
      lastEnergy = energy
      lastDensity = density
      return
    }

    val now = SystemClock.uptimeMillis()
    if (
      now - lastUpdateAt < 90 &&
      abs(energy - lastEnergy) < 0.07 &&
      abs(density - lastDensity) < 0.1
    ) {
      return
    }
    lastUpdateAt = now
    lastEnergy = energy
    lastDensity = density

    val stepMs = (26 - frequency * 14).roundToInt().coerceIn(10, 26).toLong()
    val segments = 28
    val timings = LongArray(segments) { stepMs }
    val amplitudes = IntArray(segments) { index ->
      val phase = (index.toDouble() / segments.toDouble()) * 2 * PI * (3.0 + density * 5.0)
      val wave = 0.62 + 0.38 * sin(phase)
      (255.0 * (0.18 + 0.82 * energy) * wave * (0.7 + 0.3 * density))
        .roundToInt()
        .coerceIn(1, 255)
    }

    try {
      vibrator.cancel()
      if (vibrator.hasAmplitudeControl()) {
        vibrator.vibrate(VibrationEffect.createWaveform(timings, amplitudes, 0))
      } else {
        val onOff = LongArray(segments * 2) { index ->
          if (index % 2 == 0) stepMs else (stepMs / 2).coerceAtLeast(1)
        }
        vibrator.vibrate(VibrationEffect.createWaveform(onOff, 0))
      }
    } catch (_: Exception) {
      // Some devices refuse very short waveform segments; keep the gesture alive.
    }
  }

  private fun findVibrator(): Vibrator? {
    val context = appContext.reactContext ?: return null
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      (context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager)
        ?.defaultVibrator
    } else {
      @Suppress("DEPRECATION")
      val service = context.getSystemService(Context.VIBRATOR_SERVICE)
      service as? Vibrator
    }
  }
}
