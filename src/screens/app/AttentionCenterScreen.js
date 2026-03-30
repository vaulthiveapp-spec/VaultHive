import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, StatusBar } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";

import { scale, getFontSize, getSpacing } from "../../utils/responsive";
import { VaultColors, VaultShadows, VaultSpacing } from "../../styles/DesignSystem";

const PREVIEW_ITEMS = [
  {
    id: "1",
    icon: "shield-outline",
    title: "Missing warranty",
    description: "A recent high-value purchase has no linked warranty.",
    priority: "high",
  },
  {
    id: "2",
    icon: "time-outline",
    title: "Return window closing",
    description: "One item expires in 3 days — check return eligibility.",
    priority: "warn",
  },
  {
    id: "3",
    icon: "receipt-outline",
    title: "Unreviewed purchase",
    description: "A purchase from last week is still uncategorised.",
    priority: "low",
  },
];

const PRIORITY_COLORS = {
  high: { bg: "#FFEAEA", border: "#F5BABA", icon: VaultColors.error  },
  warn: { bg: "#FFF6E3", border: "#F5D89A", icon: VaultColors.brandGoldDark },
  low:  { bg: VaultColors.surfaceAlt, border: VaultColors.border, icon: VaultColors.textSecondary },
};

export default function AttentionCenterScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <StatusBar barStyle="dark-content" backgroundColor={VaultColors.appBackground} />

      <View style={[styles.header, { paddingTop: insets.top + getSpacing(10) }]}>
        <TouchableOpacity
          style={styles.backBtn}
          activeOpacity={0.85}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="chevron-back" size={scale(20)} color={VaultColors.textPrimary} />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Attention Center</Text>
          <Text style={styles.headerSub}>Items that need your review</Text>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.comingSoonCard}>
          <View style={styles.comingSoonIcon}>
            <Ionicons name="flash-outline" size={scale(28)} color={VaultColors.brandGoldDark} />
          </View>
          <Text style={styles.comingSoonTitle}>Smart alerts, coming soon</Text>
          <Text style={styles.comingSoonText}>
            VaultHive will surface items that need your attention — missing warranties,
            expiring coverage, and unreviewed purchases — all in one place.
          </Text>
        </View>

        <Text style={styles.previewLabel}>Preview of what you will see</Text>

        {PREVIEW_ITEMS.map((item) => {
          const colors = PRIORITY_COLORS[item.priority] || PRIORITY_COLORS.low;
          return (
            <View key={item.id} style={[styles.itemCard, { borderColor: colors.border, backgroundColor: colors.bg }]}>
              <View style={[styles.itemIconWrap, { borderColor: colors.border }]}>
                <Ionicons name={item.icon} size={scale(18)} color={colors.icon} />
              </View>
              <View style={styles.itemBody}>
                <Text style={styles.itemTitle}>{item.title}</Text>
                <Text style={styles.itemDesc}>{item.description}</Text>
              </View>
            </View>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: VaultColors.appBackground },

  header: {
    paddingHorizontal: VaultSpacing.screenPadding,
    paddingBottom: getSpacing(12),
    flexDirection: "row",
    alignItems: "center",
    gap: getSpacing(12),
  },

  backBtn: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(14),
    backgroundColor: VaultColors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: VaultColors.border,
  },

  headerTitle: {
    fontSize: getFontSize(22),
    color: VaultColors.textPrimary,
    fontFamily: "Poppins",
    fontWeight: "900",
  },

  headerSub: {
    marginTop: getSpacing(2),
    fontSize: getFontSize(11),
    color: VaultColors.textMuted,
    fontFamily: "Poppins",
    fontWeight: "600",
  },

  content: {
    flex: 1,
    paddingHorizontal: VaultSpacing.screenPadding,
  },

  comingSoonCard: {
    backgroundColor: VaultColors.surfaceAlt,
    borderRadius: scale(24),
    borderWidth: 1.5,
    borderColor: VaultColors.brandGoldLight || VaultColors.border,
    padding: getSpacing(20),
    alignItems: "center",
    marginBottom: getSpacing(24),
    ...VaultShadows.sm,
  },

  comingSoonIcon: {
    width: scale(64),
    height: scale(64),
    borderRadius: scale(22),
    backgroundColor: VaultColors.brandGoldSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: getSpacing(14),
  },

  comingSoonTitle: {
    fontSize: getFontSize(18),
    color: VaultColors.textPrimary,
    fontFamily: "Poppins",
    fontWeight: "900",
    textAlign: "center",
  },

  comingSoonText: {
    marginTop: getSpacing(10),
    fontSize: getFontSize(12),
    lineHeight: getFontSize(19),
    color: VaultColors.textMuted,
    fontFamily: "Poppins",
    fontWeight: "600",
    textAlign: "center",
  },

  previewLabel: {
    fontSize: getFontSize(13),
    color: VaultColors.textSecondary,
    fontFamily: "Poppins",
    fontWeight: "800",
    marginBottom: getSpacing(12),
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  itemCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: getSpacing(12),
    borderRadius: scale(18),
    borderWidth: 1,
    padding: getSpacing(14),
    marginBottom: getSpacing(10),
  },

  itemIconWrap: {
    width: scale(42),
    height: scale(42),
    borderRadius: scale(14),
    backgroundColor: "rgba(255,255,255,0.6)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },

  itemBody: { flex: 1 },

  itemTitle: {
    fontSize: getFontSize(13),
    color: VaultColors.textPrimary,
    fontFamily: "Poppins",
    fontWeight: "900",
  },

  itemDesc: {
    marginTop: getSpacing(3),
    fontSize: getFontSize(11),
    color: VaultColors.textMuted,
    fontFamily: "Poppins",
    fontWeight: "600",
    lineHeight: getFontSize(16),
  },
});
