/**
 * SettingsScreen — Phase 12
 *
 * Standalone settings. Sections:
 *   1. Notifications   — push toggle, tone selector (4 tones with visual cards),
 *                        return deadline, warranty expiry, weekly summary
 *   2. Categories      — list + add/edit/delete user purchase categories
 *   3. Tags            — list + add/edit/delete user tags
 *   4. App             — biometric, language (display only)
 *   5. Quick links     — AI Assistant, Stores, Reports
 *   6. Account         — Log out
 */

import React, { useCallback, useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";
import * as Haptics from "expo-haptics";

import { useAuth } from "../../context/AuthContext";
import { useAlert } from "../../components/AlertProvider";
import useSettings, {
  NOTIFICATION_TONES,
  CATEGORY_COLORS,
  CATEGORY_ICONS,
  TAG_COLORS,
} from "../../hooks/useSettings";
import { scale, getFontSize, getSpacing } from "../../utils/responsive";
import { VaultColors, VaultShadows, VaultSpacing } from "../../styles/DesignSystem";

// ─── Primitive components ─────────────────────────────────────────────────────

const SectionHeader = ({ title, subtitle }) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {subtitle ? <Text style={styles.sectionSub}>{subtitle}</Text> : null}
  </View>
);

const SectionCard = ({ children }) => <View style={styles.sectionCard}>{children}</View>;

const RowDivider = () => <View style={styles.rowDivider} />;

const SettingRow = ({ icon, iconColor, label, hint, right, onPress, danger = false }) => (
  <TouchableOpacity
    style={styles.settingRow}
    activeOpacity={onPress ? 0.82 : 1}
    onPress={onPress}
    disabled={!onPress}
  >
    <View style={[styles.settingIconWrap, { backgroundColor: (iconColor || VaultColors.brandGoldDark) + "18" }]}>
      <Ionicons name={icon} size={scale(17)} color={danger ? VaultColors.error : (iconColor || VaultColors.brandGoldDark)} />
    </View>
    <View style={styles.settingBody}>
      <Text style={[styles.settingLabel, danger && { color: VaultColors.error }]}>{label}</Text>
      {hint ? <Text style={styles.settingHint}>{hint}</Text> : null}
    </View>
    <View style={styles.settingRight}>{right}</View>
  </TouchableOpacity>
);

const VaultSwitch = ({ value, onValueChange }) => (
  <Switch
    value={!!value}
    onValueChange={onValueChange}
    trackColor={{ true: VaultColors.brandGoldSoft, false: "#E0D4C0" }}
    thumbColor={value ? VaultColors.brandGoldDark : "#fff"}
    ios_backgroundColor="#E0D4C0"
  />
);

// ─── Tone selector ────────────────────────────────────────────────────────────

const ToneCard = ({ tone, selected, onPress }) => (
  <TouchableOpacity
    style={[styles.toneCard, selected && styles.toneCardActive]}
    activeOpacity={0.82}
    onPress={onPress}
  >
    <View style={[styles.toneIcon, selected && styles.toneIconActive]}>
      <Ionicons name={tone.icon} size={scale(20)} color={selected ? "#fff" : VaultColors.brandGoldDark} />
    </View>
    <Text style={[styles.toneLabel, selected && styles.toneLabelActive]}>{tone.label}</Text>
    <Text style={styles.toneDesc} numberOfLines={2}>{tone.desc}</Text>
    {selected ? (
      <View style={styles.toneCheck}>
        <Ionicons name="checkmark-circle" size={scale(16)} color={VaultColors.brandGoldDark} />
      </View>
    ) : null}
  </TouchableOpacity>
);

// ─── Category / Tag editor modal ──────────────────────────────────────────────

const ItemEditorModal = ({ visible, item, type, onSave, onClose }) => {
  const [name,    setName]    = useState(item?.name  || "");
  const [color,   setColor]   = useState(item?.color || (type === "category" ? CATEGORY_COLORS[0] : TAG_COLORS[0]));
  const [iconKey, setIconKey] = useState(item?.icon_key || "pricetag-outline");

  const colorPalette = type === "category" ? CATEGORY_COLORS : TAG_COLORS;

  const handleSave = () => {
    if (!String(name || "").trim()) return;
    onSave({ ...(item || {}), name: name.trim(), color, icon_key: iconKey });
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <View style={em.overlay}>
        <View style={em.sheet}>
          <View style={em.handle} />
          <Text style={em.title}>{item?.name ? `Edit ${type}` : `New ${type}`}</Text>

          <Text style={em.fieldLabel}>Name</Text>
          <TextInput
            style={em.input}
            value={name}
            onChangeText={setName}
            placeholder={type === "category" ? "e.g. Work, Baby, Travel" : "e.g. Important, Follow up"}
            placeholderTextColor={VaultColors.inputPlaceholder}
            autoFocus
            maxLength={32}
          />

          {type === "category" ? (
            <>
              <Text style={em.fieldLabel}>Icon</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={em.iconScroll}>
                {CATEGORY_ICONS.map((ic) => (
                  <TouchableOpacity
                    key={ic.key}
                    style={[em.iconBtn, iconKey === ic.key && em.iconBtnActive]}
                    onPress={() => setIconKey(ic.key)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name={ic.key} size={scale(18)} color={iconKey === ic.key ? "#fff" : VaultColors.brandGoldDark} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          ) : null}

          <Text style={em.fieldLabel}>Color</Text>
          <View style={em.colorRow}>
            {colorPalette.map((c) => (
              <TouchableOpacity
                key={c}
                style={[em.colorDot, { backgroundColor: c }, color === c && em.colorDotActive]}
                onPress={() => setColor(c)}
                activeOpacity={0.8}
              >
                {color === c ? <Ionicons name="checkmark" size={scale(12)} color="#fff" /> : null}
              </TouchableOpacity>
            ))}
          </View>

          <View style={em.actions}>
            <TouchableOpacity style={em.cancelBtn} onPress={onClose} activeOpacity={0.85}>
              <Text style={em.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={em.saveBtn} onPress={handleSave} activeOpacity={0.85}>
              <Text style={em.saveText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const em = StyleSheet.create({
  overlay:      { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet:        { backgroundColor: "#fff", borderTopLeftRadius: scale(24), borderTopRightRadius: scale(24), paddingHorizontal: getSpacing(20), paddingTop: getSpacing(12), paddingBottom: getSpacing(32) },
  handle:       { width: scale(36), height: scale(4), borderRadius: 2, backgroundColor: VaultColors.border, alignSelf: "center", marginBottom: getSpacing(16) },
  title:        { fontSize: getFontSize(18), fontWeight: "900", color: VaultColors.textPrimary, marginBottom: getSpacing(16) },
  fieldLabel:   { fontSize: getFontSize(11), fontWeight: "800", color: VaultColors.textMuted, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: getSpacing(6), marginTop: getSpacing(12) },
  input:        { backgroundColor: VaultColors.appBackground, borderRadius: scale(12), borderWidth: 1, borderColor: VaultColors.border, paddingHorizontal: getSpacing(14), paddingVertical: getSpacing(12), fontSize: getFontSize(15), fontWeight: "600", color: VaultColors.textPrimary },
  iconScroll:   { marginVertical: getSpacing(4) },
  iconBtn:      { width: scale(40), height: scale(40), borderRadius: scale(12), backgroundColor: VaultColors.brandGoldSoft, alignItems: "center", justifyContent: "center", marginRight: getSpacing(8), borderWidth: 1, borderColor: VaultColors.border },
  iconBtnActive:{ backgroundColor: VaultColors.brandGoldDark, borderColor: VaultColors.brandGoldDark },
  colorRow:     { flexDirection: "row", flexWrap: "wrap", gap: getSpacing(10), marginTop: getSpacing(4) },
  colorDot:     { width: scale(32), height: scale(32), borderRadius: scale(16), alignItems: "center", justifyContent: "center" },
  colorDotActive:{ borderWidth: 3, borderColor: "#fff", shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  actions:      { flexDirection: "row", gap: getSpacing(10), marginTop: getSpacing(20) },
  cancelBtn:    { flex: 1, height: scale(46), borderRadius: scale(12), backgroundColor: VaultColors.appBackground, borderWidth: 1, borderColor: VaultColors.border, alignItems: "center", justifyContent: "center" },
  cancelText:   { fontSize: getFontSize(14), fontWeight: "700", color: VaultColors.textPrimary },
  saveBtn:      { flex: 1, height: scale(46), borderRadius: scale(12), backgroundColor: VaultColors.brown, alignItems: "center", justifyContent: "center" },
  saveText:     { fontSize: getFontSize(14), fontWeight: "800", color: "#FEF7E6" },
});

// ─── Category chip ────────────────────────────────────────────────────────────

const CategoryChip = ({ item, onEdit, onDelete }) => (
  <View style={[styles.chip, { borderColor: item.color + "55" }]}>
    <View style={[styles.chipIcon, { backgroundColor: item.color + "22" }]}>
      <Ionicons name={item.icon_key || "pricetag-outline"} size={scale(13)} color={item.color || VaultColors.brandGoldDark} />
    </View>
    <Text style={styles.chipLabel} numberOfLines={1}>{item.name}</Text>
    <TouchableOpacity onPress={onEdit}  activeOpacity={0.8} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
      <Ionicons name="create-outline" size={scale(14)} color={VaultColors.textMuted} />
    </TouchableOpacity>
    <TouchableOpacity onPress={onDelete} activeOpacity={0.8} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
      <Ionicons name="close-circle-outline" size={scale(14)} color={VaultColors.error} />
    </TouchableOpacity>
  </View>
);

// ─── Tag chip ─────────────────────────────────────────────────────────────────

const TagChip = ({ item, onEdit, onDelete }) => (
  <View style={[styles.chip, { borderColor: (item.color || VaultColors.brandGoldDark) + "55" }]}>
    <View style={[styles.chipDot, { backgroundColor: item.color || VaultColors.brandGoldDark }]} />
    <Text style={styles.chipLabel} numberOfLines={1}>{item.name}</Text>
    <TouchableOpacity onPress={onEdit}  activeOpacity={0.8} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
      <Ionicons name="create-outline" size={scale(14)} color={VaultColors.textMuted} />
    </TouchableOpacity>
    <TouchableOpacity onPress={onDelete} activeOpacity={0.8} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
      <Ionicons name="close-circle-outline" size={scale(14)} color={VaultColors.error} />
    </TouchableOpacity>
  </View>
);

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function SettingsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { logout } = useAuth();
  const alert = useAlert();

  const {
    settings, categories, tags, saving,
    patchSetting, saveCategory, deleteCategory, saveTag, deleteTag,
  } = useSettings();

  // Editor modal state
  const [editorVisible, setEditorVisible] = useState(false);
  const [editorType,    setEditorType]    = useState("category"); // "category" | "tag"
  const [editorItem,    setEditorItem]    = useState(null);

  const openEditor = (type, item = null) => {
    setEditorType(type);
    setEditorItem(item);
    setEditorVisible(true);
  };

  const handleSaveItem = useCallback(async (item) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (editorType === "category") await saveCategory(item);
    else                           await saveTag(item);
  }, [editorType, saveCategory, saveTag]);

  const handleDeleteCategory = (cat) => {
    Alert.alert("Delete category?", `Remove "${cat.name}"? This won't affect existing receipts.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteCategory(cat.category_id) },
    ]);
  };

  const handleDeleteTag = (tag) => {
    Alert.alert("Delete tag?", `Remove "${tag.name}"?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteTag(tag.tag_id) },
    ]);
  };

  const handlePatchAndHaptic = (patch) => {
    Haptics.selectionAsync();
    patchSetting(patch);
  };

  const handleLogout = () => {
    alert?.open?.({
      type: "warning", title: "Log out?",
      message: "You can sign back in any time.",
      actions: [
        { text: "Cancel" },
        { text: "Log out", style: "destructive", onPress: async () => {
          const res = await logout();
          if (!res?.success) alert?.error?.("Error", res?.error || "Logout failed");
        }},
      ],
    });
  };

  const selectedTone = String(settings?.notif_sound || "default");

  return (
    <SafeAreaView style={styles.root} edges={["bottom"]}>
      <StatusBar barStyle="dark-content" backgroundColor={VaultColors.appBackground} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + getSpacing(10) }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.85}>
          <Ionicons name="chevron-back" size={scale(22)} color={VaultColors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Settings</Text>
          <Text style={styles.headerSub}>Notifications, categories, preferences</Text>
        </View>
        {saving ? <Text style={styles.savingBadge}>Saving…</Text> : <View style={{ width: scale(52) }} />}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: getSpacing(40) }]}
      >

        {/* ─── 1. Notifications ──────────────────────────────────── */}
        <SectionHeader title="Notifications" subtitle="Control when and how VaultHive alerts you" />
        <SectionCard>
          <SettingRow
            icon="notifications-outline"
            label="Push notifications"
            hint="Enable alerts for reminders and updates"
            right={<VaultSwitch value={settings?.push_enabled} onValueChange={(v) => handlePatchAndHaptic({ push_enabled: v })} />}
          />
          <RowDivider />
          <SettingRow
            icon="timer-outline"
            label="Return deadline alerts"
            hint="Notify before return windows close"
            right={<VaultSwitch value={settings?.notif_return_deadline} onValueChange={(v) => handlePatchAndHaptic({ notif_return_deadline: v })} />}
          />
          <RowDivider />
          <SettingRow
            icon="shield-checkmark-outline"
            label="Warranty expiry alerts"
            hint="Notify before warranties expire"
            right={<VaultSwitch value={settings?.notif_warranty_expiry} onValueChange={(v) => handlePatchAndHaptic({ notif_warranty_expiry: v })} />}
          />
          <RowDivider />
          <SettingRow
            icon="sparkles-outline"
            label="Weekly summary"
            hint="A friendly overview of your activity"
            right={<VaultSwitch value={settings?.notif_weekly_summary} onValueChange={(v) => handlePatchAndHaptic({ notif_weekly_summary: v })} />}
          />
        </SectionCard>

        {/* ─── 2. Reminder tone ──────────────────────────────────── */}
        <SectionHeader title="Reminder tone" subtitle="Choose the sound played for reminder notifications" />
        <View style={styles.toneGrid}>
          {NOTIFICATION_TONES.map((tone) => (
            <ToneCard
              key={tone.key}
              tone={tone}
              selected={selectedTone === tone.key}
              onPress={() => handlePatchAndHaptic({ notif_sound: tone.key })}
            />
          ))}
        </View>

        {/* ─── 3. Purchase categories ─────────────────────────────── */}
        <SectionHeader
          title="Purchase categories"
          subtitle="Organize your receipts and hubs. Synced to your account."
        />
        <SectionCard>
          {categories.length > 0 ? (
            <View style={styles.chipsWrap}>
              {categories.map((cat) => (
                <CategoryChip
                  key={String(cat.category_id)}
                  item={cat}
                  onEdit={() => openEditor("category", cat)}
                  onDelete={() => handleDeleteCategory(cat)}
                />
              ))}
            </View>
          ) : (
            <Text style={styles.emptyHint}>No custom categories yet. Add one below.</Text>
          )}
          <TouchableOpacity style={styles.addRowBtn} onPress={() => openEditor("category")} activeOpacity={0.82}>
            <Ionicons name="add-circle-outline" size={scale(18)} color={VaultColors.brandGoldDark} />
            <Text style={styles.addRowText}>Add category</Text>
          </TouchableOpacity>
        </SectionCard>

        {/* ─── 4. Tags ────────────────────────────────────────────── */}
        <SectionHeader
          title="Tags"
          subtitle="Label receipts with custom tags for quick filtering."
        />
        <SectionCard>
          {tags.length > 0 ? (
            <View style={styles.chipsWrap}>
              {tags.map((tag) => (
                <TagChip
                  key={String(tag.tag_id)}
                  item={tag}
                  onEdit={() => openEditor("tag", tag)}
                  onDelete={() => handleDeleteTag(tag)}
                />
              ))}
            </View>
          ) : (
            <Text style={styles.emptyHint}>No tags yet. Add one below.</Text>
          )}
          <TouchableOpacity style={styles.addRowBtn} onPress={() => openEditor("tag")} activeOpacity={0.82}>
            <Ionicons name="add-circle-outline" size={scale(18)} color={VaultColors.brandGoldDark} />
            <Text style={styles.addRowText}>Add tag</Text>
          </TouchableOpacity>
        </SectionCard>

        {/* ─── 5. App preferences ─────────────────────────────────── */}
        <SectionHeader title="App preferences" />
        <SectionCard>
          <SettingRow
            icon="lock-closed-outline"
            label="Biometric unlock"
            hint="Use Face ID or fingerprint to open the app"
            right={<VaultSwitch value={settings?.biometric_enabled} onValueChange={(v) => handlePatchAndHaptic({ biometric_enabled: v })} />}
          />
        </SectionCard>

        {/* ─── 6. Quick links ─────────────────────────────────────── */}
        <SectionHeader title="Quick access" />
        <SectionCard>
          <SettingRow
            icon="sparkles-outline"
            label="AI Assistant"
            hint="Chat about your purchases and warranties"
            onPress={() => navigation.navigate("AIAssistant")}
            right={<Ionicons name="chevron-forward" size={scale(15)} color={VaultColors.textMuted} />}
          />
          <RowDivider />
          <SettingRow
            icon="storefront-outline"
            label="Favorite stores"
            hint="Browse and manage saved stores"
            onPress={() => navigation.navigate("Stores")}
            right={<Ionicons name="chevron-forward" size={scale(15)} color={VaultColors.textMuted} />}
          />
          <RowDivider />
          <SettingRow
            icon="bar-chart-outline"
            label="Reports"
            hint="Monthly overview and protection metrics"
            onPress={() => navigation.navigate("Reports")}
            right={<Ionicons name="chevron-forward" size={scale(15)} color={VaultColors.textMuted} />}
          />
        </SectionCard>

        {/* ─── 7. Account / logout ────────────────────────────────── */}
        <SectionHeader title="Account" />
        <SectionCard>
          <SettingRow
            icon="log-out-outline"
            label="Log out"
            hint="Sign out from this device"
            onPress={handleLogout}
            danger
            right={<Ionicons name="chevron-forward" size={scale(15)} color={VaultColors.error} />}
          />
        </SectionCard>

      </ScrollView>

      {/* Item editor modal */}
      <ItemEditorModal
        visible={editorVisible}
        item={editorItem}
        type={editorType}
        onSave={handleSaveItem}
        onClose={() => setEditorVisible(false)}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: VaultColors.appBackground },
  content: { paddingHorizontal: VaultSpacing.screenPadding, gap: getSpacing(4) },

  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: VaultSpacing.screenPadding,
    paddingBottom: getSpacing(10), gap: getSpacing(12),
  },
  backBtn: {
    width: scale(42), height: scale(42), borderRadius: scale(14),
    backgroundColor: "#fff", borderWidth: 1, borderColor: VaultColors.border,
    alignItems: "center", justifyContent: "center",
    ...Platform.select({ ios: VaultShadows.sm, android: { elevation: 1 } }),
  },
  headerCenter:  { flex: 1 },
  headerTitle:   { fontSize: getFontSize(20), fontWeight: "900", color: VaultColors.textPrimary, letterSpacing: -0.4 },
  headerSub:     { fontSize: getFontSize(11), fontWeight: "600", color: VaultColors.textMuted, marginTop: getSpacing(1) },
  savingBadge:   { fontSize: getFontSize(10), fontWeight: "700", color: VaultColors.textMuted },

  // Section
  sectionHeader: { paddingTop: getSpacing(18), paddingBottom: getSpacing(8) },
  sectionTitle:  { fontSize: getFontSize(13), fontWeight: "900", color: VaultColors.textPrimary, letterSpacing: -0.2 },
  sectionSub:    { fontSize: getFontSize(11), fontWeight: "600", color: VaultColors.textMuted, marginTop: getSpacing(2) },

  sectionCard: {
    backgroundColor: "#fff", borderRadius: scale(18),
    borderWidth: 1, borderColor: VaultColors.border,
    overflow: "hidden",
    ...Platform.select({ ios: VaultShadows.sm, android: { elevation: 1 } }),
  },

  settingRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: getSpacing(14), paddingVertical: getSpacing(12),
    gap: getSpacing(12),
  },
  settingIconWrap: {
    width: scale(34), height: scale(34), borderRadius: scale(10),
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  settingBody:   { flex: 1 },
  settingLabel:  { fontSize: getFontSize(14), fontWeight: "700", color: VaultColors.textPrimary },
  settingHint:   { marginTop: getSpacing(1), fontSize: getFontSize(11), fontWeight: "600", color: VaultColors.textMuted },
  settingRight:  { flexShrink: 0 },
  rowDivider:    { height: 1, marginLeft: getSpacing(14) + scale(34) + getSpacing(12), backgroundColor: VaultColors.divider },

  // Tone grid
  toneGrid: {
    flexDirection: "row", flexWrap: "wrap",
    gap: getSpacing(10), marginBottom: getSpacing(4),
  },
  toneCard: {
    width: "47%", backgroundColor: "#fff",
    borderRadius: scale(16), borderWidth: 1.5, borderColor: VaultColors.border,
    padding: getSpacing(12), position: "relative",
    ...Platform.select({ ios: VaultShadows.sm, android: { elevation: 1 } }),
  },
  toneCardActive: { borderColor: VaultColors.brandGoldDark, backgroundColor: VaultColors.brandGoldSoft },
  toneIcon: {
    width: scale(40), height: scale(40), borderRadius: scale(12),
    backgroundColor: VaultColors.brandGoldSoft,
    alignItems: "center", justifyContent: "center", marginBottom: getSpacing(8),
  },
  toneIconActive:  { backgroundColor: VaultColors.brandGoldDark },
  toneLabel:       { fontSize: getFontSize(13), fontWeight: "800", color: VaultColors.textPrimary, marginBottom: getSpacing(3) },
  toneLabelActive: { color: VaultColors.brandGoldDark },
  toneDesc:        { fontSize: getFontSize(10), fontWeight: "600", color: VaultColors.textMuted, lineHeight: 15 },
  toneCheck:       { position: "absolute", top: getSpacing(8), right: getSpacing(8) },

  // Chips
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: getSpacing(8), padding: getSpacing(12) },
  chip: {
    flexDirection: "row", alignItems: "center", gap: getSpacing(6),
    paddingHorizontal: getSpacing(10), paddingVertical: getSpacing(7),
    borderRadius: scale(10), borderWidth: 1,
    backgroundColor: VaultColors.appBackground,
  },
  chipIcon:  { width: scale(20), height: scale(20), borderRadius: scale(5), alignItems: "center", justifyContent: "center" },
  chipDot:   { width: scale(8), height: scale(8), borderRadius: scale(4) },
  chipLabel: { fontSize: getFontSize(12), fontWeight: "700", color: VaultColors.textPrimary, maxWidth: scale(100) },
  emptyHint: { padding: getSpacing(14), fontSize: getFontSize(12), fontWeight: "600", color: VaultColors.textMuted },
  addRowBtn: {
    flexDirection: "row", alignItems: "center", gap: getSpacing(8),
    paddingHorizontal: getSpacing(14), paddingVertical: getSpacing(12),
    borderTopWidth: 1, borderTopColor: VaultColors.divider,
  },
  addRowText: { fontSize: getFontSize(13), fontWeight: "700", color: VaultColors.brandGoldDark },
});
