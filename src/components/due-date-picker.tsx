import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Keyboard, Pressable, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import { MonthCalendar } from '@/components/month-calendar';
import { Text } from '@/components/text';
import { addDays, fromDay, type Day } from '@/domain/dates';
import { colors, radius, spacing } from '@/theme';

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type Props = {
  /** The due day, or null for Someday. */
  value: Day | null;
  today: Day;
  onChange: (day: Day | null) => void;
  /** Marks days on the calendar that already have something. */
  marked?: (day: Day) => boolean;
  /** Set when the picker sits on a grey surface, so the choices are drawn white to stay visible. */
  onGrey?: boolean;
};

/** Quick choices (Today, Tomorrow, Next week, Someday) and a button that opens a full month to pick any day. */
export function DueDatePicker({ value, today, onChange, marked, onGrey }: Props) {
  const tomorrow = addDays(today, 1);
  const nextWeek = addDays(today, 7);
  const quick = [today, tomorrow, nextWeek];
  const custom = value !== null && !quick.includes(value);
  const [open, setOpen] = useState(false);

  const choose = (day: Day | null) => {
    Haptics.selectionAsync();
    onChange(day);
    setOpen(false);
  };
  const d = value ? fromDay(value) : null;

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        <Chip onGrey={onGrey} label="Today" selected={value === today} onPress={() => choose(today)} />
        <Chip onGrey={onGrey} label="Tomorrow" selected={value === tomorrow} onPress={() => choose(tomorrow)} />
        <Chip onGrey={onGrey} label="Next week" selected={value === nextWeek} onPress={() => choose(nextWeek)} />
        <Chip onGrey={onGrey} label="Someday" selected={value === null} onPress={() => choose(null)} />
        <Chip
          onGrey={onGrey}
          icon="calendar-month"
          label={custom && d ? `${WEEKDAY[d.getDay()]} ${d.getDate()} ${MONTH[d.getMonth()]}` : 'Pick a date'}
          selected={custom}
          onPress={() => {
            Haptics.selectionAsync();
            Keyboard.dismiss(); // the month needs the room the keyboard is using
            setOpen((v) => !v);
          }}
        />
      </View>
      {open ? (
        <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)} layout={LinearTransition.duration(200)}>
          <MonthCalendar value={value} today={today} onSelect={choose} marked={marked} disablePast onGrey={onGrey} />
        </Animated.View>
      ) : null}
    </View>
  );
}

function Chip({ icon, label, selected, onPress, onGrey }: { icon?: keyof typeof MaterialIcons.glyphMap; label: string; selected: boolean; onPress: () => void; onGrey?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 9,
        paddingHorizontal: 11,
        borderRadius: radius.md,
        borderCurve: 'continuous',
        backgroundColor: selected ? colors.ink : onGrey ? colors.card : colors.background,
        transform: [{ scale: pressed ? 0.97 : 1 }],
      })}
    >
      {icon ? <MaterialIcons name={icon} size={16} color={selected ? colors.onInk : colors.muted} /> : null}
      <Text style={{ fontSize: 14, fontWeight: '600', color: selected ? colors.onInk : colors.inkSoft }}>{label}</Text>
    </Pressable>
  );
}
