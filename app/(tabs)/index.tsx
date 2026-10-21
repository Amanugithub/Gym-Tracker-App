import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";

import { ProfileRepository } from "@/src/repositories/profile-repository";
import { getAuthMode } from "@/src/auth/session";

export default function HomeScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [name, setName] = useState("there");

  useEffect(() => {
    let mounted = true;

    async function loadName() {
      try {
        const authMode = await getAuthMode();
        if (!authMode) {
          router.replace("/(auth)/sign-in");
          return;
        }
        const profile = await new ProfileRepository(db).getProfile();
        if (!mounted) return;
        if (!profile) {
          router.replace("/onboarding");
          return;
        }
        if (profile.displayName) setName(profile.displayName);
      } catch {
        // The home screen can still render its empty state if profile loading fails.
      }
    }

    void loadName();
    return () => {
      mounted = false;
    };
  }, [db, router]);

  return (
    <View style={styles.screen}>
      <Text style={styles.eyebrow}>HOME</Text>
      <Text style={styles.title}>Good to see you, {name}.</Text>
      <Text style={styles.subtitle}>
        Your training space is ready. Workout logging is the next part we are
        building.
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>YOUR NEXT STEP</Text>
        <Text style={styles.cardTitle}>Start your first workout</Text>
        <Text style={styles.cardText}>
          Soon you will choose an exercise and record every set here, even
          without an internet connection.
        </Text>
        <Pressable
          onPress={() => router.push("/subscriptions")}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        >
          <Text style={styles.buttonText}>Start workout</Text>
        </Pressable>
      </View>
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
});
