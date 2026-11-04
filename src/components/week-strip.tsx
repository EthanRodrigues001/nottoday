import * as Haptics from 'expo-haptics';
import { Pressable, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';

import { ProgressRing } from '@/components/progress-ring';
import { Text } from '@/components/text';
import { addDays, fromDay, weekDays, type Day } from '@/domain/dates';
import { dayProgress, type DayEntry } from '@/domain/planner';
import { colors, fonts, spacing } from '@/theme';

const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DAY_SIZE = 38;

type Props = {
  today: Day;
  selected: Day;
  entries: DayEntry[];
  hasBirthday: (day: Day) => boolean;
  onSelect: (day: Day) => void;
};

/**
 * Seven equal columns, one per day: the weekday letter, then the date inside a ring that shows how much of
 * that day's list was done (past days and today), and a small dot under days that still have something coming.
 * The chosen day is a filled white circle. Tapping a day opens its list; a sideways flick changes the week.
 */
export function WeekStrip({ today, selected, entries, hasBirthday, onSelect }: Props) {
  const days = weekDays(selected);
  const flick = (direction: 1 | -1) => {
    Haptics.selectionAsync();
    onSelect(addDays(selected, 7 * direction));
  };
  // The flick needs distance or speed, so plain taps on a day still work.
  const pan = usePanGesture({
    activeOffsetX: [-20, 20],
    failOffsetY: [-12, 12],
    onDeactivate: (e) => {
      'worklet';
      if (e.translationX < -60 || e.velocityX < -700) scheduleOnRN(flick, 1);
      else if (e.translationX > 60 || e.velocityX > 700) scheduleOnRN(flick, -1);
    },
  });

  return (
    <GestureDetector gesture={pan}>
      <View style={{ flexDirection: 'row', paddingHorizontal: spacing.sm }}>
        {days.map((day, i) => {
          const isSelected = day === selected;
          const isToday = day === today;
          const isFuture = day > today;
          const progress = dayProgress(entries, day);
          const marked = (isFuture && progress.hasItems) || hasBirthday(day);
          return (
            <Pressable
              key={day}
              onPress={() => onSelect(day)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={fromDay(day).toDateString()}
              style={({ pressed }) => ({ flex: 1, alignItems: 'center', gap: 6, paddingVertical: 4, opacity: pressed ? 0.6 : 1 })}
            >
              <Text style={{ fontFamily: fonts.semibold, fontSize: 11, lineHeight: 14, letterSpacing: 0.6, color: isToday || isSelected ? colors.onNight : colors.onNightMuted }}>
                {LETTERS[i]}
              </Text>
              <View
                style={{
                  width: DAY_SIZE,
                  height: DAY_SIZE,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <View style={{ position: 'absolute' }}>
                  <ProgressRing
                    size={DAY_SIZE}
                    stroke={3}
                    fraction={progress.fraction}
                    mode={isFuture ? 'empty' : 'ring'}
                    track={isSelected ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.16)'}
                    fill={isSelected ? colors.card : undefined}
                  />
                </View>
                <Text
                  style={{
                    fontFamily: isSelected || isToday ? fonts.bold : fonts.medium,
                    fontSize: 15,
                    lineHeight: 18,
                    letterSpacing: -0.2,
                    fontVariant: ['tabular-nums'],
                    color: isSelected ? colors.ink : colors.onNight,
                  }}
                >
                  {Number(day.slice(8))}
                </Text>
              </View>
              <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: marked ? colors.accent : 'transparent' }} />
            </Pressable>
          );
        })}
      </View>
    </GestureDetector>
  );
}
