import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, Text } from 'react-native';
import { VaultColors } from '../styles/DesignSystem';
import { scale, getFontSize } from '../utils/responsive';

const MobileLoadingSpinner = ({ message = 'Loading...', size = 'medium' }) => {
  const spinValue = useRef(new Animated.Value(0)).current;
  const scaleValue = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    const spin = Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      })
    );

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(scaleValue, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(scaleValue, {
          toValue: 0.8,
          duration: 500,
          useNativeDriver: true,
        }),
      ])
    );

    spin.start();
    pulse.start();

    return () => {
      spin.stop();
      pulse.stop();
    };
  }, [spinValue, scaleValue]);

  const spinRotation = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const spinnerSize = size === 'large' ? scale(40) : size === 'small' ? scale(20) : scale(30);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.spinner,
          {
            width: spinnerSize,
            height: spinnerSize,
            transform: [
              { rotate: spinRotation },
              { scale: scaleValue }
            ],
          },
        ]}
      />
      {message && (
        <Text style={[styles.message, size === 'small' && styles.messageSmall]}>
          {message}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: scale(20),
  },
  spinner: {
    borderWidth: scale(3),
    borderTopColor: VaultColors.brandGold,
    borderRightColor: VaultColors.brandGold,
    borderBottomColor: 'transparent',
    borderLeftColor: 'transparent',
    borderRadius: scale(20),
    marginBottom: scale(10),
  },
  message: {
    color: VaultColors.textPrimary,
    fontSize: getFontSize(14),
    fontFamily: 'Poppins',
    fontWeight: '400',
    textAlign: 'center',
  },
  messageSmall: {
    fontSize: getFontSize(12),
  },
});

export default MobileLoadingSpinner;
