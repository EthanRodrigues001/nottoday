import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { Keyboard, Pressable, ScrollView, Switch, View } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import { MonthCalendar } from '@/components/month-calendar';
import { Sheet } from '@/components/sheet';
import { Text } from '@/components/text';
import { TextInput } from '@/components/text-input';
import { fromDay, type Day } from '@/domain/dates';
import { useStore } from '@/store/app-store';
import { colors, radius, spacing, type } from '@/theme';

const MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** The new-birthday drawer: a name and a date picked on a calendar. The birth year is optional and only used to say "turns 21". */
export default function AddBirthdayDrawer() {
  return <Sheet onClose={() => router.back()}>{(dismiss) => <AddBirthdayForm dismiss={dismiss} />}</Sheet>;
}

function AddBirthdayForm({ dismiss }: { dismiss: () => void }) {
  const { today, addBirthday } = useStore();
  const [name, setName] = useState('');
  const [picked, setPicked] = useState<Day | null>(null);
  const [withYear, setWithYear] = useState(false);
  const [open, setOpen] = useState(false);

  const date = picked ? fromDay(picked) : null;
  const year = date ? date.getFullYear() : null;
  const yearOk = !withYear || (year !== null && year <= Number(today.slice(0, 4)));
  const canSave = name.trim().length > 0 && date !== null && yearOk;

  const label = date ? `${date.getDate()} ${MONTH[date.getMonth()]}${withYear ? ` ${year}` : ''}` : 'Pick a date';

  const save = () => {
    if (!canSave || !date) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addBirthday({ name, month: date.getMonth() + 1, dayOfMonth: date.getDate(), birthYear: withYear ? date.getFullYear() : null });
    dismiss();
  };

  return (
    <>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: spacing.sm, gap: spacing.md }}>
        <Text style={[type.overline, { color: colors.muted }]}>New birthday</Text>
        <TextInput
          autoFocus
          value={name}
          onChangeText={setName}
          placeholder="Whose birthday?"
          placeholderTextColor={colors.faint}
          returnKeyType="next"
          onSubmitEditing={() => {
            Keyboard.dismiss();
            setOpen(true);
          }}
          accessibilityLabel="Name"
          style={{ fontSize: 22, fontWeight: '600', color: colors.ink, paddingVertical: spacing.xs }}
        />

        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            Keyboard.dismiss();
            setOpen((v) => !v);
          }}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.md, borderCurve: 'continuous', backgroundColor: colors.background, opacity: pressed ? 0.7 : 1 })}
        >
          <MaterialIcons name="cake" size={20} color={colors.muted} />
          <Text style={{ flex: 1, fontSize: 15, fontWeight: '500', color: colors.inkSoft }}>Birthday</Text>
          <Text style={{ fontSize: 15, fontWeight: '600', color: date ? colors.ink : colors.accent }}>{label}</Text>
          <MaterialIcons name={open ? 'expand-less' : 'expand-more'} size={20} color={colors.faint} />
        </Pressable>

        {open ? (
          <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)} layout={LinearTransition.duration(200)} style={{ gap: spacing.md }}>
            <MonthCalendar
              value={picked}
              today={today}
              jump
              startAt={picked ?? today}
              onSelect={(day) => {
                Haptics.selectionAsync();
                setPicked(day);
                setOpen(false);
              }}
            />
          </Animated.View>
        ) : null}

        {date ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '500', color: colors.inkSoft }}>Include the birth year</Text>
              <Text style={[type.caption, { color: yearOk ? colors.muted : colors.danger }]}>
                {yearOk ? 'Choose the year in the calendar first. Lets the card say "turns 18".' : 'That year has not happened yet.'}
              </Text>
            </View>
            <Switch value={withYear} onValueChange={setWithYear} accessibilityLabel="Include the birth year" />
          </View>
        ) : null}
      </ScrollView>

      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
        <Pressable
          onPress={save}
          disabled={!canSave}
          accessibilityRole="button"
          accessibilityLabel="Add birthday"
          style={({ pressed }) => ({ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.ink, opacity: canSave ? 1 : 0.25, transform: [{ scale: pressed ? 0.94 : 1 }] })}
        >
          <MaterialIcons name="arrow-upward" size={24} color={colors.onInk} />
        </Pressable>
      </View>
    </>
  );
}
