import { StyleSheet, Text as RNText, type TextProps, type TextStyle } from 'react-native';

import { fonts } from '@/theme';

const FAMILY_BY_WEIGHT: Record<string, string> = {
  '100': fonts.regular,
  '200': fonts.regular,
  '300': fonts.regular,
  '400': fonts.regular,
  normal: fonts.regular,
  '500': fonts.medium,
  '600': fonts.semibold,
  '700': fonts.bold,
  bold: fonts.bold,
  '800': fonts.bold,
  '900': fonts.bold,
};

/** Resolve a style's weight to the right font file; Android ignores fontWeight for custom fonts. */
export function withFamily(style: TextProps['style']): TextStyle {
  const { fontWeight, fontFamily, fontStyle, ...rest } = StyleSheet.flatten(style) ?? {};
  let family = fontFamily ?? FAMILY_BY_WEIGHT[String(fontWeight ?? '400')] ?? fonts.regular;
  if (family === fonts.display && fontStyle === 'italic') family = fonts.displayItalic;
  return { ...rest, fontFamily: family };
}

/** The app's Text: same as React Native's, with Inter weights mapped to their font files. */
export function Text({ style, ...props }: TextProps) {
  return <RNText {...props} style={withFamily(style)} />;
}
