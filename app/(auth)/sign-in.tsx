import React, { useState } from "react";
import { Link, useRouter } from "expo-router";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { setGoogleSession, setLocalSession } from "@/src/auth/session";

const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

const SignIn = () => {
  const router = useRouter();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signInWithGoogle() {
    if (!googleWebClientId) {
      setError("Google sign-in is not configured yet. Add the Google client IDs first.");
      return;
    }

    setError(null);
    setIsSigningIn(true);
    try {
      const {
        GoogleSignin,
        isSuccessResponse,
      } = await import("@react-native-google-signin/google-signin");

      GoogleSignin.configure({
        webClientId: googleWebClientId,
        iosClientId: googleIosClientId,
      });
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const response = await GoogleSignin.signIn();
      if (!isSuccessResponse(response) || !response.data.idToken) {
        setError("Google sign-in was cancelled or did not return an ID token.");
        return;
      }

      await setGoogleSession(response.data.idToken);
      router.replace("/onboarding");
    } catch (signInError) {
      const message = signInError instanceof Error ? signInError.message : "Google sign-in failed.";
      setError(message);
    } finally {
      setIsSigningIn(false);
    }
  }

  async function continueLocally() {
    await setLocalSession();
    router.replace("/onboarding");
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Sign in</Text>
      <Text style={styles.subtitle}>
        Sign in to keep your workout history when you change or reinstall your phone.
      </Text>

      <Pressable
        onPress={() => void signInWithGoogle()}
        disabled={isSigningIn}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        {isSigningIn ? <ActivityIndicator color="#fff9e3" /> : <Text style={styles.buttonText}>Continue with Google</Text>}
      </Pressable>

      <Pressable onPress={() => void continueLocally()} style={styles.localButton}>
        <Text style={styles.localButtonText}>Continue without an account</Text>
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}

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
  localButton: {
    alignSelf: "center",
    marginTop: 16,
    padding: 8,
  },
  localButtonText: {
    color: "rgba(0, 0, 0, 0.58)",
    fontSize: 13,
    fontWeight: "700",
  },
  error: {
    marginTop: 18,
    color: "#b42318",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
  pressed: {
    opacity: 0.8,
  },
});

export default SignIn;
