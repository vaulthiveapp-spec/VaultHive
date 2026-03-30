import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { VaultColors } from '../styles/DesignSystem';

const PinInput = ({ pins = [], maxLength = 6, onPinPress, style = {} }) => {
  const pinCircles = Array.from({ length: maxLength }, (_, index) => (
    <TouchableOpacity
      key={index}
      style={styles.pinCircle}
      onPress={() => onPinPress && onPinPress(index)}
    >
      <Text style={styles.pinText}>
        {pins[index] || ''}
      </Text>
    </TouchableOpacity>
  ));

  return (
    <View style={[styles.container, style]}>
      {pinCircles}
    </View>
  );
};

const PinKeypad = ({ onNumberPress, onBackspace, style = {} }) => {
  const numbers = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    ['', '0', '⌫']
  ];

  return (
    <View style={[styles.keypadContainer, style]}>
      {numbers.map((row, rowIndex) => (
        <View key={rowIndex} style={styles.keypadRow}>
          {row.map((number, colIndex) => (
            <TouchableOpacity
              key={colIndex}
              style={[
                styles.keypadButton,
                number === '' && styles.emptyButton
              ]}
              onPress={() => {
                if (number === '⌫') {
                  onBackspace && onBackspace();
                } else if (number !== '') {
                  onNumberPress && onNumberPress(number);
                }
              }}
              disabled={number === ''}
            >
              <Text style={styles.keypadText}>{number}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 15,
  },
  pinCircle: {
    width: 39,
    height: 39,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: VaultColors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  pinText: {
    fontSize: 17,
    fontWeight: '700',
    color: VaultColors.textPrimary,
  },
  keypadContainer: {
    alignItems: 'center',
    marginTop: 40,
  },
  keypadRow: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  keypadButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: VaultColors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 15,
  },
  emptyButton: {
    backgroundColor: 'transparent',
  },
  keypadText: {
    fontSize: 24,
    fontWeight: '700',
    color: VaultColors.surfaceAlt,
  },
});

export { PinInput, PinKeypad };
