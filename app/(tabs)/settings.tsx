import { useCallback, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { randomUUID } from "expo-crypto";
import { useSQLiteContext } from "expo-sqlite";

import { resetGymDatabase } from "@/src/db";
import { localDateForTimezone } from "@/src/domain/time";
import { formatWeight, weightToKg } from "@/src/domain/units";
import type { Profile } from "@/src/db/types";
import { BodyWeightRepository } from "@/src/repositories/body-weight-repository";
import { ProfileRepository } from "@/src/repositories/profile-repository";
import { getSyncStatus, syncNow } from "@/src/sync/sync-service";

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [weight, setWeight] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      void new ProfileRepository(db).getProfile().then((loaded) => {
        if (!mounted) return;
        setProfile(loaded);
        setWeight(
          loaded?.bodyweightKg === null || !loaded
            ? ""
            : formatWeight(loaded.bodyweightKg, loaded.unit),
        );
      });
      void getSyncStatus(db).then((status) => {
        if (!mounted) return;
        setSyncMessage(
          status.lastSuccess
            ? `Last synced: ${new Date(status.lastSuccess).toLocaleString()}`
            : status.lastError
              ? "Sync is waiting for a connection."
              : "Not synced yet.",
        );
      });
      return () => {
        mounted = false;
      };
    }, [db]),
  );

  async function logWeight() {
    if (!profile) return;
    const enteredWeight = Number(weight);
    const weightKg = weightToKg(enteredWeight, profile.unit);
    if (!Number.isFinite(weightKg) || weightKg <= 0) {
      setError("Enter a positive bodyweight.");
      return;
    }

    setError(null);
    setIsSaving(true);
    try {
      const measuredAt = new Date().toISOString();
      await new BodyWeightRepository(db).recordIfChanged({
        id: randomUUID(),
        weightKg,
        measuredAt,
        timezoneId: profile.timezoneId,
        localDate: localDateForTimezone(measuredAt, profile.timezoneId),
      });
      const updated = await new ProfileRepository(db).getProfile();
      setProfile(updated);
      setWeight(
        updated?.bodyweightKg === null || !updated
          ? ""
          : formatWeight(updated.bodyweightKg, updated.unit),
      );
    } catch {
      setError("Could not save this bodyweight measurement.");
    } finally {
      setIsSaving(false);
    }
  }

  async function syncData() {
    setIsSyncing(true);
    const result = await syncNow(db);
    setSyncMessage(result.success ? `Last synced: ${new Date(result.syncedAt ?? Date.now()).toLocaleString()}` : "Sync is waiting for a connection.");
    setIsSyncing(false);
    if (!result.success) setError("Could not sync right now. Your local data is safe.");
    else setError(null);
  }

  function resetLocalData() {
    Alert.alert(
      "Reset local data?",
      "This deletes your profile, workouts, and sets from this device.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: () => {
            void (async () => {
              await resetGymDatabase(db);
              router.replace("/onboarding");
            })();
          },
        },
      ],
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.eyebrow}>PROFILE</Text>
      <Text style={styles.title}>{profile?.displayName ?? "Your profile"}</Text>
      <Text style={styles.subtitle}>
        Your settings and workout data are stored locally on this phone.
      </Text>

      {profile ? (
        <View style={styles.card}>
          <Text style={styles.row}>Unit: {profile.unit.toUpperCase()}</Text>
          <Text style={styles.row}>Weekly target: {profile.weeklyTarget} workouts</Text>
          <Text style={styles.row}>Timezone: {profile.timezoneId}</Text>
          <Text style={styles.row}>
            Height: {profile.heightCm === null ? "Not set" : `${profile.heightCm} cm`}
          </Text>
        </View>
      ) : null}

      {profile ? (
        <View style={styles.weightCard}>
          <Text style={styles.weightTitle}>Log bodyweight</Text>
          <Text style={styles.weightHelp}>
            Measurements are saved over time for weight and BMI progress.
          </Text>
          <TextInput
            value={weight}
            onChangeText={setWeight}
            keyboardType="decimal-pad"
            placeholder={`Weight in ${profile.unit}`}
            placeholderTextColor="#8b8d96"
            style={styles.input}
          />
          <Pressable
            onPress={() => void logWeight()}
            disabled={isSaving}
            style={styles.smallButton}
          >
            <Text style={styles.buttonText}>{isSaving ? "Saving..." : "Save measurement"}</Text>
          </Pressable>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      ) : null}

      <Pressable onPress={() => router.push("/onboarding")} style={styles.button}>
        <Text style={styles.buttonText}>Edit profile</Text>
      </Pressable>
      <View style={styles.syncCard}>
        <Text style={styles.weightTitle}>Cloud sync</Text>
        <Text style={styles.weightHelp}>
          Finished workouts and profile data are copied to your local backend.
        </Text>
        <Pressable onPress={() => void syncData()} disabled={isSyncing} style={styles.smallButton}>
          <Text style={styles.buttonText}>{isSyncing ? "Syncing..." : "Sync now"}</Text>
        </Pressable>
        {syncMessage ? <Text style={styles.syncMessage}>{syncMessage}</Text> : null}
      </View>
      <Pressable onPress={resetLocalData} style={styles.resetButton}>
        <Text style={styles.resetText}>Reset local data</Text>
      </Pressable>
    </ScrollView>
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
  },
  subtitle: {
    marginTop: 10,
    color: "rgba(0, 0, 0, 0.6)",
    fontSize: 15,
    lineHeight: 22,
  },
  card: {
    gap: 10,
    marginTop: 26,
    padding: 18,
    borderRadius: 16,
    backgroundColor: "#fff8e7",
  },
  row: {
    color: "#081126",
    fontSize: 15,
  },
  button: {
    alignItems: "center",
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#081126",
  },
  buttonText: {
    color: "#fff9e3",
    fontWeight: "800",
  },
  weightCard: {
    marginTop: 18,
    padding: 18,
    borderRadius: 16,
    backgroundColor: "#fff8e7",
  },
  syncCard: {
    marginTop: 18,
    padding: 18,
    borderRadius: 16,
    backgroundColor: "#eaf2ff",
  },
  syncMessage: {
    marginTop: 10,
    color: "rgba(0, 0, 0, 0.58)",
    fontSize: 12,
  },
  weightTitle: {
    color: "#081126",
    fontSize: 17,
    fontWeight: "800",
  },
  weightHelp: {
    marginTop: 6,
    color: "rgba(0, 0, 0, 0.58)",
    fontSize: 13,
    lineHeight: 19,
  },
  input: {
    minHeight: 50,
    marginTop: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "rgba(8, 17, 38, 0.15)",
    borderRadius: 12,
    color: "#081126",
    backgroundColor: "#fffdf5",
  },
  smallButton: {
    alignSelf: "flex-start",
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: "#081126",
  },
  error: {
    marginTop: 10,
    color: "#b42318",
    fontSize: 13,
  },
  resetButton: {
    alignItems: "center",
    marginTop: 14,
    paddingVertical: 14,
  },
  resetText: {
    color: "#dc2626",
    fontWeight: "800",
  },
});
