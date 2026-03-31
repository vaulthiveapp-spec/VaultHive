/**
 * AddReminderScreen
 *
 * Standalone reminder creation. Supports:
 *   - Custom due date
 *   - Reminder type: return deadline / warranty expiry / custom
 *   - Optional link to a receipt, warranty, or purchase hub
 *   - Lead-days picker (how far in advance to notify)
 *   - Note / label
 *   - Offline-first via createStandaloneReminderOffline
 */
import React, { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar,
  Platform, ScrollView, Switch,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useFocusEffect } from "@react-navigation/native";

import Input from "../../components/Input";
import DateInput from "../../components/DateInput";
import Button from "../../components/Button";
import { useAuth } from "../../context/AuthContext";
import { useAlert } from "../../components/AlertProvider";
import { scale, getFontSize, getSpacing, verticalScale } from "../../utils/responsive";
import { VaultColors, VaultRadius, VaultShadows, VaultSpacing } from "../../styles/DesignSystem";
import { listReceipts, listWarranties, listHubs } from "../../services/localRepo";
import { createStandaloneReminderOffline } from "../../services/offlineActions";
import { makePushId } from "../../utils/pushId";

const today = () => new Date().toISOString().slice(0, 10);
const isIsoDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));

function addDays(iso, n) {
  try {
    const d = new Date(`${iso}T00:00:00`);
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  } catch { return iso; }
}

// ── Reminder type config ───────────────────────────────────────────────────────

const REMINDER_TYPES = [
  { key: "return_deadline", label: "Return deadline",  icon: "time-outline"              },
  { key: "warranty_expiry", label: "Warranty expiry",  icon: "shield-checkmark-outline"  },
  { key: "custom",          label: "Custom reminder",  icon: "alarm-outline"             },
];

// Use "__none__" as an internal sentinel so React key props are always
// unambiguous strings. The stored targetType value is still null (not the string).
const TARGET_TYPES = [
  { key: "__none__",  label: "No link",          storedKey: null       },
  { key: "receipt",   label: "Link to receipt",  storedKey: "receipt"  },
  { key: "warranty",  label: "Link to warranty", storedKey: "warranty" },
  { key: "hub",       label: "Link to purchase", storedKey: "hub"      },
];

const LEAD_OPTIONS = [
  { days: 0,  label: "On the day"  },
  { days: 1,  label: "1 day before"},
  { days: 3,  label: "3 days"      },
  { days: 7,  label: "1 week"      },
  { days: 14, label: "2 weeks"     },
  { days: 30, label: "1 month"     },
];

// ── Shared atoms ──────────────────────────────────────────────────────────────

const SectionCard = ({ title, subtitle, children }) => (
  <View style={styles.sectionCard}>
    <View style={styles.sectionHead}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
    </View>
    {children}
  </View>
);

const OptionChip = ({ label, active, onPress, icon }) => (
  <TouchableOpacity
    style={[styles.chip, active && styles.chipActive]}
    activeOpacity={0.82}
    onPress={onPress}
  >
    {icon ? <Ionicons name={icon} size={scale(13)} color={active ? VaultColors.buttonTextOnGold : VaultColors.textSecondary} /> : null}
    <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
  </TouchableOpacity>
);

// ── Main screen ───────────────────────────────────────────────────────────────

export default function AddReminderScreen({ navigation, route }) {
  const insets   = useSafeAreaInsets();
  const { user } = useAuth();
  const alert    = useAlert();
  const uid      = user?.uid;

  // Pre-fill from navigation params (e.g. from HubDetail or AddReceiptScreen)
  const preType       = route?.params?.type       || "custom";
  const preTargetType = route?.params?.target_type|| null;
  const preTargetId   = route?.params?.target_id  || null;
  const preDueDate    = route?.params?.due_date    || "";

  const [saving,       setSaving]       = useState(false);
  const [reminderType, setReminderType] = useState(preType);
  const [dueDate,      setDueDate]      = useState(preDueDate || "");
  const [leadDays,     setLeadDays]     = useState(3);
  const [note,         setNote]         = useState("");
  const [targetType,   setTargetType]   = useState(preTargetType);
  const [targetId,     setTargetId]     = useState(preTargetId || null);

  // Entity lists for pickers
  const [receipts,  setReceipts]  = useState([]);
  const [warranties, setWarranties] = useState([]);
  const [hubs,      setHubs]      = useState([]);

  // ── Loaders ─────────────────────────────────────────────────────────────────
  const loadEntities = useCallback(async () => {
    if (!uid) return;
    try {
      const [r, w, h] = await Promise.all([
        listReceipts(uid, 40),
        listWarranties(uid, 40),
        listHubs(uid, 40),
      ]);
      setReceipts(r  || []);
      setWarranties(w || []);
      setHubs(h      || []);
    } catch {}
  }, [uid]);

  useFocusEffect(useCallback(() => { loadEntities(); }, [loadEntities]));

  // ── Derived notification date ────────────────────────────────────────────────
  const notifyDate = dueDate && isIsoDate(dueDate) && leadDays > 0
    ? addDays(dueDate, -leadDays)
    : dueDate || null;

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const entityList = targetType === "receipt"  ? receipts
                   : targetType === "warranty" ? warranties
                   : targetType === "hub"      ? hubs
                   : [];

  const entityLabel = (item) => {
    if (targetType === "receipt")  return item.vendor_name  || item.receipt_id;
    if (targetType === "warranty") return item.product_name || item.warranty_id;
    if (targetType === "hub")      return item.title        || item.hub_id;
    return "";
  };

  const entityId = (item) => {
    if (targetType === "receipt")  return item.receipt_id;
    if (targetType === "warranty") return item.warranty_id;
    if (targetType === "hub")      return item.hub_id;
    return null;
  };

  // ── Save ─────────────────────────────────────────────────────────────────────
  const save = async () => {
    if (!uid) return;
    if (!dueDate || !isIsoDate(dueDate)) return alert?.warning?.("Missing date", "Please set a valid due date (YYYY-MM-DD).");

    setSaving(true);
    try {
      await createStandaloneReminderOffline(uid, {
        type:        reminderType,
        target_type: targetType  || null,
        target_id:   targetId    || null,
        due_date:    dueDate,
        lead_days:   leadDays,
        note:        String(note || "").trim() || null,
      });

      alert?.success?.("Reminder set", `You'll be notified ${leadDays > 0 ? `${leadDays} day${leadDays !== 1 ? "s" : ""} before ` : "on "}${dueDate}.`);
      navigation.goBack();
    } catch (e) {
      alert?.error?.("Error", e?.message || "Failed to save reminder.");
    } finally {
      setSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor={VaultColors.appBackground} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + scale(10) }]}>
        <TouchableOpacity style={styles.backBtn} activeOpacity={0.85} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={scale(20)} color={VaultColors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Add Reminder</Text>
        <View style={{ width: scale(40) }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* ── Reminder type ── */}
        <SectionCard title="Reminder type" subtitle="What kind of deadline are you tracking?">
          <View style={styles.chipRow}>
            {REMINDER_TYPES.map((rt) => (
              <OptionChip
                key={rt.key}
                label={rt.label}
                icon={rt.icon}
                active={reminderType === rt.key}
                onPress={() => setReminderType(rt.key)}
              />
            ))}
          </View>
        </SectionCard>

        {/* ── Date ── */}
        <SectionCard title="Due date" subtitle="The date this reminder is for (return window, warranty end, etc.).">
          <DateInput label="Due date" value={dueDate} onChangeText={setDueDate} />

          {notifyDate && notifyDate !== dueDate ? (
            <View style={styles.notifyBanner}>
              <Ionicons name="notifications-outline" size={scale(14)} color={VaultColors.brandGoldDark} />
              <Text style={styles.notifyText}>Notification will fire on <Text style={styles.notifyDate}>{notifyDate}</Text></Text>
            </View>
          ) : null}
        </SectionCard>

        {/* ── Lead time ── */}
        <SectionCard title="Notify me" subtitle="How far in advance should we remind you?">
          <View style={styles.chipRow}>
            {LEAD_OPTIONS.map((opt) => (
              <OptionChip
                key={opt.days}
                label={opt.label}
                active={leadDays === opt.days}
                onPress={() => setLeadDays(opt.days)}
              />
            ))}
          </View>
        </SectionCard>

        {/* ── Note ── */}
        <SectionCard title="Note (optional)" subtitle="Add context — what needs to happen by this date?">
          <Input
            label="Note"
            placeholder="e.g. Return the damaged charger to the Apple Store…"
            value={note}
            onChangeText={setNote}
            multiline
            numberOfLines={3}
          />
        </SectionCard>

        {/* ── Link to entity ── */}
        <SectionCard title="Link to (optional)" subtitle="Attach this reminder to an existing receipt, warranty, or purchase.">
          <View style={styles.chipRow}>
            {TARGET_TYPES.map((tt) => (
              <OptionChip
                key={tt.key}
                label={tt.label}
                active={targetType === tt.storedKey}
                onPress={() => { setTargetType(tt.storedKey); setTargetId(null); }}
              />
            ))}
          </View>

          {targetType && entityList.length > 0 ? (
            <View style={styles.entityPicker}>
              <Text style={styles.entityPickerLabel}>Choose {targetType}</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.entityPickerRow}
              >
                {entityList.slice(0, 25).map((item) => {
                  const id     = entityId(item);
                  const active = targetId === id;
                  return (
                    <TouchableOpacity
                      key={String(id)}
                      style={[styles.entityChip, active && styles.entityChipActive]}
                      activeOpacity={0.85}
                      onPress={() => setTargetId(active ? null : id)}
                    >
                      <Text style={[styles.entityChipText, active && styles.entityChipTextActive]} numberOfLines={1}>
                        {entityLabel(item)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          ) : targetType && entityList.length === 0 ? (
            <Text style={styles.emptySmall}>No {targetType}s found yet.</Text>
          ) : null}
        </SectionCard>

        {/* ── Summary card ── */}
        {dueDate && isIsoDate(dueDate) ? (
          <View style={styles.summaryCard}>
            <View style={styles.summaryIconWrap}>
              <Ionicons name="alarm-outline" size={scale(22)} color={VaultColors.buttonTextOnGold} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.summaryTitle}>{REMINDER_TYPES.find((r) => r.key === reminderType)?.label || "Reminder"}</Text>
              <Text style={styles.summaryMeta}>
                Due <Text style={styles.summaryDate}>{dueDate}</Text>
                {leadDays > 0 ? `  ·  Notify ${leadDays}d before` : "  ·  Notify on the day"}
              </Text>
              {targetId ? <Text style={styles.summaryLink}>Linked to {targetType}</Text> : null}
            </View>
          </View>
        ) : null}

        <Button
          title={saving ? "Saving…" : "Set reminder"}
          onPress={save}
          loading={saving}
          disabled={saving}
          size="md"
          style={{ width: "100%", marginTop: scale(14) }}
        />

        <View style={{ height: verticalScale(40) }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: VaultColors.appBackground },

  header: {
    paddingHorizontal: VaultSpacing.screenPadding,
    paddingBottom: scale(10),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: {
    width: scale(40), height: scale(40),
    borderRadius: VaultRadius.lg,
    backgroundColor: VaultColors.surfaceAlt,
    borderWidth: 1, borderColor: VaultColors.border,
    alignItems: "center", justifyContent: "center",
    ...Platform.select({ android: { elevation: 1 }, ios: VaultShadows.sm }),
  },
  title: {
    color: VaultColors.textPrimary,
    fontSize: getFontSize(18),
    fontWeight: "900",
    fontFamily: "Poppins",
  },

  content: {
    paddingHorizontal: VaultSpacing.screenPadding,
    paddingBottom: verticalScale(20),
    maxWidth: scale(560),
    width: "100%",
    alignSelf: "center",
  },

  sectionCard: {
    marginTop: scale(14),
    backgroundColor: VaultColors.surfaceAlt,
    borderRadius: VaultRadius.xl,
    borderWidth: 1.5,
    borderColor: VaultColors.border,
    padding: scale(16),
    ...Platform.select({ android: { elevation: 2 }, ios: VaultShadows.sm }),
  },
  sectionHead: { marginBottom: scale(12) },
  sectionTitle: {
    color: VaultColors.textPrimary,
    fontSize: getFontSize(14),
    fontWeight: "900",
    fontFamily: "Poppins",
  },
  sectionSubtitle: {
    marginTop: scale(3),
    color: VaultColors.textMuted,
    fontSize: getFontSize(11),
    lineHeight: getFontSize(16),
    fontWeight: "600",
    fontFamily: "Poppins",
  },

  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: scale(8),
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(5),
    paddingHorizontal: scale(14),
    paddingVertical: scale(9),
    borderRadius: VaultRadius.full,
    borderWidth: 1.5,
    borderColor: VaultColors.border,
    backgroundColor: VaultColors.appBackground,
  },
  chipActive: {
    backgroundColor: VaultColors.brandGoldDark,
    borderColor: VaultColors.brandGoldDark,
  },
  chipText: {
    fontSize: getFontSize(12),
    color: VaultColors.textPrimary,
    fontWeight: "800",
    fontFamily: "Poppins",
  },
  chipTextActive: { color: VaultColors.buttonTextOnGold },

  notifyBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(7),
    marginTop: scale(10),
    paddingVertical: scale(8),
    paddingHorizontal: scale(12),
    backgroundColor: VaultColors.brandGoldSoft,
    borderRadius: scale(12),
    borderWidth: 1,
    borderColor: VaultColors.brandGoldDark,
  },
  notifyText: {
    flex: 1,
    fontSize: getFontSize(12),
    color: VaultColors.textSecondary,
    fontWeight: "700",
    fontFamily: "Poppins",
  },
  notifyDate: {
    fontWeight: "900",
    color: VaultColors.brandGoldDark,
  },

  entityPicker: { marginTop: scale(12) },
  entityPickerLabel: {
    fontSize: getFontSize(11),
    color: VaultColors.textMuted,
    fontWeight: "700",
    fontFamily: "Poppins",
    textTransform: "capitalize",
    marginBottom: scale(8),
  },
  entityPickerRow: { gap: scale(8), paddingVertical: scale(2) },
  entityChip: {
    paddingHorizontal: scale(14),
    paddingVertical: scale(10),
    borderRadius: VaultRadius.full,
    borderWidth: 1.5,
    borderColor: VaultColors.border,
    backgroundColor: VaultColors.appBackground,
    maxWidth: scale(200),
  },
  entityChipActive: {
    backgroundColor: VaultColors.brandGoldDark,
    borderColor: VaultColors.brandGoldDark,
  },
  entityChipText: {
    fontSize: getFontSize(12),
    color: VaultColors.textPrimary,
    fontWeight: "800",
    fontFamily: "Poppins",
  },
  entityChipTextActive: { color: VaultColors.buttonTextOnGold },

  emptySmall: {
    marginTop: scale(8),
    color: VaultColors.textMuted,
    fontSize: getFontSize(12),
    fontWeight: "700",
    fontFamily: "Poppins",
  },

  summaryCard: {
    marginTop: scale(16),
    flexDirection: "row",
    alignItems: "center",
    gap: scale(14),
    backgroundColor: VaultColors.brandGoldDark,
    borderRadius: scale(20),
    padding: scale(16),
    ...Platform.select({ android: { elevation: 3 }, ios: VaultShadows.md }),
  },
  summaryIconWrap: {
    width: scale(44),
    height: scale(44),
    borderRadius: scale(15),
    backgroundColor: "rgba(254,247,230,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  summaryTitle: {
    fontSize: getFontSize(14),
    color: VaultColors.buttonTextOnGold,
    fontWeight: "900",
    fontFamily: "Poppins",
  },
  summaryMeta: {
    marginTop: scale(3),
    fontSize: getFontSize(11),
    color: "rgba(254,247,230,0.78)",
    fontWeight: "700",
    fontFamily: "Poppins",
  },
  summaryDate: {
    fontWeight: "900",
    color: VaultColors.buttonTextOnGold,
  },
  summaryLink: {
    marginTop: scale(3),
    fontSize: getFontSize(10),
    color: "rgba(254,247,230,0.65)",
    fontWeight: "700",
    fontFamily: "Poppins",
    textTransform: "capitalize",
  },
});
