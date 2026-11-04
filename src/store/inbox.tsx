import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import type { Day, TimeOfDay } from '@/domain/dates';
import { useStore } from '@/store/app-store';
import { drainAndIngest } from '@/whatsapp/drain';
import type { Suggestion } from '@/whatsapp/ingest';
import { addExample, pendingSuggestions, setChatEnabled, setSuggestionStatus } from '@/whatsapp/repository';

type Acceptance =
  | { kind: 'deadline'; title: string; day: Day | null; time: TimeOfDay | null }
  | { kind: 'birthday'; name: string; day: Day };

type Inbox = {
  pending: Suggestion[];
  refresh: () => Promise<void>;
  accept: (id: string, how: Acceptance) => Promise<void>;
  dismiss: (id: string) => Promise<void>;
  neverFromChat: (chat: string) => Promise<void>;
};

const InboxContext = createContext<Inbox | null>(null);

export function useInbox(): Inbox {
  const inbox = use(InboxContext);
  if (!inbox) throw new Error('useInbox must be used inside <InboxProvider>');
  return inbox;
}

/** Suggestions found in WhatsApp, waiting for a tap. Reads the table the background task writes to. */
export function InboxProvider({ children }: { children: ReactNode }) {
  const { db, addTask, addBirthday } = useStore();
  const [pending, setPending] = useState<Suggestion[]>([]);

  const refresh = useCallback(async () => {
    if (db) setPending(await pendingSuggestions(db));
  }, [db]);

  // The background task adds rows while the app may be open, so look again regularly and on return to the app.
  useEffect(() => {
    if (!db) return;
    const load = () => {
      // Pick up what the background service kept, then show what is waiting.
      drainAndIngest(db)
        .then(() => pendingSuggestions(db))
        .then(setPending, (error) => console.warn('Reading the Inbox failed', error instanceof Error ? error.message : 'unknown error'));
    };
    load();
    const timer = setInterval(load, 5000);
    const sub = AppState.addEventListener('change', (state) => state === 'active' && load());
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [db]);

  const accept = useCallback(
    async (id: string, how: Acceptance) => {
      if (!db) return;
      if (how.kind === 'deadline') {
        addTask({ title: how.title, day: how.day, time: how.time });
      } else {
        const [, month, dayOfMonth] = how.day.split('-').map(Number);
        addBirthday({ name: how.name, month, dayOfMonth, birthYear: null });
      }
      await setSuggestionStatus(db, id, 'accepted');
      const accepted = pending.find((p) => p.id === id);
      if (accepted && accepted.kind === 'deadline') await addExample(db, accepted.snippet, 'yes');
      await refresh();
    },
    [db, pending, addTask, addBirthday, refresh],
  );

  const dismiss = useCallback(
    async (id: string) => {
      if (!db) return;
      await setSuggestionStatus(db, id, 'dismissed');
      const dismissed = pending.find((p) => p.id === id);
      if (dismissed && dismissed.kind === 'deadline') await addExample(db, dismissed.snippet, 'no');
      await refresh();
    },
    [db, pending, refresh],
  );

  const neverFromChat = useCallback(
    async (chat: string) => {
      if (!db) return;
      await setChatEnabled(db, chat, false);
      await refresh();
    },
    [db, refresh],
  );

  const value = useMemo(() => ({ pending, refresh, accept, dismiss, neverFromChat }), [pending, refresh, accept, dismiss, neverFromChat]);
  return <InboxContext value={value}>{children}</InboxContext>;
}
