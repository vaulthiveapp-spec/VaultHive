/**
 * EditProfileScreen — Phase 12
 *
 * Independent profile editing screen.
 *
 * Features:
 *   - Avatar: pick from library → resize → upload to Supabase vh-avatars bucket
 *             → save public_url to Firebase users/{uid}/avatar_url
 *   - Name, city editing
 *   - Base currency picker (full currency list with flags)
 *   - All saves go: SQLite first → Firebase via databaseService → AuthContext refresh
 */

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import Ionicons from "react-native-vector-icons/Ionicons";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";

import { useAuth } from "../../context/AuthContext";
import { useAlert } from "../../components/AlertProvider";
import Input from "../../components/Input";
import Button from "../../components/Button";
import { uploadAvatarPublic, deleteAvatarPublic } from "../../services/uploadService";
import { getUserSettings, upsertUserSettings } from "../../services/repo/repoUser";
import databaseService from "../../services/databaseService";
import { SUPPORTED_CURRENCIES } from "../../hooks/useSettings";
import { scale, getFontSize, getSpacing } from "../../utils/responsive";
import { VaultColors, VaultShadows, VaultSpacing } from "../../styles/DesignSystem";

// ─── Currency picker modal ────────────────────────────────────────────────────

const CurrencyPicker = ({ visible, selected, onSelect, onClose }) => (
  <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
    <View style={cp.overlay}>
      <View style={cp.sheet}>
        <View style={cp.handle} />
        <Text style={cp.title}>Base currency</Text>
        <Text style={cp.sub}>All amounts display in this currency</Text>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: scale(24) }}>
          {SUPPORTED_CURRENCIES.map((c) => {
            const active = selected === c.code;
            return (
              <TouchableOpacity
                key={c.code}
                style={[cp.row, active && cp.rowActive]}
                activeOpacity={0.82}
                onPress={() => { onSelect(c.code); onClose(); }}
              >
                <Text style={cp.flag}>{c.flag}</Text>
                <View style={cp.rowBody}>
                  <Text style={[cp.code, active && cp.codeActive]}>{c.code}</Text>
                  <Text style={cp.name}>{c.name}</Text>
                </View>
                {active ? <Ionicons name="checkmark-circle" size={scale(20)} color={VaultColors.brandGoldDark} /> : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <TouchableOpacity style={cp.cancelBtn} onPress={onClose} activeOpacity={0.85}>
          <Text style={cp.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
);

const cp = StyleSheet.create({
  overlay:    { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet:      { backgroundColor: "#fff", borderTopLeftRadius: scale(24), borderTopRightRadius: scale(24), paddingHorizontal: scale(20), paddingTop: scale(12), maxHeight: "82%" },
  handle:     { width: scale(36), height: scale(4), borderRadius: 2, backgroundColor: VaultColors.border, alignSelf: "center", marginBottom: scale(16) },
  title:      { fontSize: getFontSize(18), fontWeight: "900", color: VaultColors.textPrimary, marginBottom: scale(4) },
  sub:        { fontSize: getFontSize(12), fontWeight: "600", color: VaultColors.textMuted, marginBottom: scale(16) },
  row:        { flexDirection: "row", alignItems: "center", paddingVertical: scale(13), borderBottomWidth: 1, borderBottomColor: VaultColors.divider, gap: scale(14) },
  rowActive:  { backgroundColor: VaultColors.brandGoldSoft, marginHorizontal: -scale(20), paddingHorizontal: scale(20), borderRadius: 0 },
  flag:       { fontSize: 22 },
  rowBody:    { flex: 1 },
  code:       { fontSize: getFontSize(15), fontWeight: "800", color: VaultColors.textPrimary },
  codeActive: { color: VaultColors.brandGoldDark },
  name:       { fontSize: getFontSize(12), fontWeight: "600", color: VaultColors.textMuted, marginTop: scale(1) },
  cancelBtn:  { backgroundColor: VaultColors.appBackground, borderRadius: scale(14), height: scale(48), alignItems: "center", justifyContent: "center", marginVertical: scale(12) },
  cancelText: { fontSize: getFontSize(14), fontWeight: "800", color: VaultColors.textPrimary },
});

// ─── Field row ────────────────────────────────────────────────────────────────

const FieldRow = ({ icon, label, children }) => (
  <View style={styles.fieldRow}>
    <View style={styles.fieldIcon}>
      <Ionicons name={icon} size={scale(16)} color={VaultColors.brandGoldDark} />
    </View>
    <View style={styles.fieldBody}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  </View>
);

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function EditProfileScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user, refreshUserProfile } = useAuth();
  const alert = useAlert();
  const uid = user?.uid;

  const [name,         setName]         = useState("");
  const [city,         setCity]         = useState("");
  const [currency,     setCurrency]     = useState("SAR");
  const [showCurrency, setShowCurrency] = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [avatarBusy,   setAvatarBusy]   = useState(false);

  const hasAvatar = !!user?.photoURL || !!user?.avatar_url;
  const avatarUri = user?.photoURL || user?.avatar_url || null;
  const initial   = String(user?.name || user?.username || "V").trim().charAt(0).toUpperCase();

  // ── Load current values ──────────────────────────────────────────────────
  useFocusEffect(useCallback(() => {
    if (!uid) return;
    setName(user?.name || user?.username || "");
    setCity(user?.city || "");
    getUserSettings(uid).then((s) => {
      setCurrency(String(s?.base_currency || user?.base_currency || "SAR").toUpperCase());
    }).catch(() => {});
  }, [uid, user?.name, user?.username, user?.city, user?.base_currency]));

  // ── Avatar actions ───────────────────────────────────────────────────────
  const pickAndUpload = useCallback(async () => {
    if (!uid) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      alert?.warning?.("Permission needed", "Allow photo library access to choose a profile picture.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (res.canceled || !res.assets?.[0]?.uri) return;

    setAvatarBusy(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const uploaded = await uploadAvatarPublic({
        userUid: uid,
        uri: res.assets[0].uri,
        contentType: res.assets[0].mimeType || "image/jpeg",
      });
      await databaseService.updateUserProfile(uid, {
        avatar_url: uploaded.public_url,
        photoURL:   uploaded.public_url,
        updated_at: Date.now(),
      });
      await refreshUserProfile(uid);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      alert?.success?.("Avatar updated", "Your profile picture was saved.");
    } catch (e) {
      alert?.error?.("Upload failed", e?.message || "Could not upload avatar.");
    } finally {
      setAvatarBusy(false);
    }
  }, [uid, alert, refreshUserProfile]);

  const removeAvatar = useCallback(async () => {
    if (!uid) return;
    setAvatarBusy(true);
    try {
      await deleteAvatarPublic({ userUid: uid }).catch(() => {});
      await databaseService.updateUserProfile(uid, {
        avatar_url: null, photoURL: null, updated_at: Date.now(),
      });
      await refreshUserProfile(uid);
      alert?.success?.("Avatar removed", "Your profile picture was removed.");
    } catch (e) {
      alert?.error?.("Error", e?.message || "Could not remove avatar.");
    } finally {
      setAvatarBusy(false);
    }
  }, [uid, alert, refreshUserProfile]);

  const handleAvatarTap = () => {
    if (avatarBusy) return;
    if (hasAvatar) {
      alert?.open?.({
        type: "info", title: "Profile picture",
        message: "What would you like to do?",
        actions: [
          { text: "Cancel" },
          { text: "Change photo", onPress: pickAndUpload },
          { text: "Remove",      style: "destructive", onPress: removeAvatar },
        ],
      });
    } else {
      pickAndUpload();
    }
  };

  // ── Save profile ─────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!uid) return;
    const trimName = String(name || "").trim();
    const trimCity = String(city || "").trim() || "Saudi Arabia";
    if (!trimName) {
      alert?.warning?.("Missing", "Please enter your name.");
      return;
    }
    setSaving(true);
    try {
      // 1. Update Firebase profile
      await databaseService.updateUserProfile(uid, {
        name: trimName, city: trimCity, updated_at: Date.now(),
      });
      // 2. Persist currency to user_settings in SQLite and Firebase
      const current = await getUserSettings(uid);
      const next = { ...(current || {}), uid, base_currency: currency, updated_at: Date.now() };
      await upsertUserSettings(next);
      await databaseService.updateUserSettings(uid, { base_currency: currency, updated_at: Date.now() });
      // 3. Refresh AuthContext
      await refreshUserProfile(uid);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      alert?.success?.("Saved", "Your profile was updated.");
      navigation.goBack();
    } catch (e) {
      alert?.error?.("Error", e?.message || "Could not save profile.");
    } finally {
      setSaving(false);
    }
  }, [uid, name, city, currency, alert, refreshUserProfile, navigation]);

  const currencyInfo = useMemo(
    () => SUPPORTED_CURRENCIES.find((c) => c.code === currency) || SUPPORTED_CURRENCIES[0],
    [currency]
  );

  return (
    <SafeAreaView style={styles.root} edges={["bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor={VaultColors.appBackground} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.85}>
          <Ionicons name="chevron-back" size={scale(22)} color={VaultColors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit profile</Text>
        <View style={{ width: scale(42) }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingBottom: scale(40) }]}
      >
        {/* ── Avatar ──────────────────────────────────────────── */}
        <View style={styles.avatarSection}>
          <TouchableOpacity
            style={styles.avatarWrap}
            activeOpacity={0.88}
            onPress={handleAvatarTap}
            disabled={avatarBusy}
          >
            {hasAvatar && avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarInitial}>{initial}</Text>
              </View>
            )}
            {avatarBusy ? (
              <View style={styles.avatarLoader}>
                <ActivityIndicator color="#fff" size="small" />
              </View>
            ) : (
              <View style={styles.camBadge}>
                <Ionicons name="camera" size={scale(13)} color="#fff" />
              </View>
            )}
          </TouchableOpacity>
          <Text style={styles.avatarHint}>
            {hasAvatar ? "Tap to change or remove" : "Tap to add a profile picture"}
          </Text>
          <View style={styles.avatarActions}>
            <TouchableOpacity style={styles.avatarBtn} onPress={pickAndUpload} activeOpacity={0.85} disabled={avatarBusy}>
              <Ionicons name="images-outline" size={scale(15)} color={VaultColors.brandGoldDark} />
              <Text style={styles.avatarBtnText}>{hasAvatar ? "Change" : "Upload photo"}</Text>
            </TouchableOpacity>
            {hasAvatar ? (
              <TouchableOpacity style={[styles.avatarBtn, styles.avatarBtnGhost]} onPress={removeAvatar} activeOpacity={0.85} disabled={avatarBusy}>
                <Ionicons name="trash-outline" size={scale(15)} color={VaultColors.error} />
                <Text style={[styles.avatarBtnText, styles.avatarBtnTextDanger]}>Remove</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* ── Form fields ──────────────────────────────────────── */}
        <View style={styles.card}>
          <FieldRow icon="person-outline" label="Full name">
            <Input
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              style={styles.inputInline}
            />
          </FieldRow>
          <View style={styles.fieldDivider} />
          <FieldRow icon="location-outline" label="City">
            <Input
              value={city}
              onChangeText={setCity}
              placeholder="e.g. Riyadh"
              style={styles.inputInline}
            />
          </FieldRow>
          <View style={styles.fieldDivider} />
          <FieldRow icon="wallet-outline" label="Base currency">
            <TouchableOpacity
              style={styles.currencySelector}
              activeOpacity={0.82}
              onPress={() => setShowCurrency(true)}
            >
              <Text style={styles.currencyFlag}>{currencyInfo.flag}</Text>
              <Text style={styles.currencyCode}>{currencyInfo.code}</Text>
              <Text style={styles.currencyName}>{currencyInfo.name}</Text>
              <Ionicons name="chevron-forward" size={scale(14)} color={VaultColors.textMuted} style={{ marginLeft: "auto" }} />
            </TouchableOpacity>
          </FieldRow>
        </View>

        <Text style={styles.currencyNote}>
          All spending totals and reports display in your base currency using exchange rates captured at the time of each purchase.
        </Text>

        <Button
          title={saving ? "Saving…" : "Save changes"}
          onPress={handleSave}
          disabled={saving || avatarBusy}
        />
      </ScrollView>

      <CurrencyPicker
        visible={showCurrency}
        selected={currency}
        onSelect={setCurrency}
        onClose={() => setShowCurrency(false)}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: VaultColors.appBackground },
  header: {
    paddingHorizontal: VaultSpacing.screenPadding,
    paddingBottom: scale(10),
    flexDirection: "row", alignItems: "center",
  },
  backBtn: {
    width: scale(42), height: scale(42), borderRadius: scale(14),
    backgroundColor: "#fff", borderWidth: 1, borderColor: VaultColors.border,
    alignItems: "center", justifyContent: "center",
    ...Platform.select({ ios: VaultShadows.sm, android: { elevation: 1 } }),
  },
  headerTitle: {
    flex: 1, textAlign: "center",
    fontSize: getFontSize(18), fontWeight: "900",
    color: VaultColors.textPrimary, letterSpacing: -0.3,
  },
  content: { paddingHorizontal: VaultSpacing.screenPadding, paddingTop: scale(8) },

  // Avatar
  avatarSection: { alignItems: "center", paddingVertical: scale(24) },
  avatarWrap: {
    width: scale(100), height: scale(100), borderRadius: scale(50),
    overflow: "hidden", borderWidth: 3, borderColor: VaultColors.border,
    ...Platform.select({ ios: VaultShadows.md, android: { elevation: 6 } }),
  },
  avatarImg:     { width: "100%", height: "100%" },
  avatarFallback:{ flex: 1, backgroundColor: VaultColors.brandGoldSoft, alignItems: "center", justifyContent: "center" },
  avatarInitial: { fontSize: getFontSize(36), fontWeight: "900", color: VaultColors.brandGoldDark },
  avatarLoader: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center", justifyContent: "center",
  },
  camBadge: {
    position: "absolute", bottom: 0, right: 0,
    width: scale(28), height: scale(28), borderRadius: scale(14),
    backgroundColor: VaultColors.brandGoldDark,
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "#fff",
  },
  avatarHint:    { marginTop: scale(10), fontSize: getFontSize(12), fontWeight: "600", color: VaultColors.textMuted },
  avatarActions: { flexDirection: "row", gap: scale(10), marginTop: scale(12) },
  avatarBtn: {
    flexDirection: "row", alignItems: "center", gap: scale(6),
    paddingHorizontal: scale(16), paddingVertical: scale(9),
    borderRadius: scale(12), backgroundColor: VaultColors.brandGoldSoft,
    borderWidth: 1, borderColor: VaultColors.border,
  },
  avatarBtnGhost: { backgroundColor: "#FEF0F0", borderColor: "#FECACA" },
  avatarBtnText:  { fontSize: getFontSize(13), fontWeight: "700", color: VaultColors.brandGoldDark },
  avatarBtnTextDanger: { color: VaultColors.error },

  // Form card
  card: {
    backgroundColor: "#fff", borderRadius: scale(18),
    borderWidth: 1, borderColor: VaultColors.border,
    marginBottom: scale(14),
    ...Platform.select({ ios: VaultShadows.sm, android: { elevation: 1 } }),
  },
  fieldRow:    { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: scale(16), paddingVertical: scale(12), gap: scale(12) },
  fieldIcon:   { width: scale(32), height: scale(32), borderRadius: scale(10), backgroundColor: VaultColors.brandGoldSoft, alignItems: "center", justifyContent: "center", marginTop: scale(2) },
  fieldBody:   { flex: 1 },
  fieldLabel:  { fontSize: getFontSize(11), fontWeight: "800", color: VaultColors.textMuted, textTransform: "uppercase", letterSpacing: 0.7, marginBottom: scale(4) },
  fieldDivider:{ height: 1, backgroundColor: VaultColors.divider, marginLeft: scale(16) + scale(32) + scale(12) },
  inputInline: { marginBottom: 0 },

  // Currency selector
  currencySelector: { flexDirection: "row", alignItems: "center", gap: scale(8), paddingVertical: scale(4) },
  currencyFlag: { fontSize: 20 },
  currencyCode: { fontSize: getFontSize(15), fontWeight: "800", color: VaultColors.textPrimary },
  currencyName: { fontSize: getFontSize(12), fontWeight: "600", color: VaultColors.textMuted },
  currencyNote: {
    fontSize: getFontSize(11), fontWeight: "500", color: VaultColors.textMuted,
    lineHeight: 17, marginBottom: scale(16), textAlign: "center",
    paddingHorizontal: scale(8),
  },
});
