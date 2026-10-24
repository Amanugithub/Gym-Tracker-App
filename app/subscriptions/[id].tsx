import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";

import { GlassCard, KineticScreen, ScreenHeader, SecondaryButton, SectionLabel } from "@/src/components/kinetic-ui";
import { calculatePersonalRecords, type PRType } from "@/src/domain/prs";
import { summarizeWorkout } from "@/src/domain/progress";
import { formatWeight } from "@/src/domain/units";
import type { Unit, Workout } from "@/src/db/types";
import { ProfileRepository } from "@/src/repositories/profile-repository";
import { WorkoutRepository } from "@/src/repositories/workout-repository";
import { theme } from "@/src/theme";

function formatDate(localDate: string): string {
  const [year, month, day] = localDate.split("-");
  return `${day}/${month}/${year}`;
}

const recordLabels: Record<PRType, string> = { weight: "Weight PR", reps: "Reps PR", e1rm: "e1RM PR" };

export default function WorkoutDetailsScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [history, setHistory] = useState<Workout[]>([]);
  const [unit, setUnit] = useState<Unit>("kg");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!id) { setIsLoading(false); return; }
      try {
        const [loaded, profile, completed] = await Promise.all([
          new WorkoutRepository(db).getWorkout(id),
          new ProfileRepository(db).getProfile(),
          new WorkoutRepository(db).listCompletedWorkouts(200),
        ]);
        if (!mounted) return;
        setWorkout(loaded);
        setUnit(profile?.unit ?? "kg");
        setHistory(completed);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    void load();
    return () => { mounted = false; };
  }, [db, id]);

  const recordMap = useMemo(() => {
    const map = new Map<string, PRType[]>();
    for (const record of calculatePersonalRecords(history)) map.set(record.setId, record.types);
    return map;
  }, [history]);

  if (isLoading) return <KineticScreen scroll={false} contentContainerStyle={styles.centered}><ActivityIndicator color={theme.colors.accent} /></KineticScreen>;
  if (!workout) return <KineticScreen scroll={false} contentContainerStyle={styles.centered}><Text style={styles.error}>Workout not found.</Text><SecondaryButton label="Go back" onPress={() => router.back()} /></KineticScreen>;

  const summary = summarizeWorkout(workout);
  const statusText = workout.status === "completed" ? "COMPLETED" : "ABANDONED";
  return (
    <KineticScreen contentContainerStyle={styles.content}>
      <Pressable onPress={() => router.back()} hitSlop={12}><Text style={styles.backText}>‹ Back</Text></Pressable>
      <ScreenHeader eyebrow={statusText} title={formatDate(workout.localDate)} subtitle={`${summary.exerciseCount} exercises · ${summary.setCount} sets · ${formatWeight(summary.volumeKg, unit)} ${unit} working volume`} />
      {workout.note ? <GlassCard style={styles.note}><Text style={styles.noteLabel}>SESSION NOTE</Text><Text style={styles.noteText}>{workout.note}</Text></GlassCard> : null}
      <GlassCard active={workout.status === "completed"} style={styles.locked}><Text style={styles.lockedTitle}>Performance record locked</Text><Text style={styles.lockedText}>Finished sessions are kept as logged. New records are calculated from completed workouts only.</Text></GlassCard>
      <SectionLabel trailing={`${summary.workingSetCount} working`}>EXERCISES</SectionLabel>
      {workout.exercises.map((exercise) => {
        const sets = workout.sets.filter((set) => set.exerciseId === exercise.exerciseId);
        return <GlassCard key={exercise.exerciseId} style={styles.exerciseCard}>
          <Text style={styles.exerciseName}>{exercise.name}</Text>
          {sets.length === 0 ? <Text style={styles.muted}>No sets recorded.</Text> : sets.map((set, index) => {
            const types = workout.status === "completed" ? recordMap.get(set.id) ?? [] : [];
            return <View key={set.id} style={styles.setRow}>
              <Text style={styles.setNumber}>{String(index + 1).padStart(2, "0")}</Text>
              <View style={styles.setMain}><Text style={styles.setValue}>{formatWeight(set.weightKg, unit)} {unit} × {set.reps}</Text><Text style={styles.setMeta}>{set.setType === "working" ? "Working set" : "Warm-up"}</Text></View>
              <View style={styles.badges}>{types.map((type) => <Text key={type} style={styles.badge}>{recordLabels[type]}</Text>)}</View>
            </View>;
          })}
        </GlassCard>;
      })}
    </KineticScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 48 },
  centered: { alignItems: "center", justifyContent: "center", gap: theme.spacing.md },
  backText: { marginBottom: theme.spacing.lg, color: theme.colors.accent, fontSize: 15, fontWeight: "800" },
  note: { marginBottom: theme.spacing.md },
  noteLabel: { color: theme.colors.textSubtle, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  noteText: { marginTop: theme.spacing.sm, color: theme.colors.text, fontSize: 14, lineHeight: 21 },
  locked: { marginBottom: theme.spacing.xl },
  lockedTitle: { color: theme.colors.accent, fontSize: 15, fontWeight: "800" },
  lockedText: { marginTop: theme.spacing.xs, color: theme.colors.textMuted, fontSize: 13, lineHeight: 19 },
  exerciseCard: { marginBottom: theme.spacing.md },
  exerciseName: { marginBottom: theme.spacing.sm, color: theme.colors.text, fontSize: 17, fontWeight: "700" },
  setRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, minHeight: 52, paddingVertical: theme.spacing.sm, borderTopWidth: 1, borderTopColor: theme.colors.border },
  setNumber: { width: 28, color: theme.colors.accent, fontSize: 12, fontWeight: "800" },
  setMain: { flex: 1 },
  setValue: { color: theme.colors.text, fontSize: 14, fontWeight: "700" },
  setMeta: { marginTop: 3, color: theme.colors.textSubtle, fontSize: 11 },
  badges: { alignItems: "flex-end", gap: 3 },
  badge: { color: theme.colors.accentText, paddingHorizontal: 5, paddingVertical: 3, borderRadius: theme.radii.sm, backgroundColor: theme.colors.accent, fontSize: 9, fontWeight: "800" },
  muted: { color: theme.colors.textMuted, fontSize: 13 },
  error: { color: theme.colors.danger, fontSize: 14 },
});
