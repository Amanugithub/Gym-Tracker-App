import { Ionicons } from "@expo/vector-icons";
import { randomUUID } from "expo-crypto";
import { useFocusEffect, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { localDateForTimezone } from "@/src/domain/time";
import type { Profile, Workout, WorkoutTemplate } from "@/src/db/types";
import { ProfileRepository } from "@/src/repositories/profile-repository";
import { TemplateRepository } from "@/src/repositories/template-repository";
import { WorkoutRepository } from "@/src/repositories/workout-repository";
import {
  GlassCard,
  KineticScreen,
  PrimaryButton,
  ScreenHeader,
  SecondaryButton,
  SectionLabel,
} from "@/src/components/kinetic-ui";
import { theme } from "@/src/theme";

export default function TrainScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [activeWorkout, setActiveWorkout] = useState<Workout | null>(null);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [startingTemplateId, setStartingTemplateId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      async function loadTrain() {
        setIsLoading(true);
        try {
          const [loadedProfile, loadedWorkout, loadedTemplates] = await Promise.all([
            new ProfileRepository(db).getProfile(),
            new WorkoutRepository(db).getActiveWorkout(),
            new TemplateRepository(db).listTemplates(),
          ]);
          if (!mounted) return;
          setProfile(loadedProfile);
          setActiveWorkout(loadedWorkout);
          setTemplates(loadedTemplates);
          setError(null);
        } catch {
          if (mounted) setError("Could not load your training hub.");
        } finally {
          if (mounted) setIsLoading(false);
        }
      }

      void loadTrain();
      return () => {
        mounted = false;
      };
    }, [db]),
  );

  async function startWorkout(templateId?: string) {
    if (activeWorkout) {
      router.push({ pathname: "/active-workout", params: { workoutId: activeWorkout.id } });
      return;
    }
    if (!profile) {
      router.replace("/onboarding");
      return;
    }

    setStartingTemplateId(templateId ?? "blank");
    setError(null);
    try {
      const startedAt = new Date().toISOString();
      const workout = await new WorkoutRepository(db).createWorkout({
        id: randomUUID(),
        startedAt,
        timezoneId: profile.timezoneId,
        localDate: localDateForTimezone(startedAt, profile.timezoneId),
        bodyweightKg: profile.bodyweightKg,
        templateId,
      });
      router.push({ pathname: "/active-workout", params: { workoutId: workout.id } });
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "Could not start a workout.");
    } finally {
      setStartingTemplateId(null);
    }
  }

  if (isLoading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color={theme.colors.accent} />
      </View>
    );
  }

  const systemTemplates = templates.filter((template) => template.source === "system");
  const customTemplates = templates.filter((template) => template.source === "custom");

  return (
    <KineticScreen>
      <ScreenHeader
        eyebrow="TRAIN HUB"
        title={activeWorkout ? "Active session in progress" : "Ready to train?"}
        subtitle={activeWorkout ? "Your unfinished workout is saved and ready to resume." : "Start blank or use a template as a flexible starting point."}
        trailing={
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>{activeWorkout ? "LIVE" : "READY"}</Text>
          </View>
        }
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {activeWorkout ? (
        <GlassCard active style={styles.activeCard}>
          <View style={styles.cardTopRow}>
            <View style={styles.cardLabelRow}>
              <View style={styles.liveDot} />
              <Text style={styles.cardLabel}>ACTIVE SESSION</Text>
            </View>
            <Ionicons name="time-outline" size={20} color={theme.colors.accent} />
          </View>
          <Text style={styles.activeTitle}>Continue your workout</Text>
          <Text style={styles.cardText}>{activeWorkout.exercises.length} exercises · {activeWorkout.sets.length} sets recorded</Text>
          <View style={styles.actionRow}>
            <PrimaryButton label="Resume session" onPress={() => void startWorkout()} style={styles.actionButton} />
            <SecondaryButton label="Open details" onPress={() => void startWorkout()} style={styles.actionButton} />
          </View>
        </GlassCard>
      ) : (
        <GlassCard style={styles.blankCard}>
          <View style={styles.iconBox}>
            <Ionicons name="add" size={28} color={theme.colors.accentText} />
          </View>
          <View style={styles.blankText}>
            <Text style={styles.activeTitle}>Start blank workout</Text>
            <Text style={styles.cardText}>Log exercises and sets freely as you train.</Text>
          </View>
          <PrimaryButton label="Start" onPress={() => void startWorkout()} loading={startingTemplateId === "blank"} style={styles.startButton} />
        </GlassCard>
      )}

      <SectionLabel trailing={`${templates.length} available`}>WORKOUT TEMPLATES</SectionLabel>
      <Text style={styles.helperText}>Templates add exercises to a new workout. You can still change everything during the session.</Text>

      <View style={styles.templateGrid}>
        {systemTemplates.map((template) => (
          <TemplateCard key={template.id} template={template} isStarting={startingTemplateId === template.id} onStart={() => void startWorkout(template.id)} />
        ))}
      </View>

      {customTemplates.length > 0 ? (
        <>
          <SectionLabel trailing="CUSTOM">YOUR TEMPLATES</SectionLabel>
          <View style={styles.templateGrid}>
            {customTemplates.map((template) => (
              <TemplateCard key={template.id} template={template} isStarting={startingTemplateId === template.id} onStart={() => void startWorkout(template.id)} />
            ))}
          </View>
        </>
      ) : null}

      <GlassCard style={styles.futureCard}>
        <Text style={styles.cardTitle}>Custom templates</Text>
        <Text style={styles.cardText}>Create and edit your own exercise lists from the template manager.</Text>
        <SecondaryButton label="Manage templates" onPress={() => router.push("/templates" as never)} style={styles.manageButton} />
      </GlassCard>
    </KineticScreen>
  );
}

interface TemplateCardProps {
  readonly template: WorkoutTemplate;
  readonly isStarting: boolean;
  readonly onStart: () => void;
}

function TemplateCard({ template, isStarting, onStart }: TemplateCardProps) {
  const preview = template.exercises.slice(0, 2).map((exercise) => exercise.name).join(" · ");
  return (
    <GlassCard style={styles.templateCard}>
      <Text style={styles.templateSource}>{template.source === "system" ? "BUILT-IN" : "CUSTOM"}</Text>
      <Text style={styles.templateTitle}>{template.name}</Text>
      <Text style={styles.templatePreview} numberOfLines={2}>{preview || "No exercises"}</Text>
      <View style={styles.templateFooter}>
        <Text style={styles.templateCount}>{template.exercises.length} exercises</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`Use ${template.name} template`} disabled={isStarting} onPress={onStart} style={({ pressed }) => [styles.playButton, pressed && styles.pressed]}>
          {isStarting ? <ActivityIndicator color={theme.colors.accentText} size="small" /> : <Ionicons name="play" size={15} color={theme.colors.accentText} />}
        </Pressable>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  loadingScreen: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.canvas },
  liveBadge: { flexDirection: "row", alignItems: "center", gap: theme.spacing.xs, paddingHorizontal: theme.spacing.sm, paddingVertical: theme.spacing.xs, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radii.full, backgroundColor: theme.colors.surfaceLow },
  liveDot: { width: 7, height: 7, borderRadius: theme.radii.full, backgroundColor: theme.colors.accent },
  liveText: { color: theme.colors.textMuted, fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  activeCard: { marginBottom: theme.spacing.lg },
  blankCard: { flexDirection: "row", alignItems: "center", gap: theme.spacing.md, marginBottom: theme.spacing.lg },
  blankText: { flex: 1 },
  iconBox: { width: 52, height: 52, alignItems: "center", justifyContent: "center", borderRadius: theme.radii.lg, backgroundColor: theme.colors.accent },
  startButton: { paddingHorizontal: theme.spacing.md },
  cardTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: theme.spacing.sm },
  cardLabelRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  cardLabel: { color: theme.colors.textMuted, fontSize: theme.typography.label.fontSize, fontWeight: theme.typography.label.fontWeight, letterSpacing: 1.2 },
  activeTitle: { marginTop: theme.spacing.md, color: theme.colors.text, fontSize: theme.typography.section.fontSize, fontWeight: theme.typography.section.fontWeight },
  cardTitle: { color: theme.colors.text, fontSize: theme.typography.section.fontSize, fontWeight: theme.typography.section.fontWeight },
  cardText: { marginTop: theme.spacing.sm, color: theme.colors.textMuted, fontSize: theme.typography.bodySmall.fontSize, lineHeight: theme.typography.bodySmall.lineHeight },
  actionRow: { flexDirection: "row", gap: theme.spacing.sm, marginTop: theme.spacing.md },
  actionButton: { flex: 1 },
  helperText: { marginBottom: theme.spacing.md, color: theme.colors.textMuted, fontSize: theme.typography.bodySmall.fontSize, lineHeight: theme.typography.bodySmall.lineHeight },
  templateGrid: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm, marginBottom: theme.spacing.lg },
  templateCard: { width: "48%", minHeight: 176, padding: theme.spacing.md },
  templateSource: { color: theme.colors.accent, fontSize: theme.typography.label.fontSize, fontWeight: theme.typography.label.fontWeight, letterSpacing: 1 },
  templateTitle: { marginTop: theme.spacing.md, color: theme.colors.text, fontSize: 18, fontWeight: "700" },
  templatePreview: { flex: 1, marginTop: theme.spacing.sm, color: theme.colors.textMuted, fontSize: 12, lineHeight: 17 },
  templateFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: theme.spacing.md },
  templateCount: { color: theme.colors.textSubtle, fontSize: 11 },
  playButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: theme.radii.full, backgroundColor: theme.colors.accent },
  futureCard: { marginBottom: theme.spacing.lg },
  manageButton: { alignSelf: "flex-start", marginTop: theme.spacing.md },
  error: { marginBottom: theme.spacing.md, color: theme.colors.danger, fontSize: theme.typography.bodySmall.fontSize },
  pressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
});
