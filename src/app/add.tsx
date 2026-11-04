import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { DueDatePicker } from '@/components/due-date-picker';
import { RepeatPicker } from '@/components/repeat-picker';
import { Sheet } from '@/components/sheet';
import { Text } from '@/components/text';
import { TextInput } from '@/components/text-input';
import { TimeField } from '@/components/time-field';
import { birthdaysFor } from '@/domain/birthdays';
import { isValidDay, type Day, type TimeOfDay } from '@/domain/dates';
import type { Repeat } from '@/domain/repeat';
import { useStore } from '@/store/app-store';
import { colors, spacing, type } from '@/theme';

/** The quick-add drawer: a title, optional notes, when it is due, an optional time and how it repeats. */
export default function AddTaskDrawer() {
  return <Sheet onClose={() => router.back()} maxHeight="88%">{(dismiss) => <AddTaskForm dismiss={dismiss} />}</Sheet>;
}

function AddTaskForm({ dismiss }: { dismiss: () => void }) {
  const { today, snapshot, addTask } = useStore();
  const params = useLocalSearchParams<{ day?: string }>();
  const preset: Day | null = params.day && isValidDay(params.day) ? params.day : null;

  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [day, setDay] = useState<Day | null>(preset ?? today);
  const [time, setTime] = useState<TimeOfDay | null>(null);
  const [repeat, setRepeat] = useState<Repeat>('none');
  const [every, setEvery] = useState(1);

  const canSave = title.trim().length > 0;
  const hasSomething = (d: Day) =>
    snapshot.plan.tasks.some((t) => t.day === d && t.doneOn === null) || snapshot.birthdays.some((b) => birthdaysFor(d, today, [b], []).some((i) => !i.belated));

  const save = () => {
    if (!canSave) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addTask({ title, day, time: day === null ? null : time, notes, repeat: day === null ? 'none' : repeat, every });
    dismiss();
  };

  return (
    <>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: spacing.sm, gap: spacing.md }}>
        <TextInput
          autoFocus
          value={title}
          onChangeText={setTitle}
          placeholder="What needs doing?"
          placeholderTextColor={colors.faint}
          returnKeyType="done"
          onSubmitEditing={save}
          accessibilityLabel="Task title"
          style={{ fontSize: 18, fontWeight: '600', color: colors.ink, paddingVertical: spacing.sm }}
        />
        <View style={{ flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderRadius: 14, borderCurve: 'continuous', backgroundColor: colors.background }}>
          <MaterialIcons name="notes" size={18} color={colors.faint} style={{ marginTop: 2 }} />
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Add notes"
            placeholderTextColor={colors.faint}
            multiline
            accessibilityLabel="Notes"
            style={{ flex: 1, minHeight: 40, maxHeight: 120, fontSize: 15, color: colors.ink, padding: 0, textAlignVertical: 'top' }}
          />
        </View>

        <View style={{ gap: spacing.sm }}>
          <Text style={[type.overline, { color: colors.muted }]}>Due</Text>
          <DueDatePicker value={day} today={today} onChange={setDay} marked={hasSomething} />
        </View>

        {day !== null ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={[type.overline, { color: colors.muted }]}>Time</Text>
            <TimeField value={time} onChange={setTime} />
          </View>
        ) : null}

        {day !== null ? (
          <View style={{ gap: spacing.sm }}>
            <Text style={[type.overline, { color: colors.muted }]}>Repeat</Text>
            <RepeatPicker
              value={repeat}
              every={every}
              day={day}
              onChange={(r, n) => {
                setRepeat(r);
                setEvery(n);
              }}
            />
          </View>
        ) : null}
      </ScrollView>

      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
        <Pressable
          onPress={save}
          disabled={!canSave}
          accessibilityRole="button"
          accessibilityLabel="Add task"
          style={({ pressed }) => ({
            width: 48,
            height: 48,
            borderRadius: 24,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.ink,
            opacity: canSave ? 1 : 0.25,
            transform: [{ scale: pressed ? 0.94 : 1 }],
          })}
        >
          <MaterialIcons name="arrow-upward" size={24} color={colors.onInk} />
        </Pressable>
      </View>
    </>
  );
}
