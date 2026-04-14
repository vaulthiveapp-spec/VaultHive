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
import { UI } from "./aiTheme";

function resolvePress(proposal, navigation) {
  if (!navigation) return null;

  const screen = proposal.screen;
  const targetId = proposal.target_id;

  if (!screen) return null;
  if (screen === "HubDetail" && targetId) {
    return () => navigation.navigate("HubDetail", { hubId: targetId });
  }
  if (screen === "ReceiptDetails" && targetId) {
    return () => navigation.navigate("ReceiptDetails", { receiptId: targetId });
  }
  if (screen === "WarrantyDetails" && targetId) {
    return () => navigation.navigate("WarrantyDetails", { warrantyId: targetId });
  }
  if (screen === "StoreDetails" && targetId) {
    return () => navigation.navigate("StoreDetails", { storeId: targetId });
  }

  const FLAT_SCREENS = new Set([
    "Vault",
    "AttentionCenter",
    "Stores",
    "Reports",
    "Settings",
    "Reminders",
    "Home",
  ]);

  if (FLAT_SCREENS.has(screen)) {
    return () => navigation.navigate(screen);
  }

  return null;
}

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
        {proposals.map((proposal) => {
          const onPress = resolvePress(proposal, navigation);
          const isHigh = proposal.confidence === "high";

          return (
            <TouchableOpacity
              key={proposal.id || proposal.label}
              activeOpacity={0.82}
              disabled={!onPress}
              onPress={onPress}
              style={[styles.button, isHigh && styles.buttonHigh]}
            >
              <Ionicons
                name={proposal.icon || "flash-outline"}
                size={scale(15)}
                color={isHigh ? UI.surface : UI.brown}
                style={styles.buttonIcon}
              />

              <Text numberOfLines={1} style={[styles.buttonText, isHigh && styles.buttonTextHigh]}>
                {proposal.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

export default memo(AIActionBar);

const styles = StyleSheet.create({
  wrapper: {
    marginLeft: scale(46),
    marginRight: scale(10),
    marginTop: scale(6),
  },

  label: {
    color: UI.brownSoft,
    fontSize: getFontSize(10),
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: scale(8),
  },

  row: {
    paddingRight: scale(4),
  },

  button: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: scale(14),
    paddingVertical: scale(9),
    borderRadius: scale(20),
    backgroundColor: UI.surface,
    borderWidth: 1,
    borderColor: UI.goldBorder,
    marginRight: scale(8),
  },

  buttonHigh: {
    backgroundColor: UI.brown,
    borderColor: UI.brown,
  },

  buttonIcon: {
    marginRight: scale(6),
  },

  buttonText: {
    color: UI.brownText,
    fontSize: getFontSize(12),
    fontWeight: "700",
  },

  buttonTextHigh: {
    color: UI.surface,
  },
});