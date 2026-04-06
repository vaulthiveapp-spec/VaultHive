// PhoneInput.jsx
import React, { useMemo, useState } from "react";
import { View, Text, TextInput, StyleSheet, Platform } from "react-native";

import {
  VaultColors,
  VaultSpacing,
  VaultShadows,
  VaultTypography,
} from "../styles/DesignSystem";
import { scale, getFontSize } from "../utils/responsive";

/**
 * VaultHive Phone Input
 * Saudi format:
 * fixed prefix: 🇸🇦 +966 5
 * user types remaining 8 digits
 * display format: XXXX XXXX
 */
const PhoneInput = ({
  label,
  value,
  onChangeText,
  style = {},
  inputStyle = {},
  error = null,
  onBlur,
  editable = true,
  placeholder = "XXXX XXXX",
  returnKeyType,
  onSubmitEditing,
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const fieldStyle = useMemo(
    () => [
      styles.field,
      isFocused && styles.fieldFocused,
      !!error && styles.fieldError,
      !editable && styles.fieldDisabled,
    ],
    [isFocused, error, editable]
  );

  const handleTextChange = (text) => {
    const digits = String(text || "").replace(/\D/g, "").slice(0, 8);
    onChangeText?.(digits);
  };

  const formatDisplayValue = (inputValue) => {
    const digits = String(inputValue || "").replace(/\D/g, "").slice(0, 8);
    if (digits.length <= 4) return digits;
    return `${digits.slice(0, 4)} ${digits.slice(4)}`;
  };

  return (
    <View style={[styles.container, style]}>
      {!!label && <Text style={styles.label}>{label}</Text>}

      <View style={fieldStyle}>
        <View style={styles.prefixWrap}>
          <Text style={styles.flag}>🇸🇦</Text>
          <Text style={styles.prefixText}>+966</Text>
          <Text style={styles.prefixText}>5</Text>
        </View>

        <TextInput
          style={[styles.input, inputStyle]}
          placeholder={placeholder}
          placeholderTextColor={
            VaultColors.brandGoldLight || VaultColors.inputPlaceholder
          }
          value={formatDisplayValue(value)}
          onChangeText={handleTextChange}
          keyboardType="phone-pad"
          editable={editable}
          maxLength={9} // 8 digits + 1 space
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

  prefixWrap: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: scale(14),
    paddingRight: scale(8),
    minHeight: scale(46),
  },

  flag: {
    fontSize: getFontSize(14),
    marginRight: scale(6),
  },

  prefixText: {
    fontSize: getFontSize(13),
    color: VaultColors.inputText,
    fontFamily: VaultTypography.fontFamily || "System",
    fontWeight: "700",
    marginRight: scale(4),
  },

  input: {
    flex: 1,
    paddingLeft: scale(2),
    paddingRight: scale(14),
    paddingVertical: 0,
    fontSize: getFontSize(13),
    color: VaultColors.inputText,
    minHeight: scale(46),
    includeFontPadding: false,
    textAlignVertical: "center",
    fontFamily: VaultTypography.fontFamily || "System",
    fontWeight: "600",
  },

  errorText: {
    fontSize: getFontSize(11),
    color: VaultColors.error,
    marginTop: VaultSpacing.xs,
    fontFamily: VaultTypography.fontFamily || "System",
    fontWeight: "700",
  },
});

export default PhoneInput;