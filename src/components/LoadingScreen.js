import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { VaultColors } from '../styles/DesignSystem';
import { scale, getFontSize, getSpacing } from '../utils/responsive';

const LoadingScreen = ({
  message = 'Loading...',
  color = VaultColors.brandGold,
  backgroundColor = VaultColors.appBackground,
}) => {
  return (
    <View style={[styles.container, { backgroundColor }]}>
      <ActivityIndicator
        testID="loading-indicator"
        size="large"
        color={color}
        style={styles.spinner}
      />
      <Text accessibilityRole="text" style={[styles.message, { color: VaultColors.textPrimary }]}>
        {message}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: scale(20),
  },
  spinner: {
    marginBottom: getSpacing(16),
    transform: [{ scale: 1.6 }],
  },
  message: {
    fontSize: getFontSize(14),
    fontWeight: '600',
  },
});

export default LoadingScreen;
