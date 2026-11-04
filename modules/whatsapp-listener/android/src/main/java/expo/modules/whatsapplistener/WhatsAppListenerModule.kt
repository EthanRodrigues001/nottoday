package expo.modules.whatsapplistener

import android.content.ComponentName
import android.content.Intent
import android.os.Build
import android.provider.Settings
import android.service.notification.NotificationListenerService
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class WhatsAppListenerModule : Module() {
  private val context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("WhatsAppListener")

    // Whether the user has given this app notification access in Android settings.
    Function("isAccessGranted") {
      val enabled = Settings.Secure.getString(context.contentResolver, "enabled_notification_listeners") ?: ""
      enabled.split(":").any { ComponentName.unflattenFromString(it)?.packageName == context.packageName }
    }

    // Opens Android's "Notification access" screen.
    Function("openAccessSettings") {
      val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
    }

    // Asks Android to reconnect the listener, for when a phone's battery manager has stopped it.
    Function("requestRebind") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
        NotificationListenerService.requestRebind(ComponentName(context, WhatsAppNotificationService::class.java))
      }
    }

    // Every WhatsApp notification kept since the last call, as JSON lines. The queue is emptied.
    AsyncFunction("drainQueue") {
      QueueStore.drain(context)
    }

    // Milliseconds since 1970 when the service last kept a WhatsApp notification; 0 if never.
    Function("lastEventAt") {
      QueueStore.lastEventAt(context).toDouble()
    }
  }
}
