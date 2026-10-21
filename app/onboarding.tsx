import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { randomUUID } from "expo-crypto";
import { useSQLiteContext } from "expo-sqlite";

import type { Locale, Unit } from "@/src/db/types";
import { localDateForTimezone } from "@/src/domain/time";
import { formatWeight, weightToKg } from "@/src/domain/units";
import { BodyWeightRepository } from "@/src/repositories/body-weight-repository";
import { ProfileRepository } from "@/src/repositories/profile-repository";

const DEFAULT_TIMEZONE = "Africa/Addis_Ababa";

export default function OnboardingScreen() {
  const db = useSQLiteContext();
  const router = useRouter();

  const [displayName, setDisplayName] = useState("");
  const [timezoneId, setTimezoneId] = useState(DEFAULT_TIMEZONE);
  const [unit, setUnit] = useState<Unit>("kg");
  const [language, setLanguage] = useState<Locale>("en");
  const [weeklyTarget, setWeeklyTarget] = useState("4");
  const [bodyweightKg, setBodyweightKg] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      try {
        const profile = await new ProfileRepository(db).getProfile();
        if (!mounted || !profile) return;

        setDisplayName(profile.displayName ?? "");
        setTimezoneId(profile.timezoneId);
        setUnit(profile.unit);
        setLanguage(profile.language);
        setWeeklyTarget(String(profile.weeklyTarget));
        setHeightCm(profile.heightCm === null ? "" : String(profile.heightCm));
        setBodyweightKg(
          profile.bodyweightKg === null
            ? ""
            : formatWeight(profile.bodyweightKg, profile.unit),
        );
      } catch {
        if (mounted) setError("Could not load your saved profile.");
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    void loadProfile();
    return () => {
      mounted = false;
    };
  }, [db]);

  async function handleSave() {
    const cleanName = displayName.trim();
    const target = Number(weeklyTarget);
    const enteredWeight = bodyweightKg.trim() === "" ? null : Number(bodyweightKg);
    const weight = enteredWeight === null ? null : weightToKg(enteredWeight, unit);
    const enteredHeight = heightCm.trim() === "" ? null : Number(heightCm);

    if (!cleanName) {
      setError("Please enter your name.");
      return;
    }
    if (!Number.isInteger(target) || target < 1 || target > 7) {
      setError("Your weekly target must be a whole number from 1 to 7.");
      return;
    }
    if (weight !== null && (!Number.isFinite(weight) || weight <= 0)) {
      setError("Bodyweight must be a positive number, or left empty.");
      return;
    }
    if (
      enteredHeight !== null &&
      (!Number.isFinite(enteredHeight) || enteredHeight < 50 || enteredHeight > 300)
    ) {
      setError("Height must be between 50 and 300 cm, or left empty.");
      return;
    }
    if (!timezoneId.trim()) {
      setError("Please enter your timezone.");
      return;
    }

    setError(null);
    setIsSaving(true);
    try {
      await new ProfileRepository(db).saveProfile({
        displayName: cleanName,
        timezoneId: timezoneId.trim(),
        unit,
        language,
        weeklyTarget: target,
        bodyweightKg: weight,
        heightCm: enteredHeight,
      });
      const bodyWeightRepository = new BodyWeightRepository(db);
      if (weight === null) {
        await bodyWeightRepository.refreshProfileCurrentWeight();
      } else {
        const measuredAt = new Date().toISOString();
        await bodyWeightRepository.recordIfChanged({
          id: randomUUID(),
          weightKg: weight,
          measuredAt,
          timezoneId: timezoneId.trim(),
          localDate: localDateForTimezone(measuredAt, timezoneId.trim()),
        });
      }
      router.replace("/(tabs)");
    } catch {
      setError("Could not save your profile. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color="#ea7a53" />
        <Text style={styles.loadingText}>Loading your profile...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.eyebrow}>GYM TRACKER</Text>
        <Text style={styles.title}>Set up your training space.</Text>
        <Text style={styles.subtitle}>
          These details stay on this phone and help us calculate your progress.
        </Text>

        <View style={styles.form}>
          <FieldLabel label="Your name" />
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Amanuel"
            placeholderTextColor="#8b8d96"
            autoCapitalize="words"
            style={styles.input}
          />

          <FieldLabel label="Timezone" />
          <TextInput
            value={timezoneId}
            onChangeText={setTimezoneId}
            placeholder={DEFAULT_TIMEZONE}
            placeholderTextColor="#8b8d96"
            autoCapitalize="none"
            style={styles.input}
          />
          <Text style={styles.helpText}>
            Use an IANA timezone such as Africa/Addis_Ababa.
          </Text>

          <FieldLabel label="Preferred unit" />
          <ChoiceRow<Unit>
            choices={["kg", "lb"]}
            selected={unit}
            onSelect={setUnit}
          />

          <FieldLabel label="Language" />
          <ChoiceRow<Locale>
            choices={["en", "am"]}
            labels={{ en: "English", am: "አማርኛ" }}
            selected={language}
            onSelect={setLanguage}
          />

          <FieldLabel label="Weekly workout target" />
          <TextInput
            value={weeklyTarget}
            onChangeText={setWeeklyTarget}
            placeholder="4"
            placeholderTextColor="#8b8d96"
            keyboardType="number-pad"
            style={styles.input}
          />

          <FieldLabel label={`Current bodyweight in ${unit} (optional)`} />
          <TextInput
            value={bodyweightKg}
            onChangeText={setBodyweightKg}
            placeholder="75"
            placeholderTextColor="#8b8d96"
            keyboardType="decimal-pad"
            style={styles.input}
          />

          <FieldLabel label="Height in cm (optional)" />
          <TextInput
            value={heightCm}
            onChangeText={setHeightCm}
            placeholder="175"
            placeholderTextColor="#8b8d96"
            keyboardType="decimal-pad"
            style={styles.input}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            onPress={handleSave}
            disabled={isSaving}
            style={({ pressed }) => [
              styles.saveButton,
              pressed && styles.pressed,
              isSaving && styles.disabled,
            ]}
          >
            {isSaving ? (
              <ActivityIndicator color="#fff9e3" />
            ) : (
              <Text style={styles.saveButtonText}>Save and continue</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function FieldLabel({ label }: { label: string }) {
  return <Text style={styles.label}>{label}</Text>;
}

function ChoiceRow<T extends string>({
  choices,
  labels,
  selected,
  onSelect,
}: {
  choices: readonly T[];
  labels?: Partial<Record<T, string>>;
  selected: T;
  onSelect: (choice: T) => void;
}) {
  return (
    <View style={styles.choiceRow}>
      {choices.map((choice) => {
        const isSelected = choice === selected;
        return (
          <Pressable
            key={choice}
            onPress={() => onSelect(choice)}
            style={[styles.choice, isSelected && styles.choiceSelected]}
          >
            <Text
              style={[
                styles.choiceText,
                isSelected && styles.choiceTextSelected,
              ]}
            >
              {labels?.[choice] ?? choice.toUpperCase()}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#fff9e3",
  },
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "#fff9e3",
  },
  loadingText: {
    color: "#081126",
    fontSize: 15,
  },
  content: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 64,
  },
  eyebrow: {
    color: "#ea7a53",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 2,
  },
  title: {
    maxWidth: 340,
    marginTop: 12,
    color: "#081126",
    fontSize: 34,
    fontWeight: "800",
    lineHeight: 40,
  },
  subtitle: {
    maxWidth: 340,
    marginTop: 12,
    color: "rgba(0, 0, 0, 0.6)",
    fontSize: 16,
    lineHeight: 23,
  },
  form: {
    marginTop: 32,
    gap: 10,
  },
  label: {
    marginTop: 10,
    color: "#081126",
    fontSize: 15,
    fontWeight: "700",
  },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: "rgba(8, 17, 38, 0.15)",
    borderRadius: 14,
    paddingHorizontal: 16,
    color: "#081126",
    backgroundColor: "#fff8e7",
    fontSize: 16,
  },
  helpText: {
    marginTop: -3,
    color: "rgba(0, 0, 0, 0.5)",
    fontSize: 12,
  },
  choiceRow: {
    flexDirection: "row",
    gap: 10,
  },
  choice: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(8, 17, 38, 0.15)",
    borderRadius: 14,
    backgroundColor: "#fff8e7",
  },
  choiceSelected: {
    borderColor: "#081126",
    backgroundColor: "#081126",
  },
  choiceText: {
    color: "#081126",
    fontSize: 15,
    fontWeight: "700",
  },
  choiceTextSelected: {
    color: "#fff9e3",
  },
  error: {
    marginTop: 8,
    color: "#dc2626",
    fontSize: 14,
    lineHeight: 20,
  },
  saveButton: {
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
    borderRadius: 16,
    backgroundColor: "#ea7a53",
  },
  saveButtonText: {
    color: "#fff9e3",
    fontSize: 16,
    fontWeight: "800",
  },
  pressed: {
    opacity: 0.82,
  },
  disabled: {
    opacity: 0.55,
  },
});
