package expo.modules.whatsapplistener

import android.content.Context
import java.io.File

/**
 * A small file of WhatsApp notifications waiting for the app to read them, one JSON object per line.
 *
 * The listener service appends to it even when the app is closed; the app drains it when it is open.
 * Everything stays in the app's private storage. If the app is not opened for a long time the file is
 * capped, and the oldest lines are dropped rather than growing without limit.
 */
object QueueStore {
  private const val FILE_NAME = "whatsapp-queue.jsonl"
  private const val PREFS = "whatsapp-listener"
  private const val KEY_LAST_EVENT = "last_event_at"
  private const val MAX_BYTES = 2L * 1024 * 1024

  private val lock = Any()

  private fun file(context: Context) = File(context.filesDir, FILE_NAME)

  fun append(context: Context, line: String) {
    synchronized(lock) {
      val f = file(context)
      if (f.exists() && f.length() > MAX_BYTES) {
        // Keep the newest half so a long absence loses the oldest messages first.
        val lines = f.readLines()
        f.writeText(lines.drop(lines.size / 2).joinToString("\n") + "\n")
      }
      f.appendText(line + "\n")
      context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        .edit().putLong(KEY_LAST_EVENT, System.currentTimeMillis()).apply()
    }
  }

  /** Returns every queued line and empties the queue. */
  fun drain(context: Context): List<String> {
    synchronized(lock) {
      val f = file(context)
      if (!f.exists()) return emptyList()
      val lines = f.readLines().filter { it.isNotBlank() }
      f.delete()
      return lines
    }
  }

  fun lastEventAt(context: Context): Long =
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getLong(KEY_LAST_EVENT, 0L)
}
