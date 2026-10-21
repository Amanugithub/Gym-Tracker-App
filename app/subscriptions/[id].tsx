import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";

import { summarizeWorkout } from "@/src/domain/progress";
import { formatWeight } from "@/src/domain/units";
import type { Unit, Workout } from "@/src/db/types";
import { ProfileRepository } from "@/src/repositories/profile-repository";
import { WorkoutRepository } from "@/src/repositories/workout-repository";

function formatDate(localDate: string): string {
  const [year, month, day] = localDate.split("-");
  return `${day}/${month}/${year}`;
}

export default function WorkoutDetailsScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [unit, setUnit] = useState<Unit>("kg");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadWorkout() {
      if (!id) {
        setIsLoading(false);
        return;
      }

      const [loaded, profile] = await Promise.all([
        new WorkoutRepository(db).getWorkout(id),
        new ProfileRepository(db).getProfile(),
      ]);
      if (mounted) {
        setWorkout(loaded);
        setUnit(profile?.unit ?? "kg");
        setIsLoading(false);
      }
    }

    void loadWorkout();
    return () => {
      mounted = false;
    };
  }, [db, id]);

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#ea7a53" />
      </View>
    );
  }

  if (!workout) {
    return (
      <View style={styles.centered}>
        <Text style={styles.error}>Workout not found.</Text>
        <Pressable onPress={() => router.back()} style={styles.button}>
          <Text style={styles.buttonText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const summary = summarizeWorkout(workout);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Pressable onPress={() => router.back()} hitSlop={12}>
        <Text style={styles.backText}>‹ Back</Text>
      </Pressable>

      <Text style={styles.eyebrow}>WORKOUT</Text>
      <Text style={styles.title}>{formatDate(workout.localDate)}</Text>
      <Text style={styles.subtitle}>
        {workout.status === "abandoned" ? "Abandoned · " : "Completed · "}
        {summary.exerciseCount} exercises · {summary.setCount} sets · {formatWeight(summary.volumeKg, unit)} {unit} volume
      </Text>
      {workout.note ? <Text style={styles.note}>{workout.note}</Text> : null}

      <Text style={styles.lockedMessage}>
        This workout is finished. Its performance records cannot be changed.
      </Text>

      {workout.exercises.map((exercise) => {
        const sets = workout.sets.filter(
          (set) => set.exerciseId === exercise.exerciseId,
        );
        return (
          <View key={exercise.exerciseId} style={styles.exerciseCard}>
            <Text style={styles.exerciseName}>{exercise.name}</Text>
            {sets.length === 0 ? (
              <Text style={styles.muted}>No sets recorded.</Text>
            ) : (
              sets.map((set, index) => (
                <View key={set.id} style={styles.setRow}>
                  <Text style={styles.setNumber}>{index + 1}</Text>
                  <Text style={styles.setText}>
                    {set.setType === "warmup" ? "Warm-up" : "Working"} · {formatWeight(set.weightKg, unit)} {unit} × {set.reps} reps
                  </Text>
                </View>
              ))
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#fff9e3",
  },
  content: {
    padding: 24,
    paddingTop: 36,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    backgroundColor: "#fff9e3",
  },
  backText: {
    color: "#ea7a53",
    fontSize: 16,
    fontWeight: "800",
  },
  eyebrow: {
    marginTop: 28,
    color: "#ea7a53",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 2,
  },
  title: {
    marginTop: 10,
    color: "#081126",
    fontSize: 30,
    fontWeight: "800",
  },
  subtitle: {
    marginTop: 10,
    color: "rgba(0, 0, 0, 0.6)",
    fontSize: 15,
    lineHeight: 22,
  },
  note: {
    marginTop: 14,
    padding: 14,
    borderRadius: 12,
    color: "#081126",
    backgroundColor: "#fff8e7",
    fontSize: 14,
    lineHeight: 20,
  },
  lockedMessage: {
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    color: "rgba(0, 0, 0, 0.58)",
    backgroundColor: "#fff8e7",
    fontSize: 13,
    lineHeight: 19,
  },
  editCard: {
    marginTop: 16,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#fff8e7",
  },
  editTitle: {
    color: "#081126",
    fontSize: 15,
    fontWeight: "800",
  },
  editInputs: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  editInput: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(8, 17, 38, 0.15)",
    borderRadius: 10,
    color: "#081126",
    backgroundColor: "#fffdf5",
  },
  editActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 10,
  },
  cancelButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  cancelText: {
    color: "#ea7a53",
    fontWeight: "800",
  },
  saveButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#081126",
  },
  saveText: {
    color: "#fff9e3",
    fontWeight: "800",
  },
  exerciseCard: {
    marginTop: 18,
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#fff8e7",
  },
  exerciseName: {
    marginBottom: 10,
    color: "#081126",
    fontSize: 17,
    fontWeight: "800",
  },
  setRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 7,
    borderTopWidth: 1,
    borderTopColor: "rgba(8, 17, 38, 0.08)",
  },
  setNumber: {
    width: 28,
    color: "#ea7a53",
    fontWeight: "800",
  },
  setText: {
    flex: 1,
    color: "#081126",
    fontSize: 14,
  },
  setActions: {
    flexDirection: "row",
    gap: 8,
  },
  editText: {
    color: "#081126",
    fontSize: 12,
    fontWeight: "800",
  },
  deleteText: {
    color: "#dc2626",
    fontSize: 12,
    fontWeight: "800",
  },
  muted: {
    color: "rgba(0, 0, 0, 0.6)",
  },
  error: {
    color: "#b42318",
  },
  button: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#081126",
  },
  buttonText: {
    color: "#fff9e3",
    fontWeight: "800",
  },
});
