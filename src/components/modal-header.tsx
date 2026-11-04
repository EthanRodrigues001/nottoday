import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/text';

import { colors, spacing, type } from '@/theme';

/** Title and a close button for the slide-up screens. */
export function ModalHeader({ title }: { title: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Text style={[type.title, { color: colors.ink }]}>{title}</Text>
      <Pressable
        onPress={() => router.back()}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Close"
        style={({ pressed }) => ({ padding: spacing.sm, borderRadius: 20, backgroundColor: colors.background, opacity: pressed ? 0.6 : 1 })}
      >
        <MaterialIcons name="close" size={22} color={colors.inkSoft} />
      </Pressable>
    </View>
  );
}
