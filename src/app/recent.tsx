import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/components/text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { classifyDeadline } from '@/domain/classifier';
import { useStore } from '@/store/app-store';
import { useInbox } from '@/store/inbox';
import { createRepo, recentMessageList, type RecentMessage } from '@/whatsapp/repository';
import { colors, radius, shadows, spacing, type } from '@/theme';

function ago(ms: number): string {
  const hours = Math.round((Date.now() - ms) / 3600000);
  if (hours < 1) return 'just now';
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
}

/** The last couple of weeks of scanned messages, so one that was missed can be added by hand. */
export default function RecentMessagesScreen() {
  const insets = useSafeAreaInsets();
  const { db } = useStore();
  const { refresh } = useInbox();
  const [messages, setMessages] = useState<RecentMessage[] | null>(null);
  const [added, setAdded] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!db) return;
    let alive = true;
    recentMessageList(db, 60).then(
      (list) => alive && setMessages(list),
      (error) => console.warn('Reading recent messages failed', error instanceof Error ? error.message : 'unknown error'),
    );
    return () => {
      alive = false;
    };
  }, [db]);

  const add = useCallback(
    async (m: RecentMessage) => {
      if (!db) return;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const date = classifyDeadline(m.text, new Date(m.sentAt)).date;
      await createRepo(db).addSuggestion({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
        kind: 'deadline',
        chat: m.chat,
        sender: m.sender,
        snippet: m.text.length > 220 ? `${m.text.slice(0, 219)}…` : m.text,
        sentAt: m.sentAt,
        day: date?.day ?? null,
        time: date?.time ?? null,
        name: null,
        approximate: date?.approximate ?? false,
        score: 1,
        status: 'pending',
        createdAt: Date.now(),
      });
      setAdded((s) => new Set(s).add(m.id));
      await refresh();
    },
    [db, refresh],
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.md, paddingBottom: insets.bottom + spacing.xl, gap: spacing.md }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Pressable onPress={() => router.back()} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back" style={({ pressed }) => ({ padding: spacing.sm, opacity: pressed ? 0.5 : 1 })}>
          <MaterialIcons name="arrow-back" size={24} color={colors.ink} />
        </Pressable>
        <Text style={[type.title, { color: colors.ink }]}>Recent messages</Text>
      </View>
      <Text style={{ fontSize: 14, color: colors.muted }}>Missed an assignment? Add it from here to your Inbox. The app learns from it.</Text>

      {messages === null ? null : messages.length === 0 ? (
        <Text style={{ fontSize: 14, color: colors.muted, paddingTop: spacing.lg, textAlign: 'center' }}>No scanned messages yet.</Text>
      ) : null}

      {messages?.map((m) => (
        <View key={m.id} style={{ gap: spacing.sm, padding: spacing.md, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card, boxShadow: shadows.card }}>
          <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: '700', color: colors.muted }}>
            {m.chat}
            {m.sender !== m.chat ? ` · ${m.sender}` : ''} · {ago(m.sentAt)}
          </Text>
          <Text numberOfLines={4} style={{ fontSize: 15, lineHeight: 21, color: colors.inkSoft }}>
            {m.text}
          </Text>
          <Pressable
            onPress={() => add(m)}
            disabled={added.has(m.id)}
            accessibilityRole="button"
            style={({ pressed }) => ({ alignSelf: 'flex-start', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.full, backgroundColor: added.has(m.id) ? colors.background : colors.ink, opacity: pressed ? 0.7 : 1 })}
          >
            <Text style={{ fontSize: 13, fontWeight: '700', color: added.has(m.id) ? colors.muted : colors.onInk }}>{added.has(m.id) ? 'Added to Inbox' : 'This is an assignment'}</Text>
          </Pressable>
        </View>
      ))}
    </ScrollView>
  );
}
