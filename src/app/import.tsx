import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/components/text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { readPickedFile } from '@/lib/read-picked-file';
import { chatNameFromFileName, guessMe, parseChatExport, type ParsedExport } from '@/domain/chat-export';
import { useStore } from '@/store/app-store';
import { useInbox } from '@/store/inbox';
import { importChat, type ImportSummary } from '@/whatsapp/import';
import { createRepo, getMeta, setMeta } from '@/whatsapp/repository';
import { colors, radius, shadows, spacing, type } from '@/theme';

/** Exports with media are huge and not needed; the text-only export is a few hundred kilobytes. */
const MAX_BYTES = 50 * 1024 * 1024;

type Loaded = { chat: string; parsed: ParsedExport };
type Total = ImportSummary & { chats: number };

/** Names shown to choose from; the user's own name is in nearly every chat, so it is near the top. */
const NAME_CHOICES = 12;

export default function ImportScreen() {
  const insets = useSafeAreaInsets();
  const { db, today, snapshot } = useStore();
  const { refresh } = useInbox();
  const [loaded, setLoaded] = useState<Loaded[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [me, setMe] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Total | null>(null);

  const pick = async () => {
    setError(null);
    setSummary(null);
    setLoaded([]);
    setSkipped([]);
    setMe([]);
    const result = await DocumentPicker.getDocumentAsync({ type: ['text/plain', 'application/zip'], copyToCacheDirectory: true, multiple: true });
    if (result.canceled || result.assets.length === 0) return;
    setBusy(true);
    const ok: Loaded[] = [];
    const notRead: string[] = [];
    for (const asset of result.assets) {
      if (/.zip$/i.test(asset.name)) {
        notRead.push(`${asset.name}: a zip with media inside. Export that chat again as "Without media".`);
      } else if ((asset.size ?? 0) > MAX_BYTES) {
        notRead.push(`${asset.name}: over 50 MB, so it probably has media. Export it again "Without media".`);
      } else {
        try {
          const parsed = parseChatExport(await readPickedFile(asset.uri));
          if (parsed.messages.length === 0) notRead.push(`${asset.name}: no messages found, so it is not a WhatsApp export.`);
          else ok.push({ chat: chatNameFromFileName(asset.name), parsed });
        } catch (e) {
          console.warn('Reading an export failed', e instanceof Error ? e.message : String(e));
          notRead.push(`${asset.name}: could not be read.`);
        }
      }
    }
    // Start with the names remembered from last time, or else the name found in nearly every chat.
    let start: string[] = [];
    try {
      const saved = db ? await getMeta(db, 'my_names') : null;
      const remembered: string[] = saved ? JSON.parse(saved) : [];
      const here = new Set(ok.flatMap((l) => l.parsed.participants));
      start = remembered.filter((n) => here.has(n));
    } catch {
      start = [];
    }
    if (start.length === 0) start = guessMe(ok.map((l) => l.parsed));
    setLoaded(ok);
    setSkipped(notRead);
    setMe(start);
    if (ok.length === 0) setError('Nothing could be imported from the files you picked.');
    setBusy(false);
  };

  const toggleMe = (name: string) => setMe((cur) => (cur.includes(name) ? cur.filter((n) => n !== name) : [...cur, name]));

  const run = async () => {
    if (!db || loaded.length === 0) return;
    setBusy(true);
    try {
      const repo = createRepo(db);
      const total: Total = { chats: loaded.length, messages: 0, deadlines: 0, birthdays: 0, unnamedWishes: 0 };
      for (const l of loaded) {
        const one = await importChat(repo, l.parsed, {
          chat: l.chat,
          me,
          today,
          now: Date.now(),
          knowsBirthday: (name, month, dayOfMonth) =>
            snapshot.birthdays.some((b) => b.name.toLowerCase() === name.toLowerCase() && b.month === month && b.dayOfMonth === dayOfMonth),
        });
        total.messages += one.messages;
        total.deadlines += one.deadlines;
        total.birthdays += one.birthdays;
        total.unnamedWishes += one.unnamedWishes;
      }
      await setMeta(db, 'my_names', JSON.stringify(me));
      setSummary(total);
      setLoaded([]);
      await refresh();
    } catch {
      setError('The import failed part way. Anything already found is in your Inbox; run it again for the rest.');
    } finally {
      setBusy(false);
    }
  };

  // Everyone in the picked chats, the most widespread names first (the user is in almost all of them).
  const names = (() => {
    const counts = new Map<string, number>();
    for (const l of loaded) for (const n of new Set(l.parsed.participants)) counts.set(n, (counts.get(n) ?? 0) + 1);
    const ranked = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([n]) => n);
    const top = ranked.slice(0, NAME_CHOICES);
    for (const n of me) if (!top.includes(n)) top.push(n);
    return top;
  })();
  const totalMessages = loaded.reduce((sum, l) => sum + l.parsed.messages.length, 0);
  const canRun = !busy && me.length > 0;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.md, paddingBottom: insets.bottom + spacing.xl, gap: spacing.lg }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Pressable onPress={() => router.back()} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back" style={({ pressed }) => ({ padding: spacing.sm, opacity: pressed ? 0.5 : 1 })}>
          <MaterialIcons name="arrow-back" size={24} color={colors.ink} />
        </Pressable>
        <Text style={[type.title, { color: colors.ink }]}>Import chats</Text>
      </View>

      <View style={{ gap: spacing.sm, padding: spacing.md, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card, boxShadow: shadows.card }}>
        <Text style={[type.headline, { color: colors.ink }]}>You only need this for old messages</Text>
        <Text style={{ fontSize: 14, lineHeight: 20, color: colors.muted }}>
          WhatsApp exports one chat at a time, so do it for the few chats that matter (teachers, class groups) and pick all the files together here. New messages are read automatically once scanning is on, with no export.
        </Text>
        <Text style={{ fontSize: 13, lineHeight: 19, color: colors.muted }}>
          In a chat: three dots, More, Export chat, Without media, then save it to Files. Repeat per chat, then select all the .txt files at once below. Only the text is read, and the history is not kept.
        </Text>
      </View>

      <Pressable
        onPress={pick}
        disabled={busy}
        accessibilityRole="button"
        style={({ pressed }) => ({ alignItems: 'center', paddingVertical: spacing.md, borderRadius: radius.full, backgroundColor: colors.ink, opacity: busy ? 0.4 : pressed ? 0.8 : 1 })}
      >
        {busy ? <ActivityIndicator color={colors.onInk} /> : <Text style={{ color: colors.onInk, fontSize: 15, fontWeight: '700' }}>Choose export files</Text>}
      </Pressable>

      {error ? (
        <View style={{ padding: spacing.md, borderRadius: radius.md, backgroundColor: 'rgba(229,72,77,0.1)' }}>
          <Text style={{ fontSize: 14, color: colors.danger }}>{error}</Text>
        </View>
      ) : null}

      {skipped.length > 0 ? (
        <View style={{ gap: spacing.xs, padding: spacing.md, borderRadius: radius.md, backgroundColor: 'rgba(242,107,58,0.1)' }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.accent }}>
            {skipped.length} {skipped.length === 1 ? 'file was' : 'files were'} skipped
          </Text>
          {skipped.map((line) => (
            <Text key={line} style={{ fontSize: 13, color: colors.inkSoft }}>
              {line}
            </Text>
          ))}
        </View>
      ) : null}

      {loaded.length > 0 ? (
        <View style={{ gap: spacing.md, padding: spacing.md, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card, boxShadow: shadows.card }}>
          <View style={{ gap: 2 }}>
            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.ink }}>
              {loaded.length} {loaded.length === 1 ? 'chat' : 'chats'} ready
            </Text>
            <Text style={{ fontSize: 13, color: colors.muted }} numberOfLines={2}>
              {totalMessages} messages · {loaded.map((l) => l.chat).join(', ')}
            </Text>
          </View>
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.inkSoft }}>Which name is you?</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {names.map((name) => {
              const selected = me.includes(name);
              return (
                <Pressable
                  key={name}
                  onPress={() => toggleMe(name)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  style={({ pressed }) => ({ paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.full, backgroundColor: selected ? colors.ink : colors.background, opacity: pressed ? 0.7 : 1 })}
                >
                  <Text style={{ fontSize: 14, fontWeight: '600', color: selected ? colors.onInk : colors.inkSoft }}>{name}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={{ fontSize: 12, color: colors.muted }}>
            Your name is the same in every chat, so choose it once. It is remembered for next time. Your own messages are where birthdays you wished come from.
          </Text>
          <Pressable
            onPress={run}
            disabled={!canRun}
            accessibilityRole="button"
            style={({ pressed }) => ({ alignItems: 'center', paddingVertical: spacing.md, borderRadius: radius.full, backgroundColor: colors.ink, opacity: !canRun ? 0.3 : pressed ? 0.8 : 1 })}
          >
            <Text style={{ color: colors.onInk, fontSize: 15, fontWeight: '700' }}>Find assignments and birthdays</Text>
          </Pressable>
        </View>
      ) : null}

      {summary ? (
        <View style={{ gap: spacing.sm, padding: spacing.md, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card, boxShadow: shadows.card }}>
          <Text style={{ fontSize: 17, fontWeight: '700', color: colors.ink }}>Done</Text>
          <Text style={{ fontSize: 15, color: colors.inkSoft }}>
            Read {summary.messages} messages from {summary.chats} {summary.chats === 1 ? 'chat' : 'chats'}. {summary.deadlines} upcoming {summary.deadlines === 1 ? 'deadline' : 'deadlines'} and {summary.birthdays} {summary.birthdays === 1 ? 'birthday' : 'birthdays'} are waiting in your Inbox.
          </Text>
          {summary.unnamedWishes > 0 ? (
            <Text style={{ fontSize: 13, color: colors.muted }}>
              {summary.unnamedWishes} birthday {summary.unnamedWishes === 1 ? 'wish' : 'wishes'} in a group did not say whose it was, so {summary.unnamedWishes === 1 ? 'it was' : 'they were'} skipped.
            </Text>
          ) : null}
          <Pressable onPress={() => router.navigate('/inbox')} accessibilityRole="button" style={({ pressed }) => ({ alignSelf: 'flex-start', opacity: pressed ? 0.5 : 1 })}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.ink }}>Open Inbox</Text>
          </Pressable>
        </View>
      ) : null}
    </ScrollView>
  );
}
