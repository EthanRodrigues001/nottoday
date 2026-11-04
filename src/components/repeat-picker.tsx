import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Haptics from 'expo-haptics';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/text';
import type { Day } from '@/domain/dates';
import { MAX_EVERY, REPEATS, type Repeat } from '@/domain/repeat';
import { repeatSummary } from '@/lib/day-label';
import { colors, radius, spacing, type } from '@/theme';

const SHORT: Record<Repeat, string> = { none: 'Never', daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly' };
const UNIT: Record<Exclude<Repeat, 'none'>, [string, string]> = { daily: ['day', 'days'], weekly: ['week', 'weeks'], monthly: ['month', 'months'], yearly: ['year', 'years'] };

type Props = {
  value: Repeat;
  /** Gap between occurrences: 1 is every day/week/..., 3 is every third. */
  every: number;
  /** The task's day, used to say what "monthly" means for it ("on the 5th"). */
  day: Day | null;
  onChange: (repeat: Repeat, every: number) => void;
  /** Set when the picker sits on a grey surface, so the unselected choices are drawn white. */
  onGrey?: boolean;
};

/** Never, Daily, Weekly, Monthly, Yearly in one row, a stepper for "every 3 days", and a line saying in words what the choice means. */
export function RepeatPicker({ value, every, day, onChange, onGrey }: Props) {
  const idle = onGrey ? colors.card : colors.background;
  const step = (by: number) => {
    const next = Math.min(MAX_EVERY, Math.max(1, every + by));
    if (next === every) return;
    Haptics.selectionAsync();
    onChange(value, next);
  };
  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {REPEATS.map((repeat) => {
          const selected = repeat === value;
          return (
            <Pressable
              key={repeat}
              onPress={() => {
                Haptics.selectionAsync();
                onChange(repeat, repeat === 'none' ? 1 : every);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={({ pressed }) => ({
                flex: 1,
                alignItems: 'center',
                paddingVertical: 9,
                borderRadius: radius.md,
                borderCurve: 'continuous',
                backgroundColor: selected ? colors.ink : idle,
                transform: [{ scale: pressed ? 0.97 : 1 }],
              })}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: selected ? colors.onInk : colors.inkSoft }} numberOfLines={1}>
                {SHORT[repeat]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {value !== 'none' ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Text style={{ flex: 1, fontSize: 15, fontWeight: '500', color: colors.inkSoft }}>
            Every {every} {UNIT[value][every === 1 ? 0 : 1]}
          </Text>
          <Stepper icon="remove" label="Less often" disabled={every <= 1} onPress={() => step(-1)} fill={idle} />
          <Stepper icon="add" label="More often" disabled={every >= MAX_EVERY} onPress={() => step(1)} fill={idle} />
        </View>
      ) : null}

      {value !== 'none' && day ? <Text style={[type.caption, { color: colors.muted }]}>{repeatSummary(value, day, every)}</Text> : null}
    </View>
  );
}

function Stepper({ icon, label, disabled, onPress, fill }: { icon: 'add' | 'remove'; label: string; disabled: boolean; onPress: () => void; fill: string }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({ width: 40, height: 36, borderRadius: radius.md, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center', backgroundColor: fill, opacity: disabled ? 0.35 : 1, transform: [{ scale: pressed ? 0.94 : 1 }] })}
    >
      <MaterialIcons name={icon} size={20} color={colors.ink} />
    </Pressable>
  );
}
