import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Pressable, ScrollView, Share, Switch, View } from 'react-native';
import { Text } from '@/components/text';
import { ConfirmSheet } from '@/components/confirm-sheet';
import { TimeField } from '@/components/time-field';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { readPickedFile } from '@/lib/read-picked-file';
import { parseBackup, serializeBackup } from '@/domain/backup';
import { useStore } from '@/store/app-store';
import { useUpdates } from '@/updates/updates';
import { lastWhatsAppEventAt, openNotificationAccess, reconnectListener, scanningState, type ScanningState } from '@/whatsapp/scanning-status';
import { DEFAULT_RETENTION_DAYS, getMeta, listChats, retentionDays, setChatEnabled, setRetentionDays, type ChatRow } from '@/whatsapp/repository';
import { colors, radius, shadows, spacing, type } from '@/theme';

const RETENTION_CHOICES = [3, 7, 14, 30];

function ago(ms: number): string {
  const minutes = Math.round((Date.now() - ms) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { db, snapshot, animatedHeader, setAnimatedHeader, replaceAll, reminderTimes, setReminderTimes } = useStore();
  const updates = useUpdates();
  const [state, setState] = useState<ScanningState>(scanningState());
  const [chats, setChats] = useState<ChatRow[]>([]);
  const [lastSeen, setLastSeen] = useState<number | null>(null);
  const [days, setDays] = useState(DEFAULT_RETENTION_DAYS);
  const [dialog, setDialog] = useState<{ title: string; message: string; confirmLabel: string; destructive?: boolean; onConfirm?: () => void } | null>(null);

  const read = useCallback(async () => {
    if (!db) return null;
    const stored = await getMeta(db, 'last_message_at');
    const lastSeen = lastWhatsAppEventAt() ?? (stored ? Number(stored) : null);
    return { chats: await listChats(db), lastSeen, days: await retentionDays(db) };
  }, [db]);

  // Read on open, and again when returning from Android's notification-access screen.
  useEffect(() => {
    let alive = true;
    const apply = () =>
      read().then(
        (data) => {
          if (!alive || !data) return;
          setChats(data.chats);
          setLastSeen(data.lastSeen);
          setDays(data.days);
        },
        (error) => console.warn('Loading settings failed', error),
      );
    apply();
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return;
      setState(scanningState());
      apply();
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, [read]);

  const toggleChat = async (name: string, enabled: boolean) => {
    if (!db) return;
    await setChatEnabled(db, name, enabled);
    setChats(await listChats(db));
  };

  const chooseRetention = async (n: number) => {
    if (!db) return;
    setDays(n);
    await setRetentionDays(db, n);
  };

  const backUp = async () => {
    const json = serializeBackup({ plan: snapshot.plan, birthdays: snapshot.birthdays, wishes: snapshot.wishes }, new Date());
    await Share.share({ title: 'notToday backup', message: json });
  };

  const restore = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain'], copyToCacheDirectory: true, multiple: false });
    if (result.canceled || result.assets.length === 0) return;
    try {
      const parsed = parseBackup(await readPickedFile(result.assets[0].uri));
      if (!parsed.ok) {
        setDialog({ title: 'Cannot restore', message: parsed.error, confirmLabel: 'OK' });
        return;
      }
      const backup = parsed.data;
      setDialog({
        title: 'Replace everything?',
        message: `This replaces your current tasks and birthdays with the backup (${backup.plan.tasks.length} tasks, ${backup.birthdays.length} birthdays).`,
        confirmLabel: 'Restore',
        destructive: true,
        onConfirm: () => replaceAll(backup),
      });
    } catch {
      setDialog({ title: 'Cannot restore', message: 'That file could not be read.', confirmLabel: 'OK' });
    }
  };

  const status =
    state === 'on'
      ? { icon: 'check-circle' as const, tint: colors.done, text: 'WhatsApp scanning is on' }
      : state === 'needs-access'
        ? { icon: 'error' as const, tint: colors.danger, text: 'WhatsApp scanning is off' }
        : { icon: 'info' as const, tint: colors.muted, text: 'Scanning needs the development build' };

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
        <Text style={[type.title, { color: colors.ink }]}>Settings</Text>
      </View>

      <Section title="WhatsApp scanning">
        <Card>
          <MaterialIcons name={status.icon} size={24} color={status.tint} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: colors.ink }}>{status.text}</Text>
            <Text style={{ fontSize: 13, color: colors.muted }}>
              {lastSeen ? `Last WhatsApp message seen ${ago(lastSeen)}` : 'No WhatsApp message seen yet'}
            </Text>
          </View>
        </Card>
        {state === 'needs-access' ? (
          <Pressable
            onPress={openNotificationAccess}
            accessibilityRole="button"
            style={({ pressed }) => ({ alignItems: 'center', paddingVertical: spacing.md, borderRadius: radius.full, backgroundColor: colors.ink, opacity: pressed ? 0.8 : 1 })}
          >
            <Text style={{ color: colors.onInk, fontSize: 15, fontWeight: '700' }}>Allow notification access</Text>
          </Pressable>
        ) : null}
        {state === 'on' ? (
          <View style={{ gap: spacing.sm, paddingHorizontal: spacing.xs }}>
            <Text style={{ fontSize: 13, color: colors.muted }}>
              If messages stop arriving, check that this app is allowed to run in the background (battery and autostart settings on some phones).
            </Text>
            <Pressable onPress={reconnectListener} accessibilityRole="button" style={({ pressed }) => ({ alignSelf: 'flex-start', opacity: pressed ? 0.5 : 1 })}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.ink }}>Reconnect scanner</Text>
            </Pressable>
          </View>
        ) : null}
      </Section>

      <Section title="Chats">
        {chats.length === 0 ? <Text style={{ fontSize: 14, color: colors.muted, paddingHorizontal: spacing.xs }}>Chats appear here after their first message. Switch off any you do not want scanned.</Text> : null}
        {chats.map((chat) => (
          <Card key={chat.name}>
            <MaterialIcons name={chat.isGroup ? 'groups' : 'person'} size={22} color={colors.muted} />
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: '600', color: colors.ink }}>{chat.name}</Text>
              <Text style={{ fontSize: 12, color: colors.muted }}>Last message {ago(chat.lastSeen)}</Text>
            </View>
            <Switch value={chat.enabled} onValueChange={(v) => toggleChat(chat.name, v)} accessibilityLabel={`Scan ${chat.name}`} />
          </Card>
        ))}
      </Section>

      <Section title="Find in old chats">
        <Row icon="upload-file" label="Import chat exports" hint="Old messages: deadlines ahead and birthdays you wished" onPress={() => router.push('/import')} />
        <Row icon="history" label="Recent messages" hint="Add one the scanner missed" onPress={() => router.push('/recent')} />
      </Section>

      <Section title="Keep message text for">
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {RETENTION_CHOICES.map((n) => (
            <Pressable
              key={n}
              onPress={() => chooseRetention(n)}
              accessibilityRole="button"
              accessibilityState={{ selected: days === n }}
              style={({ pressed }) => ({ flex: 1, alignItems: 'center', paddingVertical: spacing.md, borderRadius: radius.full, backgroundColor: days === n ? colors.ink : colors.card, opacity: pressed ? 0.7 : 1 })}
            >
              <Text style={{ fontSize: 15, fontWeight: '700', color: days === n ? colors.onInk : colors.inkSoft }}>{n} days</Text>
            </Pressable>
          ))}
        </View>
        <Text style={{ fontSize: 13, color: colors.muted, paddingHorizontal: spacing.xs }}>
          Scanned messages stay on this phone only and are deleted after this time. Tasks and birthdays you accept keep a short snippet.
        </Text>
      </Section>

      <Section title="Appearance">
        <Card>
          <MaterialIcons name="auto-awesome" size={22} color={colors.muted} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: colors.ink }}>Animated header</Text>
            <Text style={{ fontSize: 12, color: colors.muted }}>The moving gradient on Today. Turn off to save battery.</Text>
          </View>
          <Switch value={animatedHeader} onValueChange={setAnimatedHeader} accessibilityLabel="Animated header" />
        </Card>
      </Section>

      <Section title="Your data">
        <Row icon="ios-share" label="Back up" hint="Share your tasks and birthdays as a file" onPress={backUp} />
        <Row icon="restore" label="Restore from a backup" hint="Replaces what is in the app now" onPress={restore} />
      </Section>

      <Section title="Reminders">
        <Card>
          <MaterialIcons name="wb-sunny" size={22} color={colors.muted} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: colors.ink }}>Morning summary</Text>
            <Text style={{ fontSize: 12, color: colors.muted }}>Tasks due and birthdays</Text>
          </View>
          <TimeField value={reminderTimes.morning} clearable={false} onChange={(t) => t && setReminderTimes({ ...reminderTimes, morning: t })} />
        </Card>
        <Card>
          <MaterialIcons name="nights-stay" size={22} color={colors.muted} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: colors.ink }}>Evening nudge</Text>
            <Text style={{ fontSize: 12, color: colors.muted }}>Only if something is still open</Text>
          </View>
          <TimeField value={reminderTimes.evening} clearable={false} onChange={(t) => t && setReminderTimes({ ...reminderTimes, evening: t })} />
        </Card>
      </Section>
      <Section title="About">
        <Row
          icon="system-update"
          label={updates.check === 'available' && updates.release ? `Update to ${updates.release.version}` : 'Check for updates'}
          hint={
            updates.check === 'checking'
              ? 'Looking…'
              : updates.check === 'available'
                ? `You have ${updates.version}. Tap to see what is new`
                : updates.check === 'failed'
                  ? `Could not reach GitHub. You have ${updates.version}`
                  : `notToday ${updates.version}${updates.check === 'upToDate' ? ' · up to date' : ''}`
          }
          onPress={async () => {
            if (updates.check !== 'available') await updates.checkNow();
            router.push('/update');
          }}
        />
      </Section>
      <ConfirmSheet
        visible={dialog !== null}
        title={dialog?.title ?? ''}
        message={dialog?.message ?? ''}
        confirmLabel={dialog?.confirmLabel ?? 'OK'}
        destructive={dialog?.destructive}
        onConfirm={dialog?.onConfirm}
        onClose={() => setDialog(null)}
      />
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={[type.overline, { color: colors.muted, paddingHorizontal: spacing.xs }]}>{title.toUpperCase()}</Text>
      {children}
    </View>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card, boxShadow: shadows.card }}>
      {children}
    </View>
  );
}

function Row({ icon, label, hint, onPress }: { icon: keyof typeof MaterialIcons.glyphMap; label: string; hint: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
      <Card>
        <MaterialIcons name={icon} size={22} color={colors.muted} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: colors.ink }}>{label}</Text>
          <Text style={{ fontSize: 12, color: colors.muted }}>{hint}</Text>
        </View>
        <MaterialIcons name="chevron-right" size={22} color={colors.faint} />
      </Card>
    </Pressable>
  );
}
