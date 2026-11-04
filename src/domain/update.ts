/** A release published on GitHub that this app can download. */
export type Release = {
  /** "1.2.0", without a leading "v". */
  version: string;
  /** The release notes as written on GitHub. */
  notes: string;
  /** Where the APK is downloaded from. */
  apkUrl: string;
  /** Size of the APK in bytes, or null when GitHub did not say. */
  size: number | null;
};

/** Reads "v1.2.3", "1.2" or "1.2.3-beta" as [1, 2, 3]; anything else as null. */
export function parseVersion(text: string): number[] | null {
  const match = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:[-+].*)?$/.exec(text.trim());
  return match ? [Number(match[1]), Number(match[2] ?? 0), Number(match[3] ?? 0)] : null;
}

/** True when `latest` is a higher version than `current`. Versions that cannot be read are never newer. */
export function isNewer(latest: string, current: string): boolean {
  const a = parseVersion(latest);
  const b = parseVersion(current);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Pick the downloadable APK out of GitHub's "latest release" response. Drafts and pre-releases are not offered.
 * Returns null when the response is not a usable release, so a bad reply never shows an update.
 */
export function parseRelease(json: unknown): Release | null {
  if (!isObject(json) || json.draft === true || json.prerelease === true || typeof json.tag_name !== 'string') return null;
  const parsed = parseVersion(json.tag_name);
  if (!parsed || !Array.isArray(json.assets)) return null;
  const apk = json.assets.find(
    (a): a is Record<string, unknown> => isObject(a) && typeof a.name === 'string' && a.name.toLowerCase().endsWith('.apk') && typeof a.browser_download_url === 'string',
  );
  if (!apk) return null;
  return {
    version: parsed.join('.'),
    notes: typeof json.body === 'string' ? json.body.trim() : '',
    apkUrl: apk.browser_download_url as string,
    size: typeof apk.size === 'number' ? apk.size : null,
  };
}
