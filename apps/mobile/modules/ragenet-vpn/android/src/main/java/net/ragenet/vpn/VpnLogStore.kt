package net.ragenet.vpn

import java.util.concurrent.CopyOnWriteArrayList

data class VpnLogSnapshot(
  val time: Long,
  val level: String,
  val message: String,
)

object VpnLogStore {
  private const val LIMIT = 500
  private val entries = CopyOnWriteArrayList<VpnLogSnapshot>()
  private val listeners = CopyOnWriteArrayList<(VpnLogSnapshot) -> Unit>()

  fun append(level: String, message: String) {
    val entry = VpnLogSnapshot(System.currentTimeMillis(), level, message)
    entries.add(entry)
    while (entries.size > LIMIT) entries.removeAt(0)
    listeners.forEach { it(entry) }
  }

  fun snapshot(): List<VpnLogSnapshot> = entries.toList()

  fun clear() {
    entries.clear()
  }

  fun addListener(listener: (VpnLogSnapshot) -> Unit): () -> Unit {
    listeners.add(listener)
    return { listeners.remove(listener) }
  }
}
