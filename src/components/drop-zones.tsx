import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Text } from '@/components/text';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';

import { ZONE_DELETE, ZONE_NOT_TODAY, type DragState } from '@/components/drag-state';
import { colors, radius, spacing, spring } from '@/theme';

export const ZONE_HEIGHT = 88;

/** The two bottom targets that appear while a task is lifted. The one under the finger grows toward it. */
export function DropZones({ drag, bottom }: { drag: DragState; bottom: number }) {
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: spacing.md,
          right: spacing.md,
          bottom,
          height: ZONE_HEIGHT,
          flexDirection: 'row',
          gap: spacing.sm,
          zIndex: 50,
        },
        useAnimatedStyle(() => ({
          opacity: withSpring(drag.active.get() >= 0 ? 1 : 0, { duration: 200, dampingRatio: 1 }),
          transform: [{ translateY: withSpring(drag.active.get() >= 0 ? 0 : 40, spring.settle) }],
        })),
      ]}
    >
      <Zone drag={drag} id={ZONE_NOT_TODAY} icon="wb-twilight" label="Not today" tint={colors.accent} soft="rgba(242,107,58,0.16)" />
      <Zone drag={drag} id={ZONE_DELETE} icon="delete-outline" label="Delete" tint={colors.danger} soft="rgba(229,72,77,0.16)" />
    </Animated.View>
  );
}

function Zone({
  drag,
  id,
  icon,
  label,
  tint,
  soft,
}: {
  drag: DragState;
  id: number;
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  tint: string;
  soft: string;
}) {
  const style = useAnimatedStyle(() => {
    const on = drag.zone.get() === id;
    return {
      flex: withSpring(on ? 1.35 : 1, spring.snap),
      transform: [{ scale: withSpring(on ? 1.04 : 1, spring.snap) }],
      backgroundColor: on ? soft : colors.card,
    };
  });
  const content = useAnimatedStyle(() => ({ opacity: drag.zone.get() === id ? 1 : 0.85 }));
  return (
    <Animated.View
      style={[
        { alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: radius.card, borderCurve: 'continuous', borderWidth: 1.5, borderColor: tint },
        style,
      ]}
    >
      <Animated.View style={[{ alignItems: 'center', gap: 4 }, content]}>
        <ZoneIcon drag={drag} id={id} icon={icon} tint={tint} />
        <ZoneLabel drag={drag} id={id} label={label} tint={tint} />
      </Animated.View>
    </Animated.View>
  );
}

// The icon and label flip to white when their zone is active, so they are animated text/icon wrappers.
function ZoneIcon({ drag, id, icon, tint }: { drag: DragState; id: number; icon: keyof typeof MaterialIcons.glyphMap; tint: string }) {
  const style = useAnimatedStyle(() => ({ transform: [{ scale: withSpring(drag.zone.get() === id ? 1.2 : 1, spring.snap) }] }));
  return (
    <Animated.View style={style}>
      <MaterialIcons name={icon} size={28} color={tint} />
    </Animated.View>
  );
}

function ZoneLabel({ drag, id, label, tint }: { drag: DragState; id: number; label: string; tint: string }) {
  const style = useAnimatedStyle(() => ({ opacity: drag.zone.get() === id ? 0.95 : 1 }));
  return (
    <Animated.View style={style}>
      <Text style={{ fontSize: 14, fontWeight: '700', color: tint }}>{label}</Text>
    </Animated.View>
  );
}
