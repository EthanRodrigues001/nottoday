import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ConfirmSheet } from '@/components/confirm-sheet';
import { DueDatePicker } from '@/components/due-date-picker';
import { MonthCalendar } from '@/components/month-calendar';
import { Text } from '@/components/text';
import { TextInput } from '@/components/text-input';
import type { Day } from '@/domain/dates';
import { suggestionTitle } from '@/domain/suggestion-title';
import { dayLabel } from '@/lib/day-label';
import { useInbox } from '@/store/inbox';
import { useStore } from '@/store/app-store';
import type { Suggestion } from '@/whatsapp/ingest';
import { scanningState } from '@/whatsapp/scanning-status';
import { colors, fonts, radius, shadows, spacing, type } from '@/theme';

const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function InboxScreen() {
  const insets = useSafeAreaInsets();
  const { pending } = useInbox();
  const state = scanningState();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingHorizontal: spacing.md, paddingBottom: 150, gap: spacing.md }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: spacing.xs }}>
        <View>
          <Text style={[type.display, { color: colors.ink }]}>Inbox</Text>
          <Text style={[type.subhead, { color: colors.muted }]}>
            {pending.length === 0 ? 'Nothing to review' : `${pending.length} from WhatsApp to review`}
          </Text>
        </View>
        <Pressable
          onPress={() => router.push('/settings')}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Settings"
          style={({ pressed }) => ({ marginTop: spacing.xs, padding: spacing.sm, opacity: pressed ? 0.5 : 1 })}
        >
          <MaterialIcons name="settings" size={24} color={colors.inkSoft} />
        </Pressable>
      </View>

      {pending.length === 0 ? (
        <Animated.View entering={FadeIn.duration(240)} style={{ alignItems: 'center', gap: spacing.sm, paddingTop: spacing.xxl, paddingHorizontal: spacing.lg }}>
          <MaterialIcons name="mark-email-read" size={40} color={colors.faint} />
          <Text style={{ fontFamily: fonts.display, fontStyle: 'italic', fontSize: 30, lineHeight: 34, letterSpacing: -0.4, color: colors.inkSoft }}>All caught up</Text>
          <Text style={[type.subhead, { color: colors.muted, textAlign: 'center' }]}>
            {state === 'on'
              ? 'Assignments and birthdays found in WhatsApp show up here for you to add.'
              : state === 'needs-access'
                ? 'WhatsApp scanning is off. Turn on notification access in Settings to find assignments automatically.'
                : 'Live scanning needs the development build of the app, not Expo Go. You can still import old chats from Settings.'}
          </Text>
        </Animated.View>
      ) : null}

      {pending.map((s) => (
        <SuggestionCard key={s.id} suggestion={s} />
      ))}
    </ScrollView>
  );
}

/** True when the quoted message says nothing the title does not, so quoting it would only repeat it. */
function repeatsTitle(title: string, snippet: string): boolean {
  const flat = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  return flat(snippet) === flat(title);
}

function SuggestionCard({ suggestion: s }: { suggestion: Suggestion }) {
  const { today } = useStore();
  const { accept, dismiss, neverFromChat } = useInbox();
  const isBirthday = s.kind === 'birthday';
  const [title, setTitle] = useState(() => suggestionTitle(s.snippet));
  const [name, setName] = useState(s.name ?? '');
  const [day, setDay] = useState<Day | null>(s.day);
  const [picking, setPicking] = useState(false);
  const [asking, setAsking] = useState(false);

  const canAdd = isBirthday ? name.trim().length > 0 && day !== null : title.trim().length > 0;
  const heard = new Date(s.sentAt);
  const source = `${s.sender !== s.chat ? `${s.sender} in ` : ''}${s.chat} · ${heard.getDate()} ${MONTH[heard.getMonth()]}`;
  const dateText = isBirthday
    ? day
      ? `Every ${Number(day.slice(8))} ${MONTH[Number(day.slice(5, 7)) - 1]}`
      : 'Pick the date'
    : dayLabel(day, today) + (s.time ? ` · ${s.time}` : '');

  const add = () => {
    if (!canAdd) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (isBirthday && day) accept(s.id, { kind: 'birthday', name: name.trim(), day });
    else accept(s.id, { kind: 'deadline', title: title.trim(), day, time: s.time });
  };

  return (
    <Animated.View
      layout={LinearTransition.duration(220)}
      exiting={FadeOut.duration(160)}
      style={{ gap: spacing.sm, padding: spacing.md, paddingBottom: spacing.sm, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card, boxShadow: shadows.card }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: isBirthday ? 'rgba(242,107,58,0.12)' : 'rgba(47,139,255,0.12)' }}>
          <MaterialIcons name={isBirthday ? 'cake' : 'assignment'} size={15} color={isBirthday ? colors.accent : colors.glow} />
        </View>
        <Text numberOfLines={1} style={[type.caption, { flex: 1, color: colors.muted }]}>
          {source}
        </Text>
        <Pressable onPress={() => setAsking(true)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`More about ${s.chat}`} style={({ pressed }) => ({ padding: 4, opacity: pressed ? 0.5 : 1 })}>
          <MaterialIcons name="more-horiz" size={20} color={colors.muted} />
        </Pressable>
      </View>

      <TextInput
        value={isBirthday ? name : title}
        onChangeText={isBirthday ? setName : setTitle}
        multiline
        placeholder={isBirthday ? 'Whose birthday?' : 'Task'}
        placeholderTextColor={colors.faint}
        accessibilityLabel={isBirthday ? 'Name' : 'Task title'}
        style={[type.headline, { color: colors.ink, padding: 0, paddingVertical: 2 }]}
      />
      {isBirthday ? <Text style={[type.caption, { color: colors.muted, marginTop: -spacing.xs }]}>Wished a happy birthday in this chat</Text> : null}

      {!repeatsTitle(isBirthday ? name : title, s.snippet) ? (
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <View style={{ width: 3, borderRadius: 2, backgroundColor: colors.hairline }} />
          <Text selectable numberOfLines={3} style={{ flex: 1, fontSize: 13, lineHeight: 19, color: colors.muted }}>
            {s.snippet}
          </Text>
        </View>
      ) : null}

      <Pressable
        onPress={() => {
          Haptics.selectionAsync();
          setPicking((v) => !v);
        }}
        accessibilityRole="button"
        accessibilityState={{ expanded: picking }}
        accessibilityLabel={`${isBirthday ? 'Birthday' : 'Due'} ${dateText}. Change`}
        style={({ pressed }) => ({
          alignSelf: 'flex-start',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingVertical: 8,
          paddingHorizontal: 12,
          borderRadius: radius.md,
          borderCurve: 'continuous',
          backgroundColor: s.approximate || day === null ? 'rgba(242,107,58,0.12)' : colors.background,
          transform: [{ scale: pressed ? 0.97 : 1 }],
        })}
      >
        <MaterialIcons name="calendar-month" size={16} color={s.approximate || day === null ? colors.accent : colors.muted} />
        <Text style={{ fontSize: 14, fontWeight: '600', color: s.approximate || day === null ? colors.accent : colors.inkSoft }}>{dateText}</Text>
        {s.approximate ? <Text style={{ fontSize: 12, fontWeight: '600', color: colors.accent }}>· check</Text> : null}
        <MaterialIcons name={picking ? 'expand-less' : 'expand-more'} size={18} color={colors.muted} />
      </Pressable>

      {picking ? (
        <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)} layout={LinearTransition.duration(200)} style={{ paddingTop: spacing.xs }}>
          {isBirthday ? (
            <MonthCalendar
              value={day}
              today={today}
              jump
              startAt={day ?? today}
              onSelect={(picked) => {
                setDay(picked);
                setPicking(false);
              }}
            />
          ) : (
            <DueDatePicker
              value={day}
              today={today}
              onChange={(picked) => {
                setDay(picked);
                setPicking(false);
              }}
            />
          )}
        </Animated.View>
      ) : null}

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: spacing.xs, paddingTop: spacing.xs }}>
        <Pressable
          onPress={() => dismiss(s.id)}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          style={({ pressed }) => ({ paddingVertical: 10, paddingHorizontal: 16, borderRadius: radius.full, opacity: pressed ? 0.5 : 1 })}
        >
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.muted }}>Dismiss</Text>
        </Pressable>
        <Pressable
          onPress={add}
          disabled={!canAdd}
          accessibilityRole="button"
          style={({ pressed }) => ({ paddingVertical: 10, paddingHorizontal: 20, borderRadius: radius.full, backgroundColor: colors.ink, opacity: !canAdd ? 0.3 : 1, transform: [{ scale: pressed ? 0.96 : 1 }] })}
        >
          <Text style={{ color: colors.onInk, fontSize: 14, fontWeight: '700' }}>{isBirthday ? 'Add birthday' : 'Add task'}</Text>
        </Pressable>
      </View>

      <ConfirmSheet
        visible={asking}
        title={`Stop scanning ${s.chat}?`}
        message="Assignments and birthdays in this chat will no longer be suggested. You can switch it back on in Settings."
        confirmLabel="Never from this chat"
        destructive
        onConfirm={() => neverFromChat(s.chat)}
        onClose={() => setAsking(false)}
      />
    </Animated.View>
  );
}
