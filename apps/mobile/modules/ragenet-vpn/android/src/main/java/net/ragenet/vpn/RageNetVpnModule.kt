package net.ragenet.vpn

import android.content.Intent
import android.net.VpnService
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.ResultReceiver
import android.provider.Settings
import androidx.core.content.ContextCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.net.HttpURLConnection
import java.net.InetSocketAddress
import java.net.Socket
import java.net.URL
import java.util.Locale
import java.util.UUID
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.withTimeoutOrNull

class RageNetVpnModule : Module() {
  private companion object {
    const val VPN_PERMISSION_REQUEST = 0x5650
  }

  private var removeStatusListener: (() -> Unit)? = null
  private var removeLogListener: (() -> Unit)? = null
  private val mainHandler = Handler(Looper.getMainLooper())
  @Volatile private var pendingVpnPermission: CompletableDeferred<Boolean>? = null

  override fun definition() = ModuleDefinition {
    Name("RageNetVpn")

    Events("onVpnStatus", "onVpnLog")

    AsyncFunction("prepare") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      val intent = VpnService.prepare(context)
      if (intent == null) return@AsyncFunction true

      val activity = appContext.currentActivity
      if (activity == null) {
        // No foreground activity to host the system consent screen. Ask the
        // user to retry from the app instead of silently doing nothing.
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        try {
          context.startActivity(intent)
        } catch (_: Exception) {
          // The JS layer will show the permission message.
        }
        return@AsyncFunction false
      }

      val deferred = CompletableDeferred<Boolean>()
      pendingVpnPermission = deferred
      try {
        activity.startActivityForResult(intent, VPN_PERMISSION_REQUEST)
      } catch (_: Exception) {
        pendingVpnPermission = null
        return@AsyncFunction false
      }
      // The consent dialog is a separate activity. Wait for its result so the
      // JS caller can continue to start the tunnel in the same interaction.
      withTimeoutOrNull(60_000) { deferred.await() } ?: false
    }

    OnActivityResult { activity, payload ->
      if (payload.requestCode != VPN_PERMISSION_REQUEST) return@OnActivityResult
      val granted = try {
        VpnService.prepare(activity) == null
      } catch (_: Exception) {
        false
      }
      pendingVpnPermission?.complete(granted)
      pendingVpnPermission = null
    }

    AsyncFunction("start") { config: String, options: Map<String, Any?> ->
      val context = appContext.reactContext
        ?: throw IllegalStateException("React context is not available")
      val intent = Intent(context, RageNetVpnService::class.java).apply {
        action = RageNetVpnService.ACTION_START
        putExtra(RageNetVpnService.EXTRA_CONFIG, config)
        putExtra(RageNetVpnService.EXTRA_KILL_SWITCH, options["killSwitch"] as? Boolean ?: false)
      }
      ContextCompat.startForegroundService(context, intent)
      true
    }

    AsyncFunction("stop") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      context.startService(
        Intent(context, RageNetVpnService::class.java).apply {
          action = RageNetVpnService.ACTION_STOP
        },
      )
      true
    }

    Function("getStatus") {
      val status = VpnStateStore.snapshot()
      mapOf(
        "state" to status.state,
        "since" to status.since,
        "error" to status.error,
      )
    }

    /**
     * ANDROID_ID is scoped to the device, user and signing key and survives
     * uninstall/reinstall. Hashing it keeps the raw system identifier private
     * while giving Remnawave one stable HWID for this installation.
     */
    Function("getStableDeviceId") {
      val context = appContext.reactContext
        ?: return@Function UUID.randomUUID().toString().uppercase(Locale.US)
      val androidId = try {
        Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID)
      } catch (_: Exception) {
        null
      }

      if (!androidId.isNullOrBlank()) {
        val seed = "ragenet:${context.packageName}:$androidId"
        UUID.nameUUIDFromBytes(seed.toByteArray(Charsets.UTF_8))
          .toString()
          .uppercase(Locale.US)
      } else {
        val preferences = context.getSharedPreferences("ragenet_device", 0)
        preferences.getString("hwid", null)
          ?: UUID.randomUUID().toString().uppercase(Locale.US).also { value ->
            preferences.edit().putString("hwid", value).apply()
          }
      }
    }

    /**
     * Fresh, uncached HTTPS request. A new connection is forced with
     * `Connection: close`, so the result includes DNS/TCP/TLS and the real
     * proxy round-trip instead of a reused keep-alive socket.
     */
    AsyncFunction("measureHttpLatency") { url: String, timeoutMs: Int ->
      var connection: HttpURLConnection? = null
      try {
        val timeout = timeoutMs.coerceIn(500, 15_000)
        val started = System.nanoTime()
        connection = URL(url).openConnection() as HttpURLConnection
        connection.instanceFollowRedirects = false
        connection.connectTimeout = timeout
        connection.readTimeout = timeout
        connection.useCaches = false
        connection.requestMethod = "GET"
        connection.setRequestProperty("Accept", "*/*")
        connection.setRequestProperty("Cache-Control", "no-cache, no-store, max-age=0")
        connection.setRequestProperty("Pragma", "no-cache")
        connection.setRequestProperty("Connection", "close")
        connection.setRequestProperty("User-Agent", "RageNet/latency")
        val responseCode = connection.responseCode
        val elapsed = ((System.nanoTime() - started) / 1_000_000).toInt()
        if (responseCode in 200..399) elapsed else null
      } catch (_: Exception) {
        null
      } finally {
        connection?.disconnect()
      }
    }

    /**
     * pingBatch must run outside the process that owns the active Xray core.
     * The :ping service creates a temporary isolated core for up to five
     * locations and returns libXray's exact proxy round-trip results.
     */
    AsyncFunction("pingBatch") { payload: String, timeoutMs: Int ->
      val context = appContext.reactContext ?: return@AsyncFunction null
      val latch = CountDownLatch(1)
      var response: String? = null
      val receiver = object : ResultReceiver(Handler(Looper.getMainLooper())) {
        override fun onReceiveResult(resultCode: Int, resultData: Bundle?) {
          response = resultData?.getString(RageNetPingService.EXTRA_RESULT)
          latch.countDown()
        }
      }

      try {
        context.startService(
          Intent(context, RageNetPingService::class.java).apply {
            putExtra(RageNetPingService.EXTRA_PAYLOAD, payload)
            putExtra(RageNetPingService.EXTRA_RECEIVER, receiver)
          },
        )
        if (latch.await(timeoutMs.coerceIn(1_000, 60_000).toLong(), TimeUnit.MILLISECONDS)) {
          response
        } else {
          null
        }
      } catch (_: Exception) {
        null
      }
    }

    AsyncFunction("measureLatency") { host: String, port: Int, timeoutMs: Int ->
      var socket: Socket? = null
      try {
        socket = Socket()
        val started = System.nanoTime()
        socket.connect(InetSocketAddress(host, port), timeoutMs.coerceIn(100, 5000))
        ((System.nanoTime() - started) / 1_000_000).toInt()
      } catch (_: Exception) {
        null
      } finally {
        try {
          socket?.close()
        } catch (_: Exception) {
          // Ignore cleanup failures.
        }
      }
    }

    Function("getLogs") {
      val lifecycle = VpnLogStore.snapshot().map { entry ->
        mapOf(
          "time" to entry.time,
          "level" to entry.level,
          "message" to entry.message,
        )
      }
      val context = appContext.reactContext
      val coreFile = context?.let { File(it.filesDir, "xray.log") }
      val core = if (coreFile?.exists() == true) {
        val modified = coreFile.lastModified()
        coreFile.readLines().takeLast(300).mapIndexed { index, line ->
          val normalized = line.trim()
          val level = when {
            normalized.contains("[Error]", ignoreCase = true) -> "error"
            normalized.contains("[Warning]", ignoreCase = true) -> "warn"
            else -> "info"
          }
          mapOf(
            "time" to modified + index,
            "level" to level,
            "message" to normalized,
          )
        }
      } else {
        emptyList<Map<String, Any>>()
      }
      lifecycle + core
    }

    Function("clearLogs") {
      VpnLogStore.clear()
      try {
        appContext.reactContext?.let { File(it.filesDir, "xray.log").delete() }
      } catch (_: Exception) {
        // Best effort.
      }
      true
    }

    OnCreate {
      removeStatusListener = VpnStateStore.addListener { status ->
        mainHandler.post {
          this@RageNetVpnModule.sendEvent(
            "onVpnStatus",
            mapOf(
              "state" to status.state,
              "since" to status.since,
              "error" to status.error,
            ),
          )
        }
      }
      removeLogListener = VpnLogStore.addListener { entry ->
        mainHandler.post {
          this@RageNetVpnModule.sendEvent(
            "onVpnLog",
            mapOf(
              "time" to entry.time,
              "level" to entry.level,
              "message" to entry.message,
            ),
          )
        }
      }
    }

    OnDestroy {
      removeStatusListener?.invoke()
      removeStatusListener = null
      removeLogListener?.invoke()
      removeLogListener = null
    }
  }
}
