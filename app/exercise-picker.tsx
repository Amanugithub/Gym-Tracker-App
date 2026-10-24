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

import { KineticScreen, PrimaryButton } from "@/src/components/kinetic-ui";
import type { Exercise } from "@/src/db/types";
import { ExerciseRepository } from "@/src/repositories/exercise-repository";
import { ProfileRepository } from "@/src/repositories/profile-repository";
import { WorkoutRepository } from "@/src/repositories/workout-repository";
import { theme } from "@/src/theme";

export default function ExercisePickerScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { workoutId } = useLocalSearchParams<{ workoutId?: string }>();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [existingIds, setExistingIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [equipmentFilter, setEquipmentFilter] = useState<string>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!workoutId) {
        router.replace("/subscriptions");
        return;
      }
      try {
        const profile = await new ProfileRepository(db).getProfile();
        const workout = await new WorkoutRepository(db).getWorkout(workoutId);
        if (!profile || !workout || workout.status !== "active") {
          router.replace("/subscriptions");
          return;
        }
        const loadedExercises = await new ExerciseRepository(db).listActiveExercises(profile.language);
        if (!mounted) return;
        const already = new Set(workout.exercises.map((exercise) => exercise.exerciseId));
        setExistingIds(already);
        setSelectedIds(new Set(already));
        setExercises(loadedExercises);
      } catch {
        if (mounted) setError("Could not load the exercise library.");
      } finally {
        if (mounted) setIsLoading(false);
      }
    }
    void load();
    return () => { mounted = false; };
  }, [db, router, workoutId]);

  const equipmentOptions = useMemo(
    () => ["all", ...new Set(exercises.map((exercise) => exercise.equipment))],
    [exercises],
  );
  const filteredExercises = useMemo(() => {
    const query = search.trim().toLowerCase();
    return exercises.filter((exercise) => {
      const matchesSearch = !query || exercise.name.toLowerCase().includes(query);
      const matchesEquipment = equipmentFilter === "all" || exercise.equipment === equipmentFilter;
      return matchesSearch && matchesEquipment;
    });
  }, [equipmentFilter, exercises, search]);

  function toggleExercise(id: string) {
    if (existingIds.has(id)) return;
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function addSelected() {
    if (!workoutId) return;
    const newIds = exercises.filter((exercise) => selectedIds.has(exercise.id) && !existingIds.has(exercise.id)).map((exercise) => exercise.id);
    if (newIds.length === 0) return;
    setIsSaving(true);
    setError(null);
    try {
      await new WorkoutRepository(db).addExercisesToWorkout(workoutId, newIds);
      router.back();
    } catch {
      setError("Could not add these exercises.");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return <KineticScreen scroll={false} contentContainerStyle={styles.centered}><ActivityIndicator color={theme.colors.accent} /><Text style={styles.muted}>Loading exercises...</Text></KineticScreen>;
  }

  return (
    <KineticScreen contentContainerStyle={styles.content}>
      <View style={styles.topRow}>
        <Pressable onPress={() => router.back()} hitSlop={12}><Text style={styles.backText}>‹ Back</Text></Pressable>
        <Text style={styles.headerTitle}>Exercise library</Text>
        <View style={styles.spacer} />
      </View>
      <Text style={styles.subtitle}>Choose what belongs in this workout. You can add more later.</Text>
      <TextInput value={search} onChangeText={setSearch} placeholder="Search exercises" placeholderTextColor={theme.colors.textSubtle} style={styles.search} autoCapitalize="none" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {equipmentOptions.map((option) => (
          <Pressable key={option} onPress={() => setEquipmentFilter(option)} style={[styles.filter, equipmentFilter === option && styles.selectedFilter]}>
            <Text style={[styles.filterText, equipmentFilter === option && styles.selectedFilterText]}>{option === "all" ? "All" : option}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={styles.selectionBar}><Text style={styles.muted}>{selectedIds.size - existingIds.size} new selected</Text><Text style={styles.muted}>{filteredExercises.length} shown</Text></View>
      {filteredExercises.map((exercise) => {
        const selected = selectedIds.has(exercise.id);
        const existing = existingIds.has(exercise.id);
        return (
          <Pressable key={exercise.id} onPress={() => toggleExercise(exercise.id)} style={[styles.exerciseRow, selected && styles.selectedRow, existing && styles.existingRow]}>
            <View style={styles.copy}><Text style={styles.exerciseName}>{exercise.name}</Text><Text style={styles.meta}>{existing ? "Already in this workout" : `${exercise.equipment} · ${exercise.kind}`}</Text></View>
            <View style={[styles.checkbox, selected && styles.checked]}>{selected ? <Text style={styles.check}>✓</Text> : null}</View>
          </Pressable>
        );
      })}
      {filteredExercises.length === 0 ? <Text style={styles.muted}>No exercises match your search.</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <PrimaryButton label="Add selected exercises" onPress={() => void addSelected()} loading={isSaving} disabled={selectedIds.size <= existingIds.size} style={styles.addButton} />
    </KineticScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 42 },
  centered: { alignItems: "center", justifyContent: "center", gap: theme.spacing.md },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backText: { width: 64, color: theme.colors.accent, fontSize: 15, fontWeight: "800" },
  headerTitle: { color: theme.colors.text, fontSize: 19, fontWeight: "700" },
  spacer: { width: 64 },
  subtitle: { marginTop: theme.spacing.md, color: theme.colors.textMuted, fontSize: 14, lineHeight: 21 },
  search: { minHeight: 52, marginTop: theme.spacing.md, paddingHorizontal: theme.spacing.md, color: theme.colors.text, borderWidth: 1, borderColor: theme.colors.borderStrong, borderRadius: theme.radii.lg, backgroundColor: theme.colors.surface, fontSize: 16 },
  filters: { gap: theme.spacing.sm, paddingVertical: theme.spacing.md },
  filter: { paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radii.full, backgroundColor: theme.colors.surfaceLow },
  selectedFilter: { borderColor: theme.colors.borderActive, backgroundColor: theme.colors.accent },
  filterText: { color: theme.colors.textMuted, fontSize: 12, fontWeight: "700", textTransform: "capitalize" },
  selectedFilterText: { color: theme.colors.accentText },
  selectionBar: { flexDirection: "row", justifyContent: "space-between", marginBottom: theme.spacing.sm },
  exerciseRow: { minHeight: 68, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: theme.spacing.sm, paddingHorizontal: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radii.lg, backgroundColor: theme.colors.surface },
  selectedRow: { borderColor: theme.colors.borderActive, backgroundColor: theme.colors.surfaceHigh },
  existingRow: { opacity: 0.58 },
  copy: { flex: 1, paddingRight: theme.spacing.md },
  exerciseName: { color: theme.colors.text, fontSize: 15, fontWeight: "700" },
  meta: { marginTop: 4, color: theme.colors.textSubtle, fontSize: 12, textTransform: "capitalize" },
  checkbox: { width: 25, height: 25, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: theme.colors.borderStrong, borderRadius: theme.radii.sm },
  checked: { borderColor: theme.colors.accent, backgroundColor: theme.colors.accent },
  check: { color: theme.colors.accentText, fontSize: 16, fontWeight: "900" },
  addButton: { marginTop: theme.spacing.md },
  muted: { color: theme.colors.textMuted, fontSize: 13 },
  error: { marginTop: theme.spacing.md, color: theme.colors.danger, fontSize: 13 },
});
