import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { randomUUID } from "expo-crypto";
import { useFocusEffect, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";

import { localDateForTimezone } from "@/src/domain/time";
import type { Workout } from "@/src/db/types";
import { ProfileRepository } from "@/src/repositories/profile-repository";
import { WorkoutRepository } from "@/src/repositories/workout-repository";

export default function TrainScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [activeWorkout, setActiveWorkout] = useState<Workout | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      async function loadActiveWorkout() {
        setIsLoading(true);
        const workout = await new WorkoutRepository(db).getActiveWorkout();
        if (mounted) {
          setActiveWorkout(workout);
          setIsLoading(false);
        }
      }

      void loadActiveWorkout();
      return () => {
        mounted = false;
      };
    }, [db]),
  );

  if (isLoading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color="#ea7a53" />
      </View>
    );
  }

  async function openWorkout() {
    if (activeWorkout) {
      router.push({
        pathname: "/active-workout",
        params: { workoutId: activeWorkout.id },
      });
      return;
    }

    setError(null);
    setIsStarting(true);
    try {
      const profile = await new ProfileRepository(db).getProfile();
      if (!profile) {
        router.replace("/onboarding");
        return;
      }

      const startedAt = new Date().toISOString();
      const workout = await new WorkoutRepository(db).createWorkout({
        id: randomUUID(),
        startedAt,
        timezoneId: profile.timezoneId,
        localDate: localDateForTimezone(startedAt, profile.timezoneId),
        bodyweightKg: profile.bodyweightKg,
        exerciseIds: [],
      });

      router.push({
        pathname: "/active-workout",
        params: { workoutId: workout.id },
      });
    } catch {
      setError("Could not start a workout. Please try again.");
    } finally {
      setIsStarting(false);
    }
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.eyebrow}>TRAIN</Text>
      <Text style={styles.title}>
        {activeWorkout ? "Your workout is waiting." : "Ready to train?"}
      </Text>
      <Text style={styles.subtitle}>
        {activeWorkout
          ? "You have an unfinished workout saved on this phone."
          : "Start now, then add exercises as your session develops."}
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>
          {activeWorkout ? "ACTIVE WORKOUT" : "NEW WORKOUT"}
        </Text>
        <Text style={styles.cardTitle}>
          {activeWorkout
            ? `${activeWorkout.exercises.length} exercises selected`
            : "Log your first session"}
        </Text>
        <Text style={styles.cardText}>
          Your sets are saved locally as you train. You can add or change
          exercises while the workout is in progress.
        </Text>
        <Pressable
          onPress={openWorkout}
          disabled={isStarting}
          style={({ pressed }) => [
            styles.button,
            pressed && styles.pressed,
            isStarting && styles.disabled,
          ]}
        >
          {isStarting ? (
            <ActivityIndicator color="#fff9e3" />
          ) : (
            <Text style={styles.buttonText}>
              {activeWorkout ? "Resume workout" : "Start workout"}
            </Text>
          )}
        </Pressable>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    padding: 24,
    paddingTop: 64,
    backgroundColor: "#fff9e3",
  },
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff9e3",
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
    fontSize: 32,
    fontWeight: "800",
    lineHeight: 38,
  },
  subtitle: {
    marginTop: 12,
    color: "rgba(0, 0, 0, 0.6)",
    fontSize: 16,
    lineHeight: 23,
  },
  card: {
    marginTop: 32,
    padding: 22,
    borderRadius: 20,
    backgroundColor: "#ea7a53",
  },
  cardLabel: {
    color: "rgba(255, 249, 227, 0.75)",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  cardTitle: {
    marginTop: 10,
    color: "#fff9e3",
    fontSize: 24,
    fontWeight: "800",
  },
  cardText: {
    marginTop: 10,
    color: "rgba(255, 249, 227, 0.88)",
    fontSize: 15,
    lineHeight: 22,
  },
  button: {
    alignSelf: "flex-start",
    marginTop: 20,
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: "#081126",
  },
  buttonText: {
    color: "#fff9e3",
    fontSize: 14,
    fontWeight: "800",
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.55,
  },
  error: {
    marginTop: 16,
    color: "#dc2626",
    fontSize: 14,
  },
});
