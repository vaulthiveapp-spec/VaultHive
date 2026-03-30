/**
 * AIActionBar
 *
 * Renders the action_proposals returned by the AI as a horizontal row
 * of navigable shortcut buttons. Sits below the latest assistant message.
 *
 * Each proposal can navigate to: Vault, AttentionCenter, Stores,
 * HubDetail (with target_id), Reports, Settings, or any named screen.
 */

import React, { memo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { scale, getFontSize } from "../../utils/responsive";

// ─── Nav resolver ─────────────────────────────────────────────────────────────

function resolvePress(proposal, navigation) {
  if (!navigation) return null;
  const screen = proposal.screen;
  const targetId = proposal.target_id;

  if (!screen) return null;

  // Detail screens need a param
  if (screen === "HubDetail"         && targetId) return () => navigation.navigate("HubDetail",         { hubId: targetId });
  if (screen === "ReceiptDetails"    && targetId) return () => navigation.navigate("ReceiptDetails",    { receiptId: targetId });
  if (screen === "WarrantyDetails"   && targetId) return () => navigation.navigate("WarrantyDetails",   { warrantyId: targetId });
  if (screen === "StoreDetails"      && targetId) return () => navigation.navigate("StoreDetails",      { storeId: targetId });

  // Flat screens
  const FLAT_SCREENS = new Set([
    "Vault", "AttentionCenter", "Stores", "Reports",
    "Settings", "Reminders", "Home",
  ]);
  if (FLAT_SCREENS.has(screen)) return () => navigation.navigate(screen);

  return null;
}

// ─── Component ────────────────────────────────────────────────────────────────

function AIActionBar({ proposals = [], navigation }) {
  if (!proposals?.length) return null;

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>Suggested actions</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {proposals.map((p) => {
          const onPress = resolvePress(p, navigation);
          return (
            <TouchableOpacity
              key={p.id || p.label}
              style={[
                styles.btn,
                p.confidence === "high" && styles.btnHigh,
              ]}
              activeOpacity={0.82}
              onPress={onPress}
              disabled={!onPress}
            >
              <Ionicons
                name={p.icon || "flash-outline"}
                size={scale(15)}
                color={p.confidence === "high" ? "#FFFBF0" : "#8A5509"}
                style={styles.btnIcon}
              />
              <Text
                style={[
                  styles.btnText,
                  p.confidence === "high" && styles.btnTextHigh,
                ]}
                numberOfLines={1}
              >
                {p.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

export default memo(AIActionBar);

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: scale(16),
    marginTop: scale(6),
    marginBottom: scale(4),
  },

  label: {
    fontSize: getFontSize(10),
    fontWeight: "700",
    color: "#B08040",
    letterSpacing: 0.9,
    textTransform: "uppercase",
    marginBottom: scale(8),
  },

  row: {
    gap: scale(8),
    flexDirection: "row",
    paddingRight: scale(4),
  },

  btn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: scale(14),
    paddingVertical: scale(9),
    borderRadius: scale(22),
    backgroundColor: "#FEF7E6",
    borderWidth: 1,
    borderColor: "#DCA94D",
  },

  btnHigh: {
    backgroundColor: "#5B3B1F",
    borderColor: "#5B3B1F",
  },

  btnIcon: {
    marginRight: scale(6),
  },

  btnText: {
    fontSize: getFontSize(13),
    fontWeight: "600",
    color: "#5B3B1F",
  },

  btnTextHigh: {
    color: "#FFFBF0",
  },
});
