import { requireOptionalNativeModule } from 'expo';

type Native = {
  isAccessGranted(): boolean;
  openAccessSettings(): void;
  requestRebind(): void;
  drainQueue(): Promise<string[]>;
  lastEventAt(): number;
};

/** Null in Expo Go and on any build without the native module, so callers can degrade quietly. */
const native = requireOptionalNativeModule<Native>('WhatsAppListener');

export const isAvailable = native !== null;

export function isAccessGranted(): boolean {
  return native?.isAccessGranted() ?? false;
}

export function openAccessSettings(): void {
  native?.openAccessSettings();
}

export function requestRebind(): void {
  native?.requestRebind();
}

/** Every WhatsApp notification kept since the last call, one JSON object per string. Empties the queue. */
export async function drainQueue(): Promise<string[]> {
  return native ? native.drainQueue() : [];
}

/** When the service last kept a WhatsApp notification (ms since 1970), or null if never. */
export function lastEventAt(): number | null {
  const at = native?.lastEventAt() ?? 0;
  return at > 0 ? at : null;
}
