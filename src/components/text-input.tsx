import { TextInput as RNTextInput, type TextInputProps } from 'react-native';

import { withFamily } from '@/components/text';

/** The app's TextInput, in the same typeface as Text. */
export function TextInput({ style, ...props }: TextInputProps) {
  return <RNTextInput {...props} style={withFamily(style)} />;
}
