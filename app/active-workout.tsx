import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { randomUUID } from "expo-crypto";
import { useSQLiteContext } from "expo-sqlite";

import { localDateForTimezone } from "@/src/domain/time";
import type { SetType, Unit, Workout } from "@/src/db/types";
import { formatWeight, weightToKg } from "@/src/domain/units";
import { ProfileRepository } from "@/src/repositories/profile-repository";
import { WorkoutRepository } from "@/src/repositories/workout-repository";
import { syncNow } from "@/src/sync/sync-service";

export default function ActiveWorkoutScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { workoutId } = useLocalSearchParams<{ workoutId?: string }>();
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [currentExerciseId, setCurrentExerciseId] = useState<string | null>(null);
  const [unit, setUnit] = useState<Unit>("kg");
  const [note, setNote] = useState("");
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [weight, setWeight] = useState("20");
  const [reps, setReps] = useState("8");
  const [setType, setSetType] = useState<SetType>("working");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
    let mounted = true;

    async function loadWorkout() {
      if (!workoutId) {
        router.replace("/subscriptions");
        return;
      }

      try {
        setIsLoading(true);
        const [loaded, profile] = await Promise.all([
          new WorkoutRepository(db).getWorkout(workoutId),
          new ProfileRepository(db).getProfile(),
        ]);
        if (!mounted) return;
        if (!loaded || loaded.status !== "active") {
          setError("This workout is no longer active.");
          return;
        }
        setWorkout(loaded);
        setUnit(profile?.unit ?? "kg");
        setNote(loaded.note ?? "");
        setCurrentExerciseId((current) => current ?? loaded.exercises[0]?.exerciseId ?? null);
      } catch {
        if (mounted) setError("Could not load this workout.");
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    void loadWorkout();
    return () => {
      mounted = false;
    };
    }, [db, router, workoutId]),
  );

  const currentExercise = useMemo(
    () => workout?.exercises.find((exercise) => exercise.exerciseId === currentExerciseId) ?? null,
    [currentExerciseId, workout],
  );

  const currentSets = useMemo(
    () => workout?.sets.filter((set) => set.exerciseId === currentExerciseId) ?? [],
    [currentExerciseId, workout],
  );

  async function reloadWorkout() {
    if (!workoutId) return;
    const loaded = await new WorkoutRepository(db).getWorkout(workoutId);
    if (loaded) setWorkout(loaded);
  }

  async function addSet() {
    if (!workout || !currentExercise) return;

    const parsedDisplayWeight = Number(weight);
    const parsedReps = Number(reps);
    const parsedWeightKg = weightToKg(parsedDisplayWeight, unit);

    if (
      !Number.isFinite(parsedWeightKg) ||
      parsedWeightKg < 0 ||
      (currentExercise.kind !== "bodyweight" && parsedWeightKg === 0)
    ) {
      setError(
        currentExercise.kind === "bodyweight"
          ? "Added weight cannot be negative."
          : `Weight must be greater than zero ${unit === "kg" ? "in kg" : "in lb"}.`,
      );
      return;
    }
    if (!Number.isInteger(parsedReps) || parsedReps < 1) {
      setError("Reps must be a whole number greater than zero.");
      return;
    }

    setError(null);
    setIsSaving(true);
    try {
      const performedAt = new Date().toISOString();
      await new WorkoutRepository(db).addSet({
        id: randomUUID(),
        workoutId: workout.id,
        exerciseId: currentExercise.exerciseId,
        setType,
        weightKg: parsedWeightKg,
        reps: parsedReps,
        rpe: null,
        performedAt,
        timezoneId: workout.timezoneId,
        localDate: localDateForTimezone(performedAt, workout.timezoneId),
      });
      await reloadWorkout();
    } catch {
      setError("Could not save this set.");
    } finally {
      setIsSaving(false);
    }
  }

  function beginEditingSet(set: Workout["sets"][number]) {
    setEditingSetId(set.id);
    setWeight(formatWeight(set.weightKg, unit));
    setReps(String(set.reps));
    setSetType(set.setType);
    setError(null);
  }

  function cancelEditingSet() {
    setEditingSetId(null);
    setWeight("20");
    setReps("8");
    setSetType("working");
  }

  async function updateSet() {
    if (!workout || !currentExercise || !editingSetId) return;

    const existingSet = workout.sets.find((set) => set.id === editingSetId);
    const parsedDisplayWeight = Number(weight);
    const parsedWeightKg = weightToKg(parsedDisplayWeight, unit);
    const parsedReps = Number(reps);
    if (
      !Number.isFinite(parsedWeightKg) ||
      parsedWeightKg < 0 ||
      (currentExercise.kind !== "bodyweight" && parsedWeightKg === 0)
    ) {
      setError("Please enter a valid weight.");
      return;
    }
    if (!Number.isInteger(parsedReps) || parsedReps < 1) {
      setError("Reps must be a whole number greater than zero.");
      return;
    }

    setError(null);
    setIsSaving(true);
    try {
      await new WorkoutRepository(db).updateSet({
        id: editingSetId,
        workoutId: workout.id,
        exerciseId: currentExercise.exerciseId,
        setType,
        weightKg: parsedWeightKg,
        reps: parsedReps,
        rpe: existingSet?.rpe ?? null,
      });
      cancelEditingSet();
      await reloadWorkout();
    } catch {
      setError("Could not update this set.");
    } finally {
      setIsSaving(false);
    }
  }

  function confirmDeleteSet(setId: string) {
    if (!workout) return;
    Alert.alert("Delete set?", "This set will be removed from the workout.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void (async () => {
            setError(null);
            try {
              await new WorkoutRepository(db).deleteSet(workout.id, setId);
              if (editingSetId === setId) cancelEditingSet();
              await reloadWorkout();
            } catch {
              setError("Could not delete this set.");
            }
          })();
        },
      },
    ]);
  }

  async function saveNote() {
    if (!workout) return;
    try {
      await new WorkoutRepository(db).updateWorkoutNote(workout.id, note);
      await reloadWorkout();
    } catch {
      setError("Could not save the workout note.");
    }
  }

  async function finishWorkout() {
    if (!workout) return;
    if (workout.sets.length === 0) {
      setError("Add at least one set before finishing the workout.");
      return;
    }

    try {
      await new WorkoutRepository(db).finishWorkout(workout.id);
      void syncNow(db);
      router.replace("/");
    } catch {
      setError("Could not finish this workout.");
    }
  }

  async function abandonWorkout() {
    if (!workout) return;
    try {
      await new WorkoutRepository(db).abandonWorkout(workout.id);
      void syncNow(db);
      router.replace("/");
    } catch {
      setError("Could not abandon this workout.");
    }
  }

  if (isLoading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color="#ea7a53" />
        <Text style={styles.mutedText}>Loading workout...</Text>
      </View>
    );
  }

  if (!workout) {
    return (
      <View style={styles.loadingScreen}>
        <Text style={styles.error}>{error ?? "Workout not found."}</Text>
        <Pressable onPress={() => router.replace("/")} style={styles.smallButton}>
          <Text style={styles.smallButtonText}>Go home</Text>
        </Pressable>
      </View>
    );
  }

  if (!currentExercise) {
    return (
      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable onPress={abandonWorkout} hitSlop={12}>
            <Text style={styles.cancelText}>Abandon</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Active workout</Text>
          <Pressable onPress={finishWorkout} hitSlop={12}>
            <Text style={styles.finishText}>Finish</Text>
          </Pressable>
        </View>
        <View style={styles.emptyWorkout}>
          <Text style={styles.emptyTitle}>Your workout is empty.</Text>
          <Text style={styles.mutedText}>
            Add exercises as you decide what to train today.
          </Text>
          <Pressable
            onPress={() =>
              router.push({
                pathname: "/exercise-picker",
                params: { workoutId: workout.id },
              })
            }
            style={styles.addExerciseButton}
          >
            <Text style={styles.addButtonText}>＋ Add exercise</Text>
          </Pressable>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.header}>
        <Pressable onPress={abandonWorkout} hitSlop={12}>
          <Text style={styles.cancelText}>Abandon</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Active workout</Text>
        <Pressable onPress={finishWorkout} hitSlop={12}>
          <Text style={styles.finishText}>Finish</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.exerciseTabs}
        >
          {workout.exercises.map((exercise) => {
            const selected = exercise.exerciseId === currentExercise.exerciseId;
            return (
              <Pressable
                key={exercise.exerciseId}
                onPress={() => setCurrentExerciseId(exercise.exerciseId)}
                style={[styles.exerciseTab, selected && styles.exerciseTabSelected]}
              >
                <Text
                  style={[
                    styles.exerciseTabText,
                    selected && styles.exerciseTabTextSelected,
                  ]}
                >
                  {exercise.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Pressable
          onPress={() =>
            router.push({
              pathname: "/exercise-picker",
              params: { workoutId: workout.id },
            })
          }
          style={styles.addExerciseLink}
        >
          <Text style={styles.addExerciseLinkText}>＋ Add another exercise</Text>
        </Pressable>

        <Text style={styles.exerciseTitle}>{currentExercise.name}</Text>
        <Text style={styles.exerciseMeta}>
          {currentExercise.kind === "bodyweight" ? "Added weight" : "Weight"} in {unit}
        </Text>

        <View style={styles.noteBlock}>
          <Text style={styles.label}>Workout note</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="How did this session feel?"
            placeholderTextColor="#8b8d96"
            style={styles.noteInput}
            multiline
          />
          <Pressable onPress={saveNote} style={styles.noteButton}>
            <Text style={styles.noteButtonText}>Save note</Text>
          </Pressable>
        </View>

        <View style={styles.typeRow}>
          {(["working", "warmup"] as const).map((kind) => {
            const selected = kind === setType;
            return (
              <Pressable
                key={kind}
                onPress={() => setSetType(kind)}
                style={[styles.typeButton, selected && styles.typeButtonSelected]}
              >
                <Text style={[styles.typeText, selected && styles.typeTextSelected]}>
                  {kind === "working" ? "Working set" : "Warm-up"}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.inputRow}>
          <View style={styles.inputColumn}>
            <Text style={styles.label}>
              {currentExercise.kind === "bodyweight" ? `Added ${unit}` : `Weight ${unit}`}
            </Text>
            <TextInput
              value={weight}
              onChangeText={setWeight}
              keyboardType="decimal-pad"
              style={styles.input}
              placeholder="20"
              placeholderTextColor="#8b8d96"
            />
          </View>
          <View style={styles.inputColumn}>
            <Text style={styles.label}>Reps</Text>
            <TextInput
              value={reps}
              onChangeText={setReps}
              keyboardType="number-pad"
              style={styles.input}
              placeholder="8"
              placeholderTextColor="#8b8d96"
            />
          </View>
        </View>

        <Pressable
          onPress={editingSetId ? updateSet : addSet}
          disabled={isSaving}
          style={({ pressed }) => [
            styles.addButton,
            pressed && styles.pressed,
            isSaving && styles.disabled,
          ]}
        >
          {isSaving ? (
            <ActivityIndicator color="#fff9e3" />
          ) : (
            <Text style={styles.addButtonText}>
              {editingSetId ? "Save changes" : "＋ Add set"}
            </Text>
          )}
        </Pressable>

        <Text style={styles.sectionTitle}>This workout</Text>
        {currentSets.length === 0 ? (
          <Text style={styles.mutedText}>No sets recorded for this exercise yet.</Text>
        ) : (
          currentSets.map((set, index) => (
            <View key={set.id} style={styles.setRow}>
              <Text style={styles.setNumber}>{index + 1}</Text>
              <Text style={styles.setValue}>{formatWeight(set.weightKg, unit)} {unit}</Text>
              <Text style={styles.setValue}>{set.reps} reps</Text>
              <Text style={styles.setTypeLabel}>
                {set.setType === "working" ? "Working" : "Warm-up"}
              </Text>
              <View style={styles.setActions}>
                <Pressable onPress={() => beginEditingSet(set)} hitSlop={8}>
                  <Text style={styles.editText}>Edit</Text>
                </Pressable>
                <Pressable onPress={() => confirmDeleteSet(set.id)} hitSlop={8}>
                  <Text style={styles.deleteText}>Delete</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}

        {editingSetId ? (
          <Pressable onPress={cancelEditingSet} style={styles.cancelEditButton}>
            <Text style={styles.cancelEditText}>Cancel editing</Text>
          </Pressable>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#fff9e3",
  },
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    padding: 24,
    backgroundColor: "#fff9e3",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 16,
  },
  headerTitle: {
    color: "#081126",
    fontSize: 18,
    fontWeight: "800",
  },
  cancelText: {
    width: 64,
    color: "#dc2626",
    fontSize: 14,
    fontWeight: "700",
  },
  finishText: {
    width: 64,
    color: "#16a34a",
    fontSize: 14,
    fontWeight: "800",
    textAlign: "right",
  },
  content: {
    padding: 24,
    paddingTop: 4,
    paddingBottom: 40,
  },
  exerciseTabs: {
    gap: 8,
    paddingVertical: 8,
  },
  exerciseTab: {
    maxWidth: 190,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#fff8e7",
  },
  exerciseTabSelected: {
    backgroundColor: "#081126",
  },
  exerciseTabText: {
    color: "#081126",
    fontSize: 13,
    fontWeight: "700",
  },
  exerciseTabTextSelected: {
    color: "#fff9e3",
  },
  exerciseTitle: {
    marginTop: 24,
    color: "#081126",
    fontSize: 30,
    fontWeight: "800",
  },
  exerciseMeta: {
    marginTop: 6,
    color: "rgba(0, 0, 0, 0.55)",
    fontSize: 14,
  },
  noteBlock: {
    marginTop: 22,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#fff8e7",
  },
  noteInput: {
    minHeight: 72,
    marginTop: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(8, 17, 38, 0.15)",
    borderRadius: 12,
    color: "#081126",
    backgroundColor: "#fffdf5",
    textAlignVertical: "top",
  },
  noteButton: {
    alignSelf: "flex-start",
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#081126",
  },
  noteButtonText: {
    color: "#fff9e3",
    fontSize: 12,
    fontWeight: "800",
  },
  typeRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 24,
  },
  typeButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(8, 17, 38, 0.15)",
    borderRadius: 12,
  },
  typeButtonSelected: {
    borderColor: "#ea7a53",
    backgroundColor: "#fff0e8",
  },
  typeText: {
    color: "#081126",
    fontSize: 13,
    fontWeight: "700",
  },
  typeTextSelected: {
    color: "#ea7a53",
  },
  inputRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 18,
  },
  inputColumn: {
    flex: 1,
    gap: 8,
  },
  label: {
    color: "#081126",
    fontSize: 14,
    fontWeight: "700",
  },
  input: {
    minHeight: 56,
    borderWidth: 1,
    borderColor: "rgba(8, 17, 38, 0.15)",
    borderRadius: 14,
    paddingHorizontal: 16,
    color: "#081126",
    backgroundColor: "#fff8e7",
    fontSize: 20,
    fontWeight: "700",
  },
  addButton: {
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    borderRadius: 16,
    backgroundColor: "#ea7a53",
  },
  addButtonText: {
    color: "#fff9e3",
    fontSize: 16,
    fontWeight: "800",
  },
  sectionTitle: {
    marginTop: 32,
    marginBottom: 12,
    color: "#081126",
    fontSize: 18,
    fontWeight: "800",
  },
  setRow: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: "#fff8e7",
  },
  setNumber: {
    width: 24,
    color: "#ea7a53",
    fontSize: 16,
    fontWeight: "800",
  },
  setValue: {
    color: "#081126",
    fontSize: 15,
    fontWeight: "700",
  },
  setTypeLabel: {
    flex: 1,
    color: "rgba(0, 0, 0, 0.5)",
    fontSize: 12,
    textAlign: "right",
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
  cancelEditButton: {
    alignSelf: "center",
    marginTop: 12,
    padding: 8,
  },
  cancelEditText: {
    color: "#ea7a53",
    fontSize: 13,
    fontWeight: "800",
  },
  mutedText: {
    color: "rgba(0, 0, 0, 0.55)",
    fontSize: 14,
  },
  error: {
    marginTop: 16,
    color: "#dc2626",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  smallButton: {
    marginTop: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#081126",
  },
  smallButtonText: {
    color: "#fff9e3",
    fontWeight: "800",
  },
  emptyWorkout: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  emptyTitle: {
    color: "#081126",
    fontSize: 26,
    fontWeight: "800",
    textAlign: "center",
  },
  addExerciseButton: {
    minHeight: 56,
    minWidth: 220,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
    borderRadius: 16,
    backgroundColor: "#ea7a53",
  },
  addExerciseLink: {
    alignSelf: "flex-start",
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#fff0e8",
  },
  addExerciseLinkText: {
    color: "#ea7a53",
    fontSize: 13,
    fontWeight: "800",
  },
  pressed: {
    opacity: 0.82,
  },
  disabled: {
    opacity: 0.55,
  },
});
