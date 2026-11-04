import { View } from 'react-native';

import GradientASCIIDom from '@/components/gradient-ascii-dom';
import { colors } from '@/theme';

/** Deep blues, dark to light. The light end stays a mid blue so white text on top stays readable. */
const PALETTE = ['#070a2b', '#1c3fd1', '#2f7cf6', '#5db6fb'];

/**
 * What sits behind the Today header, inside the dark panel: the moving ASCII gradient, or, with the
 * animation switched off, a still glow of the same colours. It is the only gradient in the header.
 */
export function HeaderBackdrop({ animated }: { animated: boolean }) {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.night }}>
      {animated ? (
        <GradientASCIIDom
          dom={{ style: { width: '100%', height: '100%' }, scrollEnabled: false, contentInsetAdjustmentBehavior: 'never' }}
          colors={PALETTE}
          shape="horizon"
          cellSize={14}
          speed={0.25}
          intro={false}
          mouseInteraction={false}
          clickEffect="none"
          glow={0.15}
          flicker={0.12}
          glyphOpacity={0.38}
          density={0.6}
          gradientOpacity={0.95}
          grain={0.06}
        />
      ) : (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            experimental_backgroundImage: `radial-gradient(ellipse at 50% 0%, ${PALETTE[2]} 0%, ${PALETTE[1]} 38%, ${colors.night} 78%)`,
          }}
        />
      )}
    </View>
  );
}
