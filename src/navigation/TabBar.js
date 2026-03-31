import React, { memo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";

import { scale, getFontSize, getSpacing } from "../utils/responsive";
import { VaultColors, VaultShadows } from "../styles/DesignSystem";

const TAB_CONFIG = {
  Home:         { icon: "home-outline",         activeIcon: "home",         label: "Home"    },
  Vault:        { icon: "cube-outline",          activeIcon: "cube",         label: "Vault"   },
  Add:          { icon: "add",                   activeIcon: "add",          label: "Add",  isAdd: true },
  AIAssistant:  { icon: "sparkles-outline",      activeIcon: "sparkles",     label: "AI"      },
  Profile:      { icon: "person-outline",        activeIcon: "person",       label: "Profile" },
};

function TabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.outer, { paddingBottom: Math.max(insets.bottom, scale(8)) }]}>
      <View style={styles.row}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const config = TAB_CONFIG[route.name] || {
            icon: "ellipse-outline",
            activeIcon: "ellipse",
            label: route.name,
          };

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate({ name: route.name, merge: true });
            }
          };

          if (config.isAdd) {
            return (
              <TouchableOpacity
                key={route.key}
                style={styles.addTabWrap}
                activeOpacity={0.88}
                onPress={onPress}
                accessibilityRole="button"
                accessibilityLabel="Add"
              >
                <View style={styles.addBtn}>
                  <Ionicons name="add" size={scale(28)} color="#FFFFFF" />
                </View>
              </TouchableOpacity>
            );
          }

          return (
            <TouchableOpacity
              key={route.key}
              style={[styles.item, isFocused && styles.itemActive]}
              activeOpacity={0.88}
              onPress={onPress}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={config.label}
            >
              <View style={styles.iconWrap}>
                <Ionicons
                  name={isFocused ? config.activeIcon : config.icon}
                  size={scale(20)}
                  color={isFocused ? VaultColors.brandGoldDark : "#FFFFFF"}
                />
              </View>
              <Text
                numberOfLines={1}
                style={[styles.label, isFocused && styles.labelActive]}
              >
                {config.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default memo(TabBar);

const styles = StyleSheet.create({
  outer: {
    backgroundColor: VaultColors.brown,
    borderTopLeftRadius: scale(28),
    borderTopRightRadius: scale(28),
    paddingTop: scale(10),
    paddingHorizontal: scale(8),
    overflow: "hidden",
    ...Platform.select({
      android: { elevation: 12 },
      ios: VaultShadows.md,
    }),
  },

  row: {
    minHeight: scale(64),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  item: {
    flex: 1,
    minHeight: scale(56),
    borderRadius: scale(20),
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: scale(2),
    paddingVertical: scale(6),
  },

  itemActive: {
    backgroundColor: "#F7F1E3",
  },

  iconWrap: {
    width: scale(30),
    height: scale(30),
    borderRadius: scale(15),
    alignItems: "center",
    justifyContent: "center",
  },

  label: {
    marginTop: scale(3),
    color: "rgba(255,255,255,0.84)",
    fontSize: getFontSize(10),
    fontFamily: "Poppins",
    fontWeight: "700",
    textAlign: "center",
  },

  labelActive: {
    color: VaultColors.brandGoldDark,
    fontWeight: "900",
  },

  addTabWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: scale(2),
  },

  addBtn: {
    width: scale(52),
    height: scale(52),
    borderRadius: scale(26),
    backgroundColor: VaultColors.brandGoldDark,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: scale(4),
    ...Platform.select({
      android: { elevation: 6 },
      ios: {
        shadowColor: VaultColors.brandGoldDark,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.4,
        shadowRadius: 6,
      },
    }),
  },
});
