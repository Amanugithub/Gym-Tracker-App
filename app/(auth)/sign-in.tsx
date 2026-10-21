import React from "react";
import { Link, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

const SignIn = () => {
  const router = useRouter();

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Sign in</Text>
      <Text style={styles.subtitle}>
        Account sign-in is not connected yet.
      </Text>

      <Pressable
        onPress={() => router.replace("/onboarding")}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <Text style={styles.buttonText}>Continue locally</Text>
      </Pressable>

      <Link href="/(auth)/sign-up" style={styles.link}>
        Create account
      </Link>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#fff9e3",
  },
  title: {
    color: "#081126",
    fontSize: 32,
    fontWeight: "800",
  },
  subtitle: {
    marginTop: 10,
    color: "rgba(0, 0, 0, 0.6)",
    fontSize: 16,
  },
  button: {
    marginTop: 28,
    alignItems: "center",
    paddingVertical: 15,
    borderRadius: 12,
    backgroundColor: "#081126",
  },
  buttonText: {
    color: "#fff9e3",
    fontSize: 15,
    fontWeight: "800",
  },
  link: {
    alignSelf: "center",
    marginTop: 20,
    color: "#ea7a53",
    fontSize: 15,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.8,
  },
});

export default SignIn;
