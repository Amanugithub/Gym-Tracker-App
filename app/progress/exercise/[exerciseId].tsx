import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";

import { GlassCard, KineticScreen, ScreenHeader } from "@/src/components/kinetic-ui";
import { e1rm } from "@/src/domain/prs";
import { exerciseSessions, recordRows, type ExerciseSession, type RecordRow } from "@/src/domain/progress-modules";
import { formatWeight } from "@/src/domain/units";
import type { Unit, Workout } from "@/src/db/types";
import { ProfileRepository } from "@/src/repositories/profile-repository";
import { WorkoutRepository } from "@/src/repositories/workout-repository";
import { theme } from "@/src/theme";

export default function ExerciseDetailScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { exerciseId } = useLocalSearchParams<{ exerciseId?: string }>();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [unit, setUnit] = useState<Unit>("kg");
  const [name, setName] = useState(exerciseId ?? "Exercise");
  const [loading, setLoading] = useState(true);
  useFocusEffect(useCallback(() => {
    let mounted = true;
    async function load() {
      const [profile, loaded] = await Promise.all([new ProfileRepository(db).getProfile(), new WorkoutRepository(db).listCompletedWorkouts(200)]);
      if (!mounted) return;
      const exercise = loaded.flatMap((workout) => workout.exercises).find((candidate) => candidate.exerciseId === exerciseId);
      setUnit(profile?.unit ?? "kg");
      setName(exercise?.name ?? exerciseId ?? "Exercise");
      setWorkouts(loaded);
      setLoading(false);
    }
    void load();
    return () => { mounted = false; };
  }, [db, exerciseId]));

  const sessions = useMemo<ExerciseSession[]>(() => exerciseId ? exerciseSessions(workouts, exerciseId) : [], [exerciseId, workouts]);
  const records = useMemo<RecordRow[]>(() => exerciseId ? recordRows(workouts).filter((row) => row.exerciseId === exerciseId) : [], [exerciseId, workouts]);
  const bestWeight = Math.max(0, ...sessions.flatMap((session) => session.sets.filter((set) => set.setType === "working").map((set) => set.weightKg)));
  const bestE1rm = Math.max(0, ...sessions.flatMap((session) => session.sets.filter((set) => set.setType === "working").map((set) => e1rm(set.weightKg, set.reps) ?? 0)));

  if (loading) return <KineticScreen scroll={false} contentContainerStyle={styles.centered}><ActivityIndicator color={theme.colors.accent} /></KineticScreen>;
  return <KineticScreen>
    <Pressable onPress={() => router.back()} hitSlop={12}><Text style={styles.back}>‹ Exercise progress</Text></Pressable>
    <ScreenHeader eyebrow="EXERCISE DETAIL" title={name} subtitle={`${sessions.length} completed sessions`} />
    <View style={styles.metrics}><Metric label="Best load" value={`${formatWeight(bestWeight, unit)} ${unit}`} /><Metric label="Best e1RM" value={bestE1rm > 0 ? `${formatWeight(bestE1rm, unit)} ${unit}` : "—"} /></View>
    <Text style={styles.section}>SESSION HISTORY</Text>
    {sessions.length === 0 ? <Text style={styles.muted}>No completed sessions for this exercise.</Text> : sessions.map((session) => <GlassCard key={session.workoutId} style={styles.session}><View style={styles.sessionHead}><Text style={styles.date}>{session.localDate}</Text><Text style={styles.volume}>{formatWeight(session.volumeKg, unit)} {unit} volume</Text></View>{session.sets.map((set) => <View key={set.id} style={styles.set}><Text style={styles.setValue}>{formatWeight(set.weightKg, unit)} {unit} × {set.reps}</Text><Text style={styles.setType}>{set.setType === "working" ? "Working" : "Warm-up"}</Text></View>)}</GlassCard>)}
    <Text style={styles.section}>RECORDS FROM THIS EXERCISE</Text>
    {records.length === 0 ? <Text style={styles.muted}>No records have been detected yet.</Text> : records.slice(0, 12).map((record) => <View key={record.setId} style={styles.record}><View style={styles.recordMain}><Text style={styles.recordDate}>{record.localDate}</Text><Text style={styles.setValue}>{formatWeight(record.weightKg, unit)} {unit} × {record.reps}</Text></View><View style={styles.badges}>{record.types.map((type) => <Text key={type} style={styles.badge}>{type === "e1rm" ? "e1RM" : type}</Text>)}</View></View>)}
  </KineticScreen>;
}

function Metric({ label, value }: { label: string; value: string }) { return <GlassCard style={styles.metric}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{value}</Text></GlassCard>; }

const styles = StyleSheet.create({
  centered: { alignItems: "center", justifyContent: "center" },
  back: { marginBottom: theme.spacing.lg, color: theme.colors.accent, fontSize: 14, fontWeight: "800" },
  metrics: { flexDirection: "row", gap: theme.spacing.sm, marginBottom: theme.spacing.xl },
  metric: { flex: 1 },
  metricLabel: { color: theme.colors.textSubtle, fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  metricValue: { marginTop: theme.spacing.sm, color: theme.colors.text, fontSize: 19, fontWeight: "700" },
  section: { marginBottom: theme.spacing.sm, color: theme.colors.textMuted, fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
  session: { marginBottom: theme.spacing.sm },
  sessionHead: { flexDirection: "row", justifyContent: "space-between", marginBottom: theme.spacing.sm },
  date: { color: theme.colors.text, fontSize: 14, fontWeight: "700" },
  volume: { color: theme.colors.textSubtle, fontSize: 12 },
  set: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 7, borderTopWidth: 1, borderTopColor: theme.colors.border },
  setValue: { color: theme.colors.text, fontSize: 13, fontWeight: "700" },
  setType: { color: theme.colors.textSubtle, fontSize: 12 },
  record: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: theme.spacing.sm, padding: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radii.lg, backgroundColor: theme.colors.surface },
  recordMain: { gap: 4 },
  recordDate: { color: theme.colors.textSubtle, fontSize: 11 },
  badges: { flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-end", gap: 4, maxWidth: 125 },
  badge: { color: theme.colors.accentText, paddingHorizontal: 5, paddingVertical: 3, borderRadius: theme.radii.sm, backgroundColor: theme.colors.accent, fontSize: 9, fontWeight: "800" },
  muted: { color: theme.colors.textMuted, fontSize: 13, lineHeight: 20 },
});
