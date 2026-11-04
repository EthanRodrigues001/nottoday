import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DueDatePicker } from '@/components/due-date-picker';
import { RepeatPicker } from '@/components/repeat-picker';
import { Text } from '@/components/text';
import { TextInput } from '@/components/text-input';
import { TimeField } from '@/components/time-field';
import { birthdaysFor } from '@/domain/birthdays';
import type { Day } from '@/domain/dates';
import { needsDecision } from '@/domain/planner';
import { repeatLabel } from '@/domain/repeat';
import { dayLabel } from '@/lib/day-label';
import { useStore } from '@/store/app-store';
import { colors, radius, spacing, type } from '@/theme';

/** One task in full: rename it, add notes, change its day or time, finish it, or delete it. */
export default function TaskDetails() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { today, snapshot, updateTask, toggleDone, removeTask } = useStore();
  const task = snapshot.plan.tasks.find((t) => t.id === id);

  const [title, setTitle] = useState(task?.title ?? '');
  const [notes, setNotes] = useState(task?.notes ?? '');
  const [pickingDate, setPickingDate] = useState(false);
  const [pickingRepeat, setPickingRepeat] = useState(false);

  // Text is saved when the screen closes, so typing never rewrites the database on each key.
  const latest = useRef({ title, notes, task, updateTask, skipSave: false });
  useEffect(() => {
    latest.current = { ...latest.current, title, notes, task, updateTask };
  });
  useEffect(
    () => () => {
      const { title: t, notes: n, task: current, updateTask: save, skipSave } = latest.current;
      if (!current || skipSave) return;
      const changes: { title?: string; notes?: string } = {};
      if (t.trim() && t.trim() !== current.title) changes.title = t;
      if (n.trim() !== current.notes) changes.notes = n;
      if (changes.title !== undefined || changes.notes !== undefined) save(current.id, changes);
    },
    [],
  );
  // Deleting or finishing shows an Undo notice, which a text save on the way out would wipe.
  const closeWithoutSaving = () => {
    latest.current.skipSave = true;
  };

  if (!task) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg }}>
        <Text style={{ fontSize: 16, color: colors.muted }}>This task no longer exists.</Text>
      </View>
    );
  }

  const done = task.doneOn !== null;
  const hasSomething = (d: Day) =>
    snapshot.plan.tasks.some((t) => t.day === d && t.doneOn === null) || snapshot.birthdays.some((b) => birthdaysFor(d, today, [b], []).some((i) => !i.belated));

  return (
    <View style={{ flex: 1, paddingTop: insets.top + spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md }}>
        <Pressable onPress={() => router.back()} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back" style={({ pressed }) => ({ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, opacity: pressed ? 0.5 : 1 })}>
          <MaterialIcons name="arrow-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={[type.headline, { flex: 1, textAlign: 'center', color: colors.ink, marginRight: 40 }]}>Task details</Text>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl }}>
        <TextInput
          value={title}
          onChangeText={setTitle}
          multiline
          placeholder="Task"
          placeholderTextColor={colors.faint}
          accessibilityLabel="Task title"
          style={[type.title, { color: colors.ink, padding: 0, textDecorationLine: done ? 'line-through' : 'none' }]}
        />

        {task.slips > 0 && !done ? (
          <View style={{ alignSelf: 'flex-start', paddingVertical: 4, paddingHorizontal: 10, borderRadius: radius.full, backgroundColor: needsDecision(task) ? 'rgba(229,72,77,0.1)' : 'rgba(242,107,58,0.12)' }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: needsDecision(task) ? colors.danger : colors.accent }}>
              Slipped {task.slips} {task.slips === 1 ? 'day' : 'days'}
              {needsDecision(task) ? ' · do it, move it, or delete it' : ''}
            </Text>
          </View>
        ) : null}

        <View style={{ borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.background, overflow: 'hidden' }}>
          <Pressable
            onPress={() => {
              if (done) return;
              Haptics.selectionAsync();
              setPickingDate((v) => !v);
            }}
            accessibilityRole="button"
            accessibilityLabel={`Due ${dayLabel(task.day, today)}. Change`}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, opacity: pressed ? 0.6 : 1 })}
          >
            <MaterialIcons name="calendar-today" size={20} color={colors.muted} />
            <Text style={{ flex: 1, fontSize: 15, fontWeight: '500', color: colors.inkSoft }}>Due date</Text>
            <Text style={{ fontSize: 15, fontWeight: '600', color: colors.ink }}>{dayLabel(task.day, today)}</Text>
            {!done ? <MaterialIcons name={pickingDate ? 'expand-less' : 'chevron-right'} size={20} color={colors.faint} /> : null}
          </Pressable>
          {pickingDate ? (
            <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.md }}>
              <DueDatePicker
                value={task.day}
                today={today}
                onChange={(day) => {
                  if (day !== task.day) {
                    updateTask(task.id, { day });
                    setPickingDate(false);
                  }
                }}
                marked={hasSomething}
                onGrey
              />
            </View>
          ) : null}
          <View style={{ height: 1, marginLeft: 52, backgroundColor: colors.hairline }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md }}>
            <MaterialIcons name="schedule" size={20} color={colors.muted} />
            <Text style={{ flex: 1, fontSize: 15, fontWeight: '500', color: colors.inkSoft }}>Time</Text>
            {task.day === null ? (
              <Text style={{ fontSize: 14, color: colors.muted }}>Needs a day</Text>
            ) : (
              <TimeField value={task.time} onChange={(time) => updateTask(task.id, { time })} />
            )}
          </View>
          {task.day !== null && !done ? (
            <>
              <View style={{ height: 1, marginLeft: 52, backgroundColor: colors.hairline }} />
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  setPickingRepeat((v) => !v);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Repeat: ${repeatLabel(task.repeat, task.every)}. Change`}
                style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, opacity: pressed ? 0.6 : 1 })}
              >
                <MaterialIcons name="repeat" size={20} color={colors.muted} />
                <Text style={{ flex: 1, fontSize: 15, fontWeight: '500', color: colors.inkSoft }}>Repeat</Text>
                <Text style={{ fontSize: 15, fontWeight: '600', color: colors.ink }}>{repeatLabel(task.repeat, task.every)}</Text>
                <MaterialIcons name={pickingRepeat ? 'expand-less' : 'chevron-right'} size={20} color={colors.faint} />
              </Pressable>
              {pickingRepeat ? (
                <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.md }}>
                  <RepeatPicker value={task.repeat} every={task.every} day={task.day} onGrey onChange={(repeat, every) => updateTask(task.id, { repeat, every })} />
                </View>
              ) : null}
            </>
          ) : null}
        </View>

        <View style={{ gap: spacing.sm, padding: spacing.md, borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.background }}>
          <Text style={[type.overline, { color: colors.muted }]}>Notes</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            multiline
            placeholder="Add a few words about it"
            placeholderTextColor={colors.faint}
            accessibilityLabel="Notes"
            style={{ minHeight: 64, fontSize: 15, lineHeight: 22, color: colors.ink, padding: 0, textAlignVertical: 'top' }}
          />
        </View>
      </ScrollView>

      <View style={{ flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: Math.max(insets.bottom, spacing.md) }}>
        <Pressable
          onPress={() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            closeWithoutSaving();
            removeTask(task.id);
            router.back();
          }}
          accessibilityRole="button"
          accessibilityLabel="Delete task"
          style={({ pressed }) => ({ width: 52, height: 52, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(229,72,77,0.1)', transform: [{ scale: pressed ? 0.95 : 1 }] })}
        >
          <MaterialIcons name="delete-outline" size={24} color={colors.danger} />
        </Pressable>
        <Pressable
          onPress={() => {
            if (!done) closeWithoutSaving();
            toggleDone(task.id);
            if (!done) router.back();
          }}
          accessibilityRole="button"
          style={({ pressed }) => ({ flex: 1, height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderRadius: radius.full, backgroundColor: colors.ink, transform: [{ scale: pressed ? 0.98 : 1 }] })}
        >
          <MaterialIcons name={done ? 'undo' : 'check'} size={20} color={colors.onInk} />
          <Text style={{ fontSize: 16, fontWeight: '700', color: colors.onInk }}>{done ? 'Reopen' : 'Mark as complete'}</Text>
        </Pressable>
      </View>
    </View>
  );
}
