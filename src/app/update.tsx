import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';

import { Sheet } from '@/components/sheet';
import { Text } from '@/components/text';
import { useUpdates } from '@/updates/updates';
import { colors, radius, spacing, type } from '@/theme';

const megabytes = (bytes: number) => `${Math.round(bytes / 1_000_000)} MB`;

/** What is new in the published version, with the button that downloads and installs it. */
export default function UpdateSheet() {
  return <Sheet onClose={() => router.back()} maxHeight="80%">{(dismiss) => <UpdateBody dismiss={dismiss} />}</Sheet>;
}

function UpdateBody({ dismiss }: { dismiss: () => void }) {
  const { version, release, check, install, installNow } = useUpdates();
  const busy = install === 'downloading';

  if (!release) {
    const failed = check === 'failed';
    return (
      <View style={{ gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
        <Text style={[type.title, { color: colors.ink }]}>{failed ? 'Could not check' : check === 'checking' ? 'Checking…' : 'You are up to date'}</Text>
        <Text style={{ fontSize: 15, lineHeight: 22, color: colors.muted }}>
          {failed ? `GitHub could not be reached. You have ${version}.` : `notToday ${version} is the newest version.`}
        </Text>
        <Pressable onPress={dismiss} accessibilityRole="button" style={({ pressed }) => ({ alignItems: 'center', paddingVertical: 15, borderRadius: radius.full, backgroundColor: colors.ink, transform: [{ scale: pressed ? 0.98 : 1 }] })}>
          <Text style={{ color: colors.onInk, fontSize: 16, fontWeight: '700' }}>Done</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
      <View style={{ gap: spacing.xs }}>
        <Text style={[type.overline, { color: colors.accent }]}>Update available</Text>
        <Text style={[type.title, { color: colors.ink }]}>notToday {release.version}</Text>
        <Text style={{ fontSize: 14, color: colors.muted }}>
          You have {version}
          {release.size ? ` · ${megabytes(release.size)}` : ''}
        </Text>
      </View>

      {release.notes ? (
        <ScrollView style={{ maxHeight: 220 }} showsVerticalScrollIndicator={false}>
          <Text style={{ fontSize: 15, lineHeight: 22, color: colors.inkSoft }}>{release.notes}</Text>
        </ScrollView>
      ) : null}

      {install === 'failed' ? (
        <Text style={{ fontSize: 13, color: colors.danger }}>
          Could not download or open the update. Check your connection, and allow notToday to install apps when Android asks.
        </Text>
      ) : null}

      <View style={{ gap: spacing.sm }}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            installNow();
          }}
          disabled={busy}
          accessibilityRole="button"
          style={({ pressed }) => ({ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.sm, paddingVertical: 15, borderRadius: radius.full, backgroundColor: colors.ink, opacity: busy ? 0.7 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] })}
        >
          {busy ? <ActivityIndicator color={colors.onInk} /> : <MaterialIcons name="system-update" size={20} color={colors.onInk} />}
          <Text style={{ color: colors.onInk, fontSize: 16, fontWeight: '700' }}>{busy ? 'Downloading…' : install === 'failed' ? 'Try again' : 'Download and install'}</Text>
        </Pressable>
        <Pressable onPress={dismiss} accessibilityRole="button" style={({ pressed }) => ({ alignItems: 'center', paddingVertical: 15, borderRadius: radius.full, backgroundColor: colors.background, transform: [{ scale: pressed ? 0.98 : 1 }] })}>
          <Text style={{ color: colors.inkSoft, fontSize: 16, fontWeight: '700' }}>Not now</Text>
        </Pressable>
      </View>
    </View>
  );
}
