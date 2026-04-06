import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { VaultColors } from '../styles/DesignSystem';
import { scale } from '../utils/responsive';

const IconButton = ({
  icon,
  backgroundColor = VaultColors.brandGoldSoft,
  size = 'medium', // 'small' | 'medium' | 'large'
  onPress,
  disabled = false,
  style,
  iconStyle,
  iconColor = VaultColors.textPrimary,
}) => {
  const sizes = {
    small: { width: scale(40), height: scale(40), borderRadius: scale(14) },
    medium: { width: scale(54), height: scale(54), borderRadius: scale(18) },
    large: { width: scale(66), height: scale(66), borderRadius: scale(22) },
  };

  const cfg = sizes[size] || sizes.medium;

  return (
    <TouchableOpacity
      style={[
        styles.container,
        cfg,
        { backgroundColor },
        disabled && styles.disabled,
        style,
      ]}
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      activeOpacity={0.75}
    >
      <View style={[styles.iconContainer, iconStyle]}>
        {typeof icon === 'string' ? (
          <Text style={[styles.iconText, { color: iconColor }]}>{icon}</Text>
        ) : (
          icon
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    fontSize: scale(18),
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.55,
  },
});

export default IconButton;
