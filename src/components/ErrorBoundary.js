import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { VaultColors } from '../styles/DesignSystem';
import { scale, getFontSize, getSpacing } from '../utils/responsive';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <View style={styles.content}>
            <Text style={styles.emoji}>⚠️</Text>
            <Text style={styles.title}>Oops! Something went wrong</Text>
            <Text style={styles.message}>
              We encountered an unexpected error. Please try restarting the app.
            </Text>
            <TouchableOpacity
              style={styles.button}
              onPress={() => this.setState({ hasError: false, error: null })}
            >
              <Text style={styles.buttonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: VaultColors.brandGold,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: scale(20),
  },
  content: {
    alignItems: 'center',
    backgroundColor: VaultColors.surface,
    borderRadius: scale(20),
    padding: getSpacing(30),
    maxWidth: scale(300),
  },
  emoji: {
    fontSize: getFontSize(48),
    marginBottom: getSpacing(20),
  },
  title: {
    fontSize: getFontSize(24),
    fontWeight: '700',
    color: VaultColors.textPrimary,
    textAlign: 'center',
    marginBottom: getSpacing(15),
  },
  message: {
    fontSize: getFontSize(16),
    color: VaultColors.textMuted,
    textAlign: 'center',
    lineHeight: getFontSize(22),
    marginBottom: getSpacing(25),
  },
  button: {
    backgroundColor: VaultColors.textMuted,
    borderRadius: scale(25),
    paddingHorizontal: getSpacing(30),
    paddingVertical: getSpacing(12),
  },
  buttonText: {
    fontSize: getFontSize(16),
    fontWeight: '600',
    color: VaultColors.surfaceAlt,
  },
});

export default ErrorBoundary;
