import { Stack } from "expo-router";
import { SQLiteProvider } from "expo-sqlite";
import {
  SafeAreaProvider,
  SafeAreaView,
} from "react-native-safe-area-context";

import "@/global.css";
import { initializeGymDatabase } from "@/src/db";

export default function RootLayout() {
  return (
    <SQLiteProvider
      databaseName="gym-tracker.db"
      onInit={initializeGymDatabase}
    >
      <SafeAreaProvider>
        <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
          <Stack screenOptions={{ headerShown: false }} />
        </SafeAreaView>
      </SafeAreaProvider>
    </SQLiteProvider>
  );
}
