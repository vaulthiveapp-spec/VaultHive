/**
 * AddItemScreen
 *
 * Legacy entry point — now redirects cleanly to the canonical flows.
 * Kept registered in AppNavigator for backward compat with any deep-link
 * or navigation.navigate("AddItem") call from VaultScreen and HomeScreen.
 */
import React from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  StatusBar, Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";

import { scale, getFontSize, getSpacing, verticalScale } from "../../utils/responsive";
import { VaultColors, VaultRadius, VaultShadows, VaultSpacing } from "../../styles/DesignSystem";

const CHOICES = [
  {
    id: "receipt",
    icon: "scan-outline",
    title: "Add receipt",
    subtitle: "Capture a purchase — OCR, categories, line items, hub creation.",
    screen: "AddReceipt",
    primary: true,
  },
  {
    id: "warranty",
    icon: "shield-checkmark-outline",
    title: "Add warranty",
    subtitle: "Track product warranty with start / end dates and expiry reminders.",
    screen: "AddWarranty",
  },
  {
    id: "reminder",
    icon: "alarm-outline",
    title: "Add reminder",
    subtitle: "Set a standalone return or expiry reminder for any purchase.",
    screen: "AddReminder",
  },
];

export default function AddItemScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const hint   = route?.params?.tab === "warranties" ? "warranty" : null;

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor={VaultColors.appBackground} />

      <View style={[styles.header, { paddingTop: insets.top + scale(12) }]}>
        <TouchableOpacity style={styles.backBtn} activeOpacity={0.85} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={scale(20)} color={VaultColors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add to Vault</Text>
        <View style={{ width: scale(40) }} />
      </View>

      <View style={styles.content}>
        <View style={styles.intro}>
          <View style={styles.introIconWrap}>
            <Ionicons name="add-circle" size={scale(34)} color={VaultColors.brandGoldDark} />
          </View>
          <Text style={styles.introTitle}>What are you adding?</Text>
          <Text style={styles.introSub}>Choose the type of record to add.</Text>
        </View>

        <View style={styles.choices}>
          {CHOICES.map((c) => {
            const accent = hint ? hint === c.id : c.primary;
            return (
              <TouchableOpacity
                key={c.id}
                style={[styles.card, accent && styles.cardAccent]}
                activeOpacity={0.88}
                onPress={() => navigation.navigate(c.screen)}
              >
                <View style={[styles.cardIcon, accent && styles.cardIconAccent]}>
                  <Ionicons name={c.icon} size={scale(24)} color={accent ? VaultColors.buttonTextOnGold : VaultColors.brandGoldDark} />
                </View>
                <View style={styles.cardBody}>
                  <Text style={[styles.cardTitle, accent && styles.cardTitleAccent]}>{c.title}</Text>
                  <Text style={[styles.cardSub, accent && styles.cardSubAccent]}>{c.subtitle}</Text>
                </View>
                <Ionicons name="chevron-forward" size={scale(16)} color={accent ? "rgba(254,247,230,0.7)" : VaultColors.textMuted} />
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: VaultColors.appBackground },

  header: {
    paddingHorizontal: VaultSpacing.screenPadding,
    paddingBottom: scale(12),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: VaultColors.border,
  },
  backBtn: {
    width: scale(40), height: scale(40),
    borderRadius: scale(12),
    backgroundColor: VaultColors.surfaceAlt,
    borderWidth: 1.5, borderColor: VaultColors.border,
    alignItems: "center", justifyContent: "center",
    ...Platform.select({ android: { elevation: 1 }, ios: VaultShadows.sm }),
  },
  headerTitle: {
    fontSize: getFontSize(18),
    color: VaultColors.textPrimary,
    fontFamily: "Poppins",
    fontWeight: "900",
  },

  content: {
    flex: 1,
    paddingHorizontal: VaultSpacing.screenPadding,
    paddingTop: scale(24),
  },

  intro: { alignItems: "center", marginBottom: scale(28) },
  introIconWrap: {
    width: scale(68), height: scale(68),
    borderRadius: scale(22),
    backgroundColor: VaultColors.brandGoldSoft,
    borderWidth: 2, borderColor: VaultColors.brandGoldLight,
    alignItems: "center", justifyContent: "center",
    marginBottom: scale(14),
    ...Platform.select({ android: { elevation: 3 }, ios: VaultShadows.md }),
  },
  introTitle: {
    fontSize: getFontSize(20),
    color: VaultColors.textPrimary,
    fontFamily: "Poppins",
    fontWeight: "900",
    textAlign: "center",
  },
  introSub: {
    marginTop: scale(5),
    fontSize: getFontSize(12),
    color: VaultColors.textMuted,
    fontFamily: "Poppins",
    fontWeight: "600",
    textAlign: "center",
  },

  choices: { gap: scale(12) },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(14),
    backgroundColor: VaultColors.surfaceAlt,
    borderRadius: VaultRadius.lg,
    borderWidth: 2,
    borderColor: VaultColors.border,
    padding: scale(16),
    ...Platform.select({ android: { elevation: 2 }, ios: VaultShadows.sm }),
  },
  cardAccent: {
    backgroundColor: VaultColors.brandGoldDark,
    borderColor: VaultColors.brandGoldDark,
    ...Platform.select({ android: { elevation: 4 }, ios: VaultShadows.md }),
  },
  cardIcon: {
    width: scale(50), height: scale(50),
    borderRadius: scale(15),
    backgroundColor: VaultColors.brandGoldSoft,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: VaultColors.border,
  },
  cardIconAccent: { backgroundColor: "rgba(254,247,230,0.16)", borderColor: "rgba(254,247,230,0.25)" },
  cardBody: { flex: 1 },
  cardTitle: {
    fontSize: getFontSize(15),
    color: VaultColors.textPrimary,
    fontFamily: "Poppins",
    fontWeight: "900",
    marginBottom: scale(3),
  },
  cardTitleAccent: { color: VaultColors.buttonTextOnGold },
  cardSub: {
    fontSize: getFontSize(11),
    color: VaultColors.textMuted,
    fontFamily: "Poppins",
    fontWeight: "600",
    lineHeight: getFontSize(17),
  },
  cardSubAccent: { color: "rgba(254,247,230,0.75)" },
});
