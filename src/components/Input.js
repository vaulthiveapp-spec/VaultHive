import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";

import {
  VaultColors,
  VaultSpacing,
  VaultShadows,
  VaultTypography,
} from "../styles/DesignSystem";
import { scale, getFontSize } from "../utils/responsive";

const Input = ({
  label,
  placeholder,
  value,
  onChangeText,
  leftIcon = null,
  secureTextEntry = false,
  showPasswordToggle = false,
  suffix = null,
  style = {},
  inputStyle = {},
  keyboardType = "default",
  error = null,
  onBlur,
  autoCapitalize = "none",
  multiline = false,
  numberOfLines = 1,
  maxLength,
  editable = true,
  returnKeyType,
  onSubmitEditing,
}) => {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [suffixWidth, setSuffixWidth] = useState(scale(34));

  const isPassword = secureTextEntry && showPasswordToggle;
  const normalizedSuffix =
    suffix != null && String(suffix).trim().toUpperCase() === "SAR"
      ? "SAR"
      : suffix != null
      ? String(suffix)
      : null;

  const hasSuffix = !!normalizedSuffix && !isPassword;

  const rightPad = useMemo(() => {
    if (isPassword) return scale(44);
    if (hasSuffix) return Math.max(scale(64), suffixWidth + scale(22));
    return scale(14);
  }, [isPassword, hasSuffix, suffixWidth]);

  const fieldStyle = useMemo(
    () => [
      styles.field,
      isFocused && styles.fieldFocused,
      !!error && styles.fieldError,
      !editable && styles.fieldDisabled,
    ],
    [isFocused, error, editable]
  );

  return (
    <View style={[styles.container, style]}>
      {!!label && <Text style={styles.label}>{label}</Text>}

      <View style={fieldStyle}>
        {!!leftIcon && (
          <View style={styles.leftIconWrap}>
            <Feather
              name={leftIcon}
              size={18}
              color={VaultColors.brandGoldDark || VaultColors.iconMuted}
            />
          </View>
        )}

        <TextInput
          style={[
            styles.input,
            { paddingRight: rightPad },
            multiline && styles.multilineInput,
            inputStyle,
          ]}
          placeholder={placeholder}
          placeholderTextColor={
            VaultColors.brandGoldLight || VaultColors.inputPlaceholder
          }
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={isPassword && !isPasswordVisible}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          editable={editable}
          multiline={multiline}
          numberOfLines={numberOfLines}
          maxLength={maxLength}
          selectionColor={VaultColors.brandGoldDark || VaultColors.textSecondary}
          underlineColorAndroid="transparent"
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            setIsFocused(false);
            onBlur?.();
          }}
        />

        {hasSuffix ? (
          <View
            style={styles.suffixWrap}
            onLayout={(e) => {
              const width = e?.nativeEvent?.layout?.width || 0;
              if (width > 0 && width !== suffixWidth) {
                setSuffixWidth(width);
              }
            }}
            pointerEvents="none"
          >
            <Text style={styles.suffixText} numberOfLines={1}>
              {normalizedSuffix}
            </Text>
          </View>
        ) : null}

        {isPassword ? (
          <TouchableOpacity
            style={styles.eyeButton}
            onPress={() => setIsPasswordVisible((v) => !v)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Feather
              name={isPasswordVisible ? "eye" : "eye-off"}
              size={18}
              color={VaultColors.brandGoldDark || VaultColors.iconMuted}
            />
          </TouchableOpacity>
        ) : null}
      </View>

      {!!error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: scale(6),
  },

  label: {
    fontSize: getFontSize(12),
    fontWeight: "700",
    color: VaultColors.textSecondary,
    marginBottom: VaultSpacing.xs,
    fontFamily: VaultTypography.fontFamily || "System",
  },

  field: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: VaultColors.surfaceAlt,
    borderRadius: scale(12),
    borderWidth: 1.2,
    borderColor: VaultColors.brandGoldLight || VaultColors.border,
    minHeight: scale(46),
    ...VaultShadows.sm,
    ...(Platform.OS === "android" ? { elevation: 1, shadowOpacity: 0 } : null),
  },

  fieldFocused: {
    borderColor: VaultColors.brandGold || VaultColors.inputFocusedBorder,
  },

  fieldError: {
    borderColor: VaultColors.error,
  },

  fieldDisabled: {
    opacity: 0.6,
  },

  leftIconWrap: {
    width: scale(44),
    alignItems: "center",
    justifyContent: "center",
  },

  input: {
    flex: 1,
    paddingLeft: scale(2),
    paddingVertical: 0,
    fontSize: getFontSize(13),
    color: VaultColors.inputText,
    minHeight: scale(46),
    includeFontPadding: false,
    textAlignVertical: "center",
    fontFamily: VaultTypography.fontFamily || "System",
    fontWeight: "600",
  },

  multilineInput: {
    minHeight: scale(90),
    paddingTop: scale(10),
    paddingBottom: scale(10),
    textAlignVertical: "top",
  },

  suffixWrap: {
    position: "absolute",
    right: scale(10),
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },

  suffixText: {
    fontSize: getFontSize(12),
    fontWeight: "900",
    color: VaultColors.textMuted,
    fontFamily: VaultTypography.fontFamily || "System",
  },

  eyeButton: {
    position: "absolute",
    right: scale(10),
    top: 0,
    bottom: 0,
    justifyContent: "center",
    paddingHorizontal: scale(8),
  },

  errorText: {
    fontSize: getFontSize(11),
    color: VaultColors.error,
    marginTop: VaultSpacing.xs,
    fontFamily: VaultTypography.fontFamily || "System",
    fontWeight: "700",
  },
});

export default Input;