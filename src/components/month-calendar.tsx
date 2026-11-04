import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { FadeIn } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

import { Text } from '@/components/text';
import { addMonths, fromDay, monthGrid, type Day } from '@/domain/dates';
import { colors, fonts, radius, spacing, type } from '@/theme';

const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const CELL = 40;
const PICK_ROW = 44;
const YEAR_ROWS_SHOWN = 5;
const YEAR_COLUMNS = 4;
const FIRST_YEAR = 1940;

type Props = {
  /** The chosen day, or null when nothing is chosen (Someday). */
  value: Day | null;
  today: Day;
  onSelect: (day: Day) => void;
  /** True for days that get a dot underneath, like days with tasks or a birthday. */
  marked?: (day: Day) => boolean;
  /** Greys out days before today and stops them being chosen, for picking a due date. */
  disablePast?: boolean;
  /** Set when the calendar sits on a grey surface, so the arrow buttons are drawn white. */
  onGrey?: boolean;
  /** Lets the month and the year in the title be tapped to jump straight there, for far-away dates like a birth year. */
  jump?: boolean;
  /** Month shown first when nothing is chosen yet. */
  startAt?: Day;
};

/**
 * A Monday-first month grid. A sideways flick or the arrows change the month; the chosen day is a dark disc,
 * today is orange, and a small dot sits under days with something on them. With `jump`, tapping the month
 * or the year in the title opens a picker for it.
 */
export function MonthCalendar({ value, today, onSelect, marked, disablePast, onGrey, jump, startAt }: Props) {
  const [shown, setShown] = useState<Day>(value ?? startAt ?? today);
  const [view, setView] = useState<'days' | 'months' | 'years'>('days');
  const grid = monthGrid(shown);
  const shownDate = fromDay(shown);
  const shownMonth = shownDate.getMonth();
  const rows: Day[][] = [];
  for (let i = 0; i < grid.length; i += 7) rows.push(grid.slice(i, i + 7));

  const go = (n: number) => {
    Haptics.selectionAsync();
    setShown((current) => addMonths(current, n));
  };
  const pan = usePanGesture({
    activeOffsetX: [-20, 20],
    failOffsetY: [-12, 12],
    onDeactivate: (e) => {
      'worklet';
      if (e.translationX < -50 || e.velocityX < -700) scheduleOnRN(go, 1);
      else if (e.translationX > 50 || e.velocityX > 700) scheduleOnRN(go, -1);
    },
  });

  const open = (next: 'months' | 'years') => {
    Haptics.selectionAsync();
    setView((current) => (current === next ? 'days' : next));
  };
  const pickMonth = (month: number) => {
    Haptics.selectionAsync();
    setShown((current) => addMonths(current, month - fromDay(current).getMonth()));
    setView('days');
  };
  const pickYear = (year: number) => {
    Haptics.selectionAsync();
    setShown((current) => addMonths(current, (year - fromDay(current).getFullYear()) * 12));
    setView('days');
  };

  // Newest year first, so the likely choices are at the top and the list opens near the current one.
  const lastYear = Number(today.slice(0, 4)) + 1;
  const years = Array.from({ length: lastYear - FIRST_YEAR + 1 }, (_, i) => lastYear - i);
  const yearRow = Math.floor((lastYear - shownDate.getFullYear()) / YEAR_COLUMNS);

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xs }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <TitlePart label={MONTH[shownDate.getMonth()]} strong active={view === 'months'} jump={jump} onPress={() => open('months')} />
          <TitlePart label={String(shownDate.getFullYear())} active={view === 'years'} jump={jump} onPress={() => open('years')} />
        </View>
        {view === 'days' ? (
          <View style={{ flexDirection: 'row', gap: spacing.xs }}>
            <Arrow onGrey={onGrey} icon="chevron-left" label="Previous month" onPress={() => go(-1)} />
            <Arrow onGrey={onGrey} icon="chevron-right" label="Next month" onPress={() => go(1)} />
          </View>
        ) : null}
      </View>

      {view === 'months' ? (
        <Animated.View entering={FadeIn.duration(160)} style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {MONTH.map((name, i) => (
            <Pick key={name} label={name.slice(0, 3)} selected={i === shownMonth} width="33.33%" onGrey={onGrey} onPress={() => pickMonth(i)} />
          ))}
        </Animated.View>
      ) : null}

      {view === 'years' ? (
        <Animated.View entering={FadeIn.duration(160)}>
          <ScrollView
            style={{ height: PICK_ROW * YEAR_ROWS_SHOWN }}
            contentOffset={{ x: 0, y: Math.max(0, yearRow - 1) * PICK_ROW }}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
          >
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {years.map((year) => (
                <Pick key={year} label={String(year)} selected={year === shownDate.getFullYear()} width="25%" onGrey={onGrey} onPress={() => pickYear(year)} />
              ))}
            </View>
          </ScrollView>
        </Animated.View>
      ) : null}

      {view === 'days' ? (
        <GestureDetector gesture={pan}>
          <View>
            <View style={{ flexDirection: 'row' }}>
              {LETTERS.map((letter, i) => (
                <Text key={i} style={[type.overline, { flex: 1, textAlign: 'center', color: colors.muted, paddingVertical: spacing.xs }]}>
                  {letter}
                </Text>
              ))}
            </View>
            {rows.map((row) => (
              <View key={row[0]} style={{ flexDirection: 'row' }}>
                {row.map((day) => {
                  const inMonth = fromDay(day).getMonth() === shownMonth;
                  const isSelected = day === value;
                  const isToday = day === today;
                  const disabled = disablePast === true && day < today;
                  return (
                    <Pressable
                      key={day}
                      onPress={() => !disabled && onSelect(day)}
                      disabled={disabled}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected, disabled }}
                      accessibilityLabel={fromDay(day).toDateString()}
                      style={({ pressed }) => ({ flex: 1, alignItems: 'center', paddingVertical: 2, opacity: pressed ? 0.6 : 1 })}
                    >
                      <View style={{ width: CELL, height: CELL, alignItems: 'center', justifyContent: 'center' }}>
                        {/* Drawn in SVG: on Android a rounded View whose colour changes can show as a square. */}
                        {isSelected ? (
                          <View style={{ position: 'absolute' }}>
                            <Svg width={CELL} height={CELL} viewBox={`0 0 ${CELL} ${CELL}`}>
                              <Circle cx={CELL / 2} cy={CELL / 2} r={CELL / 2} fill={colors.ink} />
                            </Svg>
                          </View>
                        ) : null}
                        <Text
                          style={{
                            fontFamily: isSelected || isToday ? fonts.bold : fonts.medium,
                            fontSize: 15,
                            lineHeight: 18,
                            letterSpacing: -0.2,
                            fontVariant: ['tabular-nums'],
                            color: isSelected ? colors.onInk : disabled ? colors.faint : isToday ? colors.accent : inMonth ? colors.ink : colors.faint,
                          }}
                        >
                          {Number(day.slice(8))}
                        </Text>
                        {marked?.(day) ? (
                          <View style={{ position: 'absolute', bottom: 4, width: 4, height: 4, borderRadius: 2, backgroundColor: isSelected ? colors.onInk : colors.accent }} />
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        </GestureDetector>
      ) : null}
    </View>
  );
}

function TitlePart({ label, strong, active, jump, onPress }: { label: string; strong?: boolean; active: boolean; jump?: boolean; onPress: () => void }) {
  const text = (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Text style={[type.headline, { color: strong ? colors.ink : colors.muted }]}>{label}</Text>
      {jump ? <MaterialIcons name={active ? 'expand-less' : 'expand-more'} size={18} color={colors.muted} /> : null}
    </View>
  );
  if (!jump) return text;
  return (
    <Pressable onPress={onPress} hitSlop={6} accessibilityRole="button" accessibilityLabel={`Choose ${strong ? 'month' : 'year'}`} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
      {text}
    </Pressable>
  );
}

function Pick({ label, selected, width, onGrey, onPress }: { label: string; selected: boolean; width: `${number}%`; onGrey?: boolean; onPress: () => void }) {
  return (
    <View style={{ width, alignItems: 'center', height: PICK_ROW, justifyContent: 'center' }}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        style={({ pressed }) => ({
          minWidth: 64,
          alignItems: 'center',
          paddingVertical: 8,
          paddingHorizontal: 12,
          borderRadius: radius.full,
          backgroundColor: selected ? colors.ink : pressed ? (onGrey ? colors.card : colors.background) : 'transparent',
        })}
      >
        <Text style={{ fontSize: 15, fontWeight: selected ? '700' : '500', color: selected ? colors.onInk : colors.ink, fontVariant: ['tabular-nums'] }}>{label}</Text>
      </Pressable>
    </View>
  );
}

function Arrow({ icon, label, onPress, onGrey }: { icon: 'chevron-left' | 'chevron-right'; label: string; onPress: () => void; onGrey?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: onGrey ? colors.card : colors.background, opacity: pressed ? 0.5 : 1 })}
    >
      <MaterialIcons name={icon} size={22} color={colors.inkSoft} />
    </Pressable>
  );
}
