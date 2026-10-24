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

import { KineticScreen, PrimaryButton, SecondaryButton } from "@/src/components/kinetic-ui";
import { localDateForTimezone } from "@/src/domain/time";
import { formatWeight, weightToKg } from "@/src/domain/units";
import type { SetType, Unit, Workout } from "@/src/db/types";
import { ProfileRepository } from "@/src/repositories/profile-repository";
import { WorkoutRepository } from "@/src/repositories/workout-repository";
import { syncNow } from "@/src/sync/sync-service";
import { theme } from "@/src/theme";

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

  function validateInputs(): { weightKg: number; reps: number } | null {
    if (!currentExercise) return null;
    const weightKg = weightToKg(Number(weight), unit);
    const parsedReps = Number(reps);
    if (
      !Number.isFinite(weightKg) ||
      weightKg < 0 ||
      (currentExercise.kind !== "bodyweight" && weightKg === 0)
    ) {
      setError(
        currentExercise.kind === "bodyweight"
          ? "Added weight cannot be negative."
          : `Weight must be greater than zero ${unit}.`,
      );
      return null;
    }
    if (!Number.isInteger(parsedReps) || parsedReps < 1) {
      setError("Reps must be a whole number greater than zero.");
      return null;
    }
    return { weightKg, reps: parsedReps };
  }

  async function saveSet() {
    if (!workout || !currentExercise) return;
    const values = validateInputs();
    if (!values) return;
    setError(null);
    setIsSaving(true);
    try {
      const repository = new WorkoutRepository(db);
      if (editingSetId) {
        const existing = workout.sets.find((set) => set.id === editingSetId);
        await repository.updateSet({
          id: editingSetId,
          workoutId: workout.id,
          exerciseId: currentExercise.exerciseId,
          setType,
          weightKg: values.weightKg,
          reps: values.reps,
          rpe: existing?.rpe ?? null,
        });
        cancelEditing();
      } else {
        const performedAt = new Date().toISOString();
        await repository.addSet({
          id: randomUUID(),
          workoutId: workout.id,
          exerciseId: currentExercise.exerciseId,
          setType,
          weightKg: values.weightKg,
          reps: values.reps,
          rpe: null,
          performedAt,
          timezoneId: workout.timezoneId,
          localDate: localDateForTimezone(performedAt, workout.timezoneId),
        });
      }
      await reloadWorkout();
    } catch {
      setError(editingSetId ? "Could not update this set." : "Could not save this set.");
    } finally {
      setIsSaving(false);
    }
  }

  function beginEditing(set: Workout["sets"][number]) {
    setEditingSetId(set.id);
    setWeight(formatWeight(set.weightKg, unit));
    setReps(String(set.reps));
    setSetType(set.setType);
    setError(null);
  }

  function cancelEditing() {
    setEditingSetId(null);
    setWeight("20");
    setReps("8");
    setSetType("working");
  }

  function deleteSet(setId: string) {
    if (!workout) return;
    Alert.alert("Delete set?", "This set will be removed from the active workout.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void (async () => {
            try {
              await new WorkoutRepository(db).deleteSet(workout.id, setId);
              if (editingSetId === setId) cancelEditing();
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

  function abandon() {
    if (!workout) return;
    Alert.alert("Abandon workout?", "This session will stay in your history as abandoned.", [
      { text: "Keep working", style: "cancel" },
      {
        text: "Abandon",
        style: "destructive",
        onPress: () => {
          void (async () => {
            try {
              await new WorkoutRepository(db).abandonWorkout(workout.id);
              void syncNow(db);
              router.replace("/");
            } catch {
              setError("Could not abandon this workout.");
            }
          })();
        },
      },
    ]);
  }

  async function finish() {
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

  const openPicker = () => {
    if (workout) router.push({ pathname: "/exercise-picker", params: { workoutId: workout.id } });
  };

  if (isLoading) {
    return (
      <KineticScreen scroll={false} contentContainerStyle={styles.centered}>
        <ActivityIndicator color={theme.colors.accent} />
        <Text style={styles.muted}>Loading workout...</Text>
      </KineticScreen>
    );
  }

  if (!workout) {
    return (
      <KineticScreen scroll={false} contentContainerStyle={styles.centered}>
        <Text style={styles.error}>{error ?? "Workout not found."}</Text>
        <SecondaryButton label="Go home" onPress={() => router.replace("/")} />
      </KineticScreen>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.header}>
        <Pressable onPress={abandon} hitSlop={12}><Text style={styles.dangerText}>Abandon</Text></Pressable>
        <Text style={styles.headerTitle}>Active workout</Text>
        <Pressable onPress={() => void finish()} hitSlop={12}><Text style={styles.finishText}>Finish</Text></Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {workout.exercises.map((exercise) => {
            const selected = exercise.exerciseId === currentExerciseId;
            return (
              <Pressable key={exercise.exerciseId} onPress={() => setCurrentExerciseId(exercise.exerciseId)} style={[styles.tab, selected && styles.selectedTab]}>
                <Text style={[styles.tabText, selected && styles.selectedTabText]} numberOfLines={1}>{exercise.name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <SecondaryButton label="＋ Add another exercise" onPress={openPicker} style={styles.addExerciseButton} />

        {!currentExercise ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Choose exercises for this session</Text>
            <Text style={styles.muted}>You can decide what to train as you go.</Text>
            <PrimaryButton label="Add exercise" onPress={openPicker} style={styles.emptyButton} />
          </View>
        ) : (
          <>
            <Text style={styles.title}>{currentExercise.name}</Text>
            <Text style={styles.muted}>{currentExercise.kind === "bodyweight" ? "Added weight" : "Weight"} · {unit.toUpperCase()}</Text>

            <View style={styles.noteCard}>
              <Text style={styles.label}>SESSION NOTE</Text>
              <TextInput value={note} onChangeText={setNote} placeholder="How did this session feel?" placeholderTextColor={theme.colors.textSubtle} style={styles.noteInput} multiline />
              <Pressable onPress={() => void saveNote()} style={styles.textButton}><Text style={styles.textButtonText}>Save note</Text></Pressable>
            </View>

            <View style={styles.typeRow}>
              {(["working", "warmup"] as const).map((kind) => (
                <Pressable key={kind} onPress={() => setSetType(kind)} style={[styles.typeButton, setType === kind && styles.selectedType]}>
                  <Text style={[styles.typeText, setType === kind && styles.selectedTypeText]}>{kind === "working" ? "Working set" : "Warm-up"}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.inputRow}>
              <View style={styles.inputColumn}><Text style={styles.label}>{currentExercise.kind === "bodyweight" ? `ADDED ${unit.toUpperCase()}` : `WEIGHT ${unit.toUpperCase()}`}</Text><TextInput value={weight} onChangeText={setWeight} keyboardType="decimal-pad" style={styles.input} placeholder="20" placeholderTextColor={theme.colors.textSubtle} /></View>
              <View style={styles.inputColumn}><Text style={styles.label}>REPS</Text><TextInput value={reps} onChangeText={setReps} keyboardType="number-pad" style={styles.input} placeholder="8" placeholderTextColor={theme.colors.textSubtle} /></View>
            </View>
            <PrimaryButton label={editingSetId ? "Save changes" : "＋ Add set"} onPress={() => void saveSet()} loading={isSaving} style={styles.saveButton} />

            <Text style={styles.sectionTitle}>THIS WORKOUT <Text style={styles.sectionCount}>{currentSets.length} sets</Text></Text>
            {currentSets.length === 0 ? <Text style={styles.muted}>No sets recorded for this exercise yet.</Text> : currentSets.map((set, index) => (
              <View key={set.id} style={styles.setRow}>
                <Text style={styles.setNumber}>{String(index + 1).padStart(2, "0")}</Text>
                <View style={styles.setMain}><Text style={styles.setValue}>{formatWeight(set.weightKg, unit)} {unit} × {set.reps}</Text><Text style={styles.setMeta}>{set.setType === "working" ? "Working set" : "Warm-up"}</Text></View>
                <Pressable onPress={() => beginEditing(set)} hitSlop={8}><Text style={styles.actionText}>Edit</Text></Pressable>
                <Pressable onPress={() => deleteSet(set.id)} hitSlop={8}><Text style={styles.deleteText}>Delete</Text></Pressable>
              </View>
            ))}
            {editingSetId ? <Pressable onPress={cancelEditing} style={styles.cancelEditing}><Text style={styles.textButtonText}>Cancel editing</Text></Pressable> : null}
          </>
        )}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.canvas },
  centered: { alignItems: "center", justifyContent: "center", gap: theme.spacing.md },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: theme.spacing.gutter, paddingTop: theme.spacing.md, paddingBottom: theme.spacing.md, borderBottomWidth: 1, borderBottomColor: theme.colors.border, backgroundColor: theme.colors.canvas },
  headerTitle: { color: theme.colors.text, fontSize: 17, fontWeight: "700" },
  dangerText: { width: 64, color: theme.colors.danger, fontSize: 13, fontWeight: "700" },
  finishText: { width: 64, color: theme.colors.accent, fontSize: 13, fontWeight: "800", textAlign: "right" },
  content: { padding: theme.spacing.gutter, paddingBottom: 48 },
  tabs: { gap: theme.spacing.sm, paddingVertical: theme.spacing.sm },
  tab: { maxWidth: 180, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radii.full, backgroundColor: theme.colors.surfaceLow },
  selectedTab: { borderColor: theme.colors.borderActive, backgroundColor: theme.colors.accent },
  tabText: { color: theme.colors.textMuted, fontSize: 13, fontWeight: "700" },
  selectedTabText: { color: theme.colors.accentText },
  addExerciseButton: { alignSelf: "flex-start", marginTop: theme.spacing.sm },
  title: { marginTop: theme.spacing.lg, color: theme.colors.text, fontSize: 30, fontWeight: "700" },
  muted: { color: theme.colors.textMuted, fontSize: 14, lineHeight: 21 },
  noteCard: { marginTop: theme.spacing.lg, padding: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radii.xl, backgroundColor: theme.colors.surface },
  label: { color: theme.colors.textSubtle, fontSize: 11, fontWeight: "700", letterSpacing: 1.1 },
  noteInput: { minHeight: 60, marginTop: theme.spacing.sm, padding: theme.spacing.sm, color: theme.colors.text, borderWidth: 1, borderColor: theme.colors.borderStrong, borderRadius: theme.radii.md, backgroundColor: theme.colors.surfaceLow, textAlignVertical: "top" },
  textButton: { alignSelf: "flex-start", marginTop: theme.spacing.sm, paddingVertical: theme.spacing.xs },
  textButtonText: { color: theme.colors.accent, fontSize: 13, fontWeight: "800" },
  typeRow: { flexDirection: "row", gap: theme.spacing.sm, marginTop: theme.spacing.lg },
  typeButton: { paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm, borderWidth: 1, borderColor: theme.colors.borderStrong, borderRadius: theme.radii.full, backgroundColor: theme.colors.surfaceLow },
  selectedType: { borderColor: theme.colors.borderActive, backgroundColor: theme.colors.accent },
  typeText: { color: theme.colors.textMuted, fontSize: 13, fontWeight: "700" },
  selectedTypeText: { color: theme.colors.accentText },
  inputRow: { flexDirection: "row", gap: theme.spacing.md, marginTop: theme.spacing.lg },
  inputColumn: { flex: 1, gap: theme.spacing.sm },
  input: { minHeight: 56, paddingHorizontal: theme.spacing.md, color: theme.colors.text, borderWidth: 1, borderColor: theme.colors.borderStrong, borderRadius: theme.radii.lg, backgroundColor: theme.colors.surface, fontSize: 20, fontWeight: "700" },
  saveButton: { marginTop: theme.spacing.md },
  sectionTitle: { marginTop: theme.spacing.xl, marginBottom: theme.spacing.sm, color: theme.colors.textMuted, fontSize: 12, fontWeight: "800", letterSpacing: 1.1 },
  sectionCount: { color: theme.colors.textSubtle, fontWeight: "500", letterSpacing: 0 },
  setRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm, minHeight: 64, marginBottom: theme.spacing.sm, padding: theme.spacing.sm, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radii.lg, backgroundColor: theme.colors.surface },
  setNumber: { width: 28, color: theme.colors.accent, fontSize: 13, fontWeight: "800" },
  setMain: { flex: 1 },
  setValue: { color: theme.colors.text, fontSize: 15, fontWeight: "700" },
  setMeta: { marginTop: 3, color: theme.colors.textSubtle, fontSize: 11 },
  actionText: { color: theme.colors.textMuted, fontSize: 11, fontWeight: "800" },
  deleteText: { color: theme.colors.danger, fontSize: 11, fontWeight: "800" },
  cancelEditing: { alignSelf: "center", padding: theme.spacing.sm },
  error: { marginTop: theme.spacing.md, color: theme.colors.danger, fontSize: 13, lineHeight: 19 },
  emptyState: { alignItems: "center", paddingVertical: 64, gap: theme.spacing.sm },
  emptyTitle: { color: theme.colors.text, fontSize: 22, fontWeight: "700", textAlign: "center" },
  emptyButton: { marginTop: theme.spacing.md },
});
