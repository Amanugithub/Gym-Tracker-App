import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { randomUUID } from "expo-crypto";
import { useSQLiteContext } from "expo-sqlite";

import { GlassCard, KineticScreen, MetricCard, PrimaryButton, ScreenHeader } from "@/src/components/kinetic-ui";
import { calculateWeightProgress, type WeightProgress } from "@/src/domain/body-weight";
import { localDateForTimezone } from "@/src/domain/time";
import { formatWeight, weightToKg } from "@/src/domain/units";
import type { Profile, Unit } from "@/src/db/types";
import { BodyWeightRepository } from "@/src/repositories/body-weight-repository";
import { ProfileRepository } from "@/src/repositories/profile-repository";
import { theme } from "@/src/theme";

const EMPTY = calculateWeightProgress([], null);

export default function BodyMetricsScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [progress, setProgress] = useState<WeightProgress>(EMPTY);
  const [unit, setUnit] = useState<Unit>("kg");
  const [weight, setWeight] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    const [loadedProfile, entries] = await Promise.all([new ProfileRepository(db).getProfile(), new BodyWeightRepository(db).listEntries()]);
    setProfile(loadedProfile); setUnit(loadedProfile?.unit ?? "kg"); setWeight(loadedProfile?.bodyweightKg === null || !loadedProfile ? "" : formatWeight(loadedProfile.bodyweightKg, loadedProfile.unit)); setProgress(calculateWeightProgress(entries, loadedProfile?.heightCm ?? null)); setLoading(false);
  }, [db]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function save() {
    if (!profile) return;
    const kg = weightToKg(Number(weight), unit);
    if (!Number.isFinite(kg) || kg <= 0) { setError("Enter a positive bodyweight."); return; }
    setSaving(true); setError(null);
    try {
      const measuredAt = new Date().toISOString();
      await new BodyWeightRepository(db).recordIfChanged({ id: randomUUID(), weightKg: kg, measuredAt, timezoneId: profile.timezoneId, localDate: localDateForTimezone(measuredAt, profile.timezoneId) });
      await load();
    } catch { setError("Could not save this measurement."); } finally { setSaving(false); }
  }

  return <KineticScreen><Pressable onPress={() => router.back()} hitSlop={12}><Text style={styles.back}>‹ Progress</Text></Pressable><ScreenHeader eyebrow="BODY METRICS" title="Weight progression" subtitle="Bodyweight is stored with each workout and measurement. Height is optional and enables BMI." />
    {loading ? <View style={styles.loading}><ActivityIndicator color={theme.colors.accent} /></View> : <>
      <View style={styles.metrics}><MetricCard label="Current weight" value={progress.currentWeightKg === null ? "—" : formatWeight(progress.currentWeightKg, unit)} unit={progress.currentWeightKg === null ? undefined : unit} /><MetricCard label="Change" value={progress.changeKg === null ? "—" : `${progress.changeKg > 0 ? "+" : ""}${formatWeight(progress.changeKg, unit)}`} unit={progress.changeKg === null ? undefined : unit} /><MetricCard label="Current BMI" value={progress.currentBmi === null ? "—" : progress.currentBmi.toFixed(1)} /></View>
      <GlassCard style={styles.logCard}><Text style={styles.cardTitle}>Log a measurement</Text><Text style={styles.help}>Current unit: {unit.toUpperCase()}</Text><TextInput value={weight} onChangeText={setWeight} keyboardType="decimal-pad" placeholder={`Bodyweight in ${unit}`} placeholderTextColor={theme.colors.textSubtle} style={styles.input} /><PrimaryButton label="Save measurement" onPress={() => void save()} loading={saving} /><Text style={styles.height}>Height: {profile?.heightCm === null ? "Not set" : `${profile?.heightCm} cm`}</Text><Pressable onPress={() => router.push("/onboarding")}><Text style={styles.link}>Edit profile to add height</Text></Pressable>{error ? <Text style={styles.error}>{error}</Text> : null}</GlassCard>
      <Text style={styles.section}>MEASUREMENT HISTORY</Text>
      {progress.points.slice().reverse().map((point) => <View key={point.entryId} style={styles.history}><Text style={styles.date}>{point.localDate}</Text><Text style={styles.historyValue}>{formatWeight(point.weightKg, unit)} {unit}</Text><Text style={styles.bmi}>{point.bmi === null ? "BMI —" : `BMI ${point.bmi.toFixed(1)}`}</Text></View>)}
      {progress.points.length === 0 ? <Text style={styles.muted}>No measurements yet.</Text> : null}
    </>}</KineticScreen>;
}

const styles = StyleSheet.create({
  back: { marginBottom: theme.spacing.lg, color: theme.colors.accent, fontSize: 14, fontWeight: "800" },
  loading: { alignItems: "center", paddingVertical: 80 },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm, marginBottom: theme.spacing.md },
  logCard: { marginBottom: theme.spacing.xl },
  cardTitle: { color: theme.colors.text, fontSize: 17, fontWeight: "700" },
  help: { marginTop: theme.spacing.xs, color: theme.colors.textMuted, fontSize: 12 },
  input: { minHeight: 50, marginVertical: theme.spacing.md, paddingHorizontal: theme.spacing.md, color: theme.colors.text, borderWidth: 1, borderColor: theme.colors.borderStrong, borderRadius: theme.radii.lg, backgroundColor: theme.colors.surfaceLow },
  height: { marginTop: theme.spacing.md, color: theme.colors.textMuted, fontSize: 13 },
  link: { marginTop: theme.spacing.sm, color: theme.colors.accent, fontSize: 13, fontWeight: "700" },
  error: { marginTop: theme.spacing.sm, color: theme.colors.danger, fontSize: 13 },
  section: { marginBottom: theme.spacing.sm, color: theme.colors.textMuted, fontSize: 11, fontWeight: "800", letterSpacing: 1.1 },
  history: { flexDirection: "row", alignItems: "center", marginBottom: theme.spacing.sm, padding: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radii.lg, backgroundColor: theme.colors.surface },
  date: { flex: 1, color: theme.colors.textSubtle, fontSize: 12 },
  historyValue: { color: theme.colors.text, fontSize: 14, fontWeight: "700" },
  bmi: { width: 70, marginLeft: theme.spacing.sm, color: theme.colors.textMuted, fontSize: 11, textAlign: "right" },
  muted: { color: theme.colors.textMuted, fontSize: 13 },
});
