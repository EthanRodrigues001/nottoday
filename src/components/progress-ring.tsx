import Svg, { Circle } from 'react-native-svg';

import { colors } from '@/theme';

type Props = {
  size: number;
  /** 0 to 1 */
  fraction: number;
  /** Past or current days show how much was done; future days show only the empty track. */
  mode: 'ring' | 'empty';
  tint?: string;
  /** Colour of the empty track; light on the dark header, dark on the white selected day. */
  track?: string;
  stroke?: number;
  /** Fill for the whole disc behind the ring, drawn in the SVG so it is always round. */
  fill?: string;
};

/** A ring from the week strip: a track plus an arc for the share of the day's list that is done. */
export function ProgressRing({ size, fraction, mode, tint, track = 'rgba(255,255,255,0.16)', stroke = 4, fill }: Props) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const arc = tint ?? (fraction >= 1 ? colors.done : colors.partial);
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {fill ? <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={fill} /> : null}
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
      {mode === 'ring' && fraction > 0 ? (
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={arc}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${c * fraction} ${c}`}
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      ) : null}
    </Svg>
  );
}
