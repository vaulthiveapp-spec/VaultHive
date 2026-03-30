/**
 * AICardItem
 *
 * Renders a single structured card returned by the AI.
 * Kinds: store | receipt | warranty | hub | action
 *
 * Navigates to the correct detail screen when tapped.
 */

import React, { memo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { scale, getFontSize } from "../../utils/responsive";

// ─── Icon map by image_key / kind ─────────────────────────────────────────────

const IMAGE_KEY_ICONS = {
  shopping:     { icon: "bag-outline",               color: "#8A5509" },
  electronics:  { icon: "hardware-chip-outline",     color: "#2E6BD8" },
  groceries:    { icon: "cart-outline",              color: "#18A957" },
  fashion:      { icon: "shirt-outline",             color: "#C03075" },
  pharmacy:     { icon: "medkit-outline",            color: "#D64545" },
  home:         { icon: "home-outline",              color: "#B37A1F" },
  subscriptions:{ icon: "repeat-outline",            color: "#8A5509" },
  default:      { icon: "cube-outline",              color: "#8A5509" },
};

const KIND_ICONS = {
  store:    { icon: "storefront-outline",            color: "#8A5509" },
  receipt:  { icon: "receipt-outline",               color: "#18A957" },
  warranty: { icon: "shield-checkmark-outline",      color: "#2E6BD8" },
  hub:      { icon: "cube-outline",                  color: "#B37A1F" },
  action:   { icon: "flash-outline",                 color: "#D64545" },
};

function getIconConfig(card) {
  return (
    KIND_ICONS[card.kind] ||
    IMAGE_KEY_ICONS[card.image_key] ||
    IMAGE_KEY_ICONS.default
  );
}

// ─── Navigation helper ────────────────────────────────────────────────────────

function resolveNavigation(card, navigation) {
  if (!navigation || !card.ref_id) return null;
  switch (card.kind) {
    case "receipt":
      return () => navigation.navigate("ReceiptDetails", { receiptId: card.ref_id });
    case "warranty":
      return () => navigation.navigate("WarrantyDetails", { warrantyId: card.ref_id });
    case "hub":
      return () => navigation.navigate("HubDetail", { hubId: card.ref_id });
    case "store":
      return () => navigation.navigate("StoreDetails", { storeId: card.ref_id });
    default:
      return null;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

function AICardItem({ card, navigation }) {
  const { icon, color } = getIconConfig(card);
  const onPress = resolveNavigation(card, navigation);

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={onPress ? 0.82 : 1}
      onPress={onPress}
      disabled={!onPress}
    >
      {/* Left icon */}
      <View style={[styles.iconWrap, { backgroundColor: color + "18" }]}>
        <Ionicons name={icon} size={scale(20)} color={color} />
      </View>

      {/* Center content */}
      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>{card.title}</Text>
          {!!card.badge ? (
            <View style={[styles.badge, { borderColor: color + "55" }]}>
              <Text style={[styles.badgeText, { color }]}>{card.badge}</Text>
            </View>
          ) : null}
        </View>
        {!!card.subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>{card.subtitle}</Text>
        ) : null}
        {!!card.description ? (
          <Text style={styles.description} numberOfLines={2}>{card.description}</Text>
        ) : null}
      </View>

      {/* Right arrow */}
      {onPress ? (
        <Ionicons
          name="chevron-forward"
          size={scale(16)}
          color="#C9A96B"
          style={styles.chevron}
        />
      ) : null}
    </TouchableOpacity>
  );
}

export default memo(AICardItem);

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFDF8",
    borderRadius: scale(14),
    borderWidth: 1,
    borderColor: "#F0DDB8",
    paddingHorizontal: scale(14),
    paddingVertical: scale(12),
    marginBottom: scale(8),
    ...Platform.select({
      ios: {
        shadowColor: "#8A5509",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.07,
        shadowRadius: 6,
      },
      android: { elevation: 2 },
    }),
  },

  iconWrap: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(12),
    alignItems: "center",
    justifyContent: "center",
    marginRight: scale(12),
    flexShrink: 0,
  },

  content: {
    flex: 1,
    minWidth: 0,
  },

  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(6),
  },

  title: {
    flex: 1,
    fontSize: getFontSize(14),
    fontWeight: "700",
    color: "#3D2208",
    letterSpacing: -0.1,
  },

  badge: {
    paddingHorizontal: scale(7),
    paddingVertical: scale(2),
    borderRadius: scale(20),
    borderWidth: 1,
    backgroundColor: "transparent",
    flexShrink: 0,
  },

  badgeText: {
    fontSize: getFontSize(10),
    fontWeight: "700",
    letterSpacing: 0.3,
  },

  subtitle: {
    marginTop: scale(2),
    fontSize: getFontSize(12),
    color: "#9A7040",
    fontWeight: "500",
  },

  description: {
    marginTop: scale(3),
    fontSize: getFontSize(12),
    color: "#B08040",
    lineHeight: 17,
  },

  chevron: {
    marginLeft: scale(8),
    flexShrink: 0,
  },
});
