import * as SecureStore from "expo-secure-store";

const AUTH_MODE_KEY = "gym_tracker_auth_mode";
const GOOGLE_ID_TOKEN_KEY = "gym_tracker_google_id_token";

export type AuthMode = "google" | "local";

export async function setGoogleSession(idToken: string): Promise<void> {
  await SecureStore.setItemAsync(AUTH_MODE_KEY, "google");
  await SecureStore.setItemAsync(GOOGLE_ID_TOKEN_KEY, idToken);
}

export async function setLocalSession(): Promise<void> {
  await SecureStore.setItemAsync(AUTH_MODE_KEY, "local");
  await SecureStore.deleteItemAsync(GOOGLE_ID_TOKEN_KEY);
}

export async function getAuthMode(): Promise<AuthMode | null> {
  const mode = await SecureStore.getItemAsync(AUTH_MODE_KEY);
  return mode === "google" || mode === "local" ? mode : null;
}

export async function getGoogleIdToken(): Promise<string | null> {
  if ((await getAuthMode()) !== "google") return null;

  const storedToken = await SecureStore.getItemAsync(GOOGLE_ID_TOKEN_KEY);

  // GoogleSignin refreshes the ID token when possible. The dynamic import keeps
  // the rest of the app usable in Expo Go, where the native module is absent.
  try {
    const { GoogleSignin } = await import("@react-native-google-signin/google-signin");
    const tokens = await GoogleSignin.getTokens();
    if (tokens.idToken) {
      await SecureStore.setItemAsync(GOOGLE_ID_TOKEN_KEY, tokens.idToken);
      return tokens.idToken;
    }
  } catch {
    // The stored token is still useful for local development and offline work.
  }

  return storedToken;
}
