import { useCallback, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";

import { resetGymDatabase } from "@/src/db";
import { GlassCard, KineticScreen, PrimaryButton, ScreenHeader, SecondaryButton, SectionLabel } from "@/src/components/kinetic-ui";
import type { Profile } from "@/src/db/types";
import { ProfileRepository } from "@/src/repositories/profile-repository";
import { getSyncStatus, syncNow } from "@/src/sync/sync-service";
import { theme } from "@/src/theme";

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [pending, setPending] = useState(0);
  const [syncMessage, setSyncMessage] = useState("Not synced yet.");
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    const [loaded, status] = await Promise.all([new ProfileRepository(db).getProfile(), getSyncStatus(db)]);
    setProfile(loaded); setPending(status.pendingCount); setSyncMessage(status.lastSuccess ? `Last synced ${new Date(status.lastSuccess).toLocaleString()}` : status.lastError ?? "Not synced yet.");
  }, [db]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function sync() {
    setSyncing(true); setError(null);
    try { const result = await syncNow(db); setPending(result.pendingCount); setSyncMessage(result.success ? `Last synced ${new Date(result.syncedAt ?? Date.now()).toLocaleString()}` : result.message); if (!result.success) setError(result.message); } catch (syncError) { setError(syncError instanceof Error ? syncError.message : "Sync failed"); } finally { setSyncing(false); }
  }
  function reset() {
    Alert.alert("Reset local data?", "This deletes the profile, workouts, templates, and measurements on this device.", [{ text: "Cancel", style: "cancel" }, { text: "Reset", style: "destructive", onPress: () => { void (async () => { await resetGymDatabase(db); router.replace("/onboarding"); })(); } }]);
  }
  return <KineticScreen><ScreenHeader eyebrow="PROFILE" title={profile?.displayName ?? "Your profile"} subtitle="Manage the information used for your logs, body metrics, and sync." />
    {!profile ? <Text style={styles.muted}>Profile has not been set up yet.</Text> : <>
      <GlassCard style={styles.identity}><Text style={styles.identityName}>{profile.displayName ?? "Unnamed athlete"}</Text><Text style={styles.identityMeta}>{profile.unit.toUpperCase()} · {profile.language === "am" ? "Amharic" : "English"}</Text><Text style={styles.identityMeta}>{profile.timezoneId}</Text></GlassCard>
      <View style={styles.actions}><PrimaryButton label="Edit profile" onPress={() => router.push("/onboarding")} style={styles.flexButton} /><SecondaryButton label="Templates" onPress={() => router.push("/templates" as never)} style={styles.flexButton} /></View>
      <SectionLabel>PROFILE DATA</SectionLabel>
      <GlassCard style={styles.dataCard}><Row label="Weekly target" value={`${profile.weeklyTarget} workouts`} /><Row label="Height" value={profile.heightCm === null ? "Not set" : `${profile.heightCm} cm`} /><Row label="Current bodyweight" value={profile.bodyweightKg === null ? "Not set" : `${profile.bodyweightKg.toFixed(1)} kg`} /></GlassCard>
      <SectionLabel>BACKUP & SYNC</SectionLabel>
      <GlassCard style={styles.syncCard}><Text style={styles.cardTitle}>Cloud sync</Text><Text style={styles.help}>Finished workouts, templates, bodyweight entries, and profile changes can be restored from the sync server.</Text>{pending > 0 ? <Text style={styles.pending}>{pending} item{pending === 1 ? "" : "s"} waiting to sync</Text> : null}<Text style={styles.syncMessage}>{syncMessage}</Text><PrimaryButton label="Sync now" onPress={() => void sync()} loading={syncing} style={styles.syncButton} />{error ? <Text style={styles.error}>{error}</Text> : null}</GlassCard>
      <Pressable onPress={reset} style={styles.reset}><Text style={styles.resetText}>Reset local data</Text></Pressable>
    </>}</KineticScreen>;
}

function Row({ label, value }: { label: string; value: string }) { return <View style={styles.row}><Text style={styles.rowLabel}>{label}</Text><Text style={styles.rowValue}>{value}</Text></View>; }

const styles = StyleSheet.create({
  identity: { marginBottom: theme.spacing.md },
  identityName: { color: theme.colors.text, fontSize: 21, fontWeight: "700" },
  identityMeta: { marginTop: theme.spacing.xs, color: theme.colors.textMuted, fontSize: 12 },
  actions: { flexDirection: "row", gap: theme.spacing.sm, marginBottom: theme.spacing.xl },
  flexButton: { flex: 1 },
  dataCard: { marginBottom: theme.spacing.xl },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: theme.spacing.sm, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  rowLabel: { color: theme.colors.textMuted, fontSize: 14 },
  rowValue: { color: theme.colors.text, fontSize: 14, fontWeight: "700" },
  syncCard: { marginBottom: theme.spacing.md },
  cardTitle: { color: theme.colors.text, fontSize: 17, fontWeight: "700" },
  help: { marginTop: theme.spacing.sm, color: theme.colors.textMuted, fontSize: 13, lineHeight: 19 },
  pending: { marginTop: theme.spacing.md, color: theme.colors.accent, fontSize: 13, fontWeight: "700" },
  syncMessage: { marginTop: theme.spacing.sm, color: theme.colors.textSubtle, fontSize: 11 },
  syncButton: { marginTop: theme.spacing.md },
  error: { marginTop: theme.spacing.sm, color: theme.colors.danger, fontSize: 13 },
  reset: { alignItems: "center", paddingVertical: theme.spacing.md },
  resetText: { color: theme.colors.danger, fontSize: 13, fontWeight: "800" },
  muted: { color: theme.colors.textMuted, fontSize: 14 },
});
