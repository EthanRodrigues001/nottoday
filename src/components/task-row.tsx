import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Haptics from 'expo-haptics';
import { memo, useEffect } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import { Text } from '@/components/text';
import { GestureDetector, useCompetingGestures, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  Extrapolation,
  FadeOut,
  LinearTransition,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { indexAt, ROW_GAP, topOf, ZONE_DELETE, ZONE_NONE, ZONE_NOT_TODAY, type DragState } from '@/components/drag-state';
import type { Task } from '@/domain/planner';
import { repeatShort } from '@/domain/repeat';
import { colors, radius, shadows, spacing, spring } from '@/theme';

const COMMIT_DISTANCE = 104;
const COMMIT_VELOCITY = 900;
const LIFT_AFTER_MS = 260;
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

/** Past the commit distance the card follows the finger less and less, like a stretched band. */
function rubberband(distance: number, limit: number) {
  'worklet';
  const sign = distance < 0 ? -1 : 1;
  const d = Math.abs(distance);
  if (d <= limit) return distance;
  const over = d - limit;
  return sign * (limit + (over * 56 * 0.55) / (56 + 0.55 * over));
}

const tick = () => Haptics.selectionAsync();
const thud = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
const bump = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

type Props = {
  task: Task;
  index: number;
  flagged: boolean;
  /** Place in the day's list. The list is the priority order, so rank 0 is the most important task. */
  rank: number;
  drag: DragState;
  /** Screen Y above which the finger counts as being over the bottom targets. */
  zoneTop: number;
  animateLayout: boolean;
  onMeasured: (index: number, height: number) => void;
  onToggle: (id: string) => void;
  onTomorrow: (id: string) => void;
  onMenu: (id: string) => void;
  /** Drop finished: `zone` is the target the finger was over, or the new index for a reorder. */
  onDrop: (id: string, zone: number, toIndex: number) => void;
};

function TaskRowImpl({ task, index, flagged, rank, drag, zoneTop, animateLayout, onMeasured, onToggle, onTomorrow, onMenu, onDrop }: Props) {
  const { width } = useWindowDimensions();
  const x = useSharedValue(0);
  const armed = useSharedValue(0); // -1 left, 0 none, 1 right
  const grabbed = useSharedValue(0); // 1 while this row is lifted
  const settleY = useSharedValue(0);
  // How much the row is the top priority: 1 for the first task, fading to 0 as it is dragged down the list.
  const top = useSharedValue(rank === 0 ? 1 : 0);
  useEffect(() => {
    top.set(withTiming(rank === 0 ? 1 : 0, { duration: 320, easing: EASE_OUT }));
  }, [rank, top]);

  const swipe = usePanGesture({
    activeOffsetX: [-14, 14],
    failOffsetY: [-12, 12],
    onUpdate: (e) => {
      'worklet';
      const t = rubberband(e.translationX, COMMIT_DISTANCE + 24);
      x.set(t);
      const next = t > COMMIT_DISTANCE ? 1 : t < -COMMIT_DISTANCE ? -1 : 0;
      if (next !== armed.get()) {
        armed.set(next);
        if (next !== 0) scheduleOnRN(tick);
      }
    },
    onDeactivate: (e) => {
      'worklet';
      const goRight = x.get() > COMMIT_DISTANCE || e.velocityX > COMMIT_VELOCITY;
      const goLeft = x.get() < -COMMIT_DISTANCE || e.velocityX < -COMMIT_VELOCITY;
      if (goRight || goLeft) {
        const dir = goRight ? 1 : -1;
        x.set(
          withTiming(dir * width, { duration: 200, easing: EASE_OUT }, (finished) => {
            'worklet';
            if (!finished) return;
            scheduleOnRN(goRight ? onToggle : onTomorrow, task.id);
          }),
        );
        scheduleOnRN(thud);
      } else {
        x.set(withSpring(0, { ...spring.flick, velocity: e.velocityX }));
      }
      armed.set(0);
    },
  });

  // Press and hold lifts the row; it then follows the finger 1:1 and the others part around it.
  const lift = usePanGesture({
    activateAfterLongPress: LIFT_AFTER_MS,
    onActivate: () => {
      'worklet';
      grabbed.set(1);
      drag.active.set(index);
      drag.hover.set(index);
      drag.offsetY.set(0);
      drag.zone.set(ZONE_NONE);
      scheduleOnRN(bump);
    },
    onUpdate: (e) => {
      'worklet';
      drag.offsetY.set(e.translationY);
      const heights = drag.heights.get();
      const centre = topOf(heights, index) + (heights[index] ?? 0) / 2 + e.translationY;
      const hover = indexAt(heights, centre);
      if (hover !== drag.hover.get()) {
        drag.hover.set(hover);
        scheduleOnRN(tick);
      }
      const zone = e.absoluteY > zoneTop ? (e.absoluteX < width / 2 ? ZONE_NOT_TODAY : ZONE_DELETE) : ZONE_NONE;
      if (zone !== drag.zone.get()) {
        drag.zone.set(zone);
        if (zone !== ZONE_NONE) scheduleOnRN(thud);
      }
    },
    onDeactivate: (e) => {
      'worklet';
      const zone = drag.zone.get();
      const heights = drag.heights.get();
      const to = drag.hover.get();
      if (zone !== ZONE_NONE) {
        // Dropped on a target: the row shrinks away, then the action runs.
        grabbed.set(withTiming(0, { duration: 160 }));
        scheduleOnRN(onDrop, task.id, zone, to);
        return;
      }
      // Settle into the slot it would take, carrying the release velocity.
      const slotOffset = topOf(heights, to) - topOf(heights, index) + (to > index ? (heights[to] ?? 0) - (heights[index] ?? 0) : 0);
      settleY.set(
        withSpring(slotOffset - e.translationY, { ...spring.snap, velocity: e.velocityY }, (finished) => {
          'worklet';
          if (finished) scheduleOnRN(onDrop, task.id, ZONE_NONE, to);
        }),
      );
    },
  });

  const gesture = useCompetingGestures(lift, swipe);

  const card = useAnimatedStyle(() => {
    const dragging = drag.active.get() === index;
    const y = dragging ? drag.offsetY.get() + settleY.get() : 0;
    const lifted = dragging && grabbed.get() === 1;
    return {
      zIndex: dragging ? 10 : 0,
      transform: [{ translateX: x.get() }, { translateY: y }, { scale: withSpring(lifted ? 1.03 : 1, spring.snap) }],
      opacity: dragging && drag.zone.get() !== ZONE_NONE ? withTiming(0.55, { duration: 120 }) : 1,
    };
  });
  const glow = useAnimatedStyle(() => ({ opacity: top.get() }));
  const halo = useAnimatedStyle(() => ({ opacity: top.get(), transform: [{ scale: 0.7 + 0.3 * top.get() }] }));

  // Rows the dragged row passes over slide out of its way, then everything snaps back to layout on drop.
  const part = useAnimatedStyle(() => {
    const a = drag.active.get();
    if (a < 0 || a === index) return { transform: [{ translateY: 0 }] };
    const hover = drag.hover.get();
    const step = (drag.heights.get()[a] ?? 0) + ROW_GAP;
    let shift = 0;
    if (a < hover && index > a && index <= hover) shift = -step;
    else if (a > hover && index < a && index >= hover) shift = step;
    return { transform: [{ translateY: withSpring(shift, spring.snap) }] };
  });

  const doneHint = useAnimatedStyle(() => ({
    opacity: interpolate(x.get(), [0, COMMIT_DISTANCE], [0, 1], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(x.get(), [0, COMMIT_DISTANCE], [0.7, 1], Extrapolation.CLAMP) }],
  }));
  const laterHint = useAnimatedStyle(() => ({
    opacity: interpolate(x.get(), [0, -COMMIT_DISTANCE], [0, 1], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(x.get(), [0, -COMMIT_DISTANCE], [0.7, 1], Extrapolation.CLAMP) }],
  }));

  return (
    <Animated.View
      onLayout={(e) => onMeasured(index, e.nativeEvent.layout.height)}
      layout={animateLayout ? LinearTransition.duration(240) : undefined}
      exiting={FadeOut.duration(140)}
      style={[{ borderRadius: radius.card }, part]}
    >
      <View
        pointerEvents="none"
        style={{ position: 'absolute', inset: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg }}
      >
        <Animated.View style={[{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, doneHint]}>
          <MaterialIcons name="check-circle" size={26} color={colors.done} />
          <Text style={{ color: colors.done, fontWeight: '700' }}>Done</Text>
        </Animated.View>
        <Animated.View style={[{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, laterHint]}>
          <Text style={{ color: colors.accent, fontWeight: '700' }}>Not today</Text>
          <MaterialIcons name="wb-twilight" size={26} color={colors.accent} />
        </Animated.View>
      </View>

      <GestureDetector gesture={gesture}>
        <Animated.View
          style={[
            {
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              backgroundColor: colors.card,
              borderRadius: radius.card,
              borderCurve: 'continuous',
              overflow: 'hidden',
              paddingVertical: 11,
              paddingLeft: 14,
              paddingRight: 6,
              boxShadow: shadows.card,
            },
            card,
          ]}
        >
          {/* The most important task glows: a warm wash fading across the card and a hairline in the accent, no label. */}
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: 'absolute',
                inset: 0,
                borderRadius: radius.card,
                borderCurve: 'continuous',
                borderWidth: 1,
                borderColor: 'rgba(242, 107, 58, 0.22)',
                experimental_backgroundImage: 'linear-gradient(105deg, rgba(242, 107, 58, 0.15) 0%, rgba(242, 107, 58, 0.05) 45%, rgba(242, 107, 58, 0) 85%)',
              },
              glow,
            ]}
          />
          <View style={{ width: 24, height: 24 }}>
            <Animated.View pointerEvents="none" style={[{ position: 'absolute', inset: -5, borderRadius: 17, backgroundColor: 'rgba(242, 107, 58, 0.16)' }, halo]} />
            <Pressable
              onPress={() => onToggle(task.id)}
              hitSlop={10}
              accessibilityRole="checkbox"
              accessibilityLabel={`Mark ${task.title} done`}
              accessibilityState={{ checked: false }}
              style={({ pressed }) => ({
                width: 24,
                height: 24,
                borderRadius: 12,
                borderWidth: 2,
                borderColor: rank === 0 ? colors.accent : rank <= 2 ? colors.priorityRing : colors.faint,
                transform: [{ scale: pressed ? 0.92 : 1 }],
              })}
            />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            {/* Not selectable: text selection would take over the press-and-hold that lifts the row. */}
            <Text style={{ fontSize: 15, lineHeight: 20, letterSpacing: -0.2, fontWeight: '600', color: colors.ink }}>
              {task.title}
            </Text>
            {task.time || task.slips > 0 || task.repeat !== 'none' ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                {task.time ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <MaterialIcons name="schedule" size={14} color={colors.muted} />
                    <Text style={{ fontSize: 13, fontWeight: '500', color: colors.muted, fontVariant: ['tabular-nums'] }}>{task.time}</Text>
                  </View>
                ) : null}
                {task.repeat !== 'none' ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <MaterialIcons name="repeat" size={14} color={colors.muted} />
                    <Text style={{ fontSize: 13, fontWeight: '500', color: colors.muted }}>{repeatShort(task.repeat, task.every)}</Text>
                  </View>
                ) : null}
                {task.slips > 0 ? (
                  <Text style={{ fontSize: 13, fontWeight: '600', color: flagged ? colors.danger : colors.accent }}>
                    slipped {task.slips} {task.slips === 1 ? 'day' : 'days'}
                    {flagged ? ' · decide' : ''}
                  </Text>
                ) : null}
              </View>
            ) : null}
          </View>
          <Pressable
            onPress={() => onMenu(task.id)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Options for ${task.title}`}
            style={({ pressed }) => ({ padding: 6, opacity: pressed ? 0.5 : 1 })}
          >
            <MaterialIcons name="more-horiz" size={20} color={colors.muted} />
          </Pressable>
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

export const TaskRow = memo(TaskRowImpl);
