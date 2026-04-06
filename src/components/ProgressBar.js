import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { VaultColors, VaultTypographyStyles, VaultRadius } from '../styles/DesignSystem';

const ProgressBar = ({
  currentAmount = 0,
  goalAmount = 100,
  percentage = 0,
  showPercentage = true,
  showAmounts = true,
  color = VaultColors.brandGold,
  backgroundColor = VaultColors.border,
  height = 14,
  style,
  labelStyle,
  amountStyle,
}) => {
  const progress =
    percentage || (goalAmount > 0 ? Math.min((currentAmount / goalAmount) * 100, 100) : 0);

  return (
    <View style={[styles.container, style]}>
      {(showAmounts || showPercentage) && (
        <View style={styles.labelsRow}>
          {showAmounts && (
            <Text style={[styles.amountText, amountStyle]}>
              {currentAmount} / {goalAmount}
            </Text>
          )}
          {showPercentage && (
            <Text style={[styles.percentText, labelStyle]}>
              {Math.round(progress)}%
            </Text>
          )}
        </View>
      )}

      <View style={[styles.bar, { height, backgroundColor }]}>
        <View style={[styles.fill, { width: `${progress}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  labelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  amountText: {
    ...VaultTypographyStyles.body3,
    color: VaultColors.textMuted,
  },
  percentText: {
    ...VaultTypographyStyles.body3,
    color: VaultColors.textMuted,
  },
  bar: {
    width: '100%',
    borderRadius: VaultRadius.full,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: VaultRadius.full,
  },
});

export default ProgressBar;
