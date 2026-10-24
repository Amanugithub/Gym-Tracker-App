import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";

import { GlassCard, KineticScreen, ScreenHeader } from "@/src/components/kinetic-ui";
import { calculateProgressStats, type ProgressStats } from "@/src/domain/progress";
import { formatWeight } from "@/src/domain/units";
import type { Unit } from "@/src/db/types";
import { ProfileRepository } from "@/src/repositories/profile-repository";
import { WorkoutRepository } from "@/src/repositories/workout-repository";
import { theme } from "@/src/theme";

const EMPTY = calculateProgressStats([]);

export default function StrengthProgressScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [stats, setStats] = useState<ProgressStats>(EMPTY);
  const [unit, setUnit] = useState<Unit>("kg");
  const [loading, setLoading] = useState(true);
  useFocusEffect(useCallback(() => {
    let mounted = true;
    async function load() {
      const [profile, workouts] = await Promise.all([new ProfileRepository(db).getProfile(), new WorkoutRepository(db).listCompletedWorkouts(200)]);
      if (!mounted) return;
      setUnit(profile?.unit ?? "kg"); setStats(calculateProgressStats(workouts)); setLoading(false);
    }
    void load(); return () => { mounted = false; };
  }, [db]));
  return <KineticScreen><ScreenHeader eyebrow="STRENGTH" title="Load is only one signal" subtitle="Compare heaviest working sets and estimated one-rep max from your actual logs." />
    {loading ? <View style={styles.loading}><ActivityIndicator color={theme.colors.accent} /></View> : stats.exercises.length === 0 ? <Text style={styles.muted}>Complete a working set to see strength progress.</Text> : stats.exercises.map((exercise) => <Pressable key={exercise.exerciseId} onPress={() => router.push({ pathname: "/progress/exercise/[exerciseId]", params: { exerciseId: exercise.exerciseId } } as never)}><GlassCard style={styles.card}><View style={styles.head}><Text style={styles.name}>{exercise.name}</Text><Text style={styles.sessions}>{exercise.sessionCount} sessions</Text></View><View style={styles.values}><View><Text style={styles.label}>BEST LOAD</Text><Text style={styles.value}>{formatWeight(exercise.heaviestWeightKg, unit)} {unit} × {exercise.heaviestReps}</Text></View><View><Text style={styles.label}>ESTIMATED 1RM</Text><Text style={styles.value}>{exercise.bestE1rmKg === null ? "—" : `${formatWeight(exercise.bestE1rmKg, unit)} ${unit}`}</Text></View></View></GlassCard></Pressable>)}</KineticScreen>;
}

const styles = StyleSheet.create({
  loading: { alignItems: "center", paddingVertical: 80 },
  card: { marginBottom: theme.spacing.sm },
  head: { flexDirection: "row", justifyContent: "space-between", gap: theme.spacing.md },
  name: { flex: 1, color: theme.colors.text, fontSize: 16, fontWeight: "700" },
  sessions: { color: theme.colors.textSubtle, fontSize: 11 },
  values: { flexDirection: "row", gap: theme.spacing.lg, marginTop: theme.spacing.lg },
  label: { color: theme.colors.textSubtle, fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  value: { marginTop: theme.spacing.xs, color: theme.colors.accent, fontSize: 15, fontWeight: "800" },
  muted: { color: theme.colors.textMuted, fontSize: 14 },
});
