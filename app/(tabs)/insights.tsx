import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { Ionicons } from "@expo/vector-icons";

import { GlassCard, KineticScreen, MetricCard, PrimaryButton, ScreenHeader, SectionLabel } from "@/src/components/kinetic-ui";
import { calculateWeightProgress } from "@/src/domain/body-weight";
import { localDateForTimezone } from "@/src/domain/time";
import { calculateProgressStats, type ProgressStats } from "@/src/domain/progress";
import { formatWeight } from "@/src/domain/units";
import type { Unit } from "@/src/db/types";
import { BodyWeightRepository } from "@/src/repositories/body-weight-repository";
import { ProfileRepository } from "@/src/repositories/profile-repository";
import { WorkoutRepository } from "@/src/repositories/workout-repository";
import { theme } from "@/src/theme";

const EMPTY_STATS = calculateProgressStats([]);

export default function InsightsScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [stats, setStats] = useState<ProgressStats>(EMPTY_STATS);
  const [unit, setUnit] = useState<Unit>("kg");
  const [bmi, setBmi] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    let mounted = true;
    async function load() {
      setIsLoading(true);
      try {
        const [profile, history, bodyWeight] = await Promise.all([
          new ProfileRepository(db).getProfile(),
          new WorkoutRepository(db).listWorkoutHistory(200),
          new BodyWeightRepository(db).listEntries(),
        ]);
        if (!mounted) return;
        const currentDate = profile ? localDateForTimezone(new Date().toISOString(), profile.timezoneId) : undefined;
        const completed = history.filter((workout) => workout.status === "completed");
        const progress = calculateWeightProgress(bodyWeight, profile?.heightCm ?? null);
        setUnit(profile?.unit ?? "kg");
        setBmi(progress.currentBmi);
        setStats(calculateProgressStats(completed, { currentLocalDate: currentDate, weeklyTarget: profile?.weeklyTarget ?? null }));
        setError(null);
      } catch {
        if (mounted) setError("Could not load your progress.");
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    void load();
    return () => { mounted = false; };
  }, [db]));

  return (
    <KineticScreen>
      <ScreenHeader eyebrow="PROGRESS" title="Your training history" subtitle="Explore the patterns in the workouts you have completed." />
      {isLoading ? <View style={styles.loading}><ActivityIndicator color={theme.colors.accent} /></View> : <>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.metrics}>
          <MetricCard label="Workouts" value={String(stats.completedWorkoutCount)} supporting={`${stats.workoutsThisWeek} this week`} />
          <MetricCard label="Current streak" value={String(stats.currentStreak)} unit="days" supporting={`Best ${stats.longestStreak} days`} />
          <MetricCard label="Working sets" value={String(stats.totalSetCount)} />
          <MetricCard label="Volume" value={formatWeight(stats.totalVolumeKg, unit)} unit={unit} />
        </View>
        <GlassCard style={styles.targetCard}>
          <View style={styles.targetText}><Text style={styles.targetTitle}>Weekly target</Text><Text style={styles.targetValue}>{stats.workoutsThisWeek} / {stats.weeklyTarget ?? "—"} completed</Text></View>
          <Ionicons name="calendar-outline" size={23} color={theme.colors.accent} />
        </GlassCard>
        <GlassCard style={styles.bodyCard}>
          <View style={styles.bodyText}><Text style={styles.cardLabel}>BODY METRICS</Text><Text style={styles.bodyValue}>{bmi === null ? "No BMI yet" : `BMI ${bmi.toFixed(1)}`}</Text><Text style={styles.muted}>Track weight and height changes over time.</Text></View>
          <PrimaryButton label="Open" onPress={() => router.push("/progress/body-metrics" as never)} style={styles.openButton} />
        </GlassCard>
        <SectionLabel>EXPLORE PROGRESS</SectionLabel>
        <View style={styles.moduleGrid}>
          <Module title="Exercise progress" icon="barbell-outline" onPress={() => router.push("/progress/exercises" as never)} />
          <Module title="Strength" icon="trending-up-outline" onPress={() => router.push("/progress/strength" as never)} />
          <Module title="Training volume" icon="layers-outline" onPress={() => router.push("/progress/volume" as never)} />
          <Module title="Consistency" icon="calendar-outline" onPress={() => router.push("/progress/consistency" as never)} />
          <Module title="Records & milestones" icon="ribbon-outline" onPress={() => router.push("/progress/records" as never)} />
        </View>
      </>}
    </KineticScreen>
  );
}

function Module({ title, icon, onPress }: { title: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void }) {
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.module, pressed && styles.pressed]}><Ionicons name={icon} size={22} color={theme.colors.accent} /><Text style={styles.moduleTitle}>{title}</Text><Ionicons name="arrow-forward" size={16} color={theme.colors.textSubtle} /></Pressable>;
}

const styles = StyleSheet.create({
  loading: { alignItems: "center", paddingVertical: 80 },
  error: { marginBottom: theme.spacing.md, color: theme.colors.danger, fontSize: 13 },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm, marginBottom: theme.spacing.md },
  targetCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: theme.spacing.md },
  targetText: { flex: 1 },
  targetTitle: { color: theme.colors.text, fontSize: 16, fontWeight: "700" },
  targetValue: { marginTop: theme.spacing.xs, color: theme.colors.textMuted, fontSize: 13 },
  bodyCard: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md, marginBottom: theme.spacing.xl },
  bodyText: { flex: 1 },
  cardLabel: { color: theme.colors.accent, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  bodyValue: { marginTop: theme.spacing.sm, color: theme.colors.text, fontSize: 22, fontWeight: "700" },
  muted: { marginTop: theme.spacing.xs, color: theme.colors.textMuted, fontSize: 12, lineHeight: 18 },
  openButton: { minHeight: 40, paddingHorizontal: theme.spacing.md },
  moduleGrid: { gap: theme.spacing.sm },
  module: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md, minHeight: 62, paddingHorizontal: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radii.lg, backgroundColor: theme.colors.surface },
  moduleTitle: { flex: 1, color: theme.colors.text, fontSize: 15, fontWeight: "700" },
  pressed: { opacity: 0.8 },
});
