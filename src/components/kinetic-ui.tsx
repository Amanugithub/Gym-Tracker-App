import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { theme } from "@/src/theme";

export interface KineticScreenProps {
  readonly children: ReactNode;
  readonly contentContainerStyle?: StyleProp<ViewStyle>;
  readonly scroll?: boolean;
}

export function KineticScreen({
  children,
  contentContainerStyle,
  scroll = true,
}: KineticScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      {scroll ? (
        <ScrollView
          style={styles.screen}
          contentContainerStyle={[styles.content, contentContainerStyle]}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.screen, styles.content, contentContainerStyle]}>
          {children}
        </View>
      )}
    </SafeAreaView>
  );
}

export interface ScreenHeaderProps {
  readonly eyebrow: string;
  readonly title: string;
  readonly subtitle?: string;
  readonly trailing?: ReactNode;
}

export function ScreenHeader({ eyebrow, title, subtitle, trailing }: ScreenHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.headerText}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {trailing}
    </View>
  );
}

export interface GlassCardProps {
  readonly children: ReactNode;
  readonly style?: StyleProp<ViewStyle>;
  readonly active?: boolean;
}

export function GlassCard({ children, style, active = false }: GlassCardProps) {
  return <View style={[styles.card, active && styles.activeCard, style]}>{children}</View>;
}

export interface SectionLabelProps {
  readonly children: string;
  readonly trailing?: string;
}

export function SectionLabel({ children, trailing }: SectionLabelProps) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionLabel}>{children}</Text>
      {trailing ? <Text style={styles.sectionTrailing}>{trailing}</Text> : null}
    </View>
  );
}

export interface PrimaryButtonProps {
  readonly label: string;
  readonly onPress: () => void;
  readonly disabled?: boolean;
  readonly loading?: boolean;
  readonly style?: StyleProp<ViewStyle>;
}

export function PrimaryButton({ label, onPress, disabled = false, loading = false, style }: PrimaryButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.primaryButton,
        style,
        pressed && styles.pressed,
        (disabled || loading) && styles.disabled,
      ]}
    >
      {loading ? <ActivityIndicator color={theme.colors.accentText} /> : <Text style={styles.primaryButtonText}>{label}</Text>}
    </Pressable>
  );
}

export interface SecondaryButtonProps {
  readonly label: string;
  readonly onPress: () => void;
  readonly style?: StyleProp<ViewStyle>;
}

export function SecondaryButton({ label, onPress, style }: SecondaryButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.secondaryButton, style, pressed && styles.pressed]}
    >
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  );
}

export interface MetricCardProps {
  readonly label: string;
  readonly value: string;
  readonly unit?: string;
  readonly supporting?: string;
  readonly style?: StyleProp<ViewStyle>;
}

export function MetricCard({ label, value, unit, supporting, style }: MetricCardProps) {
  return (
    <GlassCard style={[styles.metricCard, style]}>
      <Text style={styles.metricLabel}>{label}</Text>
      <View style={styles.metricValueRow}>
        <Text style={styles.metricValue}>{value}</Text>
        {unit ? <Text style={styles.metricUnit}>{unit}</Text> : null}
      </View>
      {supporting ? <Text style={styles.metricSupporting}>{supporting}</Text> : null}
    </GlassCard>
  );
}

export interface ProgressBarProps {
  readonly progress: number;
  readonly style?: StyleProp<ViewStyle>;
}

export function ProgressBar({ progress, style }: ProgressBarProps) {
  const boundedProgress = Math.max(0, Math.min(1, progress));
  return (
    <View style={[styles.progressTrack, style]}>
      <View style={[styles.progressFill, { width: `${boundedProgress * 100}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.canvas },
  screen: { flex: 1, backgroundColor: theme.colors.canvas },
  content: { padding: theme.spacing.gutter, paddingBottom: 36 },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  headerText: { flex: 1 },
  eyebrow: {
    color: theme.colors.accent,
    fontSize: theme.typography.label.fontSize,
    fontWeight: theme.typography.label.fontWeight,
    letterSpacing: 1.4,
    lineHeight: theme.typography.label.lineHeight,
  },
  title: {
    marginTop: theme.spacing.sm,
    color: theme.colors.text,
    fontSize: theme.typography.headline.fontSize,
    fontWeight: theme.typography.headline.fontWeight,
    lineHeight: theme.typography.headline.lineHeight,
  },
  subtitle: {
    marginTop: theme.spacing.sm,
    color: theme.colors.textMuted,
    fontSize: theme.typography.bodySmall.fontSize,
    lineHeight: theme.typography.bodySmall.lineHeight,
  },
  card: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radii.xl,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
  },
  activeCard: { borderColor: theme.colors.borderActive },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: theme.spacing.sm,
  },
  sectionLabel: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.label.fontSize,
    fontWeight: theme.typography.label.fontWeight,
    letterSpacing: 1.2,
    lineHeight: theme.typography.label.lineHeight,
    textTransform: "uppercase",
  },
  sectionTrailing: {
    color: theme.colors.textSubtle,
    fontSize: theme.typography.label.fontSize,
    fontWeight: theme.typography.label.fontWeight,
  },
  primaryButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.accent,
  },
  primaryButtonText: { color: theme.colors.accentText, fontSize: 14, fontWeight: "800" },
  secondaryButton: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    borderRadius: theme.radii.full,
    backgroundColor: theme.colors.surfaceLow,
  },
  secondaryButtonText: { color: theme.colors.text, fontSize: 14, fontWeight: "600" },
  metricCard: { flex: 1, minWidth: "46%" },
  metricLabel: {
    color: theme.colors.textSubtle,
    fontSize: theme.typography.label.fontSize,
    fontWeight: theme.typography.label.fontWeight,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  metricValueRow: { flexDirection: "row", alignItems: "baseline", gap: theme.spacing.xs, marginTop: theme.spacing.sm },
  metricValue: { color: theme.colors.text, fontSize: theme.typography.metric.fontSize, fontWeight: theme.typography.metric.fontWeight },
  metricUnit: { color: theme.colors.accent, fontSize: theme.typography.label.fontSize, fontWeight: "700" },
  metricSupporting: { marginTop: theme.spacing.xs, color: theme.colors.textMuted, fontSize: theme.typography.label.fontSize },
  progressTrack: { height: 6, overflow: "hidden", borderRadius: theme.radii.full, backgroundColor: theme.colors.surfaceHigh },
  progressFill: { height: "100%", borderRadius: theme.radii.full, backgroundColor: theme.colors.accent },
  pressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.5 },
});
