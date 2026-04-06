import React from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";

import { scale, getFontSize, getSpacing } from "../utils/responsive";
import { VaultColors, VaultShadows } from "../styles/DesignSystem";

const DrawerItem = ({ icon, title, onPress, danger = false }) => (
  <TouchableOpacity style={styles.itemRow} activeOpacity={0.88} onPress={onPress}>
    <View style={[styles.itemIconWrap, danger && styles.itemIconWrapDanger]}>
      <Ionicons
        name={icon}
        size={scale(22)}
        color={danger ? "#FFFFFF" : VaultColors.brandGoldDark}
      />
    </View>

    <Text style={[styles.itemTitle, danger && styles.itemTitleDanger]}>
      {title}
    </Text>

    {!danger ? (
      <Ionicons
        name="chevron-forward"
        size={scale(18)}
        color="rgba(255,255,255,0.82)"
      />
    ) : null}
  </TouchableOpacity>
);

const DrawerDivider = () => <View style={styles.divider} />;

export default function AppDrawer({
  visible,
  onClose,
  navigation,
  user,
  onLogout,
}) {
  const insets = useSafeAreaInsets();

  const displayName =
    user?.name || user?.username || user?.displayName || "VaultHive User";
  const email = user?.email || "your account";
  const initial = String(displayName).trim().charAt(0).toUpperCase() || "V";

  const open = (screen) => {
    onClose?.();
    navigation?.navigate?.(screen);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.modalRoot}>
        <View
          style={[
            styles.panel,
            {
              paddingTop: insets.top + getSpacing(10),
              paddingBottom: Math.max(insets.bottom, getSpacing(14)),
            },
          ]}
        >
          <TouchableOpacity
            style={styles.profileHeader}
            activeOpacity={0.88}
            onPress={() => open("MyProfile")}
          >
            <View style={styles.profileRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initial}</Text>
              </View>

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

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.content}
          >
            <DrawerItem
              icon="person-outline"
              title="My Profile"
              onPress={() => open("MyProfile")}
            />
            <DrawerDivider />

            <DrawerItem
              icon="cube-outline"
              title="Vault"
              onPress={() => open("Vault")}
            />
            <DrawerDivider />

            <DrawerItem
              icon="storefront-outline"
              title="Stores"
              onPress={() => open("Stores")}
            />
            <DrawerDivider />

            <DrawerItem
              icon="notifications-outline"
              title="Reminders"
              onPress={() => open("Reminders")}
            />
            <DrawerDivider />

            <DrawerItem
              icon="bar-chart-outline"
              title="Reports"
              onPress={() => open("Reports")}
            />
            <DrawerDivider />

            <DrawerItem
              icon="sparkles-outline"
              title="AI Assistant"
              onPress={() => open("AIAssistant")}
            />
            <DrawerDivider />

            <DrawerItem
              icon="settings-outline"
              title="Settings"
              onPress={() => open("Settings")}
            />
            <DrawerDivider />

            <View style={styles.logoutWrap}>
              <DrawerItem
                icon="log-out-outline"
                title="Log Out"
                danger
                onPress={onLogout}
              />
            </View>
          </ScrollView>
        </View>

        <Pressable style={styles.overlay} onPress={onClose} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "rgba(18,12,4,0.18)",
  },

  panel: {
    width: "84%",
    backgroundColor: VaultColors.brandGoldDark || "#8B5A00",
    borderTopRightRadius: scale(34),
    borderBottomRightRadius: scale(34),
    paddingHorizontal: scale(18),
    ...VaultShadows.md,
  },

  overlay: {
    flex: 1,
  },

  profileHeader: {
    paddingBottom: getSpacing(18),
    paddingTop: getSpacing(18),
  },

  profileRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  avatar: {
    width: scale(62),
    height: scale(62),
    borderRadius: scale(31),
    backgroundColor: "#F7F1E3",
    alignItems: "center",
    justifyContent: "center",
    marginRight: getSpacing(14),
  },

  avatarText: {
    color: VaultColors.brandGoldDark,
    fontSize: getFontSize(22),
    fontFamily: "Poppins",
    fontWeight: "900",
  },

  profileTextWrap: {
    flex: 1,
  },

  profileName: {
    color: "#FFFFFF",
    fontSize: getFontSize(21),
    fontFamily: "Poppins",
    fontWeight: "900",
  },

  profileEmail: {
    marginTop: getSpacing(3),
    color: "rgba(255,255,255,0.82)",
    fontSize: getFontSize(11.5),
    fontFamily: "Poppins",
    fontWeight: "600",
  },

  content: {
    paddingBottom: getSpacing(10),
  },

  itemRow: {
    minHeight: scale(72),
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: getSpacing(10),
  },

  itemIconWrap: {
    width: scale(48),
    height: scale(48),
    borderRadius: scale(18),
    backgroundColor: "#F7F1E3",
    alignItems: "center",
    justifyContent: "center",
    marginRight: getSpacing(14),
  },

  itemIconWrapDanger: {
    backgroundColor: "rgba(255,255,255,0.16)",
  },

  itemTitle: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: getFontSize(16),
    fontFamily: "Poppins",
    fontWeight: "800",
  },

  itemTitleDanger: {
    color: "#FFFFFF",
  },

  divider: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.34)",
    marginLeft: scale(62),
  },

  logoutWrap: {
    marginTop: getSpacing(18),
  },
});