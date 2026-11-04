package expo.modules.whatsapplistener

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import org.json.JSONObject

/**
 * Receives every notification Android posts, and keeps only the ones from WhatsApp.
 * Anything else is dropped on the spot, before its text is read, so other apps' notifications
 * never reach this app's storage or its JavaScript.
 */
class WhatsAppNotificationService : NotificationListenerService() {

  companion object {
    private val WHATSAPP_PACKAGES = setOf("com.whatsapp", "com.whatsapp.w4b")
  }

  override fun onNotificationPosted(sbn: StatusBarNotification?) {
    if (sbn == null || sbn.packageName !in WHATSAPP_PACKAGES) return
    try {
      val n = sbn.notification
      val extras = n.extras
      val json = JSONObject()
        .put("packageName", sbn.packageName)
        .put("title", extras?.getCharSequence(Notification.EXTRA_TITLE)?.toString())
        .put("text", extras?.getCharSequence(Notification.EXTRA_TEXT)?.toString())
        .put("bigText", extras?.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString())
        .put("subText", extras?.getCharSequence(Notification.EXTRA_SUB_TEXT)?.toString())
        .put("timestamp", sbn.postTime)
        .put("seenAt", System.currentTimeMillis())
        .put("ongoing", sbn.isOngoing)
        .put("category", n.category)
        .put("isGroupConversation", extras?.getBoolean(Notification.EXTRA_IS_GROUP_CONVERSATION, false) ?: false)
        .put("conversationTitle", extras?.getCharSequence(Notification.EXTRA_CONVERSATION_TITLE)?.toString())
      QueueStore.append(applicationContext, json.toString())
    } catch (e: Exception) {
      // A malformed notification must never crash the listener; skip it.
    }
  }
}
