/**
 * ProfileScreen — Phase 12
 *
 * Standalone profile hub. Shows:
 *   - Avatar (tap → EditProfile)
 *   - Name, email, city, user type
 *   - Quick stats row (hubs, receipts, warranty count)
 *   - Navigation menu: Edit Profile, Reminders, Favorites, AI, Settings, Logout
 */

import React, { useCallback, useState } from "react";
import {
  Image, Platform, ScrollView, StatusBar,
  StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";

import { useAuth } from "../../context/AuthContext";
import { useAlert } from "../../components/AlertProvider";
import { getDb } from "../../db/db";
import { scale, getFontSize, getSpacing } from "../../utils/responsive";
import { VaultColors, VaultShadows, VaultSpacing } from "../../styles/DesignSystem";

// ─── Quick stats ──────────────────────────────────────────────────────────────

async function loadStats(uid) {
  try {
    const db = await getDb();
    const [hubs, receipts, warranties, favorites] = await Promise.all([
      db.getFirstAsync(`SELECT COUNT(*) as n FROM purchase_hubs WHERE user_uid=? AND is_deleted=0`, [uid]),
      db.getFirstAsync(`SELECT COUNT(*) as n FROM receipts WHERE user_uid=? AND is_deleted=0`, [uid]),
      db.getFirstAsync(`SELECT COUNT(*) as n FROM warranties WHERE user_uid=? AND is_deleted=0`, [uid]),
      db.getFirstAsync(`SELECT COUNT(*) as n FROM user_favorite_stores WHERE user_uid=? AND is_on=1`, [uid]),
    ]);
    return {
      hubs:       Number(hubs?.n      || 0),
      receipts:   Number(receipts?.n  || 0),
      warranties: Number(warranties?.n || 0),
      favorites:  Number(favorites?.n || 0),
    };
  } catch { return { hubs: 0, receipts: 0, warranties: 0, favorites: 0 }; }
}

// ─── Menu item ────────────────────────────────────────────────────────────────

const MenuItem = ({ icon, label, subtitle, onPress, danger = false, badge }) => (
  <TouchableOpacity style={styles.menuItem} activeOpacity={0.82} onPress={onPress}>
    <View style={[styles.menuIcon, danger && styles.menuIconDanger]}>
      <Ionicons name={icon} size={scale(18)} color={danger ? VaultColors.error : VaultColors.brandGoldDark} />
    </View>
    <View style={styles.menuBody}>
      <Text style={[styles.menuLabel, danger && styles.menuLabelDanger]}>{label}</Text>
      {!!subtitle ? <Text style={styles.menuSub}>{subtitle}</Text> : null}
    </View>
    {badge != null ? (
      <View style={styles.menuBadge}>
        <Text style={styles.menuBadgeText}>{badge}</Text>
      </View>
    ) : (
      !danger ? <Ionicons name="chevron-forward" size={scale(15)} color={VaultColors.textMuted} /> : null
    )}
  </TouchableOpacity>
);

const Divider = () => <View style={styles.divider} />;

// ─── Stat tile ────────────────────────────────────────────────────────────────

const StatTile = ({ value, label, icon }) => (
  <View style={styles.statTile}>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ProfileScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const alert = useAlert();
  const uid = user?.uid;

  const [stats, setStats] = useState({ hubs: 0, receipts: 0, warranties: 0, favorites: 0 });

  useFocusEffect(useCallback(() => {
    if (uid) loadStats(uid).then(setStats);
  }, [uid]));

  const displayName  = user?.name || user?.username || "VaultHive User";
  const email        = user?.email || "";
  const city         = user?.city  || "";
  const userType     = user?.user_type || "user";
  const initial      = String(displayName).trim().charAt(0).toUpperCase() || "V";
  const hasAvatar    = !!user?.photoURL || !!user?.avatar_url;
  const avatarUri    = user?.photoURL   || user?.avatar_url || null;
  const baseCurrency = user?.base_currency || "SAR";

  const handleLogout = () => {
    alert?.open?.({
      type: "warning",
      title: "Log out?",
      message: "You can sign back in any time.",
      actions: [
        { text: "Cancel" },
        {
          text: "Log out", style: "destructive",
          onPress: async () => {
            const res = await logout();
            if (!res?.success) alert?.error?.("Error", res?.error || "Logout failed");
          },
        },
      ],
    });
  };

  return (
    <SafeAreaView style={styles.root} edges={["bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor={VaultColors.appBackground} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: scale(32) }}
      >
        {/* ── Hero ──────────────────────────────────────────────── */}
        <LinearGradient
          colors={[VaultColors.brown, "#7A4F2C"]}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[styles.hero, { paddingTop: insets.top + scale(20) }]}
        >
          {/* Settings shortcut top-right */}
          <TouchableOpacity
            style={styles.heroSettings}
            activeOpacity={0.85}
            onPress={() => navigation.navigate("Settings")}
          >
            <Ionicons name="settings-outline" size={scale(20)} color="rgba(254,247,230,0.8)" />
          </TouchableOpacity>

          {/* Avatar */}
          <TouchableOpacity
            style={styles.avatarWrap}
            activeOpacity={0.88}
            onPress={() => navigation.navigate("EditProfile")}
          >
            {hasAvatar ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
            ) : (
              <Text style={styles.avatarInitial}>{initial}</Text>
            )}
            <View style={styles.avatarCamBadge}>
              <Ionicons name="camera" size={scale(11)} color="#FEF7E6" />
            </View>
          </TouchableOpacity>

          <Text style={styles.heroName}>{displayName}</Text>
          {!!email ? <Text style={styles.heroEmail}>{email}</Text> : null}

          <View style={styles.heroPillRow}>
            {!!city ? (
              <View style={styles.heroPill}>
                <Ionicons name="location-outline" size={scale(11)} color="rgba(254,247,230,0.75)" />
                <Text style={styles.heroPillText}>{city}</Text>
              </View>
            ) : null}
            <View style={styles.heroPill}>
              <Ionicons name="wallet-outline" size={scale(11)} color="rgba(254,247,230,0.75)" />
              <Text style={styles.heroPillText}>{baseCurrency}</Text>
            </View>
          </View>
        </LinearGradient>

        {/* ── Stats row ──────────────────────────────────────────── */}
        <View style={styles.statsRow}>
          <StatTile value={stats.hubs}       label="Hubs"       icon="cube-outline" />
          <View style={styles.statsDivider} />
          <StatTile value={stats.receipts}   label="Receipts"   icon="receipt-outline" />
          <View style={styles.statsDivider} />
          <StatTile value={stats.warranties} label="Warranties" icon="shield-checkmark-outline" />
          <View style={styles.statsDivider} />
          <StatTile value={stats.favorites}  label="Saved"      icon="heart-outline" />
        </View>

        {/* ── Menu ───────────────────────────────────────────────── */}
        <View style={styles.menuSection}>
          <Text style={styles.menuSectionLabel}>Account</Text>
          <View style={styles.menuCard}>
            <MenuItem
              icon="person-outline"
              label="Edit profile"
              subtitle="Name, city, avatar, currency"
              onPress={() => navigation.navigate("EditProfile")}
            />
            <Divider />
            <MenuItem
              icon="heart-outline"
              label="Favorite stores"
              subtitle={`${stats.favorites} saved store${stats.favorites !== 1 ? "s" : ""}`}
              onPress={() => navigation.navigate("Stores")}
              badge={stats.favorites > 0 ? stats.favorites : undefined}
            />
            <Divider />
            <MenuItem
              icon="alarm-outline"
              label="Reminders"
              subtitle="Manage your active reminders"
              onPress={() => navigation.navigate("Reminders")}
            />
          </View>
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.menuSectionLabel}>Tools</Text>
          <View style={styles.menuCard}>
            <MenuItem
              icon="sparkles-outline"
              label="AI Assistant"
              subtitle="Ask about purchases, warranties, and more"
              onPress={() => navigation.navigate("AIAssistant")}
            />
            <Divider />
            <MenuItem
              icon="bar-chart-outline"
              label="Reports"
              subtitle="Monthly spending and protection overview"
              onPress={() => navigation.navigate("Reports")}
            />
            <Divider />
            <MenuItem
              icon="cube-outline"
              label="Purchase vault"
              subtitle="All your purchase hubs"
              onPress={() => navigation.navigate("Vault")}
            />
          </View>
        </View>

        <View style={styles.menuSection}>
          <Text style={styles.menuSectionLabel}>Preferences</Text>
          <View style={styles.menuCard}>
            <MenuItem
              icon="settings-outline"
              label="Settings"
              subtitle="Notifications, tones, categories, tags"
              onPress={() => navigation.navigate("Settings")}
            />
          </View>
        </View>

        <View style={[styles.menuSection, { marginBottom: 0 }]}>
          <View style={styles.menuCard}>
            <MenuItem
              icon="log-out-outline"
              label="Log out"
              onPress={handleLogout}
              danger
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: VaultColors.appBackground },

  // Hero
  hero: {
    paddingHorizontal: VaultSpacing.screenPadding,
    paddingBottom: scale(28),
    alignItems: "center",
  },
  heroSettings: {
    position: "absolute",
    top: scale(16),
    right: VaultSpacing.screenPadding,
    width: scale(40), height: scale(40),
    alignItems: "center", justifyContent: "center",
  },
  avatarWrap: {
    width: scale(96), height: scale(96),
    borderRadius: scale(48),
    backgroundColor: VaultColors.brandGoldSoft,
    alignItems: "center", justifyContent: "center",
    borderWidth: 3, borderColor: "rgba(254,247,230,0.3)",
    overflow: "hidden",
    ...Platform.select({ ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 }, android: { elevation: 6 } }),
  },
  avatarImg:     { width: "100%", height: "100%" },
  avatarInitial: { fontSize: getFontSize(34), fontWeight: "900", color: VaultColors.brandGoldDark },
  avatarCamBadge: {
    position: "absolute", bottom: 0, right: 0,
    width: scale(28), height: scale(28), borderRadius: scale(14),
    backgroundColor: VaultColors.brandGoldDark,
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: VaultColors.brown,
  },
  heroName:  { marginTop: scale(14), fontSize: getFontSize(22), fontWeight: "900", color: "#FEF7E6", letterSpacing: -0.4 },
  heroEmail: { marginTop: scale(3),  fontSize: getFontSize(12), fontWeight: "600", color: "rgba(254,247,230,0.7)" },
  heroPillRow: { flexDirection: "row", gap: scale(8), marginTop: scale(12) },
  heroPill: {
    flexDirection: "row", alignItems: "center", gap: scale(4),
    backgroundColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: scale(10), paddingVertical: scale(5),
    borderRadius: scale(12),
  },
  heroPillText: { fontSize: getFontSize(11), fontWeight: "700", color: "rgba(254,247,230,0.85)" },

  // Stats
  statsRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#fff",
    marginHorizontal: VaultSpacing.screenPadding,
    marginTop: -scale(18),
    borderRadius: scale(18),
    borderWidth: 1, borderColor: VaultColors.border,
    paddingVertical: scale(16),
    ...Platform.select({ ios: VaultShadows.md, android: { elevation: 4 } }),
  },
  statTile:    { flex: 1, alignItems: "center" },
  statsDivider: { width: 1, height: scale(28), backgroundColor: VaultColors.divider },
  statValue:   { fontSize: getFontSize(20), fontWeight: "900", color: VaultColors.textPrimary, letterSpacing: -0.4 },
  statLabel:   { marginTop: scale(2), fontSize: getFontSize(10), fontWeight: "700", color: VaultColors.textMuted },

  // Menu
  menuSection:      { paddingHorizontal: VaultSpacing.screenPadding, marginTop: scale(18) },
  menuSectionLabel: { fontSize: getFontSize(11), fontWeight: "800", color: VaultColors.textMuted, textTransform: "uppercase", letterSpacing: 0.9, marginBottom: scale(8) },
  menuCard: {
    backgroundColor: "#fff", borderRadius: scale(18),
    borderWidth: 1, borderColor: VaultColors.border,
    overflow: "hidden",
    ...Platform.select({ ios: VaultShadows.sm, android: { elevation: 1 } }),
  },
  menuItem: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: scale(16), paddingVertical: scale(14),
    gap: scale(12),
  },
  menuIcon: {
    width: scale(36), height: scale(36), borderRadius: scale(11),
    backgroundColor: VaultColors.brandGoldSoft,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  menuIconDanger: { backgroundColor: "#FEF0F0" },
  menuBody:       { flex: 1, minWidth: 0 },
  menuLabel:      { fontSize: getFontSize(14), fontWeight: "700", color: VaultColors.textPrimary },
  menuLabelDanger:{ color: VaultColors.error },
  menuSub:        { marginTop: scale(1), fontSize: getFontSize(11), fontWeight: "600", color: VaultColors.textMuted },
  menuBadge: {
    backgroundColor: VaultColors.brandGoldSoft, borderRadius: scale(12),
    paddingHorizontal: scale(8), paddingVertical: scale(3),
    borderWidth: 1, borderColor: VaultColors.border,
  },
  menuBadgeText: { fontSize: getFontSize(11), fontWeight: "800", color: VaultColors.brandGoldDark },
  divider:       { height: 1, marginLeft: scale(16) + scale(36) + scale(12), backgroundColor: VaultColors.divider },
});
