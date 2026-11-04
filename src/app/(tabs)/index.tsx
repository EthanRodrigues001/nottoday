import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { Text } from '@/components/text';
import Animated, { FadeIn, LinearTransition, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HeaderBackdrop } from '@/components/header-backdrop';
import { DraggableTaskList, useDragState } from '@/components/draggable-task-list';
import { DropZones, ZONE_HEIGHT } from '@/components/drop-zones';
import { TAB_BAR_HEIGHT } from '@/components/tab-bar-metrics';
import { WeekStrip } from '@/components/week-strip';
import { birthdaysFor, type BirthdayItem } from '@/domain/birthdays';
import { addDays, fromDay, isValidDay, type Day } from '@/domain/dates';
import { doneTasksOn, openTasksOn } from '@/domain/planner';
import { useStore } from '@/store/app-store';
import { useUpdates } from '@/updates/updates';
import { scanningState } from '@/whatsapp/scanning-status';
import { colors, fonts, radius, shadows, spacing, type } from '@/theme';

const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function heading(day: Day, today: Day) {
  if (day === today) return 'Today';
  if (day === addDays(today, 1)) return 'Tomorrow';
  if (day === addDays(today, -1)) return 'Yesterday';
  return WEEKDAY[fromDay(day).getDay()];
}

export default function TodayScreen() {
  const insets = useSafeAreaInsets();
  const { today, snapshot, animatedHeader, toggleDone, notToday, toggleWish, removeTask, moveTask } = useStore();
  const updates = useUpdates();
  const { height: windowHeight } = useWindowDimensions();
  const drag = useDragState();
  const scanning = scanningState();
  // Targets sit just above the floating tab bar; the finger counts as over them from slightly above.
  const zonesBottom = Math.max(insets.bottom, spacing.md) + TAB_BAR_HEIGHT + spacing.sm;
  const zoneTop = windowHeight - zonesBottom - ZONE_HEIGHT - spacing.lg;
  // The chosen day is remembered with the "today" it was chosen on, so a new calendar day resets it.
  const [picked, setPicked] = useState<{ day: Day; madeOn: Day }>({ day: today, madeOn: today });
  const [showDone, setShowDone] = useState(false);
  const selected = picked.madeOn === today ? picked.day : today;
  const setSelected = useCallback((day: Day) => setPicked({ day, madeOn: today }), [today]);

  // The Calendar screen opens a day here with a `day` parameter; take it once, then clear it.
  const { day: requested } = useLocalSearchParams<{ day?: string }>();
  const [handled, setHandled] = useState<string | undefined>(undefined);
  if (requested !== handled) {
    setHandled(requested);
    if (requested && isValidDay(requested)) setSelected(requested);
  }
  useEffect(() => {
    if (requested) router.setParams({ day: undefined });
  }, [requested]);

  const { tasks, entries } = snapshot.plan;
  const open = openTasksOn(tasks, selected);
  const done = doneTasksOn(tasks, selected);
  const birthdays = birthdaysFor(selected, today, snapshot.birthdays, snapshot.wishes);

  // Finishing the last open task of today gets a success buzz; the empty state pops a green check in.
  const previousOpen = useRef(open.length);
  const finishedToday = selected === today && open.length === 0 && done.length > 0;
  useEffect(() => {
    if (finishedToday && previousOpen.current > 0) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    previousOpen.current = open.length;
  }, [finishedToday, open.length]);

  const onToggle = useCallback((id: string) => toggleDone(id), [toggleDone]);
  const onTomorrow = useCallback((id: string) => notToday(id, addDays(selected, 1)), [notToday, selected]);
  const onMenu = useCallback((id: string) => router.push({ pathname: '/task/[id]', params: { id } }), []);
  const hasBirthday = useCallback(
    (day: Day) => snapshot.birthdays.some((b) => birthdaysFor(day, today, [b], []).some((i) => !i.belated)),
    [snapshot.birthdays, today],
  );

  const date = fromDay(selected);
  const summary =
    open.length + done.length === 0
      ? `${date.getDate()} ${MONTH[date.getMonth()]}`
      : `${date.getDate()} ${MONTH[date.getMonth()]} · ${open.length} to do · ${done.length} done`;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={{
          backgroundColor: colors.night,
          borderBottomLeftRadius: radius.xl,
          borderBottomRightRadius: radius.xl,
          borderCurve: 'continuous',
          overflow: 'hidden',
          paddingTop: insets.top + spacing.sm,
          paddingBottom: spacing.sm,
          gap: spacing.md,
        }}
      >
        <HeaderBackdrop animated={animatedHeader} />
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.xs }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <Text style={[type.display, { color: colors.onNight }]}>{heading(selected, today)}</Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
              <HeaderButton icon="calendar-month" label="Calendar" onPress={() => router.push('/calendar')} />
              <HeaderButton icon="settings" label="Settings" onPress={() => router.push('/settings')} />
            </View>
          </View>
          <Text style={[type.subhead, { color: colors.onNightMuted }]}>{summary}</Text>
        </View>
        <WeekStrip today={today} selected={selected} entries={entries} hasBirthday={hasBirthday} onSelect={setSelected} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: 150, gap: spacing.sm }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {scanning === 'needs-access' ? (
          <Pressable
            onPress={() => router.push('/settings')}
            accessibilityRole="button"
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: 'rgba(229,72,77,0.1)', opacity: pressed ? 0.7 : 1 })}
          >
            <MaterialIcons name="notifications-off" size={20} color={colors.danger} />
            <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: colors.danger }}>WhatsApp scanning is off. Tap to fix.</Text>
          </Pressable>
        ) : null}

        {updates.check === 'available' && updates.release ? (
          <Pressable
            onPress={() => router.push('/update')}
            accessibilityRole="button"
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.priorityWash, opacity: pressed ? 0.7 : 1 })}
          >
            <MaterialIcons name="system-update" size={20} color={colors.accent} />
            <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: colors.inkSoft }}>notToday {updates.release.version} is ready</Text>
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.accent }}>Update</Text>
          </Pressable>
        ) : null}

        {birthdays.map((item) => (
          <BirthdayCard key={`${item.birthday.id}-${item.year}`} item={item} onWish={() => toggleWish(item.birthday.id, item.year)} />
        ))}

        <DraggableTaskList
          tasks={open}
          drag={drag}
          zoneTop={zoneTop}
          onToggle={onToggle}
          onTomorrow={onTomorrow}
          onMenu={onMenu}
          onNotToday={onTomorrow}
          onDelete={removeTask}
          onReorder={(id, toIndex) => moveTask(id, selected, toIndex)}
        />

        {open.length === 0 && birthdays.length === 0 ? (
          <Animated.View entering={FadeIn.duration(240)} style={{ alignItems: 'center', gap: spacing.sm, paddingTop: spacing.xxl }}>
            <Animated.View entering={ZoomIn.springify().duration(500).damping(12)}>
              <MaterialIcons name={done.length > 0 ? 'task-alt' : 'wb-sunny'} size={done.length > 0 ? 56 : 40} color={done.length > 0 ? colors.done : colors.faint} />
            </Animated.View>
            <Text style={{ fontFamily: fonts.display, fontStyle: 'italic', fontSize: 30, lineHeight: 34, letterSpacing: -0.4, color: colors.inkSoft }}>
              {done.length > 0 ? 'All done for this day' : 'A clear day'}
            </Text>
            {done.length === 0 ? <Text style={[type.subhead, { color: colors.muted }]}>Tap + to plan something</Text> : null}
          </Animated.View>
        ) : null}

        {done.length > 0 ? (
          <Animated.View layout={LinearTransition.duration(240)} style={{ gap: spacing.sm, paddingTop: spacing.sm }}>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                setShowDone((v) => !v);
              }}
              accessibilityRole="button"
              accessibilityState={{ expanded: showDone }}
              style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.sm, opacity: pressed ? 0.6 : 1 })}
            >
              <MaterialIcons name={showDone ? 'expand-more' : 'chevron-right'} size={22} color={colors.muted} />
              <Text style={[type.overline, { color: colors.muted }]}>Done · {done.length}</Text>
            </Pressable>
            {showDone
              ? done.map((task) => (
                  <Pressable
                    key={task.id}
                    onPress={() => toggleDone(task.id)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: true }}
                    accessibilityLabel={`${task.title}, done. Tap to reopen`}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      paddingVertical: 11,
                      paddingHorizontal: 14,
                      borderRadius: radius.card,
                      borderCurve: 'continuous',
                      backgroundColor: colors.card,
                      opacity: pressed ? 0.6 : 0.7,
                    })}
                  >
                    <MaterialIcons name="check-circle" size={24} color={colors.done} />
                    <Text style={{ flex: 1, fontSize: 16, fontWeight: '500', color: colors.muted, textDecorationLine: 'line-through' }}>
                      {task.title}
                    </Text>
                  </Pressable>
                ))
              : null}
          </Animated.View>
        ) : null}
      </ScrollView>
      <DropZones drag={drag} bottom={zonesBottom} />
    </View>
  );
}

function HeaderButton({ icon, label, onPress }: { icon: 'calendar-month' | 'settings'; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({ padding: spacing.sm, borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.12)', opacity: pressed ? 0.6 : 1 })}
    >
      <MaterialIcons name={icon} size={20} color={colors.onNight} />
    </Pressable>
  );
}

function BirthdayCard({ item, onWish }: { item: BirthdayItem; onWish: () => void }) {
  const wished = item.wishedOn !== null;
  return (
    <Animated.View
      layout={LinearTransition.duration(240)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 10,
        paddingLeft: 12,
        paddingRight: 10,
        borderRadius: radius.card,
        borderCurve: 'continuous',
        backgroundColor: colors.card,
        boxShadow: shadows.card,
      }}
    >
      <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(242,107,58,0.12)' }}>
        <MaterialIcons name="cake" size={22} color={colors.accent} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: 16, fontWeight: '600', color: colors.ink }}>{item.birthday.name}</Text>
        <Text style={{ fontSize: 13, fontWeight: '500', color: item.belated ? colors.danger : colors.muted }}>
          {item.belated ? 'Belated birthday' : 'Birthday'}
          {item.turns !== null ? ` · turns ${item.turns}` : ''}
          {wished ? ` · wished ${item.wishedOn!.slice(8)}/${item.wishedOn!.slice(5, 7)}` : ''}
        </Text>
      </View>
      <Pressable
        onPress={() => {
          Haptics.notificationAsync(wished ? Haptics.NotificationFeedbackType.Warning : Haptics.NotificationFeedbackType.Success);
          onWish();
        }}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: wished }}
        accessibilityLabel={`Wished ${item.birthday.name}`}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.xs,
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
          borderRadius: radius.full,
          backgroundColor: wished ? colors.done : colors.ink,
          transform: [{ scale: pressed ? 0.96 : 1 }],
        })}
      >
        <MaterialIcons name={wished ? 'check' : 'celebration'} size={16} color={colors.onInk} />
        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.onInk }}>{wished ? 'Wished' : 'Wish'}</Text>
      </Pressable>
    </Animated.View>
  );
}
