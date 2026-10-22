package net.ragenet.vpn

import android.app.Service
import android.content.Intent
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Bundle
import android.os.IBinder
import android.os.ResultReceiver
import libXray.LibXray
import org.json.JSONObject

/**
 * Runs libXray pingBatch in an isolated Android process. The active tunnel
 * lives in the main process, while pingBatch deliberately requires a process
 * without a managed Xray instance.
 */
class RageNetPingService : Service() {
  companion object {
    const val EXTRA_PAYLOAD = "payload"
    const val EXTRA_RECEIVER = "receiver"
    const val EXTRA_RESULT = "result"
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val payload = intent?.getStringExtra(EXTRA_PAYLOAD)
    val receiver = getReceiver(intent)

    if (payload.isNullOrBlank()) {
      sendResult(receiver, errorResponse("empty ping payload"))
      stopSelf(startId)
      return START_NOT_STICKY
    }

    Thread {
      val connectivity = bindUnderlyingNetwork()
      val result = if (connectivity == null) {
        errorResponse("underlying network is unavailable")
      } else {
        try {
          LibXray.invoke(payload)
        } catch (error: Exception) {
          errorResponse(error.message ?: "pingBatch failed")
        } finally {
          connectivity.bindProcessToNetwork(null)
        }
      }
      sendResult(receiver, result)
      stopSelf(startId)
    }.start()

    return START_NOT_STICKY
  }

  override fun onBind(intent: Intent?): IBinder? = null

  @Suppress("DEPRECATION")
  private fun getReceiver(intent: Intent?): ResultReceiver? =
    intent?.getParcelableExtra(EXTRA_RECEIVER)

  /**
   * The VPN applies to the whole app UID, including the :ping process. Bind
   * this process to the underlying Wi-Fi/cellular network so libXray connects
   * directly to each proxy instead of re-entering the active tunnel.
   */
  private fun bindUnderlyingNetwork(): ConnectivityManager? {
    val manager = getSystemService(ConnectivityManager::class.java) ?: return null
    val network = manager.allNetworks.firstOrNull { candidate ->
      val capabilities = manager.getNetworkCapabilities(candidate) ?: return@firstOrNull false
      capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
        capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_VPN)
    } ?: return null
    return if (manager.bindProcessToNetwork(network)) manager else null
  }

  private fun sendResult(receiver: ResultReceiver?, result: String) {
    receiver?.send(
      0,
      Bundle().apply {
        putString(EXTRA_RESULT, result)
      },
    )
  }

  private fun errorResponse(message: String): String =
    JSONObject()
      .put("success", false)
      .put("data", JSONObject.NULL)
      .put("error", message)
      .toString()
}
