package net.ragenet.vpn

import android.content.Intent
import android.net.VpnService
import android.os.Handler
import android.os.Looper
import androidx.core.content.ContextCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class RageNetVpnModule : Module() {
  private var removeStatusListener: (() -> Unit)? = null
  private val mainHandler = Handler(Looper.getMainLooper())

  override fun definition() = ModuleDefinition {
    Name("RageNetVpn")

    Events("onVpnStatus")

    Function("prepare") {
      val context = appContext.reactContext ?: return@Function false
      val intent = VpnService.prepare(context)
      if (intent == null) {
        true
      } else {
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        val activity = appContext.currentActivity
        if (activity != null) {
          activity.startActivity(intent)
        } else {
          context.startActivity(intent)
        }
        false
      }
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
    }

    OnDestroy {
      removeStatusListener?.invoke()
      removeStatusListener = null
    }
  }
}
