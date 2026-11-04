import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MonthCalendar } from '@/components/month-calendar';
import { Text } from '@/components/text';
import { birthdaysFor } from '@/domain/birthdays';
import { addDays, fromDay, type Day } from '@/domain/dates';
import { doneTasksOn, openTasksOn } from '@/domain/planner';
import { repeatLabel, type Repeat } from '@/domain/repeat';
import { useStore } from '@/store/app-store';
import { colors, radius, shadows, spacing, type } from '@/theme';

const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** A whole-month view. Pick a day to see what is on it, then open it on Today or add something to it. */
export default function CalendarScreen() {
  const insets = useSafeAreaInsets();
  const { today, snapshot, toggleDone } = useStore();
  const [day, setDay] = useState<Day>(today);

  const { tasks } = snapshot.plan;
  const open = openTasksOn(tasks, day);
  const done = doneTasksOn(tasks, day);
  const birthdays = birthdaysFor(day, today, snapshot.birthdays, snapshot.wishes);
  const marked = (d: Day) => tasks.some((t) => t.day === d) || snapshot.birthdays.some((b) => birthdaysFor(d, today, [b], []).some((i) => !i.belated));

  const date = fromDay(day);
  const label = day === today ? 'Today' : day === addDays(today, 1) ? 'Tomorrow' : WEEKDAY[date.getDay()];
  const count = open.length + done.length + birthdays.length;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.md, paddingBottom: insets.bottom + 120, gap: spacing.md }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Pressable onPress={() => router.back()} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back" style={({ pressed }) => ({ padding: spacing.sm, opacity: pressed ? 0.5 : 1 })}>
            <MaterialIcons name="arrow-back" size={24} color={colors.ink} />
          </Pressable>
          <Text style={[type.title, { color: colors.ink }]}>Calendar</Text>
        </View>

        <View style={{ padding: spacing.md, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card, boxShadow: shadows.card }}>
          <MonthCalendar value={day} today={today} onSelect={setDay} marked={marked} />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: spacing.xs }}>
          <Text style={[type.headline, { color: colors.ink }]}>
            {label}, {date.getDate()} {MONTH[date.getMonth()]}
          </Text>
          <Text style={[type.caption, { color: colors.muted }]}>{count === 0 ? 'Nothing planned' : `${count} ${count === 1 ? 'item' : 'items'}`}</Text>
        </View>

        <View style={{ gap: spacing.sm }}>
          {birthdays.map((item) => (
            <Line key={`${item.birthday.id}-${item.year}`} bar={colors.accent} title={`${item.birthday.name}'s birthday`} meta={item.turns !== null ? `turns ${item.turns}` : undefined} />
          ))}
          {open.map((t) => (
            <Line key={t.id} bar={colors.ink} title={t.title} meta={metaOf(t.time, t.repeat, t.every)} onPress={() => router.push({ pathname: '/task/[id]', params: { id: t.id } })} onCheck={() => toggleDone(t.id)} />
          ))}
          {done.map((t) => (
            <Line key={t.id} bar={colors.done} title={t.title} meta={metaOf(t.time, t.repeat, t.every)} done onCheck={() => toggleDone(t.id)} />
          ))}
        </View>

        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Action icon="add" label="Add to this day" onPress={() => router.push({ pathname: '/add', params: { day } })} />
          <Action icon="today" label="Open on Today" dark onPress={() => router.navigate({ pathname: '/', params: { day } })} />
        </View>
      </ScrollView>
    </View>
  );
}

function metaOf(time: string | null, repeat: Repeat, every: number): string | undefined {
  const parts = [time, repeat === 'none' ? null : repeatLabel(repeat, every)].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : undefined;
}

function Line({ bar, title, meta, done, onPress, onCheck }: { bar: string; title: string; meta?: string; done?: boolean; onPress?: () => void; onCheck?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingLeft: 12, paddingRight: 6, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card, boxShadow: shadows.card, opacity: pressed ? 0.7 : 1 })}
    >
      <View style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, backgroundColor: bar }} />
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={{ fontSize: 15, lineHeight: 20, fontWeight: '600', color: done ? colors.muted : colors.ink, textDecorationLine: done ? 'line-through' : 'none' }}>{title}</Text>
        {meta ? <Text style={[type.caption, { color: colors.muted, fontVariant: ['tabular-nums'] }]}>{meta}</Text> : null}
      </View>
      {onCheck ? (
        <Pressable onPress={onCheck} hitSlop={8} accessibilityRole="checkbox" accessibilityState={{ checked: !!done }} accessibilityLabel={done ? `Reopen ${title}` : `Mark ${title} done`} style={{ padding: 8 }}>
          <MaterialIcons name={done ? 'check-circle' : 'radio-button-unchecked'} size={24} color={done ? colors.done : colors.faint} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

function Action({ icon, label, dark, onPress }: { icon: keyof typeof MaterialIcons.glyphMap; label: string; dark?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingVertical: 14, borderRadius: radius.full, backgroundColor: dark ? colors.ink : colors.card, boxShadow: dark ? undefined : shadows.card, transform: [{ scale: pressed ? 0.97 : 1 }] })}
    >
      <MaterialIcons name={icon} size={18} color={dark ? colors.onInk : colors.ink} />
      <Text style={{ fontSize: 15, fontWeight: '700', color: dark ? colors.onInk : colors.ink }}>{label}</Text>
    </Pressable>
  );
}
