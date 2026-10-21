import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";

import { localDateForTimezone } from "@/src/domain/time";
import {
  calculateWeightProgress,
  type WeightProgress,
} from "@/src/domain/body-weight";
import {
  calculateProgressStats,
  summarizeWorkout,
  type ProgressStats,
} from "@/src/domain/progress";
import type { Unit, Workout } from "@/src/db/types";
import { formatWeight } from "@/src/domain/units";
import { ProfileRepository } from "@/src/repositories/profile-repository";
import { BodyWeightRepository } from "@/src/repositories/body-weight-repository";
import { WorkoutRepository } from "@/src/repositories/workout-repository";

const EMPTY_STATS = calculateProgressStats([]);
const EMPTY_WEIGHT_PROGRESS = calculateWeightProgress([], null);

function formatDate(localDate: string): string {
  const [year, month, day] = localDate.split("-");
  return `${day}/${month}/${year}`;
}

export default function InsightsScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [stats, setStats] = useState<ProgressStats>(EMPTY_STATS);
  const [weightProgress, setWeightProgress] =
    useState<WeightProgress>(EMPTY_WEIGHT_PROGRESS);
  const [unit, setUnit] = useState<Unit>("kg");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      async function loadProgress() {
        setIsLoading(true);
        setError(null);
        try {
          const [history, profile, weightEntries] = await Promise.all([
            new WorkoutRepository(db).listWorkoutHistory(),
            new ProfileRepository(db).getProfile(),
            new BodyWeightRepository(db).listEntries(),
          ]);
          if (!mounted) return;

          const currentLocalDate = profile
            ? localDateForTimezone(new Date().toISOString(), profile.timezoneId)
            : undefined;
          const completedWorkouts = history.filter(
            (workout) => workout.status === "completed",
          );
          setWorkouts(history);
          setUnit(profile?.unit ?? "kg");
          setWeightProgress(
            calculateWeightProgress(weightEntries, profile?.heightCm ?? null),
          );
          setStats(
            calculateProgressStats(completedWorkouts, {
              currentLocalDate,
              weeklyTarget: profile?.weeklyTarget ?? null,
            }),
          );
        } catch {
          if (mounted) setError("Could not load your progress.");
        } finally {
          if (mounted) setIsLoading(false);
        }
      }

      void loadProgress();
      return () => {
        mounted = false;
      };
    }, [db]),
  );

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>PROGRESS</Text>
      <Text style={styles.title}>Your training history.</Text>
      <Text style={styles.subtitle}>
        These numbers come from the workouts saved on this phone.
      </Text>

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color="#ea7a53" />
          <Text style={styles.muted}>Loading progress...</Text>
        </View>
      ) : (
        <>
          <View style={styles.statsGrid}>
            <Stat label="Workouts" value={String(stats.completedWorkoutCount)} />
            <Stat
              label="This week"
              value={`${stats.workoutsThisWeek}/${stats.weeklyTarget ?? "—"}`}
            />
            <Stat label="Total sets" value={String(stats.totalSetCount)} />
            <Stat
              label={`Volume ${unit}`}
              value={formatWeight(stats.totalVolumeKg, unit)}
            />
            <Stat label="Training days" value={String(stats.trainingDayCount)} />
            <Stat label="Current streak" value={`${stats.currentStreak} days`} />
          </View>

          <Text style={styles.sectionTitle}>Body weight</Text>
          {weightProgress.currentWeightKg === null ? (
            <Text style={styles.emptyText}>
              Log a bodyweight measurement from your Profile tab to see progress.
            </Text>
          ) : (
            <View style={styles.weightCard}>
              <View style={styles.weightSummaryRow}>
                <View>
                  <Text style={styles.weightLabel}>Current</Text>
                  <Text style={styles.weightValue}>
                    {formatWeight(weightProgress.currentWeightKg, unit)} {unit}
                  </Text>
                </View>
                <View>
                  <Text style={styles.weightLabel}>Change</Text>
                  <Text style={styles.weightValue}>
                    {formatSignedWeight(weightProgress.changeKg, unit)}
                  </Text>
                </View>
                <View>
                  <Text style={styles.weightLabel}>BMI</Text>
                  <Text style={styles.weightValue}>
                    {formatBmi(weightProgress.currentBmi)}
                  </Text>
                </View>
              </View>
              {weightProgress.points.length > 1 ? (
                <Text style={styles.weightHelp}>
                  From {formatWeight(weightProgress.startingWeightKg!, unit)} {unit} · BMI change {formatSignedNumber(weightProgress.bmiChange)}
                </Text>
              ) : null}
              <View style={styles.weightHistory}>
                {weightProgress.points
                  .slice(-6)
                  .reverse()
                  .map((point) => (
                    <View key={point.entryId} style={styles.weightHistoryRow}>
                      <Text style={styles.historyMeta}>{formatDate(point.localDate)}</Text>
                      <Text style={styles.historyMeta}>
                        {formatWeight(point.weightKg, unit)} {unit}
                        {point.bmi === null ? "" : ` · BMI ${point.bmi.toFixed(1)}`}
                      </Text>
                    </View>
                  ))}
              </View>
            </View>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Text style={styles.sectionTitle}>Recent workouts</Text>
          {workouts.length === 0 ? (
            <Text style={styles.emptyText}>
              Finish a workout and it will appear here.
            </Text>
          ) : (
            workouts.map((workout) => {
              const summary = summarizeWorkout(workout);
              return (
                <Pressable
                  key={workout.id}
                  onPress={() =>
                    router.push({
                      pathname: "/subscriptions/[id]",
                      params: { id: workout.id },
                    })
                  }
                  style={({ pressed }) => [
                    styles.historyCard,
                    pressed && styles.pressed,
                  ]}
                >
                  <View>
                    <Text style={styles.historyDate}>
                      {formatDate(workout.localDate)}
                    </Text>
                    <Text style={styles.historyMeta}>
                      {workout.status === "abandoned" ? "Abandoned · " : ""}
                      {summary.exerciseCount} exercises · {summary.setCount} sets
                    </Text>
                  </View>
                  <Text style={styles.historyVolume}>
                    {workout.status === "abandoned"
                      ? "Not counted"
                      : `${formatWeight(summary.volumeKg, unit)} ${unit}`}
                  </Text>
                </Pressable>
              );
            })
          )}

          <Text style={styles.sectionTitle}>Exercise progress</Text>
          {stats.exercises.length === 0 ? (
            <Text style={styles.emptyText}>
              Exercise bests will appear after your first completed workout.
            </Text>
          ) : (
            stats.exercises.map((exercise) => (
              <View key={exercise.exerciseId} style={styles.exerciseCard}>
                <Text style={styles.exerciseName}>{exercise.name}</Text>
                <Text style={styles.historyMeta}>
                  {exercise.sessionCount} sessions · {exercise.setCount} sets · {exercise.prCount} PRs · heaviest {formatWeight(exercise.heaviestWeightKg, unit)} {unit} × {exercise.heaviestReps} · most reps {formatWeight(exercise.mostRepsWeightKg, unit)} {unit} × {exercise.mostReps}
                  {exercise.bestE1rmKg === null
                    ? ""
                    : ` · e1RM ${formatWeight(exercise.bestE1rmKg, unit)} ${unit}`}
                </Text>
              </View>
            ))
          )}
        </>
      )}
    </ScrollView>
  );
}

function formatSignedWeight(valueKg: number | null, unit: Unit): string {
  if (valueKg === null) return "—";
  const sign = valueKg > 0 ? "+" : valueKg < 0 ? "−" : "";
  return `${sign}${formatWeight(Math.abs(valueKg), unit)} ${unit}`;
}

function formatSignedNumber(value: number | null): string {
  if (value === null) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${Math.abs(value).toFixed(1)}`;
}

function formatBmi(value: number | null): string {
  return value === null ? "Not set" : value.toFixed(1);
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
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
  eyebrow: {
    color: "#ea7a53",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 2,
  },
  title: {
    marginTop: 12,
    color: "#081126",
    fontSize: 30,
    fontWeight: "800",
    lineHeight: 36,
  },
  subtitle: {
    marginTop: 10,
    color: "rgba(0, 0, 0, 0.6)",
    fontSize: 15,
    lineHeight: 22,
  },
  loading: {
    alignItems: "center",
    gap: 12,
    marginTop: 40,
  },
  muted: {
    color: "rgba(0, 0, 0, 0.6)",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 26,
  },
  statCard: {
    width: "48%",
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#ea7a53",
  },
  statValue: {
    color: "#fff9e3",
    fontSize: 24,
    fontWeight: "800",
  },
  statLabel: {
    marginTop: 4,
    color: "rgba(255, 249, 227, 0.8)",
    fontSize: 13,
  },
  sectionTitle: {
    marginTop: 30,
    marginBottom: 12,
    color: "#081126",
    fontSize: 20,
    fontWeight: "800",
  },
  historyCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#fff8e7",
  },
  historyDate: {
    color: "#081126",
    fontSize: 16,
    fontWeight: "800",
  },
  historyMeta: {
    marginTop: 5,
    color: "rgba(0, 0, 0, 0.58)",
    fontSize: 13,
  },
  historyVolume: {
    color: "#ea7a53",
    fontSize: 15,
    fontWeight: "800",
  },
  weightCard: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#fff8e7",
  },
  weightSummaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  weightLabel: {
    color: "rgba(0, 0, 0, 0.58)",
    fontSize: 12,
  },
  weightValue: {
    marginTop: 4,
    color: "#081126",
    fontSize: 17,
    fontWeight: "800",
  },
  weightHelp: {
    marginTop: 14,
    color: "rgba(0, 0, 0, 0.58)",
    fontSize: 12,
  },
  weightHistory: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(8, 17, 38, 0.08)",
  },
  weightHistoryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 8,
  },
  exerciseCard: {
    marginBottom: 10,
    padding: 16,
    borderRadius: 16,
    backgroundColor: "#fff8e7",
  },
  exerciseName: {
    color: "#081126",
    fontSize: 16,
    fontWeight: "800",
  },
  emptyText: {
    color: "rgba(0, 0, 0, 0.6)",
    fontSize: 15,
    lineHeight: 22,
  },
  error: {
    marginTop: 14,
    color: "#b42318",
    fontSize: 14,
  },
  pressed: {
    opacity: 0.75,
  },
});
