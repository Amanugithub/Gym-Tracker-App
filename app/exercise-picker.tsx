import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";

import type { Exercise } from "@/src/db/types";
import { ExerciseRepository } from "@/src/repositories/exercise-repository";
import { ProfileRepository } from "@/src/repositories/profile-repository";
import { WorkoutRepository } from "@/src/repositories/workout-repository";

export default function ExercisePickerScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { workoutId } = useLocalSearchParams<{ workoutId?: string }>();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [existingIds, setExistingIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        if (!workoutId) {
          router.replace("/subscriptions");
          return;
        }
        const loadedProfile = await new ProfileRepository(db).getProfile();
        if (!mounted) return;
        if (!loadedProfile) {
          router.replace("/onboarding");
          return;
        }
        const workout = await new WorkoutRepository(db).getWorkout(workoutId);
        if (!workout || workout.status !== "active") {
          router.replace("/subscriptions");
          return;
        }
        const loadedExercises = await new ExerciseRepository(db).listActiveExercises(
          loadedProfile.language,
        );
        if (!mounted) return;
        const alreadySelected = new Set(
          workout.exercises.map((exercise) => exercise.exerciseId),
        );
        setExistingIds(alreadySelected);
        setSelectedIds(alreadySelected);
        setExercises(loadedExercises);
      } catch {
        if (mounted) setError("Could not load the exercise library.");
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, [db, router, workoutId]);

  const filteredExercises = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return exercises;
    return exercises.filter((exercise) =>
      exercise.name.toLowerCase().includes(query),
    );
  }, [exercises, search]);

  function toggleExercise(id: string) {
    if (existingIds.has(id)) return;
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function addSelectedExercises() {
    const newExerciseIds = exercises
      .filter((exercise) => selectedIds.has(exercise.id) && !existingIds.has(exercise.id))
      .map((exercise) => exercise.id);
    if (!workoutId || newExerciseIds.length === 0) return;

    setError(null);
    setIsStarting(true);
    try {
      await new WorkoutRepository(db).addExercisesToWorkout(
        workoutId,
        newExerciseIds,
      );
      router.back();
    } catch {
      setError("Could not start the workout. Please try again.");
    } finally {
      setIsStarting(false);
    }
  }

  if (isLoading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color="#ea7a53" />
        <Text style={styles.mutedText}>Loading exercises...</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Add exercises</Text>
        <View style={styles.headerSpacer} />
      </View>

      <Text style={styles.subtitle}>
        Add exercises whenever you decide what to train.
      </Text>

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search exercises"
        placeholderTextColor="#8b8d96"
        style={styles.searchInput}
        autoCapitalize="none"
      />

      <ScrollView contentContainerStyle={styles.list}>
        {filteredExercises.map((exercise) => {
          const selected = selectedIds.has(exercise.id);
          const alreadyAdded = existingIds.has(exercise.id);
          return (
            <Pressable
              key={exercise.id}
              onPress={() => toggleExercise(exercise.id)}
              style={[
                styles.exerciseRow,
                selected && styles.exerciseSelected,
                alreadyAdded && styles.exerciseAlreadyAdded,
              ]}
            >
              <View style={styles.exerciseCopy}>
                <Text style={styles.exerciseName}>{exercise.name}</Text>
                <Text style={styles.exerciseMeta}>
                  {alreadyAdded
                    ? "Already in this workout"
                    : `${exercise.equipment} · ${exercise.kind}`}
                </Text>
              </View>
              <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                {selected ? <Text style={styles.checkmark}>✓</Text> : null}
              </View>
            </Pressable>
          );
        })}
        {filteredExercises.length === 0 ? (
          <Text style={styles.mutedText}>No exercises match your search.</Text>
        ) : null}
      </ScrollView>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        onPress={addSelectedExercises}
        disabled={selectedIds.size <= existingIds.size || isStarting}
        style={({ pressed }) => [
          styles.startButton,
          pressed && styles.pressed,
          (selectedIds.size <= existingIds.size || isStarting) && styles.disabled,
        ]}
      >
        {isStarting ? (
          <ActivityIndicator color="#fff9e3" />
        ) : (
          <Text style={styles.startButtonText}>
            Add selected exercises
          </Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    padding: 24,
    paddingTop: 56,
    backgroundColor: "#fff9e3",
  },
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "#fff9e3",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backText: {
    width: 64,
    color: "#ea7a53",
    fontSize: 16,
    fontWeight: "800",
  },
  headerTitle: {
    color: "#081126",
    fontSize: 20,
    fontWeight: "800",
  },
  headerSpacer: {
    width: 64,
  },
  subtitle: {
    marginTop: 18,
    color: "rgba(0, 0, 0, 0.6)",
    fontSize: 15,
  },
  searchInput: {
    minHeight: 50,
    marginTop: 18,
    borderWidth: 1,
    borderColor: "rgba(8, 17, 38, 0.15)",
    borderRadius: 14,
    paddingHorizontal: 16,
    color: "#081126",
    backgroundColor: "#fff8e7",
    fontSize: 16,
  },
  list: {
    gap: 10,
    paddingVertical: 18,
    paddingBottom: 24,
  },
  exerciseRow: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "rgba(8, 17, 38, 0.12)",
    borderRadius: 16,
    backgroundColor: "#fff8e7",
  },
  exerciseSelected: {
    borderColor: "#ea7a53",
    backgroundColor: "#fff0e8",
  },
  exerciseAlreadyAdded: {
    opacity: 0.72,
  },
  exerciseCopy: {
    flex: 1,
    paddingRight: 12,
  },
  exerciseName: {
    color: "#081126",
    fontSize: 16,
    fontWeight: "700",
  },
  exerciseMeta: {
    marginTop: 4,
    color: "rgba(0, 0, 0, 0.5)",
    fontSize: 12,
    textTransform: "capitalize",
  },
  checkbox: {
    width: 26,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(8, 17, 38, 0.22)",
    borderRadius: 8,
  },
  checkboxSelected: {
    borderColor: "#ea7a53",
    backgroundColor: "#ea7a53",
  },
  checkmark: {
    color: "#fff9e3",
    fontSize: 17,
    fontWeight: "800",
  },
  startButton: {
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: "#081126",
  },
  startButtonText: {
    color: "#fff9e3",
    fontSize: 16,
    fontWeight: "800",
  },
  mutedText: {
    color: "rgba(0, 0, 0, 0.55)",
    fontSize: 14,
  },
  error: {
    marginBottom: 12,
    color: "#dc2626",
    fontSize: 14,
  },
  pressed: {
    opacity: 0.82,
  },
  disabled: {
    opacity: 0.45,
  },
});
