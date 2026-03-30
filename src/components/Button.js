import React, { useMemo, useRef } from "react";
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, Animated, View } from "react-native";

import { VaultColors, VaultRadius, VaultShadows, VaultTypography } from "../styles/DesignSystem";
import { scale, getFontSize, getSpacing } from "../utils/responsive";
import { createBounceAnimation, createScaleAnimation } from "../utils/animations";

/**
 * VaultHive Button
 * - Variants: primary | secondary | outline | ghost | danger
 * - Sizes: sm | md | login
 */
const Button = ({
  title,
  onPress,
  variant = "primary",
  size = "login",
  style,
  textStyle,
  disabled = false,
  loading = false,
  animated = true,
  left,
  right,
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const isDisabled = disabled || loading;

  const spinnerColor = useMemo(() => {
    if (variant === "outline" || variant === "ghost") return VaultColors.textPrimary;
    return VaultColors.buttonTextOnGold;
  }, [variant]);

  const handlePressIn = () => {
    if (animated && !isDisabled) createScaleAnimation(scaleAnim, 0.985, 90).start();
  };

  const handlePressOut = () => {
    if (animated && !isDisabled) createBounceAnimation(scaleAnim).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={[
          styles.base,
          styles[`size_${size}`] || styles.size_md,
          styles[`variant_${variant}`] || styles.variant_primary,
          isDisabled && styles.disabled,
          style,
        ]}
        onPress={isDisabled ? undefined : onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.9}
        disabled={isDisabled}
        accessibilityRole="button"
      >
        {loading ? (
          <ActivityIndicator size="small" color={spinnerColor} />
        ) : (
          <>
            {left ? <View style={styles.side}>{left}</View> : null}
            <Text
              style={[
                styles.text,
                styles[`text_${size}`] || styles.text_md,
                styles[`text_${variant}`] || styles.text_primary,
                isDisabled && styles.textDisabled,
                textStyle,
              ]}
              numberOfLines={1}
            >
              {title}
            </Text>
            {right ? <View style={styles.side}>{right}</View> : null}
          </>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  base: {
    minHeight: scale(52),
    borderRadius: VaultRadius.button,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: getSpacing(18),
    flexDirection: "row",
    gap: getSpacing(8),
  },

  // sizes
  size_sm: {
    minHeight: scale(42),
    paddingHorizontal: getSpacing(14),
    borderRadius: scale(14),
  },
  size_md: {
    minHeight: scale(52),
    paddingHorizontal: getSpacing(18),
    borderRadius: scale(16),
  },
  // legacy: keep auth screens the same
  size_login: {
    minHeight: scale(46),
    paddingVertical: getSpacing(10),
    paddingHorizontal: getSpacing(18),
    alignSelf: "center",
    borderRadius: scale(14),
  },

  // variants
  variant_primary: {
    backgroundColor: VaultColors.buttonPrimary,
    borderWidth: 1,
    borderColor: VaultColors.brandGoldDark,
    ...VaultShadows.sm,
  },
  variant_secondary: {
    backgroundColor: VaultColors.brandGoldDark,
    borderWidth: 1,
    borderColor: VaultColors.brandGoldDark,
    ...VaultShadows.sm,
  },
  variant_outline: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: VaultColors.brandGoldLight,
  },
  variant_ghost: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "transparent",
  },
  variant_danger: {
    backgroundColor: VaultColors.error,
    borderWidth: 1,
    borderColor: "#B83A3A",
    ...VaultShadows.sm,
  },

  disabled: { opacity: 0.55 },

  text: {
    fontFamily: VaultTypography.fontFamily || "System",
    fontWeight: "900",
    textAlign: "center",
    includeFontPadding: false,
    letterSpacing: 0.2,
  },

  text_sm: { fontSize: getFontSize(13) },
  text_md: { fontSize: getFontSize(14) },
  text_login: { fontSize: getFontSize(14) },

  text_primary: { color: VaultColors.buttonTextOnGold },
  text_secondary: { color: VaultColors.buttonTextOnGold },
  text_outline: { color: VaultColors.textPrimary },
  text_ghost: { color: VaultColors.textPrimary },
  text_danger: { color: "#FFFFFF" },

  textDisabled: { color: VaultColors.textMuted },

  side: { alignItems: "center", justifyContent: "center" },
});

export default Button;
