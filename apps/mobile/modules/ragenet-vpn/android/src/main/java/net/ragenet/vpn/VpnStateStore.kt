package net.ragenet.vpn

import java.util.concurrent.CopyOnWriteArrayList

data class VpnStatusSnapshot(
  val state: String,
  val since: Long?,
  val error: String?,
)

object VpnStateStore {
  @Volatile
  private var current = VpnStatusSnapshot("disconnected", null, null)

  private val listeners = CopyOnWriteArrayList<(VpnStatusSnapshot) -> Unit>()

  fun snapshot(): VpnStatusSnapshot = current

  fun update(state: String, error: String? = null) {
    current = VpnStatusSnapshot(
      state = state,
      since = if (state == "connected" || state == "connecting") System.currentTimeMillis() else null,
      error = error,
    )
    listeners.forEach { it(current) }
  }

  fun addListener(listener: (VpnStatusSnapshot) -> Unit): () -> Unit {
    listeners.add(listener)
    return { listeners.remove(listener) }
  }
}
