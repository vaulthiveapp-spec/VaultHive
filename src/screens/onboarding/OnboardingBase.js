import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import {
  scale,
  getFontSize,
  getSpacing,
  verticalScale,
} from "../../utils/responsive";
import {
  VaultColors,
  VaultRadius,
  VaultShadows,
  VaultSpacing,
} from "../../styles/DesignSystem";

/**
 * OnboardingBase
 *
 * Props:
 *   step          – current step number (1-indexed)
 *   total         – total steps
 *   title         – headline text
 *   subtitle      – body copy
 *   illustration  – (preferred) large SVG scene component, rendered full-size
 *   customIcon    – small icon component rendered inside the gold circle
 *   icon          – Ionicons name string rendered inside the gold circle
 *   primaryLabel  – CTA button label
 *   onPrimary     – CTA press handler
 *   onSkip        – skip press handler
 */
export default function OnboardingBase({
  step = 1,
  total = 3,
  title,
  subtitle,
  illustration,
  icon,
  customIcon,
  primaryLabel,
  onPrimary,
  onSkip,
}) {
  const renderHero = () => {
    if (illustration) {
      return (
        <View style={styles.heroIllustration}>
          {React.createElement(illustration, { size: scale(220) })}
        </View>
      );
    }
    return (
      <View style={styles.heroIconShell}>
        <View style={styles.heroIconCore}>
          {customIcon ? (
            React.createElement(customIcon, {
              size: 34,
              color: VaultColors.buttonTextOnGold,
            })
          ) : (
            <Ionicons
              name={icon}
              size={scale(34)}
              color={VaultColors.buttonTextOnGold}
            />
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Top bar */}
      <View style={styles.topRow}>
        <View style={styles.progressWrap}>
          {Array.from({ length: total }).map((_, i) => (
            <View
              key={i}
              style={[styles.progressDot, i < step && styles.progressDotActive]}
            />
          ))}
        </View>

        <TouchableOpacity
          style={styles.skipBtn}
          activeOpacity={0.85}
          onPress={onSkip}
        >
          <Text style={styles.skipText}>Skip</Text>
          <Ionicons
            name="chevron-forward"
            size={scale(14)}
            color={VaultColors.textSecondary}
          />
        </TouchableOpacity>
      </View>

      {/* Hero */}
      <View style={styles.hero}>
        {renderHero()}
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>

      {/* CTA */}
      <View style={styles.sheet}>
        <TouchableOpacity
          style={styles.primaryBtn}
          activeOpacity={0.9}
          onPress={onPrimary}
        >
          <Text style={styles.primaryBtnText}>{primaryLabel}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: VaultColors.appBackground,
  },

  topRow: {
    paddingHorizontal: VaultSpacing.screenPadding,
    paddingTop: getSpacing(18),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  progressWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: getSpacing(10),
  },

  progressDot: {
    width: scale(11),
    height: scale(11),
    borderRadius: scale(5.5),
    backgroundColor: "rgba(223,169,77,0.26)",
    borderWidth: 1,
    borderColor: "rgba(223,169,77,0.34)",
  },

  progressDotActive: {
    backgroundColor: VaultColors.brandGold,
    borderColor: VaultColors.brandGoldDark,
  },

  skipBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: getSpacing(4),
    paddingVertical: getSpacing(4),
  },

  skipText: {
    color: VaultColors.textSecondary,
    fontSize: getFontSize(12),
    fontFamily: "Poppins",
    fontWeight: "800",
  },

  hero: {
    flex: 1,
    paddingHorizontal: VaultSpacing.screenPadding,
    paddingTop: verticalScale(12),
    paddingBottom: verticalScale(28),
    alignItems: "center",
    justifyContent: "center",
  },

  // Large illustration (no background circle)
  heroIllustration: {
    marginBottom: getSpacing(20),
    alignItems: "center",
    justifyContent: "center",
  },

  // Legacy fallback: icon inside gold circle
  heroIconShell: {
    width: scale(124),
    height: scale(124),
    borderRadius: scale(62),
    backgroundColor: "rgba(223,169,77,0.16)",
    borderWidth: 1,
    borderColor: "rgba(223,169,77,0.28)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: getSpacing(22),
  },

  heroIconCore: {
    width: scale(86),
    height: scale(86),
    borderRadius: scale(43),
    backgroundColor: VaultColors.brandGold,
    alignItems: "center",
    justifyContent: "center",
    ...VaultShadows.md,
  },

  title: {
    textAlign: "center",
    color: VaultColors.textPrimary,
    fontSize: getFontSize(25),
    fontFamily: "Poppins",
    fontWeight: "900",
    lineHeight: getFontSize(31),
  },

  subtitle: {
    marginTop: getSpacing(12),
    textAlign: "center",
    color: VaultColors.textSecondary,
    fontSize: getFontSize(13.5),
    lineHeight: getFontSize(20),
    fontFamily: "Poppins",
    fontWeight: "600",
    opacity: 0.92,
    paddingHorizontal: getSpacing(8),
  },

  sheet: {
    paddingHorizontal: VaultSpacing.screenPadding,
    paddingTop: getSpacing(8),
    paddingBottom: verticalScale(65),
  },

  primaryBtn: {
    width: "60%",
    alignSelf: "center",
    minHeight: scale(52),
    borderRadius: VaultRadius.lg,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: VaultColors.buttonPrimary,
    borderWidth: 1,
    borderColor: VaultColors.brandGoldDark,
    ...VaultShadows.sm,
  },

  primaryBtnText: {
    color: VaultColors.buttonTextOnGold,
    fontSize: getFontSize(14),
    fontFamily: "Poppins",
    fontWeight: "900",
  },
});