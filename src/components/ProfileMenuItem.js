import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VaultColors, VaultSpacing, VaultRadius } from '../styles/DesignSystem';
import { scale, getFontSize } from '../utils/responsive';

const ProfileMenuItem = ({
  icon,
  title,
  onPress,
  showChevron = true,
  style,
  titleStyle,
  iconStyle,
  disabled = false,
}) => {
  return (
    <TouchableOpacity
      style={[styles.row, disabled && styles.disabled, style]}
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      activeOpacity={0.75}
    >
      <View style={[styles.iconWrap, iconStyle]}>
        {icon}
      </View>

      <Text style={[styles.title, titleStyle]} numberOfLines={1}>
        {title}
      </Text>

      {showChevron ? (
        <Ionicons name="chevron-forward" size={18} color={VaultColors.iconMuted} />
      ) : null}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: scale(14),
    paddingHorizontal: VaultSpacing.screenPadding,
    backgroundColor: 'transparent',
  },
  iconWrap: {
    width: scale(38),
    height: scale(38),
    borderRadius: VaultRadius.md,
    backgroundColor: VaultColors.surfaceAlt,
    borderWidth: 1,
    borderColor: VaultColors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: scale(12),
  },
  title: {
    flex: 1,
    fontSize: getFontSize(14),
    fontFamily: 'Poppins',
    fontWeight: '500',
    color: VaultColors.textPrimary,
  },
  disabled: {
    opacity: 0.55,
  },
});

export default ProfileMenuItem;
