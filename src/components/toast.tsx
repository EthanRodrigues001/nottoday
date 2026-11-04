import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOutDown,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Text } from '@/components/text';
import { useStore, type NoticeKind } from '@/store/app-store';
import { colors, radius, shadows, spacing } from '@/theme';

/** How long a message stays; the line along its bottom edge shows the time left. */
const VISIBLE_MS = 5000;
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const SWIPE_DISTANCE = 70;
const SWIPE_VELOCITY = 600;

const KIND: Record<NoticeKind, { icon: keyof typeof MaterialIcons.glyphMap; tint: string; wash: string }> = {
  done: { icon: 'check-circle', tint: colors.done, wash: 'rgba(47,174,123,0.14)' },
  moved: { icon: 'wb-twilight', tint: colors.accent, wash: 'rgba(242,107,58,0.14)' },
  deleted: { icon: 'delete-outline', tint: colors.danger, wash: 'rgba(229,72,77,0.12)' },
  info: { icon: 'info-outline', tint: colors.inkSoft, wash: 'rgba(0,0,0,0.06)' },
};

/**
 * The message that follows every swipe, drop or delete, with Undo, so no gesture is final. It rises in with a
 * strong ease-out, leaves downward, shows its remaining time as a thin line, and can be flicked away sideways
 * or down.
 */
export function Toast({ bottom }: { bottom: number }) {
  const { notice, undo, dismissNotice } = useStore();

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(dismissNotice, VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [notice, dismissNotice]);

  if (!notice) return null;
  return <Message key={notice.id} bottom={bottom} message={notice.message} kind={notice.kind} onUndo={undo} onDismiss={dismissNotice} />;
}

function Message({ bottom, message, kind, onUndo, onDismiss }: { bottom: number; message: string; kind: NoticeKind; onUndo: () => void; onDismiss: () => void }) {
  const reduced = useReducedMotion();
  const look = KIND[kind];
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const remaining = useSharedValue(1);

  // The line runs out over the time the message stays.
  useEffect(() => {
    remaining.set(withTiming(0, { duration: VISIBLE_MS, easing: Easing.linear }));
  }, [remaining]);

  const swipe = usePanGesture({
    activeOffsetX: [-10, 10],
    activeOffsetY: [-8, 8],
    onUpdate: (e) => {
      'worklet';
      x.set(e.translationX);
      y.set(Math.max(0, e.translationY));
    },
    onDeactivate: (e) => {
      'worklet';
      const away = Math.abs(e.translationX) > SWIPE_DISTANCE || Math.abs(e.velocityX) > SWIPE_VELOCITY || e.translationY > SWIPE_DISTANCE || e.velocityY > SWIPE_VELOCITY;
      if (away) {
        const sideways = Math.abs(e.translationX) >= e.translationY;
        const direction = e.translationX < 0 ? -1 : 1;
        if (sideways) x.set(withTiming(direction * 500, { duration: 180, easing: EASE_OUT }));
        else y.set(withTiming(200, { duration: 180, easing: EASE_OUT }));
        scheduleOnRN(onDismiss);
      } else {
        x.set(withSpring(0, { duration: 300, dampingRatio: 0.8, velocity: e.velocityX }));
        y.set(withSpring(0, { duration: 300, dampingRatio: 0.8, velocity: e.velocityY }));
      }
    },
  });

  const follow = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }, { translateY: y.get() }], opacity: 1 - Math.min(1, Math.abs(x.get()) / 400) }));
  const line = useAnimatedStyle(() => ({ transform: [{ scaleX: remaining.get() }] }));

  return (
    <Animated.View
      // Rises into place; leaves the way it came (down), faster than it arrived.
      entering={reduced ? FadeIn.duration(120) : FadeInDown.duration(260).easing(EASE_OUT)}
      exiting={FadeOutDown.duration(160)}
      accessibilityLiveRegion="polite"
      style={{ position: 'absolute', left: spacing.md, right: spacing.md, bottom }}
    >
      <GestureDetector gesture={swipe}>
        <Animated.View style={[{ borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.card, boxShadow: shadows.toast, overflow: 'hidden' }, follow]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2, paddingVertical: spacing.sm, paddingLeft: spacing.sm + 2, paddingRight: spacing.sm }}>
            <View style={{ width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: look.wash }}>
              <MaterialIcons name={look.icon} size={19} color={look.tint} />
            </View>
            <Text numberOfLines={1} style={{ flex: 1, color: colors.ink, fontSize: 15, letterSpacing: -0.15, fontWeight: '600' }}>
              {message}
            </Text>
            <Pressable
              onPress={() => {
                cancelAnimation(remaining);
                onUndo();
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Undo: ${message}`}
              style={({ pressed }) => ({ paddingVertical: 9, paddingHorizontal: 16, borderRadius: radius.full, backgroundColor: colors.background, transform: [{ scale: pressed ? 0.95 : 1 }] })}
            >
              <Text style={{ color: colors.ink, fontSize: 14, letterSpacing: -0.1, fontWeight: '700' }}>Undo</Text>
            </Pressable>
          </View>
          <Animated.View style={[{ height: 2, backgroundColor: look.tint, opacity: 0.55, transformOrigin: 'left center' }, line]} />
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}
