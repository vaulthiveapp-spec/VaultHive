import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
} from "react-native";
import { DrawerContentScrollView } from "@react-navigation/drawer";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";

import { useAuth } from "../context/AuthContext";
import { useAlert } from "../components/AlertProvider";
import { scale, getFontSize, getSpacing } from "../utils/responsive";
import { VaultColors, VaultShadows } from "../styles/DesignSystem";

const DRAWER_ITEMS = [
  { name: "MainTabs",        icon: "grid-outline",         label: "Home"             },
  { name: "Vault",           icon: "cube-outline",         label: "Vault"            },
  { name: "AIAssistant",     icon: "sparkles-outline",     label: "AI Assistant"     },
  { name: "AttentionCenter", icon: "flash-outline",        label: "Attention Center" },
  { name: "Stores",          icon: "storefront-outline",   label: "Stores"           },
  { name: "Reports",         icon: "bar-chart-outline",    label: "Reports"          },
  { name: "Settings",        icon: "settings-outline",     label: "Settings"         },
];

const DrawerItem = ({ icon, label, active, onPress, danger = false }) => (
  <TouchableOpacity
    style={styles.itemRow}
    activeOpacity={0.88}
    onPress={onPress}
  >
    <View style={[styles.itemIconWrap, danger && styles.itemIconWrapDanger]}>
      <Ionicons
        name={icon}
        size={scale(20)}
        color={danger ? "#FFFFFF" : active ? VaultColors.brandGold : "#F7F1E3"}
      />
    </View>
    <Text style={[styles.itemLabel, active && styles.itemLabelActive, danger && styles.itemLabelDanger]}>
      {label}
    </Text>
    {!danger ? (
      <Ionicons
        name="chevron-forward"
        size={scale(16)}
        color="rgba(255,255,255,0.6)"
      />
    ) : null}
  </TouchableOpacity>
);

const DrawerDivider = () => <View style={styles.divider} />;

export default function DrawerContent({ state, navigation }) {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const alert = useAlert();

  const activeRouteName = state?.routes?.[state?.index]?.name ?? "";

  const displayName = user?.name || user?.username || "VaultHive User";
  const email = user?.email || "your account";
  const initial = String(displayName).trim().charAt(0).toUpperCase() || "V";

  const navigate = (screenName) => {
    const tabRoutes = ["Home", "Vault", "Add", "Stores", "Profile"];
    navigation.closeDrawer();
    if (tabRoutes.includes(screenName)) {
      navigation.navigate("MainTabs", { screen: screenName });
      return;
    }
    navigation.navigate(screenName);
  };

  const confirmLogout = () => {
    navigation.closeDrawer();
    alert?.open?.({
      type: "warning",
      title: "Log out?",
      message: "You will need to sign in again to access your vault.",
      actions: [
        { text: "Cancel" },
        {
          text: "Log out",
          style: "destructive",
          onPress: async () => {
            const result = await logout();
            if (!result?.success) {
              alert?.error?.("Error", result?.error || "Logout failed.");
            }
          },
        },
      ],
    });
  };

  return (
    <View style={[styles.panel, { paddingTop: insets.top + scale(10) }]}>
      {/* Profile header */}
      <TouchableOpacity
        style={styles.profileHeader}
        activeOpacity={0.88}
        onPress={() => {
          navigation.closeDrawer();
          navigation.navigate("MainTabs", { screen: "Profile" });
        }}
      >
        <View style={styles.profileRow}>
          {user?.photoURL ? (
            <Image source={{ uri: user.photoURL }} style={styles.avatarImg} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
          )}
          <View style={styles.profileTextWrap}>
            <Text style={styles.profileName} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={styles.profileEmail} numberOfLines={1}>
              {email}
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* Nav items */}
      <DrawerContentScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {DRAWER_ITEMS.map((item, index) => (
          <React.Fragment key={item.name}>
            <DrawerItem
              icon={item.icon}
              label={item.label}
              active={activeRouteName === item.name}
              onPress={() => navigate(item.name)}
            />
            {index < DRAWER_ITEMS.length - 1 ? <DrawerDivider /> : null}
          </React.Fragment>
        ))}

        <View style={styles.logoutWrap}>
          <DrawerDivider />
          <DrawerItem
            icon="log-out-outline"
            label="Log out"
            danger
            onPress={confirmLogout}
          />
        </View>
      </DrawerContentScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    backgroundColor: VaultColors.brown || "#5B3B1F",
    borderTopRightRadius: scale(32),
    borderBottomRightRadius: scale(32),
    paddingHorizontal: scale(18),
    ...VaultShadows.md,
  },

  profileHeader: {
    paddingVertical: scale(16),
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.18)",
    marginBottom: scale(6),
  },

  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(12),
  },

  avatar: {
    width: scale(56),
    height: scale(56),
    borderRadius: scale(28),
    backgroundColor: "#F7F1E3",
    alignItems: "center",
    justifyContent: "center",
  },

  avatarImg: {
    width: scale(56),
    height: scale(56),
    borderRadius: scale(28),
  },

  avatarText: {
    color: VaultColors.brandGoldDark,
    fontSize: getFontSize(20),
    fontFamily: "Poppins",
    fontWeight: "900",
  },

  profileTextWrap: {
    flex: 1,
  },

  profileName: {
    color: "#FFFFFF",
    fontSize: getFontSize(18),
    fontFamily: "Poppins",
    fontWeight: "900",
  },

  profileEmail: {
    marginTop: scale(3),
    color: "rgba(255,255,255,0.76)",
    fontSize: getFontSize(11),
    fontFamily: "Poppins",
    fontWeight: "600",
  },

  scrollContent: {
    paddingBottom: scale(20),
  },

  itemRow: {
    minHeight: scale(64),
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: scale(8),
  },

  itemIconWrap: {
    width: scale(44),
    height: scale(44),
    borderRadius: scale(16),
    backgroundColor: "rgba(247,241,227,0.14)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: scale(12),
  },

  itemIconWrapDanger: {
    backgroundColor: "rgba(255,255,255,0.10)",
  },

  itemLabel: {
    flex: 1,
    color: "rgba(255,255,255,0.88)",
    fontSize: getFontSize(15),
    fontFamily: "Poppins",
    fontWeight: "700",
  },

  itemLabelActive: {
    color: "#FFFFFF",
    fontWeight: "900",
  },

  itemLabelDanger: {
    color: "#FFFFFF",
  },

  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.12)",
    marginLeft: scale(56),
  },

  logoutWrap: {
    marginTop: scale(16),
  },
});
