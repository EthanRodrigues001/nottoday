import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { TabList, TabSlot, TabTrigger, Tabs } from 'expo-router/ui';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from '@/components/text';
import { TAB_BAR_HEIGHT, TAB_BAR_PADDING } from '@/components/tab-bar-metrics';
import { Toast } from '@/components/toast';
import { useInbox } from '@/store/inbox';
import { colors, fonts, radius, spacing } from '@/theme';

const ADD_SIZE = TAB_BAR_HEIGHT;
const BAR_PADDING = TAB_BAR_PADDING;

/**
 * Floating dark tab bar. The open tab is a white pill with its name; the others are bare icons,
 * with a count on the Inbox. A round add button sits beside it.
 */
export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, spacing.md);
  const { pending } = useInbox();

  return (
    <Tabs>
      <TabSlot style={{ flex: 1 }} />
      <Toast bottom={bottom + ADD_SIZE + spacing.md} />
      <TabList
        style={{
          position: 'absolute',
          left: spacing.md,
          right: spacing.md + ADD_SIZE + spacing.sm,
          bottom,
          height: ADD_SIZE,
          flexDirection: 'row',
          alignItems: 'center',
          padding: BAR_PADDING,
          borderRadius: radius.full,
          backgroundColor: colors.night,
        }}
      >
        <TabTrigger name="index" href="/" asChild>
          <TabButton icon="check-circle-outline" activeIcon="check-circle" label="Today" />
        </TabTrigger>
        <TabTrigger name="inbox" href="/inbox" asChild>
          <TabButton icon="inbox" activeIcon="inbox" label="Inbox" badge={pending.length} />
        </TabTrigger>
        <TabTrigger name="later" href="/later" asChild>
          <TabButton icon="event" activeIcon="event" label="Later" />
        </TabTrigger>
      </TabList>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push('/add');
        }}
        accessibilityRole="button"
        accessibilityLabel="Add a task"
        style={({ pressed }) => ({
          position: 'absolute',
          right: spacing.md,
          bottom,
          width: ADD_SIZE,
          height: ADD_SIZE,
          borderRadius: ADD_SIZE / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.hairline,
          transform: [{ scale: pressed ? 0.94 : 1 }],
        })}
      >
        <MaterialIcons name="add" size={26} color={colors.ink} />
      </Pressable>
    </Tabs>
  );
}

function TabButton({
  icon,
  activeIcon,
  label,
  isFocused,
  badge,
  ...props
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  activeIcon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  isFocused?: boolean;
  badge?: number;
} & React.ComponentProps<typeof Pressable>) {
  return (
    <Pressable
      {...props}
      accessibilityRole="tab"
      accessibilityLabel={badge ? `${label}, ${badge} waiting` : label}
      accessibilityState={{ selected: isFocused }}
      style={({ pressed }) => ({
        flex: isFocused ? 2.2 : 1,
        height: ADD_SIZE - BAR_PADDING * 2,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        borderRadius: radius.full,
        backgroundColor: isFocused ? colors.card : 'transparent',
        transform: [{ scale: pressed ? 0.95 : 1 }],
      })}
    >
      <View>
        <MaterialIcons name={isFocused ? activeIcon : icon} size={22} color={isFocused ? colors.ink : colors.onNightMuted} />
        {badge ? (
          <View
            style={{
              position: 'absolute',
              top: -6,
              right: -10,
              minWidth: 18,
              height: 18,
              paddingHorizontal: 5,
              borderRadius: 9,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: isFocused ? colors.ink : colors.card,
              borderWidth: 2,
              borderColor: isFocused ? colors.card : colors.night,
            }}
          >
            <Text style={{ fontFamily: fonts.bold, fontSize: 10, lineHeight: 12, color: isFocused ? colors.card : colors.ink, fontVariant: ['tabular-nums'] }}>
              {badge}
            </Text>
          </View>
        ) : null}
      </View>
      {isFocused ? <Text style={{ fontFamily: fonts.semibold, fontSize: 14, letterSpacing: -0.2, color: colors.ink }}>{label}</Text> : null}
    </Pressable>
  );
}
