import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
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

export default function OnboardingBase({
  step = 1,
  total = 3,
  title,
  subtitle,
  icon,
  image,
  primaryLabel,
  onPrimary,
  onSkip,
}) {
  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <View style={styles.progressWrap}>
          {Array.from({ length: total }).map((_, i) => {
            const active = i < step;
            return (
              <View
                key={i}
                style={[styles.progressDot, active && styles.progressDotActive]}
              />
            );
          })}
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

      <View style={styles.hero}>
        {image ? (
          <Image source={image} style={styles.heroImage} resizeMode="contain" />
        ) : (
          <View style={styles.heroIconShell}>
            <View style={styles.heroIconCore}>
              <Ionicons
                name={icon}
                size={scale(34)}
                color={VaultColors.buttonTextOnGold}
              />
            </View>
          </View>
        )}

        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>

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
    paddingTop: verticalScale(20),
    paddingBottom: verticalScale(36),
    alignItems: "center",
    justifyContent: "center",
  },

  heroImage: {
    width: scale(240),
    height: scale(240),
    marginBottom: getSpacing(22),
    backgroundColor: "transparent",
  },

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