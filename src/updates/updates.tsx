import Constants from 'expo-constants';
import { File, Paths } from 'expo-file-system';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { isNewer, parseRelease, type Release } from '@/domain/update';
import { useStore } from '@/store/app-store';
import { getMeta, setMeta } from '@/whatsapp/repository';

/** Where new versions are published: the latest GitHub release of this repository. */
const REPO = 'EthanRodrigues001/nottoday';
const LATEST = `https://api.github.com/repos/${REPO}/releases/latest`;
const APK_MIME = 'application/vnd.android.package-archive';
/** The app looks for an update when it opens, but not more often than this. */
const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;

export const currentVersion = Constants.expoConfig?.version ?? '0.0.0';

export type CheckState = 'idle' | 'checking' | 'upToDate' | 'available' | 'failed';
export type InstallState = 'idle' | 'downloading' | 'failed';

type Updates = {
  version: string;
  release: Release | null;
  check: CheckState;
  install: InstallState;
  /** Look for a new version now. Resolves with the release when one is newer. */
  checkNow: () => Promise<Release | null>;
  /** Download the APK and hand it to Android's installer. */
  installNow: () => Promise<void>;
};

const UpdatesContext = createContext<Updates | null>(null);

export function useUpdates(): Updates {
  const value = useContext(UpdatesContext);
  if (!value) throw new Error('useUpdates must be used inside <UpdatesProvider>');
  return value;
}

async function fetchLatest(): Promise<Release | null> {
  const response = await fetch(LATEST, { headers: { Accept: 'application/vnd.github+json' } });
  // No release published yet, or the repository is not public: nothing to offer, not an error worth showing.
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`GitHub answered ${response.status}`);
  const release = parseRelease(await response.json());
  return release && isNewer(release.version, currentVersion) ? release : null;
}

/** Keeps the newest published version, checks for it when the app opens, and downloads and installs it on request. */
export function UpdatesProvider({ children }: { children: ReactNode }) {
  const { db } = useStore();
  const [release, setRelease] = useState<Release | null>(null);
  const [check, setCheck] = useState<CheckState>('idle');
  const [install, setInstall] = useState<InstallState>('idle');
  const checking = useRef<Promise<Release | null> | null>(null);

  const checkNow = useCallback(() => {
    if (checking.current) return checking.current;
    setCheck('checking');
    const run = fetchLatest().then(
      (found) => {
        setRelease(found);
        setCheck(found ? 'available' : 'upToDate');
        if (db) setMeta(db, 'update_checked_at', String(Date.now())).catch(() => {});
        return found;
      },
      (error) => {
        console.warn('Checking for an update failed', error);
        setCheck('failed');
        return null;
      },
    );
    checking.current = run;
    run.finally(() => {
      checking.current = null;
    });
    return run;
  }, [db]);

  // On opening the app, look once, unless it looked recently.
  useEffect(() => {
    if (!db) return;
    let alive = true;
    getMeta(db, 'update_checked_at').then(
      (last) => {
        if (alive && (!last || Date.now() - Number(last) > CHECK_EVERY_MS)) checkNow();
      },
      () => {},
    );
    return () => {
      alive = false;
    };
  }, [db, checkNow]);

  const installNow = useCallback(async () => {
    if (!release) return;
    setInstall('downloading');
    try {
      const apk = await File.downloadFileAsync(release.apkUrl, new File(Paths.cache, `nottoday-${release.version}.apk`), { idempotent: true });
      await File.preview(apk, { mimeType: APK_MIME, title: `notToday ${release.version}` });
      setInstall('idle');
    } catch (error) {
      console.warn('Installing the update failed', error);
      setInstall('failed');
    }
  }, [release]);

  const value = useMemo(() => ({ version: currentVersion, release, check, install, checkNow, installNow }), [release, check, install, checkNow, installNow]);
  return <UpdatesContext.Provider value={value}>{children}</UpdatesContext.Provider>;
}
