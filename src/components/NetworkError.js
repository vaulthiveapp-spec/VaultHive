import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { VaultColors } from '../styles/DesignSystem';
import { scale, getFontSize, getSpacing } from '../utils/responsive';

const NetworkError = ({ onRetry, message = "No internet connection" }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>📡</Text>
      <Text style={styles.title}>Connection Error</Text>
      <Text style={styles.message}>{message}</Text>
      <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
        <Text style={styles.retryText}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: scale(20),
    backgroundColor: VaultColors.surface,
  },
  emoji: {
    fontSize: getFontSize(64),
    marginBottom: getSpacing(20),
  },
  title: {
    fontSize: getFontSize(24),
    fontWeight: '700',
    color: VaultColors.textPrimary,
    textAlign: 'center',
    marginBottom: getSpacing(10),
  },
  message: {
    fontSize: getFontSize(16),
    color: VaultColors.textMuted,
    textAlign: 'center',
    marginBottom: getSpacing(30),
    lineHeight: getFontSize(22),
  },
  retryButton: {
    backgroundColor: VaultColors.brandGold,
    borderRadius: scale(25),
    paddingHorizontal: getSpacing(30),
    paddingVertical: getSpacing(15),
  },
  retryText: {
    fontSize: getFontSize(16),
    fontWeight: '600',
    color: VaultColors.textMuted,
  },
});

export default NetworkError;
