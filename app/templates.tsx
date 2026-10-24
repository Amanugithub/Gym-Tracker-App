import { useCallback, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";

import { GlassCard, KineticScreen, PrimaryButton, ScreenHeader, SecondaryButton, SectionLabel } from "@/src/components/kinetic-ui";
import type { WorkoutTemplate } from "@/src/db/types";
import { TemplateRepository } from "@/src/repositories/template-repository";
import { theme } from "@/src/theme";

export default function TemplatesScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try { setTemplates(await new TemplateRepository(db).listTemplates()); setError(null); } catch { setError("Could not load templates."); } finally { setLoading(false); }
  }, [db]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const system = templates.filter((template) => template.source === "system");
  const custom = templates.filter((template) => template.source === "custom");
  function remove(template: WorkoutTemplate) {
    Alert.alert(`Delete ${template.name}?`, "The template will be removed. Existing workouts are not affected.", [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => { void (async () => { try { await new TemplateRepository(db).deleteTemplate(template.id); await load(); } catch { setError("Could not delete this template."); } })(); } }]);
  }
  return <KineticScreen><Pressable onPress={() => router.back()} hitSlop={12}><Text style={styles.back}>‹ Train hub</Text></Pressable><ScreenHeader eyebrow="TEMPLATES" title="Your starting points" subtitle="Templates only pre-fill exercises. You can still change the workout once it starts." />
    <PrimaryButton label="＋ Create custom template" onPress={() => router.push("/template-editor" as never)} style={styles.create} />
    {loading ? <View style={styles.loading}><ActivityIndicator color={theme.colors.accent} /></View> : <>
      <SectionLabel>BUILT-IN</SectionLabel>{system.map((template) => <TemplateCard key={template.id} template={template} />)}
      <SectionLabel trailing={`${custom.length}`}>CUSTOM</SectionLabel>{custom.length === 0 ? <Text style={styles.muted}>Create a custom template for exercises you repeat often.</Text> : custom.map((template) => <GlassCard key={template.id} style={styles.card}><TemplateCardContent template={template} /><View style={styles.actions}><SecondaryButton label="Edit" onPress={() => router.push({ pathname: "/template-editor", params: { templateId: template.id } } as never)} style={styles.action} /><Pressable onPress={() => remove(template)} style={styles.delete}><Text style={styles.deleteText}>Delete</Text></Pressable></View></GlassCard>)}
    </>}
    {error ? <Text style={styles.error}>{error}</Text> : null}
  </KineticScreen>;
}

function TemplateCard({ template }: { template: WorkoutTemplate }) { return <GlassCard style={styles.card}><TemplateCardContent template={template} /></GlassCard>; }
function TemplateCardContent({ template }: { template: WorkoutTemplate }) { return <><Text style={styles.name}>{template.name}</Text><Text style={styles.meta}>{template.exercises.length} exercises</Text><Text style={styles.preview}>{template.exercises.map((exercise) => exercise.name).join(" · ") || "No exercises"}</Text></>; }

const styles = StyleSheet.create({
  back: { marginBottom: theme.spacing.lg, color: theme.colors.accent, fontSize: 14, fontWeight: "800" },
  create: { marginBottom: theme.spacing.xl },
  loading: { alignItems: "center", paddingVertical: 70 },
  card: { marginBottom: theme.spacing.sm },
  name: { color: theme.colors.text, fontSize: 17, fontWeight: "700" },
  meta: { marginTop: theme.spacing.xs, color: theme.colors.accent, fontSize: 12, fontWeight: "700" },
  preview: { marginTop: theme.spacing.sm, color: theme.colors.textMuted, fontSize: 13, lineHeight: 19 },
  actions: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md, marginTop: theme.spacing.md },
  action: { flex: 1, minHeight: 40 },
  delete: { padding: theme.spacing.sm },
  deleteText: { color: theme.colors.danger, fontSize: 13, fontWeight: "800" },
  muted: { marginBottom: theme.spacing.md, color: theme.colors.textMuted, fontSize: 13 },
  error: { marginTop: theme.spacing.md, color: theme.colors.danger, fontSize: 13 },
});
