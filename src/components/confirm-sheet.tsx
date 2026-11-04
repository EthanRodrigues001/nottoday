import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { Sheet, type SheetHandle } from '@/components/sheet';
import { Text } from '@/components/text';
import { colors, radius, spacing, type } from '@/theme';

type Props = {
  visible: boolean;
  title: string;
  message: string;
  /** Label of the main button. */
  confirmLabel: string;
  /** Draws the main button red, for things that delete or cannot be undone. */
  destructive?: boolean;
  /** Without a confirm action the sheet is only a message with a single button. */
  onConfirm?: () => void;
  onClose: () => void;
};

/** The app's own confirmation, so a question never falls back to Android's system dialog with its blue capital-letter buttons. */
export function ConfirmSheet({ visible, title, message, confirmLabel, destructive, onConfirm, onClose }: Props) {
  const sheetRef = useRef<SheetHandle | null>(null);
  useEffect(() => {
    if (visible && destructive) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }, [visible, destructive]);

  return (
    // A Modal takes over the back button, so it hands it to the sheet to close with its own animation.
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={() => sheetRef.current?.dismiss()}>
      <GestureHandlerRootView style={{ flex: 1 }}>
      <Sheet onClose={onClose} dismissRef={sheetRef} maxHeight="70%">
        {(dismiss) => (
          <View style={{ gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
            <View style={{ gap: spacing.xs }}>
              <Text style={[type.title, { color: colors.ink }]}>{title}</Text>
              <Text style={{ fontSize: 15, lineHeight: 22, color: colors.muted }}>{message}</Text>
            </View>
            <View style={{ gap: spacing.sm }}>
              <Pressable
                onPress={() => {
                  onConfirm?.();
                  dismiss();
                }}
                accessibilityRole="button"
                style={({ pressed }) => ({
                  alignItems: 'center',
                  paddingVertical: 15,
                  borderRadius: radius.full,
                  backgroundColor: destructive ? colors.danger : colors.ink,
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                })}
              >
                <Text style={{ color: colors.onInk, fontSize: 16, fontWeight: '700' }}>{confirmLabel}</Text>
              </Pressable>
              {onConfirm ? (
                <Pressable
                  onPress={dismiss}
                  accessibilityRole="button"
                  style={({ pressed }) => ({ alignItems: 'center', paddingVertical: 15, borderRadius: radius.full, backgroundColor: colors.background, transform: [{ scale: pressed ? 0.98 : 1 }] })}
                >
                  <Text style={{ color: colors.inkSoft, fontSize: 16, fontWeight: '700' }}>Cancel</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        )}
      </Sheet>
      </GestureHandlerRootView>
    </Modal>
  );
}
