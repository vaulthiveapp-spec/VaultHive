import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  VaultColors,
  VaultSpacing,
  VaultTypographyStyles,
} from '../styles/DesignSystem';
import { scale } from '../utils/responsive';

const ProfileHeader = ({
  title,
  onBackPress,
  onNotificationPress,
  showBackButton = true,
  showNotification = true,
  style,
  titleStyle,
}) => {
  return (
    <View style={[styles.header, style]}>
      <View style={styles.side}>
        {showBackButton ? (
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={onBackPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={22} color={VaultColors.navIcon} />
          </TouchableOpacity>
        ) : null}
      </View>

      <Text style={[styles.title, titleStyle]} numberOfLines={1}>
        {title}
      </Text>

      <View style={[styles.side, styles.sideRight]}>
        {showNotification ? (
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={onNotificationPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="notifications-outline" size={22} color={VaultColors.navIcon} />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: VaultSpacing.md,
    paddingHorizontal: VaultSpacing.screenPadding,
    backgroundColor: VaultColors.appBackground,
  },
  side: {
    width: scale(44),
    alignItems: 'flex-start',
  },
  sideRight: {
    alignItems: 'flex-end',
  },
  iconBtn: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(12),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: VaultColors.surfaceAlt,
    borderWidth: 1,
    borderColor: VaultColors.border,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    ...VaultTypographyStyles.headerTitle,
    color: VaultColors.textPrimary,
  },
});

export default ProfileHeader;
