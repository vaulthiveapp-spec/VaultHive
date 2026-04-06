import React, { memo, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";

import { scale, getFontSize, getSpacing } from "../utils/responsive";
import { VaultColors, VaultShadows } from "../styles/DesignSystem";

const DEFAULT_ITEMS = [
  {
    id: "home",
    label: "Home",
    icon: "home-outline",
    activeIcon: "home",
    screen: "Home",
  },
  {
    id: "vault",
    label: "Vault",
    icon: "cube-outline",
    activeIcon: "cube",
    screen: "Vault",
  },
  {
    id: "ai",
    label: "AI",
    icon: "sparkles-outline",
    activeIcon: "sparkles",
    screen: "AIAssistant",
  },
  {
    id: "stores",
    label: "Stores",
    icon: "storefront-outline",
    activeIcon: "storefront",
    screen: "Stores",
  },
  {
    id: "reminders",
    label: "Reminders",
    icon: "notifications-outline",
    activeIcon: "notifications",
    screen: "Reminders",
  },
];

function BottomNavigation({
  navigation,
  activeTab = "home",
  items,
  badgeCounts = {},
}) {
  const navItems = useMemo(() => {
    if (Array.isArray(items) && items.length) {
      return items.slice(0, 5);
    }
    return DEFAULT_ITEMS;
  }, [items]);

  return (
    <View style={styles.outer}>
      <View style={styles.row}>
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          const badge = Number(badgeCounts[item.id] || 0);

          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.item, isActive && styles.itemActive]}
              activeOpacity={0.88}
              onPress={() => navigation?.navigate?.(item.screen)}
            >
              <View style={styles.iconWrap}>
                <Ionicons
                  name={isActive ? item.activeIcon || item.icon : item.icon}
                  size={scale(20)}
                  color={
                    isActive
                      ? VaultColors.brandGoldDark
                      : "#FFFFFF"
                  }
                />

                {badge > 0 ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {badge > 9 ? "9+" : badge}
                    </Text>
                  </View>
                ) : null}
              </View>

              <Text
                numberOfLines={1}
                style={[styles.label, isActive && styles.labelActive]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default memo(BottomNavigation);

const styles = StyleSheet.create({
  outer: {
    backgroundColor: VaultColors.brown,
    borderTopLeftRadius: scale(30),
    borderTopRightRadius: scale(30),
    paddingTop: scale(10),
    paddingBottom: scale(10),
    paddingHorizontal: scale(10),
    marginBottom: 0,
    marginTop: 0,
    overflow: "hidden",
    ...Platform.select({
      android: {
        elevation: 12,
      },
      ios: VaultShadows.md,
    }),
  },

  row: {
    minHeight: scale(72),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  item: {
    flex: 1,
    minHeight: scale(60),
    borderRadius: scale(22),
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: scale(2),
    paddingVertical: scale(6),
  },

  itemActive: {
    backgroundColor: VaultColors.surfaceAlt || "#F7F1E3",
  },

  iconWrap: {
    width: scale(32),
    height: scale(32),
    borderRadius: scale(16),
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },

  label: {
    marginTop: getSpacing(4),
    color: "rgba(255,255,255,0.86)",
    fontSize: getFontSize(10.5),
    fontFamily: "Poppins",
    fontWeight: "700",
    textAlign: "center",
  },

  labelActive: {
    color: VaultColors.brandGoldDark || "#8B5A00",
    fontWeight: "900",
  },

  badge: {
    position: "absolute",
    top: scale(-3),
    right: scale(-4),
    minWidth: scale(16),
    height: scale(16),
    borderRadius: scale(8),
    backgroundColor: VaultColors.error || "#E75A5F",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: scale(3),
    borderWidth: 1.5,
    borderColor: VaultColors.surfaceAlt || "#F7F1E3",
  },

  badgeText: {
    color: "#FFFFFF",
    fontSize: getFontSize(7.5),
    fontFamily: "Poppins",
    fontWeight: "900",
  },
});