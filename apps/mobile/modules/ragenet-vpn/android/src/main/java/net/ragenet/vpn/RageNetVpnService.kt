package net.ragenet.vpn

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.content.pm.ServiceInfo
import android.net.VpnService
import android.os.Build
import android.os.ParcelFileDescriptor
import android.util.Log
import androidx.core.app.ServiceCompat
import libXray.DialerController
import libXray.LibXray
import org.json.JSONObject
import java.util.concurrent.Executors

class RageNetVpnService : VpnService() {
  companion object {
    const val ACTION_START = "net.ragenet.vpn.START"
    const val ACTION_STOP = "net.ragenet.vpn.STOP"
    const val EXTRA_CONFIG = "config"
    const val EXTRA_KILL_SWITCH = "killSwitch"

    private const val TAG = "RageNetVpnService"
    private const val CHANNEL_ID = "ragenet_vpn"
    private const val NOTIFICATION_ID = 101
  }

  private val executor = Executors.newSingleThreadExecutor()
  private var tunnel: ParcelFileDescriptor? = null
  private var running = false
  private var dialerRegistered = false

  private val dialer = object : DialerController {
    override fun protectFd(fd: Long): Boolean = protect(fd.toInt())
  }

  override fun onCreate() {
    super.onCreate()
    createNotificationChannel()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_STOP -> stopTunnel()
      ACTION_START -> {
        val config = intent.getStringExtra(EXTRA_CONFIG)
        if (config.isNullOrBlank()) {
          VpnStateStore.update("error", "Пустой Xray-конфиг")
          stopSelf()
          return START_NOT_STICKY
        }
        startForegroundNotification("Подключение…")
        executor.execute { startTunnel(config) }
      }
    }
    return START_NOT_STICKY
  }

  override fun onRevoke() {
    stopTunnel()
  }

  override fun onDestroy() {
    stopTunnel()
    executor.shutdownNow()
    super.onDestroy()
  }

  private fun startTunnel(configJson: String) {
    if (running) return
    VpnStateStore.update("connecting")
    try {
      val builder = Builder()
        .setSession("RageNet VPN")
        .setMtu(1500)
        .addAddress("198.18.0.1", 15)
        .addRoute("0.0.0.0", 0)
        .addAddress("fc00::1", 64)
        .addRoute("::", 0)
        .addDnsServer("1.1.1.1")
        .addDnsServer("8.8.8.8")
        .addDnsServer("2606:4700:4700::1111")

      try {
        builder.addDisallowedApplication(packageName)
      } catch (error: Exception) {
        Log.w(TAG, "Could not exclude RageNet from the tunnel", error)
      }

      val descriptor = builder.establish()
        ?: throw IllegalStateException("VpnService.establish() returned null")
      tunnel = descriptor

      LibXray.touch()
      if (!dialerRegistered) {
        LibXray.registerDialerController(dialer)
        dialerRegistered = true
      }
      LibXray.setDNS(dialer, "1.1.1.1:53")

      val root = JSONObject(configJson)
      val env = root.optJSONObject("env") ?: JSONObject()
      env.put("xray.tun.fd", descriptor.fd.toString())
      root.put("env", env)

      val request = JSONObject()
        .put("apiVersion", LibXray.LibXrayAPIVersion)
        .put("method", "runXray")
        .put("payload", JSONObject().put("xrayJson", root.toString()))

      val response = JSONObject(LibXray.invoke(request.toString()))
      if (!response.optBoolean("success")) {
        throw IllegalStateException(response.optString("error", "Xray failed to start"))
      }

      running = true
      VpnStateStore.update("connected")
      updateNotification("Подключено")
    } catch (error: Exception) {
      Log.e(TAG, "Failed to start Xray", error)
      releaseTunnel()
      VpnStateStore.update("error", error.message ?: "Не удалось запустить Xray")
      stopForeground(STOP_FOREGROUND_REMOVE)
      stopSelf()
    }
  }

  private fun stopTunnel() {
    if (!running && tunnel == null) {
      stopSelf()
      return
    }
    VpnStateStore.update("disconnecting")
    try {
      val request = JSONObject()
        .put("apiVersion", LibXray.LibXrayAPIVersion)
        .put("method", "stopXray")
      LibXray.invoke(request.toString())
    } catch (error: Exception) {
      Log.w(TAG, "stopXray failed", error)
    }
    try {
      LibXray.resetDNS()
    } catch (error: Exception) {
      Log.w(TAG, "resetDNS failed", error)
    }
    releaseTunnel()
    VpnStateStore.update("disconnected")
    stopForeground(STOP_FOREGROUND_REMOVE)
    stopSelf()
  }

  private fun releaseTunnel() {
    running = false
    try {
      tunnel?.close()
    } catch (error: Exception) {
      Log.w(TAG, "TUN close failed", error)
    }
    tunnel = null
  }

  private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = getSystemService(NotificationManager::class.java)
    manager.createNotificationChannel(
      NotificationChannel(
        CHANNEL_ID,
        "RageNet VPN",
        NotificationManager.IMPORTANCE_LOW,
      ).apply {
        description = "Состояние VPN-подключения"
        setShowBadge(false)
      },
    )
  }

  private fun startForegroundNotification(text: String) {
    val notification = buildNotification(text)
    val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
    } else {
      0
    }
    ServiceCompat.startForeground(this, NOTIFICATION_ID, notification, type)
  }

  private fun updateNotification(text: String) {
    val manager = getSystemService(NotificationManager::class.java)
    manager.notify(NOTIFICATION_ID, buildNotification(text))
  }

  private fun buildNotification(text: String): Notification {
    val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
    val contentIntent = launchIntent?.let {
      PendingIntent.getActivity(
        this,
        0,
        it,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
    }
    val stopIntent = PendingIntent.getService(
      this,
      1,
      Intent(this, RageNetVpnService::class.java).setAction(ACTION_STOP),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    return Notification.Builder(this, CHANNEL_ID)
      .setSmallIcon(android.R.drawable.ic_lock_lock)
      .setContentTitle("RageNet VPN")
      .setContentText(text)
      .setContentIntent(contentIntent)
      .setOngoing(true)
      .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Отключить", stopIntent)
      .build()
  }
}
