import { useCallback, useEffect, type ReactNode, type RefObject } from 'react';
import { BackHandler, LayoutChangeEvent, Pressable, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import * as Haptics from 'expo-haptics';

import { colors, spacing } from '@/theme';

/** Where the sheet waits, far enough down that it is never visible before it has been measured. */
const PARKED = 4000;
/**
 * The drawer spring from apple-design: ~0.3 s, a little under-damped. The sheet hangs from the bottom
 * edge, so it must never pass 0 (that would pull it up off the screen's edge and show a gap): overshootClamping.
 */
const OPEN = { duration: 300, dampingRatio: 0.8, overshootClamping: true } as const;
const CLOSE = { duration: 280, dampingRatio: 1, overshootClamping: true } as const;
/** How far past the top the sheet can be pulled, with resistance. */
const STRETCH = 120;
/** Apple's scroll deceleration: a release at v px/s is going to come to rest about v * 0.499 px further on. */
const RESTS_AFTER = 0.998 / (1 - 0.998) / 1000;

export type SheetHandle = { dismiss: () => void };

type Props = {
  /** Called once the sheet has finished leaving the screen; remove it from the tree here. */
  onClose: () => void;
  /** The content. It gets `dismiss`, which closes the sheet with the same animation as dragging it away. */
  children: (dismiss: () => void) => ReactNode;
  maxHeight?: `${number}%`;
  /** Lets a parent close the sheet, for example from a Modal's back-button callback. */
  dismissRef?: RefObject<SheetHandle | null>;
};

/** Resistance that grows the further past the edge the finger pulls: the sheet follows less and less, like a stretched band. */
function rubberband(distance: number) {
  'worklet';
  return (distance * STRETCH * 0.55) / (STRETCH + 0.55 * distance);
}

/**
 * A bottom sheet that behaves like Apple's: it springs up from the bottom edge, follows the finger 1:1 when
 * dragged by its handle, and on release goes where the throw is heading (projected from the release velocity)
 * with that velocity handed to the spring. It can be grabbed again while it is still opening or closing, the dimmed
 * background fades with its position, and Android's back button closes it the same way.
 */
export function Sheet({ onClose, children, maxHeight = '90%', dismissRef }: Props) {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const translateY = useSharedValue(PARKED);
  const height = useSharedValue(0);
  const grabbedAt = useSharedValue(0);
  const placed = useSharedValue(false);
  const finished = useSharedValue(false);

  // Whoever closed the sheet, `onClose` runs once.
  const finish = useCallback(() => {
    if (finished.get()) return;
    finished.set(true);
    onClose();
  }, [finished, onClose]);

  const dismiss = useCallback(() => {
    if (finished.get()) return;
    if (reduced) {
      finish();
      return;
    }
    translateY.set(
      withSpring(height.get() || PARKED, CLOSE, (done) => {
        'worklet';
        if (done) scheduleOnRN(finish);
      }),
    );
  }, [finish, finished, height, reduced, translateY]);

  useEffect(() => {
    if (!dismissRef) return;
    dismissRef.current = { dismiss };
    return () => {
      dismissRef.current = null;
    };
  }, [dismissRef, dismiss]);

  // Android's back button closes the sheet with its own animation instead of cutting it off.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      dismiss();
      return true;
    });
    return () => sub.remove();
  }, [dismiss]);

  const onLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    height.set(h);
    if (placed.get()) return;
    placed.set(true);
    if (reduced) {
      translateY.set(0);
      return;
    }
    translateY.set(h);
    translateY.set(withSpring(0, OPEN));
  };

  const drag = usePanGesture({
    activeOffsetY: [-6, 6],
    failOffsetX: [-24, 24],
    onActivate: () => {
      'worklet';
      // Grabbing it mid-flight stops the animation where the sheet is right now, and the drag continues from there.
      cancelAnimation(translateY);
      grabbedAt.set(translateY.get());
    },
    onUpdate: (e) => {
      'worklet';
      const to = grabbedAt.get() + e.translationY;
      translateY.set(to < 0 ? -rubberband(-to) : to);
    },
    onDeactivate: (e) => {
      'worklet';
      const h = height.get();
      const restsAt = translateY.get() + e.velocityY * RESTS_AFTER;
      if (restsAt > h * 0.5) {
        translateY.set(
          withSpring(h, { ...CLOSE, velocity: e.velocityY }, (done) => {
            'worklet';
            if (done) scheduleOnRN(finish);
          }),
        );
        scheduleOnRN(Haptics.selectionAsync);
      } else {
        translateY.set(withSpring(0, { ...OPEN, velocity: e.velocityY }));
      }
    },
  });

  const scrim = useAnimatedStyle(() => ({
    opacity: height.get() > 0 ? interpolate(translateY.get(), [0, height.get()], [1, 0], Extrapolation.CLAMP) : 0,
  }));
  const sheet = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.get() }] }));

  return (
    <View style={{ flex: 1, justifyContent: 'flex-end' }}>
      <Animated.View style={[{ position: 'absolute', inset: 0, backgroundColor: 'rgba(14,12,22,0.42)' }, scrim]}>
        <Pressable onPress={dismiss} accessibilityRole="button" accessibilityLabel="Close" style={{ flex: 1 }} />
      </Animated.View>

      <Animated.View
        onLayout={onLayout}
        style={[
          {
            maxHeight,
            backgroundColor: colors.card,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            borderCurve: 'continuous',
            paddingBottom: Math.max(insets.bottom, spacing.md),
          },
          sheet,
        ]}
      >
        <GestureDetector gesture={drag}>
          {/* A generous grab area: the visible bar is small, the part that responds is not. */}
          <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 14 }} accessibilityRole="adjustable" accessibilityLabel="Drag down to close">
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.faint }} />
          </View>
        </GestureDetector>
        {children(dismiss)}
      </Animated.View>
    </View>
  );
}
