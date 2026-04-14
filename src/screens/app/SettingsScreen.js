import React, { useCallback, useEffect, useState } from "react";
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
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
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
import useTonePreview from "../../hooks/useTonePreview";
import { scale, getFontSize } from "../../utils/responsive";
import { VaultColors, VaultShadows, VaultSpacing } from "../../styles/DesignSystem";

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
      <Ionicons
        name={icon}
        size={scale(17)}
        color={danger ? VaultColors.error : iconColor || VaultColors.brandGoldDark}
      />
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

const ToneCard = ({ tone, selected, previewing, onSelect, onPreview }) => (
  <View style={[styles.toneCard, selected && styles.toneCardActive]}>
    <View style={styles.toneTopRow}>
      <View style={[styles.toneIcon, selected && styles.toneIconActive]}>
        <Ionicons
          name={tone.icon}
          size={scale(20)}
          color={selected ? "#fff" : VaultColors.brandGoldDark}
        />
      </View>
      <View style={styles.toneBadgesRow}>
        {tone.isDefault ? (
          <View style={styles.defaultBadge}>
            <Text style={styles.defaultBadgeText}>Default</Text>
          </View>
        ) : null}
        {selected ? (
          <Ionicons name="checkmark-circle" size={scale(18)} color={VaultColors.brandGoldDark} />
        ) : null}
      </View>
    </View>

    <Text style={[styles.toneLabel, selected && styles.toneLabelActive]}>{tone.label}</Text>
    <Text style={styles.toneDesc}>{tone.desc}</Text>

    <View style={styles.toneActions}>
      <TouchableOpacity
        style={[
          styles.toneGhostBtn,
          !tone.previewAsset && styles.toneGhostBtnDisabled,
        ]}
        onPress={() => onPreview(tone)}
        activeOpacity={0.85}
        disabled={!tone.previewAsset}
      >
        <Ionicons
          name={previewing ? "stop-circle-outline" : "play-circle-outline"}
          size={scale(15)}
          color={!tone.previewAsset ? VaultColors.textMuted : VaultColors.brandGoldDark}
        />
        <Text
          style={[
            styles.toneGhostBtnText,
            !tone.previewAsset && styles.toneGhostBtnTextDisabled,
          ]}
        >
          {tone.previewAsset ? (previewing ? "Stop" : "Preview") : "No preview"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.tonePrimaryBtn, selected && styles.tonePrimaryBtnSelected]}
        onPress={() => onSelect(tone.key)}
        activeOpacity={0.85}
      >
        <Text style={styles.tonePrimaryBtnText}>
          {selected ? "Selected" : "Choose"}
        </Text>
      </TouchableOpacity>
    </View>
  </View>
);

const ItemEditorModal = ({ visible, item, type, onSave, onClose }) => {
  const [name, setName] = useState(item?.name || "");
  const [color, setColor] = useState(item?.color || (type === "category" ? CATEGORY_COLORS[0] : TAG_COLORS[0]));
  const [iconKey, setIconKey] = useState(item?.icon_key || "pricetag-outline");

  useEffect(() => {
    setName(item?.name || "");
    setColor(item?.color || (type === "category" ? CATEGORY_COLORS[0] : TAG_COLORS[0]));
    setIconKey(item?.icon_key || "pricetag-outline");
  }, [item, type, visible]);

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
                    <Ionicons
                      name={ic.key}
                      size={scale(18)}
                      color={iconKey === ic.key ? "#fff" : VaultColors.brandGoldDark}
                    />
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

const CategoryChip = ({ item, onEdit, onDelete }) => (
  <View style={[styles.chip, { borderColor: item.color + "55" }]}>
    <View style={[styles.chipIcon, { backgroundColor: item.color + "22" }]}>
      <Ionicons name={item.icon_key || "pricetag-outline"} size={scale(13)} color={item.color || VaultColors.brandGoldDark} />
    </View>
    <Text style={styles.chipLabel} numberOfLines={1}>{item.name}</Text>
    <TouchableOpacity onPress={onEdit} activeOpacity={0.8} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
      <Ionicons name="create-outline" size={scale(14)} color={VaultColors.textMuted} />
    </TouchableOpacity>
    <TouchableOpacity onPress={onDelete} activeOpacity={0.8} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
      <Ionicons name="close-circle-outline" size={scale(14)} color={VaultColors.error} />
    </TouchableOpacity>
  </View>
);

const TagChip = ({ item, onEdit, onDelete }) => (
  <View style={[styles.chip, { borderColor: (item.color || VaultColors.brandGoldDark) + "55" }]}>
    <View style={[styles.chipDot, { backgroundColor: item.color || VaultColors.brandGoldDark }]} />
    <Text style={styles.chipLabel} numberOfLines={1}>{item.name}</Text>
    <TouchableOpacity onPress={onEdit} activeOpacity={0.8} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
      <Ionicons name="create-outline" size={scale(14)} color={VaultColors.textMuted} />
    </TouchableOpacity>
    <TouchableOpacity onPress={onDelete} activeOpacity={0.8} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
      <Ionicons name="close-circle-outline" size={scale(14)} color={VaultColors.error} />
    </TouchableOpacity>
  </View>
);

export default function SettingsScreen({ navigation }) {
  const { logout } = useAuth();
  const alert = useAlert();

  const {
    settings,
    categories,
    tags,
    patchSetting,
    saveCategory,
    deleteCategory,
    saveTag,
    deleteTag,
  } = useSettings();

  const { previewingToneKey, previewTone, stopPreview } = useTonePreview();

  const [editorVisible, setEditorVisible] = useState(false);
  const [editorType, setEditorType] = useState("category");
  const [editorItem, setEditorItem] = useState(null);

  useEffect(() => {
    return () => {
      stopPreview();
    };
  }, [stopPreview]);

  const openEditor = (type, item = null) => {
    setEditorType(type);
    setEditorItem(item);
    setEditorVisible(true);
  };

  const handleSaveItem = useCallback(
    async (item) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      if (editorType === "category") await saveCategory(item);
      else await saveTag(item);
    },
    [editorType, saveCategory, saveTag]
  );

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

  const handlePatchAndHaptic = useCallback(
    async (patch) => {
      Haptics.selectionAsync().catch(() => {});
      await patchSetting(patch);
    },
    [patchSetting]
  );

  const handleSelectTone = useCallback(
    async (toneKey) => {
      Haptics.selectionAsync().catch(() => {});
      await patchSetting({ notif_sound: toneKey });
    },
    [patchSetting]
  );

  const handlePreviewTone = useCallback(
    async (tone) => {
      Haptics.selectionAsync().catch(() => {});
      await previewTone(tone.key);
    },
    [previewTone]
  );

  const handleLogout = () => {
    alert?.open?.({
      type: "warning",
      title: "Log out?",
      message: "You can sign back in any time.",
      actions: [
        { text: "Cancel" },
        {
          text: "Log out",
          style: "destructive",
          onPress: async () => {
            const res = await logout();
            if (!res?.success) alert?.error?.("Error", res?.error || "Logout failed");
          },
        },
      ],
    });
  };

  const selectedTone = String(settings?.notif_sound || "default");

  return (
    <SafeAreaView style={styles.root} edges={["bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor={VaultColors.appBackground} />

      <LinearGradient
        colors={["#5B3B1F", "#7A4F2C"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.header}
      >
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.85}>
          <Ionicons name="chevron-back" size={scale(26)} color="#FEF7E6" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Ionicons name="settings-outline" size={scale(24)} color="#FEF7E6" />
          <Text style={styles.headerTitle}>Settings</Text>
        </View>
        <View style={{ width: scale(44) }} />
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: scale(40) }]}
      >
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

        <SectionHeader
          title="Reminder tone"
          subtitle="Choose your reminder sound and preview it before saving."
        />

        <View style={styles.toneGrid}>
          {NOTIFICATION_TONES.map((tone) => (
            <ToneCard
              key={tone.key}
              tone={tone}
              selected={selectedTone === tone.key}
              previewing={previewingToneKey === tone.key}
              onSelect={handleSelectTone}
              onPreview={handlePreviewTone}
            />
          ))}
        </View>

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

        <SectionHeader title="App preferences" />
        <SectionCard>
          <SettingRow
            icon="lock-closed-outline"
            label="Biometric unlock"
            hint="Use Face ID or fingerprint to open the app"
            right={<VaultSwitch value={settings?.biometric_enabled} onValueChange={(v) => handlePatchAndHaptic({ biometric_enabled: v })} />}
          />
        </SectionCard>

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

const em = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: scale(24),
    borderTopRightRadius: scale(24),
    paddingHorizontal: scale(20),
    paddingTop: scale(12),
    paddingBottom: scale(32),
  },
  handle: {
    width: scale(36),
    height: scale(4),
    borderRadius: 2,
    backgroundColor: VaultColors.border,
    alignSelf: "center",
    marginBottom: scale(16),
  },
  title: {
    fontSize: getFontSize(18),
    fontWeight: "900",
    color: VaultColors.textPrimary,
    marginBottom: scale(16),
  },
  fieldLabel: {
    fontSize: getFontSize(11),
    fontWeight: "800",
    color: VaultColors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: scale(6),
    marginTop: scale(12),
  },
  input: {
    backgroundColor: VaultColors.appBackground,
    borderRadius: scale(12),
    borderWidth: 1,
    borderColor: VaultColors.border,
    paddingHorizontal: scale(14),
    paddingVertical: scale(12),
    fontSize: getFontSize(15),
    fontWeight: "600",
    color: VaultColors.textPrimary,
  },
  iconScroll: { marginVertical: scale(4) },
  iconBtn: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(12),
    backgroundColor: VaultColors.brandGoldSoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: scale(8),
    borderWidth: 1,
    borderColor: VaultColors.border,
  },
  iconBtnActive: {
    backgroundColor: VaultColors.brandGoldDark,
    borderColor: VaultColors.brandGoldDark,
  },
  colorRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: scale(10),
    marginTop: scale(4),
  },
  colorDot: {
    width: scale(32),
    height: scale(32),
    borderRadius: scale(16),
    alignItems: "center",
    justifyContent: "center",
  },
  colorDotActive: {
    borderWidth: 3,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  actions: {
    flexDirection: "row",
    gap: scale(10),
    marginTop: scale(20),
  },
  cancelBtn: {
    flex: 1,
    height: scale(46),
    borderRadius: scale(12),
    backgroundColor: VaultColors.appBackground,
    borderWidth: 1,
    borderColor: VaultColors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: {
    fontSize: getFontSize(14),
    fontWeight: "700",
    color: VaultColors.textPrimary,
  },
  saveBtn: {
    flex: 1,
    height: scale(46),
    borderRadius: scale(12),
    backgroundColor: VaultColors.brown,
    alignItems: "center",
    justifyContent: "center",
  },
  saveText: {
    fontSize: getFontSize(14),
    fontWeight: "800",
    color: "#FEF7E6",
  },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: VaultColors.appBackground },
  content: { paddingHorizontal: VaultSpacing.screenPadding, gap: scale(4) },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: scale(6),
    paddingTop: 0,
    paddingBottom: scale(12),
  },
  backBtn: {
    width: scale(44),
    height: scale(44),
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: scale(10),
  },
  headerTitle: {
    color: "#FEF7E6",
    fontSize: getFontSize(17),
    fontWeight: "800",
    letterSpacing: -0.25,
  },

  sectionHeader: { paddingTop: scale(18), paddingBottom: scale(8) },
  sectionTitle: {
    fontSize: getFontSize(13),
    fontWeight: "900",
    color: VaultColors.textPrimary,
    letterSpacing: -0.2,
  },
  sectionSub: {
    fontSize: getFontSize(11),
    fontWeight: "600",
    color: VaultColors.textMuted,
    marginTop: scale(2),
  },

  sectionCard: {
    backgroundColor: "#fff",
    borderRadius: scale(18),
    borderWidth: 1,
    borderColor: VaultColors.border,
    overflow: "hidden",
    ...Platform.select({ ios: VaultShadows.sm, android: { elevation: 1 } }),
  },

  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: scale(14),
    paddingVertical: scale(12),
    gap: scale(12),
  },
  settingIconWrap: {
    width: scale(34),
    height: scale(34),
    borderRadius: scale(10),
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  settingBody: { flex: 1 },
  settingLabel: {
    fontSize: getFontSize(14),
    fontWeight: "700",
    color: VaultColors.textPrimary,
  },
  settingHint: {
    marginTop: scale(1),
    fontSize: getFontSize(11),
    fontWeight: "600",
    color: VaultColors.textMuted,
  },
  settingRight: { flexShrink: 0 },
  rowDivider: {
    height: 1,
    marginLeft: scale(14) + scale(34) + scale(12),
    backgroundColor: VaultColors.divider,
  },

  toneGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: scale(10),
    marginBottom: scale(4),
  },
  toneCard: {
    width: "47%",
    backgroundColor: "#fff",
    borderRadius: scale(16),
    borderWidth: 1.5,
    borderColor: VaultColors.border,
    padding: scale(12),
    minHeight: scale(188),
    ...Platform.select({ ios: VaultShadows.sm, android: { elevation: 1 } }),
  },
  toneCardActive: {
    borderColor: VaultColors.brandGoldDark,
    backgroundColor: VaultColors.brandGoldSoft,
  },
  toneTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: scale(8),
  },
  toneIcon: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(12),
    backgroundColor: VaultColors.brandGoldSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  toneIconActive: {
    backgroundColor: VaultColors.brandGoldDark,
  },
  toneBadgesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(6),
  },
  defaultBadge: {
    paddingHorizontal: scale(8),
    paddingVertical: scale(4),
    borderRadius: scale(999),
    backgroundColor: "#F6E2B6",
  },
  defaultBadgeText: {
    fontSize: getFontSize(9),
    fontWeight: "800",
    color: VaultColors.brandGoldDark,
    textTransform: "uppercase",
  },
  toneLabel: {
    fontSize: getFontSize(13),
    fontWeight: "800",
    color: VaultColors.textPrimary,
    marginBottom: scale(4),
  },
  toneLabelActive: {
    color: VaultColors.brandGoldDark,
  },
  toneDesc: {
    fontSize: getFontSize(10),
    fontWeight: "600",
    color: VaultColors.textMuted,
    lineHeight: 15,
    minHeight: scale(44),
  },
  toneActions: {
    flexDirection: "row",
    gap: scale(8),
    marginTop: scale(12),
  },
  toneGhostBtn: {
    flex: 1,
    height: scale(38),
    borderRadius: scale(12),
    borderWidth: 1,
    borderColor: VaultColors.border,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: scale(6),
  },
  toneGhostBtnDisabled: {
    backgroundColor: "#F6F2EB",
  },
  toneGhostBtnText: {
    fontSize: getFontSize(11),
    fontWeight: "700",
    color: VaultColors.brandGoldDark,
  },
  toneGhostBtnTextDisabled: {
    color: VaultColors.textMuted,
  },
  tonePrimaryBtn: {
    flex: 1,
    height: scale(38),
    borderRadius: scale(12),
    backgroundColor: VaultColors.brown,
    alignItems: "center",
    justifyContent: "center",
  },
  tonePrimaryBtnSelected: {
    backgroundColor: VaultColors.brandGoldDark,
  },
  tonePrimaryBtnText: {
    fontSize: getFontSize(11),
    fontWeight: "800",
    color: "#FEF7E6",
  },

  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: scale(8),
    padding: scale(12),
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(6),
    paddingHorizontal: scale(10),
    paddingVertical: scale(7),
    borderRadius: scale(10),
    borderWidth: 1,
    backgroundColor: VaultColors.appBackground,
  },
  chipIcon: {
    width: scale(20),
    height: scale(20),
    borderRadius: scale(5),
    alignItems: "center",
    justifyContent: "center",
  },
  chipDot: {
    width: scale(8),
    height: scale(8),
    borderRadius: scale(4),
  },
  chipLabel: {
    fontSize: getFontSize(12),
    fontWeight: "700",
    color: VaultColors.textPrimary,
    maxWidth: scale(100),
  },
  emptyHint: {
    padding: scale(14),
    fontSize: getFontSize(12),
    fontWeight: "600",
    color: VaultColors.textMuted,
  },
  addRowBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(8),
    paddingHorizontal: scale(14),
    paddingVertical: scale(12),
    borderTopWidth: 1,
    borderTopColor: VaultColors.divider,
  },
  addRowText: {
    fontSize: getFontSize(13),
    fontWeight: "700",
    color: VaultColors.brandGoldDark,
  },
});