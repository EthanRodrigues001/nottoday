import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeOut, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/text';
import { upcoming } from '@/domain/birthdays';
import { somedayTasks } from '@/domain/planner';
import { useStore } from '@/store/app-store';
import { colors, radius, shadows, spacing, type } from '@/theme';

const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function inWords(days: number): string {
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days < 60) return `in ${days} days`;
  return `in ${Math.round(days / 30)} months`;
}

export default function LaterScreen() {
  const insets = useSafeAreaInsets();
  const { today, snapshot, notToday, removeBirthday } = useStore();
  const someday = somedayTasks(snapshot.plan.tasks);
  const coming = upcoming(today, snapshot.birthdays, 366);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingTop: insets.top + spacing.lg, paddingHorizontal: spacing.md, paddingBottom: 150, gap: spacing.lg }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={[type.display, { color: colors.ink, paddingHorizontal: spacing.xs }]}>Later</Text>

      <Section title="Someday" count={someday.length}>
        {someday.length === 0 ? <Empty icon="inbox" text="Nothing parked. Choose Not today, then Someday, on a task." /> : null}
        {someday.map((task) => (
          <Animated.View key={task.id} layout={LinearTransition.duration(200)} exiting={FadeOut.duration(140)}>
            <Row
              onPress={() => router.push({ pathname: '/task/[id]', params: { id: task.id } })}
              accessibilityLabel={`${task.title}. Open`}
              title={task.title}
              trailing={
                <Pressable
                  onPress={() => {
                    Haptics.selectionAsync();
                    notToday(task.id, today, { silent: true });
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Move ${task.title} to today`}
                  style={({ pressed }) => ({ paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.full, backgroundColor: colors.ink, transform: [{ scale: pressed ? 0.96 : 1 }] })}
                >
                  <Text style={{ color: colors.onInk, fontSize: 13, fontWeight: '700' }}>Do today</Text>
                </Pressable>
              }
            />
          </Animated.View>
        ))}
      </Section>

      <Section
        title="Birthdays"
        count={snapshot.birthdays.length}
        action={
          <Pressable
            onPress={() => router.push('/birthday')}
            accessibilityRole="button"
            accessibilityLabel="Add a birthday"
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingLeft: 10, paddingRight: 14, borderRadius: radius.full, backgroundColor: colors.ink, transform: [{ scale: pressed ? 0.96 : 1 }] })}
          >
            <MaterialIcons name="add" size={18} color={colors.onInk} />
            <Text style={{ color: colors.onInk, fontSize: 13, fontWeight: '700' }}>Add</Text>
          </Pressable>
        }
      >
        {snapshot.birthdays.length === 0 ? <Empty icon="cake" text="Add a birthday once. It comes back every year." /> : null}
        {coming.map(({ birthday, day, inDays }) => {
          const age = birthday.birthYear === null ? null : Number(day.slice(0, 4)) - birthday.birthYear;
          return (
            <Animated.View key={birthday.id} layout={LinearTransition.duration(200)} exiting={FadeOut.duration(140)}>
              <Row
                leading={
                  <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(242,107,58,0.12)' }}>
                    <MaterialIcons name="cake" size={20} color={colors.accent} />
                  </View>
                }
                title={birthday.name}
                subtitle={`${Number(day.slice(8))} ${MONTH[Number(day.slice(5, 7)) - 1]} · ${inWords(inDays)}${age !== null ? ` · turns ${age}` : ''}`}
                trailing={
                  <Pressable
                    onPress={() => removeBirthday(birthday.id)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${birthday.name}`}
                    style={({ pressed }) => ({ padding: spacing.sm, opacity: pressed ? 0.5 : 1 })}
                  >
                    <MaterialIcons name="close" size={20} color={colors.muted} />
                  </Pressable>
                }
              />
            </Animated.View>
          );
        })}
      </Section>
    </ScrollView>
  );
}

function Section({ title, count, action, children }: { title: string; count: number; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 32, paddingHorizontal: spacing.xs }}>
        <Text style={[type.overline, { color: colors.muted }]}>
          {title} · {count}
        </Text>
        {action}
      </View>
      {children}
    </View>
  );
}

function Row({
  leading,
  title,
  subtitle,
  trailing,
  onPress,
  accessibilityLabel,
}: {
  leading?: React.ReactNode;
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 11,
        paddingLeft: leading ? 12 : 14,
        paddingRight: 8,
        borderRadius: radius.card,
        borderCurve: 'continuous',
        backgroundColor: colors.card,
        boxShadow: shadows.card,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      {leading}
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={{ fontSize: 15, lineHeight: 20, letterSpacing: -0.2, fontWeight: '600', color: colors.ink }}>{title}</Text>
        {subtitle ? <Text style={[type.caption, { color: colors.muted }]}>{subtitle}</Text> : null}
      </View>
      {trailing}
    </Pressable>
  );
}

function Empty({ icon, text }: { icon: keyof typeof MaterialIcons.glyphMap; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md, paddingHorizontal: spacing.md, borderRadius: radius.card, borderCurve: 'continuous', borderWidth: 1, borderColor: colors.hairline, borderStyle: 'dashed' }}>
      <MaterialIcons name={icon} size={20} color={colors.faint} />
      <Text style={{ flex: 1, fontSize: 14, lineHeight: 20, color: colors.muted }}>{text}</Text>
    </View>
  );
}
