import React from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  StatusBar, ScrollView, Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";

import { scale, getFontSize, getSpacing, verticalScale } from "../../utils/responsive";
import { VaultColors, VaultRadius, VaultShadows, VaultSpacing } from "../../styles/DesignSystem";

const ADD_OPTIONS = [
  {
    id: "receipt",
    icon: "scan-outline",
    activeIcon: "scan",
    title: "Add receipt",
    subtitle: "Capture a purchase receipt — scan, OCR, and auto-organize in seconds.",
    screen: "AddReceipt",
    primary: true,
    badge: "Most used",
  },
  {
    id: "warranty",
    icon: "shield-checkmark-outline",
    activeIcon: "shield-checkmark",
    title: "Add warranty",
    subtitle: "Link product protection. Get notified before it expires.",
    screen: "AddWarranty",
  },
  {
    id: "reminder",
    icon: "alarm-outline",
    activeIcon: "alarm",
    title: "Add reminder",
    subtitle: "Set a standalone reminder for a return deadline, event, or task.",
    screen: "AddReminder",
  },
  {
    id: "file",
    icon: "attach-outline",
    activeIcon: "attach",
    title: "Upload file",
    subtitle: "Attach an invoice, contract, or document directly to a purchase hub.",
    screen: "AddReceipt",
    screenParams: { startWithFilePicker: true },
  },
];

function AddCard({ opt, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.card, opt.primary && styles.cardPrimary]}
      activeOpacity={0.88}
      onPress={onPress}
    >
      <View style={[styles.cardIcon, opt.primary && styles.cardIconPrimary]}>
        <Ionicons
          name={opt.icon}
          size={scale(28)}
          color={opt.primary ? VaultColors.buttonTextOnGold : VaultColors.brandGoldDark}
        />
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardTitleRow}>
          <Text style={[styles.cardTitle, opt.primary && styles.cardTitlePrimary]}>{opt.title}</Text>
          {opt.badge ? (
            <View style={[styles.badge, opt.primary && styles.badgePrimary]}>
              <Text style={[styles.badgeText, opt.primary && styles.badgeTextPrimary]}>{opt.badge}</Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.cardSubtitle, opt.primary && styles.cardSubtitlePrimary]}>{opt.subtitle}</Text>
      </View>
      <Ionicons
        name="chevron-forward"
        size={scale(18)}
        color={opt.primary ? "rgba(254,247,230,0.7)" : VaultColors.textMuted}
      />
    </TouchableOpacity>
  );
}

export default function AddScreen({ navigation }) {
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor={VaultColors.appBackground} />

      <View style={[styles.header, { paddingTop: insets.top + scale(10) }]}>
        <Text style={styles.headerTitle}>Add</Text>
        <Text style={styles.headerSub}>What would you like to save?</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {ADD_OPTIONS.map((opt) => (
          <AddCard
            key={opt.id}
            opt={opt}
            onPress={() => navigation.navigate(opt.screen, opt.screenParams || {})}
          />
        ))}

        <View style={styles.tipCard}>
          <View style={styles.tipIconWrap}>
            <Ionicons name="sparkles-outline" size={scale(18)} color={VaultColors.brandGoldDark} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.tipTitle}>VaultHive AI</Text>
            <Text style={styles.tipText}>
              Add a receipt and tap "Apply AI suggestions" to automatically categorize and organize your purchase.
            </Text>
          </View>
        </View>

        <View style={{ height: verticalScale(20) }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: VaultColors.appBackground },

  header: {
    paddingHorizontal: VaultSpacing.screenPadding,
    paddingBottom: scale(16),
  },
  headerTitle: {
    fontSize: getFontSize(26),
    color: VaultColors.textPrimary,
    fontFamily: "Poppins",
    fontWeight: "900",
  },
  headerSub: {
    marginTop: scale(4),
    fontSize: getFontSize(12),
    color: VaultColors.textMuted,
    fontFamily: "Poppins",
    fontWeight: "600",
  },

  content: {
    paddingHorizontal: VaultSpacing.screenPadding,
    paddingBottom: scale(24),
    gap: scale(12),
  },

  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(14),
    backgroundColor: VaultColors.surfaceAlt,
    borderRadius: scale(22),
    borderWidth: 1.5,
    borderColor: VaultColors.border,
    padding: scale(18),
    ...Platform.select({ android: { elevation: 2 }, ios: VaultShadows.sm }),
  },
  cardPrimary: {
    backgroundColor: VaultColors.brandGoldDark,
    borderColor: VaultColors.brandGoldDark,
    ...Platform.select({ android: { elevation: 4 }, ios: VaultShadows.md }),
  },
  cardIcon: {
    width: scale(56),
    height: scale(56),
    borderRadius: scale(18),
    backgroundColor: VaultColors.brandGoldSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  cardIconPrimary: { backgroundColor: "rgba(254,247,230,0.16)" },
  cardBody: { flex: 1 },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: scale(8), marginBottom: scale(4) },
  cardTitle: { fontSize: getFontSize(16), color: VaultColors.textPrimary, fontFamily: "Poppins", fontWeight: "900" },
  cardTitlePrimary: { color: VaultColors.buttonTextOnGold },
  cardSubtitle: { fontSize: getFontSize(11), color: VaultColors.textMuted, fontFamily: "Poppins", fontWeight: "600", lineHeight: getFontSize(17) },
  cardSubtitlePrimary: { color: "rgba(254,247,230,0.78)" },

  badge: {
    backgroundColor: VaultColors.brandGoldSoft,
    borderRadius: VaultRadius.full,
    paddingHorizontal: scale(8),
    paddingVertical: scale(3),
    borderWidth: 1,
    borderColor: VaultColors.brandGoldDark,
  },
  badgePrimary: { backgroundColor: "rgba(254,247,230,0.18)", borderColor: "rgba(254,247,230,0.4)" },
  badgeText: { fontSize: getFontSize(9), color: VaultColors.brandGoldDark, fontFamily: "Poppins", fontWeight: "900" },
  badgeTextPrimary: { color: "rgba(254,247,230,0.9)" },

  tipCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: scale(12),
    backgroundColor: VaultColors.surfaceAlt,
    borderRadius: scale(20),
    borderWidth: 1.5,
    borderColor: VaultColors.border,
    padding: scale(16),
    marginTop: scale(4),
  },
  tipIconWrap: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(14),
    backgroundColor: VaultColors.brandGoldSoft,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  tipTitle: { fontSize: getFontSize(13), color: VaultColors.textPrimary, fontFamily: "Poppins", fontWeight: "900", marginBottom: scale(3) },
  tipText: { fontSize: getFontSize(11), color: VaultColors.textMuted, fontFamily: "Poppins", fontWeight: "600", lineHeight: getFontSize(17) },
});
