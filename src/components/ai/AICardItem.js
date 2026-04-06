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

const UI = {
  cream: "#FEF7E5",
  creamSoft: "#FBF3DE",
  brown: "#5A3B1F",
  brownText: "#3F250D",
  brownMuted: "#8E6026",
  goldBorder: "#D8B266",
  goldTagBg: "#F1DFAB",
  chevron: "#BE8D35",
  shadow: "#7B5322",
};

const IMAGE_KEY_ICONS = {
  shopping: { icon: "bag-outline", color: "#9C651C" },
  electronics: { icon: "hardware-chip-outline", color: "#2E6BD8" },
  groceries: { icon: "cart-outline", color: "#1C9A57" },
  fashion: { icon: "shirt-outline", color: "#C03075" },
  pharmacy: { icon: "medkit-outline", color: "#D64545" },
  home: { icon: "home-outline", color: "#B37A1F" },
  subscriptions: { icon: "repeat-outline", color: "#9C651C" },
  default: { icon: "cube-outline", color: "#9C651C" },
};

const KIND_ICONS = {
  store: { icon: "storefront-outline", color: "#9C651C" },
  receipt: { icon: "receipt-outline", color: "#1C9A57" },
  warranty: { icon: "shield-checkmark-outline", color: "#2E6BD8" },
  hub: { icon: "cube-outline", color: "#B37A1F" },
  action: { icon: "flash-outline", color: "#D64545" },
};

function getIconConfig(card) {
  return KIND_ICONS[card.kind] || IMAGE_KEY_ICONS[card.image_key] || IMAGE_KEY_ICONS.default;
}

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

function AICardItem({ card, navigation }) {
  const { icon, color } = getIconConfig(card);
  const onPress = resolveNavigation(card, navigation);

  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.82 : 1}
      disabled={!onPress}
      onPress={onPress}
      style={styles.card}
    >
      <View style={[styles.iconWrap, { backgroundColor: `${color}18` }]}>
        <Ionicons name={icon} size={scale(20)} color={color} />
      </View>

      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text numberOfLines={1} style={styles.title}>
            {card.title}
          </Text>

          {!!card.badge ? (
            <View style={[styles.badge, { borderColor: `${color}55` }]}>
              <Text style={[styles.badgeText, { color }]}>{card.badge}</Text>
            </View>
          ) : null}
        </View>

        {!!card.subtitle ? (
          <Text numberOfLines={1} style={styles.subtitle}>
            {card.subtitle}
          </Text>
        ) : null}

        {!!card.description ? (
          <Text numberOfLines={2} style={styles.description}>
            {card.description}
          </Text>
        ) : null}
      </View>

      {onPress ? (
        <Ionicons
          name="chevron-forward"
          size={scale(16)}
          color={UI.chevron}
          style={styles.chevron}
        />
      ) : null}
    </TouchableOpacity>
  );
}

export default memo(AICardItem);

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: UI.creamSoft,
    borderRadius: scale(16),
    borderWidth: 1,
    borderColor: UI.goldBorder,
    paddingHorizontal: scale(14),
    paddingVertical: scale(12),
    marginBottom: scale(8),
    ...Platform.select({
      ios: {
        shadowColor: UI.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
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
    color: UI.brownText,
    fontSize: getFontSize(14),
    fontWeight: "800",
    letterSpacing: -0.1,
  },

  badge: {
    paddingHorizontal: scale(7),
    paddingVertical: scale(2),
    borderRadius: scale(14),
    borderWidth: 1,
    backgroundColor: UI.goldTagBg,
    flexShrink: 0,
  },

  badgeText: {
    fontSize: getFontSize(10),
    fontWeight: "800",
    letterSpacing: 0.3,
  },

  subtitle: {
    marginTop: scale(2),
    color: UI.brownMuted,
    fontSize: getFontSize(12),
    fontWeight: "600",
  },

  description: {
    marginTop: scale(3),
    color: "#B07D2A",
    fontSize: getFontSize(12),
    lineHeight: 17,
    fontWeight: "600",
  },

  chevron: {
    marginLeft: scale(8),
    flexShrink: 0,
  },
});