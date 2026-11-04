import { isAccessGranted, isAvailable, lastEventAt, openAccessSettings, requestRebind } from '@modules/whatsapp-listener/src';

/**
 * Whether WhatsApp scanning can run on this build and whether Android has given notification access.
 * The native module is absent in Expo Go, where scanning is simply unavailable.
 */
export type ScanningState = 'unavailable' | 'needs-access' | 'on';

export function scanningState(): ScanningState {
  if (!isAvailable) return 'unavailable';
  try {
    return isAccessGranted() ? 'on' : 'needs-access';
  } catch {
    return 'unavailable';
  }
}

export const openNotificationAccess = openAccessSettings;

/** Ask Android to reconnect the listener, in case the phone's battery manager stopped it. */
export const reconnectListener = requestRebind;

/** When the service last kept a WhatsApp notification, or null. */
export const lastWhatsAppEventAt = lastEventAt;
