import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Haptics from 'expo-haptics';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/text';
import { shiftTime, type TimeOfDay } from '@/domain/dates';
import { colors, radius, spacing } from '@/theme';

const STEP = 15;

type Props = {
  /** The time, or null when there is none. */
  value: TimeOfDay | null;
  onChange: (time: TimeOfDay | null) => void;
  /** Time a first tap on "Add time" starts from. */
  start?: TimeOfDay;
  /** When false the time cannot be cleared, for reminders that always have one. */
  clearable?: boolean;
};

/** A time of day moved in quarter-hour steps with the plus and minus buttons, so no keyboard is needed. */
export function TimeField({ value, onChange, start = '09:00', clearable = true }: Props) {
  if (value === null) {
    return (
      <Pressable
        onPress={() => onChange(start)}
        accessibilityRole="button"
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, opacity: pressed ? 0.5 : 1 })}
      >
        <MaterialIcons name="add" size={18} color={colors.accent} />
        <Text style={{ fontSize: 15, fontWeight: '600', color: colors.accent }}>Add time</Text>
      </Pressable>
    );
  }
  const move = (minutes: number) => {
    Haptics.selectionAsync();
    onChange(shiftTime(value, minutes));
  };
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <Step icon="remove" label="Earlier" onPress={() => move(-STEP)} />
      <Text style={{ minWidth: 56, textAlign: 'center', fontSize: 17, fontWeight: '700', color: colors.ink, fontVariant: ['tabular-nums'] }}>{value}</Text>
      <Step icon="add" label="Later" onPress={() => move(STEP)} />
      {clearable ? (
        <Pressable onPress={() => onChange(null)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Remove time" style={({ pressed }) => ({ marginLeft: spacing.xs, opacity: pressed ? 0.5 : 1 })}>
          <MaterialIcons name="close" size={18} color={colors.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}

function Step({ icon, label, onPress }: { icon: 'add' | 'remove'; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({ width: 34, height: 34, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, transform: [{ scale: pressed ? 0.94 : 1 }] })}
    >
      <MaterialIcons name={icon} size={20} color={colors.inkSoft} />
    </Pressable>
  );
}
