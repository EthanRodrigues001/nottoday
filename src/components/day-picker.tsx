import { Pressable, ScrollView } from 'react-native';
import { Text } from '@/components/text';

import { addDays, fromDay, type Day } from '@/domain/dates';
import { colors, radius, spacing } from '@/theme';

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function labelFor(day: Day, today: Day): string {
  if (day === today) return 'Today';
  if (day === addDays(today, 1)) return 'Tomorrow';
  const d = fromDay(day);
  return `${WEEKDAY[d.getDay()]} ${d.getDate()}`;
}

/** A row of day chips: today and the days after it, Someday, and the current value if it falls outside them. */
export function DayPicker({ value, today, onChange }: { value: Day | null; today: Day; onChange: (day: Day | null) => void }) {
  const days = Array.from({ length: 8 }, (_, i) => addDays(today, i));
  if (value !== null && !days.includes(value)) days.push(value);
  days.sort();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }} keyboardShouldPersistTaps="handled">
      {days.map((day) => (
        <Chip key={day} label={labelFor(day, today)} selected={value === day} onPress={() => onChange(day)} />
      ))}
      <Chip label="Someday" selected={value === null} onPress={() => onChange(null)} />
    </ScrollView>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={({ pressed }) => ({
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: radius.full,
        backgroundColor: selected ? colors.ink : colors.background,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text style={{ fontSize: 14, fontWeight: '600', color: selected ? colors.onInk : colors.inkSoft }}>{label}</Text>
    </Pressable>
  );
}
