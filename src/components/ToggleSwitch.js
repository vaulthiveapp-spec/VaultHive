import React, { useEffect, useRef } from 'react';
import { TouchableOpacity, View, StyleSheet, Animated } from 'react-native';
import { VaultColors } from '../styles/DesignSystem';
import { scale } from '../utils/responsive';

const SIZES = {
  small: { width: scale(36), height: scale(20), thumb: scale(16), pad: scale(2) },
  medium: { width: scale(44), height: scale(24), thumb: scale(20), pad: scale(2) },
  large: { width: scale(54), height: scale(30), thumb: scale(26), pad: scale(2) },
};

const ToggleSwitch = ({
  value,
  onValueChange,
  disabled = false,
  activeColor = VaultColors.brandGold,
  inactiveColor = VaultColors.border,
  thumbColor = VaultColors.surfaceAlt,
  size = 'medium', // 'small' | 'medium' | 'large'
  style,
}) => {
  const cfg = SIZES[size] || SIZES.medium;
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: value ? 1 : 0,
      duration: 160,
      useNativeDriver: true,
    }).start();
  }, [value, anim]);

  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [cfg.pad, cfg.width - cfg.thumb - cfg.pad],
  });

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={disabled ? undefined : () => onValueChange && onValueChange(!value)}
      disabled={disabled}
      style={[styles.wrap, style, disabled && styles.disabled]}
    >
      <View
        style={[
          styles.track,
          {
            width: cfg.width,
            height: cfg.height,
            borderRadius: cfg.height / 2,
            backgroundColor: value ? activeColor : inactiveColor,
          },
        ]}
      >
        <Animated.View
          style={[
            styles.thumb,
            {
              width: cfg.thumb,
              height: cfg.thumb,
              borderRadius: cfg.thumb / 2,
              backgroundColor: thumbColor,
              transform: [{ translateX }],
            },
          ]}
        />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  wrap: {
    justifyContent: 'center',
  },
  track: {
    justifyContent: 'center',
  },
  thumb: {
    position: 'absolute',
    top: 0,
  },
  disabled: {
    opacity: 0.55,
  },
});

export default ToggleSwitch;
