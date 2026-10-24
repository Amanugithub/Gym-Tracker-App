import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";

import { GlassCard, KineticScreen, MetricCard, ScreenHeader } from "@/src/components/kinetic-ui";
import { calculateConsistencySummary, calculateProgressStats } from "@/src/domain/progress";
import { dateDaysBefore } from "@/src/domain/progress-modules";
import { localDateForTimezone } from "@/src/domain/time";
import type { Profile, Workout } from "@/src/db/types";
import { ProfileRepository } from "@/src/repositories/profile-repository";
import { WorkoutRepository } from "@/src/repositories/workout-repository";
import { theme } from "@/src/theme";

export default function ConsistencyProgressScreen() {
  const db = useSQLiteContext();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [today, setToday] = useState(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(true);
  useFocusEffect(useCallback(() => {
    let mounted = true;
    async function load() {
      const [loadedProfile, loadedWorkouts] = await Promise.all([new ProfileRepository(db).getProfile(), new WorkoutRepository(db).listCompletedWorkouts(200)]);
      if (!mounted) return;
      setProfile(loadedProfile); setToday(loadedProfile ? localDateForTimezone(new Date().toISOString(), loadedProfile.timezoneId) : new Date().toISOString().slice(0, 10)); setWorkouts(loadedWorkouts); setLoading(false);
    }
    void load(); return () => { mounted = false; };
  }, [db]));
  const summary = calculateConsistencySummary(workouts, today);
  const stats = calculateProgressStats(workouts, { currentLocalDate: today, weeklyTarget: profile?.weeklyTarget });
  const recentDates = useMemo(() => Array.from({ length: 28 }, (_, index) => dateDaysBefore(today, 27 - index)), [today]);
  const trainingDates = new Set(summary.dates);
  return <KineticScreen><ScreenHeader eyebrow="CONSISTENCY" title="Build a rhythm that fits" subtitle="This view reflects completed workouts, not a rigid schedule." />
    {loading ? <View style={styles.loading}><ActivityIndicator color={theme.colors.accent} /></View> : <>
      <View style={styles.metrics}><MetricCard label="Current streak" value={String(summary.currentStreak)} unit="days" /><MetricCard label="Longest streak" value={String(summary.longestStreak)} unit="days" /><MetricCard label="Training days" value={String(summary.trainingDayCount)} /><MetricCard label="This week" value={`${stats.workoutsThisWeek}/${profile?.weeklyTarget ?? "—"}`} /></View>
      <Text style={styles.section}>LAST 28 DAYS</Text>
      <GlassCard style={styles.calendar}>{recentDates.map((date) => <View key={date} style={styles.day}><View style={[styles.dot, trainingDates.has(date) && styles.activeDot]} /><Text style={styles.dayLabel}>{date.slice(8)}</Text></View>)}</GlassCard>
      <GlassCard style={styles.note}><Text style={styles.noteTitle}>How this is counted</Text><Text style={styles.noteText}>A training day counts when a completed workout has at least three working sets. Abandoned and unfinished sessions are kept separate.</Text></GlassCard>
    </>}</KineticScreen>;
}

const styles = StyleSheet.create({
  loading: { alignItems: "center", paddingVertical: 80 },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm, marginBottom: theme.spacing.xl },
  section: { marginBottom: theme.spacing.sm, color: theme.colors.textMuted, fontSize: 11, fontWeight: "800", letterSpacing: 1.1 },
  calendar: { flexDirection: "row", flexWrap: "wrap", gap: 14, marginBottom: theme.spacing.lg },
  day: { width: 25, alignItems: "center", gap: 4 },
  dot: { width: 15, height: 15, borderRadius: theme.radii.full, backgroundColor: theme.colors.surfaceHighest },
  activeDot: { backgroundColor: theme.colors.accent },
  dayLabel: { color: theme.colors.textSubtle, fontSize: 9 },
  note: { borderColor: theme.colors.borderActive },
  noteTitle: { color: theme.colors.accent, fontSize: 14, fontWeight: "800" },
  noteText: { marginTop: theme.spacing.sm, color: theme.colors.textMuted, fontSize: 13, lineHeight: 19 },
});
