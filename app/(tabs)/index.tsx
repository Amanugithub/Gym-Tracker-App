import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { getAuthMode } from "@/src/auth/session";
import { calculateWeightProgress } from "@/src/domain/body-weight";
import { calculateProgressStats, summarizeWorkout, type ProgressStats } from "@/src/domain/progress";
import { localDateForTimezone } from "@/src/domain/time";
import { formatWeight } from "@/src/domain/units";
import type { Profile, Unit, Workout } from "@/src/db/types";
import { BodyWeightRepository } from "@/src/repositories/body-weight-repository";
import { ProfileRepository } from "@/src/repositories/profile-repository";
import { WorkoutRepository } from "@/src/repositories/workout-repository";
import {
  GlassCard,
  KineticScreen,
  PrimaryButton,
  ProgressBar,
  ScreenHeader,
  SectionLabel,
  SecondaryButton,
} from "@/src/components/kinetic-ui";
import { theme } from "@/src/theme";

const EMPTY_STATS = calculateProgressStats([]);

function formatRecentDate(localDate: string): string {
  const [year, month, day] = localDate.split("-");
  return `${day}/${month}/${year}`;
}

function formatElapsed(startedAt: string): string {
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 60_000));
  const hours = Math.floor(elapsedMinutes / 60);
  const minutes = elapsedMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function formatSignedWeight(value: number | null, unit: Unit): string {
  if (value === null) return "—";
  const converted = unit === "kg" ? value : value * 2.2046226218;
  return `${converted >= 0 ? "+" : ""}${converted.toFixed(1)} ${unit}`;
}

export default function HomeScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [activeWorkout, setActiveWorkout] = useState<Workout | null>(null);
  const [recentWorkouts, setRecentWorkouts] = useState<Workout[]>([]);
  const [stats, setStats] = useState<ProgressStats>(EMPTY_STATS);
  const [weightProgress, setWeightProgress] = useState(calculateWeightProgress([], null));
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      async function loadHome() {
        try {
          const authMode = await getAuthMode();
          if (!authMode) {
            router.replace("/(auth)/sign-in");
            return;
          }

          const workoutRepository = new WorkoutRepository(db);
          const [loadedProfile, loadedActive, history, weightEntries] = await Promise.all([
            new ProfileRepository(db).getProfile(),
            workoutRepository.getActiveWorkout(),
            workoutRepository.listWorkoutHistory(5),
            new BodyWeightRepository(db).listEntries(),
          ]);

          if (!mounted) return;
          if (!loadedProfile) {
            router.replace("/onboarding");
            return;
          }

          const currentLocalDate = localDateForTimezone(new Date().toISOString(), loadedProfile.timezoneId);
          const completed = history.filter((workout) => workout.status === "completed");
          setProfile(loadedProfile);
          setActiveWorkout(loadedActive);
          setRecentWorkouts(completed.slice(0, 3));
          setStats(calculateProgressStats(completed, {
            currentLocalDate,
            weeklyTarget: loadedProfile.weeklyTarget,
          }));
          setWeightProgress(calculateWeightProgress(weightEntries, loadedProfile.heightCm));
          setError(null);
        } catch {
          if (mounted) setError("Could not load your home dashboard.");
        }
      }

      void loadHome();
      return () => {
        mounted = false;
      };
    }, [db, router]),
  );

  const unit = profile?.unit ?? "kg";
  const weeklyTarget = profile?.weeklyTarget ?? 0;
  const weeklyProgress = weeklyTarget > 0 ? stats.workoutsThisWeek / weeklyTarget : 0;
  const featuredExercise = [...stats.exercises].sort((a, b) => b.lastPerformedAt.localeCompare(a.lastPerformedAt))[0];

  return (
    <KineticScreen>
      <ScreenHeader
        eyebrow="WORKOUT TRACKER"
        title={`Hello, ${profile?.displayName || "athlete"}`}
        subtitle={activeWorkout ? "Active session saved locally" : "Ready when you are"}
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
              <Text style={styles.cardLabel}>WORKOUT IN PROGRESS</Text>
            </View>
            <Text style={styles.cardMeta}>{formatElapsed(activeWorkout.startedAt)}</Text>
          </View>
          <Text style={styles.activeTitle}>Continue your session</Text>
          <Text style={styles.activeDescription}>
            {activeWorkout.exercises.length} exercises · {activeWorkout.sets.length} sets recorded
          </Text>
          <PrimaryButton
            label="Resume workout"
            onPress={() => router.push({ pathname: "/active-workout", params: { workoutId: activeWorkout.id } })}
            style={styles.fullButton}
          />
        </GlassCard>
      ) : (
        <GlassCard style={styles.startCard}>
          <Text style={styles.cardLabel}>NEXT ACTION</Text>
          <Text style={styles.startTitle}>Start a workout</Text>
          <Text style={styles.startDescription}>
            Begin blank or choose a template. Add exercises as your session develops.
          </Text>
          <PrimaryButton label="Open Train" onPress={() => router.push("/subscriptions")} style={styles.fullButton} />
        </GlassCard>
      )}

      <SectionLabel trailing={`${stats.workoutsThisWeek}/${weeklyTarget || "—"}`}>WEEKLY TARGET</SectionLabel>
      <GlassCard style={styles.targetCard}>
        <View style={styles.targetRow}>
          <Text style={styles.targetValue}>{stats.workoutsThisWeek}</Text>
          <Text style={styles.targetText}>completed workout{stats.workoutsThisWeek === 1 ? "" : "s"} this week</Text>
        </View>
        <ProgressBar progress={weeklyProgress} />
      </GlassCard>

      <SectionLabel>QUICK ACTIONS</SectionLabel>
      <View style={styles.quickGrid}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Start a workout"
          onPress={() => router.push("/subscriptions")}
          style={({ pressed }) => [styles.quickCard, pressed && styles.pressed]}
        >
          <Ionicons name="barbell-outline" size={24} color={theme.colors.accent} />
          <Text style={styles.quickTitle}>Start workout</Text>
          <Text style={styles.quickText}>Blank or template</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Check progress"
          onPress={() => router.push("/insights")}
          style={({ pressed }) => [styles.quickCard, pressed && styles.pressed]}
        >
          <Ionicons name="trending-up-outline" size={24} color={theme.colors.accent} />
          <Text style={styles.quickTitle}>Check progress</Text>
          <Text style={styles.quickText}>PRs and history</Text>
        </Pressable>
      </View>

      <SectionLabel trailing={weightProgress.currentWeightKg === null ? "OPTIONAL" : undefined}>BODY WEIGHT</SectionLabel>
      <GlassCard>
        {weightProgress.currentWeightKg === null ? (
          <View>
            <Text style={styles.cardTitle}>Track body-weight progress</Text>
            <Text style={styles.cardText}>Add a measurement from Profile to see weight change and BMI when height is available.</Text>
            <SecondaryButton label="Open Profile" onPress={() => router.push("/settings")} style={styles.compactButton} />
          </View>
        ) : (
          <View style={styles.weightRow}>
            <View>
              <Text style={styles.metricLabel}>CURRENT</Text>
              <Text style={styles.largeMetric}>{formatWeight(weightProgress.currentWeightKg, unit)}<Text style={styles.metricUnit}> {unit}</Text></Text>
            </View>
            <View style={styles.weightChange}>
              <Text style={styles.metricLabel}>SINCE FIRST LOG</Text>
              <Text style={styles.changeValue}>{formatSignedWeight(weightProgress.changeKg, unit)}</Text>
            </View>
          </View>
        )}
      </GlassCard>

      <SectionLabel trailing={featuredExercise ? "LATEST" : "NO DATA"}>STRENGTH PROGRESS</SectionLabel>
      <GlassCard>
        {featuredExercise ? (
          <>
            <View style={styles.cardTopRow}>
              <Text style={styles.cardTitle}>{featuredExercise.name}</Text>
              <Text style={styles.accentText}>{featuredExercise.bestE1rmKg === null ? "BODYWEIGHT" : `e1RM ${formatWeight(featuredExercise.bestE1rmKg, unit)} ${unit}`}</Text>
            </View>
            <Text style={styles.cardText}>Best set {formatWeight(featuredExercise.heaviestWeightKg, unit)} {unit} × {featuredExercise.heaviestReps} reps</Text>
            <SecondaryButton label="Open Progress" onPress={() => router.push("/insights")} style={styles.compactButton} />
          </>
        ) : (
          <Text style={styles.cardText}>Complete a workout to start building exercise progress.</Text>
        )}
      </GlassCard>

      <SectionLabel trailing="VIEW ALL">RECENT WORKOUTS</SectionLabel>
      {recentWorkouts.length === 0 ? (
        <Text style={styles.emptyText}>Your completed workouts will appear here.</Text>
      ) : (
        recentWorkouts.map((workout) => {
          const summary = summarizeWorkout(workout);
          return (
            <Pressable
              key={workout.id}
              accessibilityRole="button"
              accessibilityLabel={`Open workout from ${formatRecentDate(workout.localDate)}`}
              onPress={() => router.push({ pathname: "/subscriptions/[id]", params: { id: workout.id } })}
              style={({ pressed }) => [styles.historyCard, pressed && styles.pressed]}
            >
              <View style={styles.cardTopRow}>
                <Text style={styles.cardTitle}>{formatRecentDate(workout.localDate)}</Text>
                <Text style={styles.syncedLabel}>COMPLETED</Text>
              </View>
              <Text style={styles.cardText}>{summary.exerciseCount} exercises · {summary.setCount} sets · {formatWeight(summary.volumeKg, unit)} {unit}</Text>
            </Pressable>
          );
        })
      )}
    </KineticScreen>
  );
}

const styles = StyleSheet.create({
  liveBadge: { flexDirection: "row", alignItems: "center", gap: theme.spacing.xs, paddingHorizontal: theme.spacing.sm, paddingVertical: theme.spacing.xs, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radii.full, backgroundColor: theme.colors.surfaceLow },
  liveDot: { width: 7, height: 7, borderRadius: theme.radii.full, backgroundColor: theme.colors.accent },
  liveText: { color: theme.colors.textMuted, fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  activeCard: { marginBottom: theme.spacing.lg },
  startCard: { marginBottom: theme.spacing.lg },
  cardTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: theme.spacing.sm },
  cardLabelRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  cardLabel: { color: theme.colors.textMuted, fontSize: theme.typography.label.fontSize, fontWeight: theme.typography.label.fontWeight, letterSpacing: 1.2 },
  cardMeta: { color: theme.colors.accent, fontSize: theme.typography.label.fontSize, fontWeight: "700" },
  activeTitle: { marginTop: theme.spacing.md, color: theme.colors.text, fontSize: theme.typography.section.fontSize, fontWeight: theme.typography.section.fontWeight },
  startTitle: { marginTop: theme.spacing.md, color: theme.colors.text, fontSize: theme.typography.headline.fontSize, fontWeight: theme.typography.headline.fontWeight },
  activeDescription: { marginTop: theme.spacing.xs, color: theme.colors.textMuted, fontSize: theme.typography.bodySmall.fontSize },
  startDescription: { marginTop: theme.spacing.sm, color: theme.colors.textMuted, fontSize: theme.typography.bodySmall.fontSize, lineHeight: theme.typography.bodySmall.lineHeight },
  fullButton: { marginTop: theme.spacing.md },
  targetCard: { marginBottom: theme.spacing.lg },
  targetRow: { flexDirection: "row", alignItems: "baseline", gap: theme.spacing.sm, marginBottom: theme.spacing.sm },
  targetValue: { color: theme.colors.accent, fontSize: 28, fontWeight: "800" },
  targetText: { color: theme.colors.textMuted, fontSize: theme.typography.bodySmall.fontSize },
  quickGrid: { flexDirection: "row", gap: theme.spacing.sm, marginBottom: theme.spacing.lg },
  quickCard: { flex: 1, minHeight: 118, padding: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radii.xl, backgroundColor: theme.colors.surface },
  quickTitle: { marginTop: theme.spacing.md, color: theme.colors.text, fontSize: theme.typography.bodySmall.fontSize, fontWeight: "700" },
  quickText: { marginTop: theme.spacing.xs, color: theme.colors.textSubtle, fontSize: 12 },
  cardTitle: { color: theme.colors.text, fontSize: theme.typography.section.fontSize, fontWeight: theme.typography.section.fontWeight },
  cardText: { marginTop: theme.spacing.sm, color: theme.colors.textMuted, fontSize: theme.typography.bodySmall.fontSize, lineHeight: theme.typography.bodySmall.lineHeight },
  compactButton: { alignSelf: "flex-start", marginTop: theme.spacing.md },
  weightRow: { flexDirection: "row", justifyContent: "space-between", gap: theme.spacing.md },
  weightChange: { flex: 1, alignItems: "flex-end" },
  metricLabel: { color: theme.colors.textSubtle, fontSize: theme.typography.label.fontSize, fontWeight: theme.typography.label.fontWeight, letterSpacing: 1 },
  largeMetric: { marginTop: theme.spacing.xs, color: theme.colors.text, fontSize: 30, fontWeight: "800" },
  metricUnit: { color: theme.colors.accent, fontSize: theme.typography.label.fontSize },
  changeValue: { marginTop: theme.spacing.xs, color: theme.colors.accent, fontSize: 20, fontWeight: "700" },
  accentText: { color: theme.colors.accent, fontSize: theme.typography.label.fontSize, fontWeight: "700" },
  syncedLabel: { color: theme.colors.accent, fontSize: theme.typography.label.fontSize, fontWeight: "700" },
  historyCard: { marginBottom: theme.spacing.sm, padding: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radii.xl, backgroundColor: theme.colors.surface },
  emptyText: { marginBottom: theme.spacing.lg, color: theme.colors.textMuted, fontSize: theme.typography.bodySmall.fontSize },
  error: { marginBottom: theme.spacing.md, color: theme.colors.danger, fontSize: theme.typography.bodySmall.fontSize },
  pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
});
