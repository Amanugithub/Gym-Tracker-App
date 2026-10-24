import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";

import { GlassCard, KineticScreen, ScreenHeader } from "@/src/components/kinetic-ui";
import { recordRows, type RecordRow } from "@/src/domain/progress-modules";
import { formatWeight } from "@/src/domain/units";
import type { Unit, Workout } from "@/src/db/types";
import { ProfileRepository } from "@/src/repositories/profile-repository";
import { WorkoutRepository } from "@/src/repositories/workout-repository";
import { theme } from "@/src/theme";

export default function RecordsProgressScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [unit, setUnit] = useState<Unit>("kg");
  const [loading, setLoading] = useState(true);
  useFocusEffect(useCallback(() => {
    let mounted = true;
    async function load() {
      const [profile, loaded] = await Promise.all([new ProfileRepository(db).getProfile(), new WorkoutRepository(db).listCompletedWorkouts(200)]);
      if (!mounted) return;
      setUnit(profile?.unit ?? "kg"); setWorkouts(loaded); setLoading(false);
    }
    void load(); return () => { mounted = false; };
  }, [db]));
  const rows = useMemo<RecordRow[]>(() => recordRows(workouts), [workouts]);
  return <KineticScreen><ScreenHeader eyebrow="RECORDS" title="Your milestones" subtitle="Every record below is tied to a real completed set." />
    {loading ? <View style={styles.loading}><ActivityIndicator color={theme.colors.accent} /></View> : rows.length === 0 ? <Text style={styles.muted}>No personal records yet. Keep logging completed working sets.</Text> : rows.map((row) => <Pressable key={row.setId} onPress={() => router.push({ pathname: "/subscriptions/[id]", params: { id: row.workoutId } })}><GlassCard style={styles.card}><View style={styles.head}><View style={styles.main}><Text style={styles.name}>{row.exerciseName}</Text><Text style={styles.date}>{row.localDate}</Text></View><Text style={styles.set}>{formatWeight(row.weightKg, unit)} {unit} × {row.reps}</Text></View><View style={styles.badges}>{row.types.map((type) => <Text key={type} style={styles.badge}>{type === "e1rm" ? "Estimated 1RM PR" : `${type === "weight" ? "Weight" : "Reps"} PR`}</Text>)}</View></GlassCard></Pressable>)}</KineticScreen>;
}

const styles = StyleSheet.create({
  loading: { alignItems: "center", paddingVertical: 80 },
  card: { marginBottom: theme.spacing.sm },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: theme.spacing.md },
  main: { flex: 1 },
  name: { color: theme.colors.text, fontSize: 15, fontWeight: "700" },
  date: { marginTop: 4, color: theme.colors.textSubtle, fontSize: 11 },
  set: { color: theme.colors.accent, fontSize: 14, fontWeight: "800" },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: theme.spacing.md },
  badge: { paddingHorizontal: 7, paddingVertical: 4, borderRadius: theme.radii.sm, color: theme.colors.accentText, backgroundColor: theme.colors.accent, fontSize: 10, fontWeight: "800" },
  muted: { color: theme.colors.textMuted, fontSize: 14 },
});
