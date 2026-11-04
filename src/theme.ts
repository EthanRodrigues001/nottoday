/**
 * The single source of visual values. Reference images are in references/ui/
 * (white rounded cards on a light grey ground, black accent, a dark ASCII header).
 */

export const colors = {
  background: '#F4F4F6',
  card: '#FFFFFF',
  ink: '#111111',
  inkSoft: '#3A3A3C',
  muted: '#8E8E93',
  faint: '#C7C7CC',
  hairline: 'rgba(0, 0, 0, 0.07)',
  onInk: '#FFFFFF',
  accent: '#F26B3A',
  /** The first task of a list is the top priority: a faint warm wash, and a softer ring for the next two. */
  priorityWash: '#FFF5EF',
  priorityRing: '#F3B49A',
  done: '#2FAE7B',
  partial: '#F4766B',
  danger: '#E5484D',
  /** The dark ground behind the ASCII header and the floating tab bar. */
  night: '#0E0C16',
  nightRaised: '#1B1A24',
  onNight: '#FFFFFF',
  onNightMuted: 'rgba(255, 255, 255, 0.62)',
  glow: '#38BDF8',
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;

export const radius = { sm: 8, md: 14, card: 18, xl: 32, full: 9999 } as const;

/**
 * Typefaces: Inter for everything you read and tap, Instrument Serif for big titles.
 * On Android a weight needs its own font file, so weights map to family names (see components/text.tsx).
 */
export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  display: 'InstrumentSerif_400Regular',
  displayItalic: 'InstrumentSerif_400Regular_Italic',
} as const;

/**
 * The type scale. Tracking follows size: large text is pulled tighter, body stays near zero,
 * small text opens up a little (apple-design, section 15). Line height shrinks as size grows.
 */
export const type = {
  display: { fontFamily: fonts.display, fontSize: 42, lineHeight: 44, letterSpacing: -0.8 },
  title: { fontFamily: fonts.semibold, fontSize: 26, lineHeight: 30, letterSpacing: -0.6 },
  headline: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 22, letterSpacing: -0.25 },
  body: { fontFamily: fonts.medium, fontSize: 16, lineHeight: 22, letterSpacing: -0.15 },
  subhead: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, letterSpacing: -0.05 },
  caption: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, letterSpacing: 0.15 },
  overline: { fontFamily: fonts.bold, fontSize: 11, lineHeight: 14, letterSpacing: 0.9, textTransform: 'uppercase' as const },
} as const;

export const shadows = {
  card: '0 1px 2px rgba(0, 0, 0, 0.04), 0 6px 18px rgba(0, 0, 0, 0.045)',
  raised: '0 10px 28px rgba(0, 0, 0, 0.22)',
  bar: '0 10px 30px rgba(0, 0, 0, 0.28)',
  /** A message floating over the screen: soft and wide, so it lifts off without a border. */
  toast: '0 2px 6px rgba(0, 0, 0, 0.06), 0 12px 32px rgba(0, 0, 0, 0.16)',
} as const;

/** Durations in ms for timing animations; springs use the config below. */
export const motion = { fast: 140, base: 240 } as const;

/** Spring shapes: critically damped by default, a little bounce only after a flick. */
export const spring = {
  settle: { duration: 400, dampingRatio: 1 },
  flick: { duration: 400, dampingRatio: 0.8 },
  snap: { duration: 300, dampingRatio: 0.8 },
} as const;
