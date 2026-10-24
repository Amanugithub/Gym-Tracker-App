import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";

import { KineticScreen, ScreenHeader } from "@/src/components/kinetic-ui";
import { calculateProgressStats, type ProgressStats } from "@/src/domain/progress";
import { formatWeight } from "@/src/domain/units";
import type { Unit } from "@/src/db/types";
import { ProfileRepository } from "@/src/repositories/profile-repository";
import { WorkoutRepository } from "@/src/repositories/workout-repository";
import { theme } from "@/src/theme";

const EMPTY = calculateProgressStats([]);

export default function ExerciseProgressScreen() {
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
      setUnit(profile?.unit ?? "kg");
      setStats(calculateProgressStats(workouts));
      setLoading(false);
    }
    void load();
    return () => { mounted = false; };
  }, [db]));
  return <KineticScreen><ScreenHeader eyebrow="EXERCISE PROGRESS" title="Every lift has a history" subtitle="Select an exercise to see its sessions, best sets, and records." />
    {loading ? <View style={styles.loading}><ActivityIndicator color={theme.colors.accent} /></View> : stats.exercises.length === 0 ? <Text style={styles.muted}>Complete a workout to start building exercise history.</Text> : stats.exercises.map((exercise) => <Pressable key={exercise.exerciseId} onPress={() => router.push({ pathname: "/progress/exercise/[exerciseId]", params: { exerciseId: exercise.exerciseId } } as never)} style={({ pressed }) => [styles.row, pressed && styles.pressed]}><View style={styles.main}><Text style={styles.name}>{exercise.name}</Text><Text style={styles.meta}>{exercise.sessionCount} sessions · {exercise.setCount} sets · {exercise.prCount} records</Text></View><View style={styles.best}><Text style={styles.bestValue}>{formatWeight(exercise.heaviestWeightKg, unit)} {unit}</Text><Text style={styles.meta}>best load</Text></View></Pressable>)}</KineticScreen>;
}

const styles = StyleSheet.create({
  loading: { alignItems: "center", paddingVertical: 80 },
  row: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md, marginBottom: theme.spacing.sm, padding: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radii.lg, backgroundColor: theme.colors.surface },
  main: { flex: 1 },
  name: { color: theme.colors.text, fontSize: 16, fontWeight: "700" },
  meta: { marginTop: theme.spacing.xs, color: theme.colors.textSubtle, fontSize: 12 },
  best: { alignItems: "flex-end" },
  bestValue: { color: theme.colors.accent, fontSize: 14, fontWeight: "800" },
  muted: { color: theme.colors.textMuted, fontSize: 14, lineHeight: 21 },
  pressed: { opacity: 0.8 },
});
