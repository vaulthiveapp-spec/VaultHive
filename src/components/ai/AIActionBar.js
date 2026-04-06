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

const UI = {
  cream: "#FEF7E5",
  brown: "#5A3B1F",
  brownText: "#3F250D",
  brownMuted: "#A7782F",
  goldLeft: "#D2A751",
  goldCenter: "#EBD68D",
  goldRight: "#CDA044",
  goldBorder: "#D8B266",
  shadow: "#7B5322",
};

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

function ActionChip({ proposal, navigation }) {
  const onPress = resolvePress(proposal, navigation);
  const isHigh = proposal.confidence === "high";

  return (
    <TouchableOpacity
      activeOpacity={0.82}
      disabled={!onPress}
      onPress={onPress}
      style={[styles.button, isHigh && styles.buttonHigh]}
    >
      <Ionicons
        name={proposal.icon || "flash-outline"}
        size={scale(15)}
        color={isHigh ? UI.cream : UI.brown}
        style={styles.buttonIcon}
      />
      <Text
        numberOfLines={1}
        style={[styles.buttonText, isHigh && styles.buttonTextHigh]}
      >
        {proposal.label}
      </Text>
    </TouchableOpacity>
  );
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
        {proposals.map((proposal) => (
          <ActionChip
            key={proposal.id || proposal.label}
            proposal={proposal}
            navigation={navigation}
          />
        ))}
      </ScrollView>
    </View>
  );
}

export default memo(AIActionBar);

const styles = StyleSheet.create({
  wrapper: {
    marginLeft: scale(48),
    marginRight: scale(10),
    marginTop: scale(6),
  },

  label: {
    color: UI.brownMuted,
    fontSize: getFontSize(10),
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: scale(8),
  },

  row: {
    flexDirection: "row",
    gap: scale(8),
    paddingRight: scale(4),
  },

  button: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: scale(13),
    paddingVertical: scale(8),
    borderRadius: scale(20),
    backgroundColor: UI.cream,
    borderWidth: 1,
    borderColor: UI.goldBorder,
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
    color: UI.cream,
  },
});