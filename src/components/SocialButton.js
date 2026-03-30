import React from 'react';
import { TouchableOpacity, StyleSheet, View, Text } from 'react-native';
import { VaultColors, VaultRadius } from '../styles/DesignSystem';
import GoogleIcon from './GoogleIcon';
import FacebookIcon from './FacebookIcon';
import { scale } from '../utils/responsive';

const SocialButton = ({ type, onPress, style = {} }) => {
  const renderIcon = () => {
    if (type === 'google') return <GoogleIcon width={scale(22)} height={scale(22)} />;
    if (type === 'facebook') return <FacebookIcon width={scale(22)} height={scale(22)} />;
    return (
      <Text style={{ color: VaultColors.textPrimary, fontWeight: '700' }}>
        ?
      </Text>
    );
  };

  return (
    <TouchableOpacity
      style={[styles.button, style]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={styles.iconWrap}>{renderIcon()}</View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    width: scale(44),
    height: scale(44),
    borderRadius: VaultRadius.md,
    backgroundColor: VaultColors.surfaceAlt,
    borderWidth: 1,
    borderColor: VaultColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default SocialButton;
