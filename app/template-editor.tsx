import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { randomUUID } from "expo-crypto";
import { useSQLiteContext } from "expo-sqlite";

import { KineticScreen, PrimaryButton } from "@/src/components/kinetic-ui";
import type { Exercise, WorkoutTemplate } from "@/src/db/types";
import { ExerciseRepository } from "@/src/repositories/exercise-repository";
import { ProfileRepository } from "@/src/repositories/profile-repository";
import { TemplateRepository } from "@/src/repositories/template-repository";
import { theme } from "@/src/theme";

export default function TemplateEditorScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { templateId } = useLocalSearchParams<{ templateId?: string }>();
  const [template, setTemplate] = useState<WorkoutTemplate | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [name, setName] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const [profile, loadedTemplate] = await Promise.all([new ProfileRepository(db).getProfile(), templateId ? new TemplateRepository(db).getTemplate(templateId) : Promise.resolve(null)]);
        const loadedExercises = await new ExerciseRepository(db).listActiveExercises(profile?.language ?? "en");
        if (!mounted) return;
        setTemplate(loadedTemplate); setName(loadedTemplate?.name ?? ""); setSelectedIds(loadedTemplate?.exercises.map((exercise) => exercise.exerciseId) ?? []); setExercises(loadedExercises);
      } catch { if (mounted) setError("Could not load the template editor."); } finally { if (mounted) setLoading(false); }
    }
    void load(); return () => { mounted = false; };
  }, [db, templateId]);

  const filtered = useMemo(() => { const query = search.trim().toLowerCase(); return exercises.filter((exercise) => !query || exercise.name.toLowerCase().includes(query)); }, [exercises, search]);
  function toggle(id: string) { setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]); }
  async function save() {
    if (name.trim().length === 0) { setError("Give the template a name."); return; }
    if (selectedIds.length === 0) { setError("Select at least one exercise."); return; }
    setSaving(true); setError(null);
    try {
      const repository = new TemplateRepository(db);
      if (template) await repository.updateTemplate({ id: template.id, name, exerciseIds: selectedIds });
      else await repository.createTemplate({ id: randomUUID(), name, exerciseIds: selectedIds });
      router.back();
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Could not save this template."); } finally { setSaving(false); }
  }
  if (loading) return <KineticScreen scroll={false} contentContainerStyle={styles.centered}><ActivityIndicator color={theme.colors.accent} /></KineticScreen>;
  return <KineticScreen contentContainerStyle={styles.content}><View style={styles.header}><Pressable onPress={() => router.back()} hitSlop={12}><Text style={styles.back}>‹ Back</Text></Pressable><Text style={styles.title}>{template ? "Edit template" : "New template"}</Text><View style={styles.spacer} /></View><Text style={styles.label}>TEMPLATE NAME</Text><TextInput value={name} onChangeText={setName} placeholder="e.g. Saturday shoulders" placeholderTextColor={theme.colors.textSubtle} style={styles.nameInput} /><Text style={styles.helper}>Selected exercises keep this order when a workout starts.</Text><TextInput value={search} onChangeText={setSearch} placeholder="Search exercises" placeholderTextColor={theme.colors.textSubtle} style={styles.search} autoCapitalize="none" /><ScrollView contentContainerStyle={styles.list}>{filtered.map((exercise) => { const selected = selectedIds.includes(exercise.id); return <Pressable key={exercise.id} onPress={() => toggle(exercise.id)} style={[styles.exercise, selected && styles.selected]}><View style={styles.exerciseMain}><Text style={styles.exerciseName}>{exercise.name}</Text><Text style={styles.meta}>{selected ? `Exercise ${selectedIds.indexOf(exercise.id) + 1}` : `${exercise.equipment} · ${exercise.kind}`}</Text></View><View style={[styles.checkbox, selected && styles.checked]}>{selected ? <Text style={styles.check}>✓</Text> : null}</View></Pressable>; })}</ScrollView>{error ? <Text style={styles.error}>{error}</Text> : null}<PrimaryButton label={template ? "Save template" : "Create template"} onPress={() => void save()} loading={saving} style={styles.save} /></KineticScreen>;
}

const styles = StyleSheet.create({
  content: { paddingBottom: 42 },
  centered: { alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: theme.spacing.xl },
  back: { width: 64, color: theme.colors.accent, fontSize: 14, fontWeight: "800" },
  title: { color: theme.colors.text, fontSize: 19, fontWeight: "700" },
  spacer: { width: 64 },
  label: { color: theme.colors.textSubtle, fontSize: 11, fontWeight: "800", letterSpacing: 1.1 },
  nameInput: { minHeight: 52, marginTop: theme.spacing.sm, paddingHorizontal: theme.spacing.md, color: theme.colors.text, borderWidth: 1, borderColor: theme.colors.borderStrong, borderRadius: theme.radii.lg, backgroundColor: theme.colors.surface, fontSize: 16 },
  helper: { marginTop: theme.spacing.sm, color: theme.colors.textMuted, fontSize: 12 },
  search: { minHeight: 50, marginTop: theme.spacing.lg, paddingHorizontal: theme.spacing.md, color: theme.colors.text, borderWidth: 1, borderColor: theme.colors.borderStrong, borderRadius: theme.radii.lg, backgroundColor: theme.colors.surfaceLow },
  list: { paddingTop: theme.spacing.md, paddingBottom: theme.spacing.sm },
  exercise: { minHeight: 62, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: theme.spacing.sm, paddingHorizontal: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radii.lg, backgroundColor: theme.colors.surface },
  selected: { borderColor: theme.colors.borderActive, backgroundColor: theme.colors.surfaceHigh },
  exerciseMain: { flex: 1 },
  exerciseName: { color: theme.colors.text, fontSize: 14, fontWeight: "700" },
  meta: { marginTop: 3, color: theme.colors.textSubtle, fontSize: 11 },
  checkbox: { width: 24, height: 24, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: theme.colors.borderStrong, borderRadius: theme.radii.sm },
  checked: { borderColor: theme.colors.accent, backgroundColor: theme.colors.accent },
  check: { color: theme.colors.accentText, fontWeight: "900" },
  error: { marginTop: theme.spacing.sm, color: theme.colors.danger, fontSize: 13 },
  save: { marginTop: theme.spacing.md },
});
