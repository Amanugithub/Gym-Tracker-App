import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";

import { GlassCard, KineticScreen, MetricCard, ScreenHeader } from "@/src/components/kinetic-ui";
import { filterWorkoutsByDays, calculateWeeklyVolume } from "@/src/domain/progress-modules";
import { calculateProgressStats } from "@/src/domain/progress";
import { localDateForTimezone } from "@/src/domain/time";
import { formatWeight } from "@/src/domain/units";
import type { Unit, Workout } from "@/src/db/types";
import { ProfileRepository } from "@/src/repositories/profile-repository";
import { WorkoutRepository } from "@/src/repositories/workout-repository";
import { theme } from "@/src/theme";

export default function VolumeProgressScreen() {
  const db = useSQLiteContext();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [unit, setUnit] = useState<Unit>("kg");
  const [currentDate, setCurrentDate] = useState(new Date().toISOString().slice(0, 10));
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  useFocusEffect(useCallback(() => {
    let mounted = true;
    async function load() {
      const [profile, loaded] = await Promise.all([new ProfileRepository(db).getProfile(), new WorkoutRepository(db).listCompletedWorkouts(200)]);
      if (!mounted) return;
      setUnit(profile?.unit ?? "kg");
      setCurrentDate(profile ? localDateForTimezone(new Date().toISOString(), profile.timezoneId) : new Date().toISOString().slice(0, 10));
      setWorkouts(loaded); setLoading(false);
    }
    void load(); return () => { mounted = false; };
  }, [db]));
  const windowWorkouts = useMemo(() => filterWorkoutsByDays(workouts, currentDate, days), [currentDate, days, workouts]);
  const weekly = useMemo(() => calculateWeeklyVolume(workouts, currentDate, days), [currentDate, days, workouts]);
  const stats = calculateProgressStats(windowWorkouts);
  const max = Math.max(1, ...weekly.map((item) => item.volumeKg));
  return <KineticScreen><ScreenHeader eyebrow="TRAINING VOLUME" title="The work adds up" subtitle="Working-set volume is calculated from your saved completed workouts." />
    {loading ? <View style={styles.loading}><ActivityIndicator color={theme.colors.accent} /></View> : <>
      <View style={styles.filters}>{[7, 30, 90].map((option) => <Pressable key={option} onPress={() => setDays(option)} style={[styles.filter, days === option && styles.selectedFilter]}><Text style={[styles.filterText, days === option && styles.selectedFilterText]}>{option}D</Text></Pressable>)}</View>
      <View style={styles.metrics}><MetricCard label="Total volume" value={formatWeight(stats.totalVolumeKg, unit)} unit={unit} /><MetricCard label="Working sets" value={String(stats.totalSetCount)} /><MetricCard label="Workouts" value={String(stats.completedWorkoutCount)} /></View>
      <Text style={styles.section}>WEEKLY TREND</Text>
      <GlassCard style={styles.chart}>{weekly.map((item) => <View key={item.key} style={styles.barColumn}><View style={styles.barTrack}><View style={[styles.bar, { height: `${Math.max(4, (item.volumeKg / max) * 100)}%` }]} /></View><Text style={styles.barLabel}>{item.label}</Text><Text style={styles.barValue}>{item.volumeKg > 0 ? formatWeight(item.volumeKg, unit) : "—"}</Text></View>)}</GlassCard>
      <Text style={styles.section}>EXERCISE VOLUME</Text>
      {stats.exercises.slice(0, 8).map((exercise) => <View key={exercise.exerciseId} style={styles.exercise}><Text style={styles.exerciseName}>{exercise.name}</Text><Text style={styles.exerciseMeta}>{exercise.setCount} sets · best working load {formatWeight(exercise.heaviestWeightKg, unit)} {unit}</Text></View>)}
      {stats.exercises.length === 0 ? <Text style={styles.muted}>Complete a workout to see volume here.</Text> : null}
    </>}</KineticScreen>;
}

const styles = StyleSheet.create({
  loading: { alignItems: "center", paddingVertical: 80 },
  filters: { flexDirection: "row", gap: theme.spacing.sm, marginBottom: theme.spacing.md },
  filter: { paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radii.full },
  selectedFilter: { borderColor: theme.colors.borderActive, backgroundColor: theme.colors.accent },
  filterText: { color: theme.colors.textMuted, fontSize: 12, fontWeight: "800" },
  selectedFilterText: { color: theme.colors.accentText },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm, marginBottom: theme.spacing.xl },
  section: { marginBottom: theme.spacing.sm, color: theme.colors.textMuted, fontSize: 11, fontWeight: "800", letterSpacing: 1.1 },
  chart: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", height: 190, marginBottom: theme.spacing.xl, paddingTop: theme.spacing.lg },
  barColumn: { flex: 1, alignItems: "center", height: "100%", justifyContent: "flex-end", gap: 3 },
  barTrack: { width: 18, flex: 1, justifyContent: "flex-end", borderRadius: theme.radii.sm, backgroundColor: theme.colors.surfaceHigh },
  bar: { width: "100%", borderRadius: theme.radii.sm, backgroundColor: theme.colors.accent },
  barLabel: { color: theme.colors.textSubtle, fontSize: 9 },
  barValue: { color: theme.colors.textSubtle, fontSize: 8 },
  exercise: { marginBottom: theme.spacing.sm, padding: theme.spacing.md, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  exerciseName: { color: theme.colors.text, fontSize: 14, fontWeight: "700" },
  exerciseMeta: { marginTop: theme.spacing.xs, color: theme.colors.textSubtle, fontSize: 12 },
  muted: { color: theme.colors.textMuted, fontSize: 13 },
});
