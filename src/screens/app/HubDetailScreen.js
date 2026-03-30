/**
 * HubDetailScreen — Phase 6
 *
 * The canonical detail view for a purchase_hub.
 * Loads via getHubDetail() which returns the hub plus:
 *   receipt · warranty · attachments · service_history · claims
 *   reminders · exports · ai_conversations
 */
import React, { useCallback, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  StatusBar, Platform, Linking, Alert,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import Ionicons from "react-native-vector-icons/Ionicons";

import { useAuth } from "../../context/AuthContext";
import { useAlert } from "../../components/AlertProvider";
import { scale, getFontSize, getSpacing, verticalScale } from "../../utils/responsive";
import { VaultColors, VaultRadius, VaultShadows, VaultSpacing } from "../../styles/DesignSystem";
import { getHubDetail } from "../../services/repo/repoHubs";
import { useCurrency } from "../../hooks/useCurrency";
import { deletePurchaseHubOffline } from "../../services/offlineActions";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function humanDate(value) {
  if (!value) return "—";
  try {
    const raw = String(value);
    const d = raw.includes("T") ? new Date(raw) : new Date(`${raw}T00:00:00`);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-SA", { month: "long", day: "numeric", year: "numeric" });
  } catch { return "—"; }
}

function daysUntil(value) {
  if (!value) return null;
  try {
    const d = new Date(String(value).includes("T") ? value : `${value}T00:00:00`);
    return Math.ceil((d.getTime() - Date.now()) / 86400000);
  } catch { return null; }
}

const STATUS_CONFIG = {
  active:          { label: "Active",          bg: "#E8F8EE", border: "#A8DFC0", text: "#18A957", icon: "checkmark-circle-outline" },
  under_warranty:  { label: "Under Warranty",  bg: "#EEF4FF", border: "#B0C8F0", text: "#2E6BD8", icon: "shield-checkmark-outline" },
  returnable:      { label: "Returnable",      bg: "#FFF6E3", border: "#F5D89A", text: "#E0A100", icon: "time-outline"             },
  return_risk:     { label: "Return Risk",     bg: "#FDECEC", border: "#F5BABA", text: "#D64545", icon: "alert-circle-outline"     },
  out_of_warranty: { label: "Out of Warranty", bg: "#F5F5F5", border: "#DCDCDC", text: "#888888", icon: "shield-outline"           },
  expired:         { label: "Expired",         bg: "#FDECEC", border: "#F5BABA", text: "#D64545", icon: "close-circle-outline"     },
};
function statusCfg(s) {
  return STATUS_CONFIG[s] || { label: s || "Unknown", bg: VaultColors.brandGoldSoft, border: VaultColors.border, text: VaultColors.textPrimary, icon: "cube-outline" };
}

// ─── Shared UI atoms ──────────────────────────────────────────────────────────

const SectionCard = ({ children, style }) => (
  <View style={[styles.sectionCard, style]}>{children}</View>
);

const SectionHeader = ({ icon, title, action, onAction }) => (
  <View style={styles.sectionHeaderRow}>
    <View style={styles.sectionHeaderLeft}>
      <View style={styles.sectionIconWrap}>
        <Ionicons name={icon} size={scale(15)} color={VaultColors.textPrimary} />
      </View>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
    {action ? (
      <TouchableOpacity activeOpacity={0.82} onPress={onAction}>
        <Text style={styles.sectionAction}>{action}</Text>
      </TouchableOpacity>
    ) : null}
  </View>
);

const InfoRow = ({ label, value, icon }) => (
  <View style={styles.infoRow}>
    {icon ? <Ionicons name={icon} size={scale(14)} color={VaultColors.textMuted} style={styles.infoIcon} /> : null}
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue} numberOfLines={2}>{value || "—"}</Text>
  </View>
);

const Chip = ({ label, icon, tone = "default" }) => {
  const chipStyle = tone === "warn"
    ? [styles.chip, styles.chipWarn]
    : tone === "danger"
      ? [styles.chip, styles.chipDanger]
      : tone === "info"
        ? [styles.chip, styles.chipInfo]
        : styles.chip;
  const textStyle = tone === "warn"
    ? [styles.chipText, styles.chipTextWarn]
    : tone === "danger"
      ? [styles.chipText, styles.chipTextDanger]
      : tone === "info"
        ? [styles.chipText, styles.chipTextInfo]
        : styles.chipText;
  return (
    <View style={chipStyle}>
      {icon ? <Ionicons name={icon} size={scale(11)} color={tone === "default" ? VaultColors.textMuted : undefined} /> : null}
      <Text style={textStyle}>{label}</Text>
    </View>
  );
};

const EmptyNote = ({ text }) => (
  <Text style={styles.emptyNote}>{text}</Text>
);

// ─── Section: Receipt ─────────────────────────────────────────────────────────

function ReceiptSection({ receipt, navigation, uid, fmt }) {
  if (!receipt) {
    return (
      <SectionCard>
        <SectionHeader icon="receipt-outline" title="Receipt" action="Add" onAction={() => navigation.navigate("AddReceipt")} />
        <EmptyNote text="No receipt linked to this purchase." />
      </SectionCard>
    );
  }
  const r = receipt;
  return (
    <SectionCard>
      <SectionHeader icon="receipt-outline" title="Receipt" action="View" onAction={() => navigation.navigate("ReceiptDetails", { receiptId: r.receipt_id })} />
      <InfoRow label="Store" value={r.vendor_name || "—"} icon="storefront-outline" />
      <InfoRow label="Date" value={humanDate(r.purchase_date)} icon="calendar-outline" />
      <InfoRow label="Amount" value={fmt(r.total_amount, r.currency_code || "SAR")} icon="wallet-outline" />
      {r.return_deadline ? <InfoRow label="Return by" value={humanDate(r.return_deadline)} icon="time-outline" /> : null}
      {r.note ? <InfoRow label="Note" value={r.note} icon="document-text-outline" /> : null}
      {r.items && r.items.length > 0 ? (
        <View style={styles.itemList}>
          <Text style={styles.itemListLabel}>Line items ({r.items.length})</Text>
          {r.items.slice(0, 4).map((it, idx) => (
            <View key={String(it.item_id || idx)} style={styles.lineItem}>
              <Text style={styles.lineItemName} numberOfLines={1}>{it.name || "Item"}</Text>
              <Text style={styles.lineItemAmt}>{fmt(it.total, r.currency_code || "SAR")}</Text>
            </View>
          ))}
          {r.items.length > 4 ? <Text style={styles.itemsMore}>+{r.items.length - 4} more items</Text> : null}
        </View>
      ) : null}
    </SectionCard>
  );
}

// ─── Section: Warranty ────────────────────────────────────────────────────────

function WarrantySection({ warranty, navigation }) {
  if (!warranty) {
    return (
      <SectionCard>
        <SectionHeader icon="shield-checkmark-outline" title="Warranty" action="Add" onAction={() => navigation.navigate("AddWarranty")} />
        <EmptyNote text="No warranty linked to this purchase." />
      </SectionCard>
    );
  }
  const w = warranty;
  const days = daysUntil(w.warranty_end);
  const tone = days === null ? "default" : days < 0 ? "danger" : days <= 30 ? "warn" : "default";
  return (
    <SectionCard>
      <SectionHeader icon="shield-checkmark-outline" title="Warranty" action="View" onAction={() => navigation.navigate("WarrantyDetails", { warrantyId: w.warranty_id })} />
      <InfoRow label="Product" value={w.product_name || w.item_name} icon="cube-outline" />
      {w.serial_number ? <InfoRow label="Serial No." value={w.serial_number} icon="barcode-outline" /> : null}
      <InfoRow label="Start" value={humanDate(w.warranty_start)} icon="calendar-outline" />
      <InfoRow label="Expires" value={humanDate(w.warranty_end)} icon="time-outline" />
      {days !== null ? (
        <Chip
          label={days < 0 ? "Expired" : days === 0 ? "Expires today" : `${days} days remaining`}
          icon={days < 0 ? "close-circle-outline" : "shield-outline"}
          tone={tone}
        />
      ) : null}
      {w.terms_note ? <InfoRow label="Terms" value={w.terms_note} icon="document-text-outline" /> : null}
    </SectionCard>
  );
}

// ─── Section: Attachments ─────────────────────────────────────────────────────

function AttachmentsSection({ attachments = [] }) {
  const all = attachments || [];
  return (
    <SectionCard>
      <SectionHeader icon="attach-outline" title={`Attachments (${all.length})`} />
      {all.length === 0 ? (
        <EmptyNote text="No files attached to this purchase." />
      ) : (
        all.map((att) => (
          <TouchableOpacity
            key={String(att.attachment_id)}
            style={styles.attachRow}
            activeOpacity={0.82}
            onPress={() => att.public_url && Linking.openURL(att.public_url)}
          >
            <View style={styles.attachIcon}>
              <Ionicons
                name={String(att.content_type || "").startsWith("image/") ? "image-outline" : "document-outline"}
                size={scale(18)}
                color={VaultColors.textPrimary}
              />
            </View>
            <View style={styles.attachInfo}>
              <Text style={styles.attachName} numberOfLines={1}>{att.filename || "Attachment"}</Text>
              <Text style={styles.attachMeta}>
                {att.content_type || "file"}{att.size_bytes ? ` · ${Math.round(att.size_bytes / 1024)}kb` : ""}
                {att.upload_status === "pending" ? " · uploading…" : ""}
              </Text>
            </View>
            {att.public_url ? (
              <Ionicons name="open-outline" size={scale(16)} color={VaultColors.textMuted} />
            ) : (
              <Ionicons name="cloud-upload-outline" size={scale(16)} color={VaultColors.warning} />
            )}
          </TouchableOpacity>
        ))
      )}
    </SectionCard>
  );
}

// ─── Section: Reminders ───────────────────────────────────────────────────────

function RemindersSection({ reminders = [], navigation }) {
  const active = (reminders || []).filter((r) => r.status === "active" || !r.status);
  return (
    <SectionCard>
      <SectionHeader icon="notifications-outline" title={`Reminders (${active.length})`} action="Manage" onAction={() => navigation.navigate("Reminders")} />
      {active.length === 0 ? (
        <EmptyNote text="No active reminders for this purchase." />
      ) : (
        active.map((r) => {
          const days = daysUntil(r.due_date);
          const tone = days === null ? "default" : days < 0 ? "danger" : days <= 3 ? "warn" : "default";
          return (
            <View key={String(r.reminder_id)} style={styles.reminderRow}>
              <View style={styles.reminderLeft}>
                <Ionicons name="alarm-outline" size={scale(15)} color={VaultColors.textSecondary} />
                <View>
                  <Text style={styles.reminderType}>{String(r.type || "reminder").replace(/_/g, " ")}</Text>
                  <Text style={styles.reminderDate}>{humanDate(r.due_date)}</Text>
                </View>
              </View>
              {days !== null ? (
                <Chip
                  label={days < 0 ? "Overdue" : days === 0 ? "Today" : `in ${days}d`}
                  tone={tone}
                />
              ) : null}
            </View>
          );
        })
      )}
    </SectionCard>
  );
}

// ─── Section: Service History ─────────────────────────────────────────────────

function ServiceHistorySection({ serviceHistory = [], hubId, navigation }) {
  const records = serviceHistory || [];
  return (
    <SectionCard>
      <SectionHeader
        icon="construct-outline"
        title={`Service History (${records.length})`}
      />
      {records.length === 0 ? (
        <EmptyNote text="No service records yet." />
      ) : (
        records.map((s) => (
          <View key={String(s.service_id)} style={styles.serviceRow}>
            <View style={styles.serviceLeft}>
              <View style={styles.serviceDot} />
              <View>
                <Text style={styles.serviceTitle}>{s.title || String(s.type || "Service").replace(/_/g, " ")}</Text>
                <Text style={styles.serviceMeta}>{humanDate(s.service_date)}{s.note ? ` · ${s.note}` : ""}</Text>
              </View>
            </View>
          </View>
        ))
      )}
    </SectionCard>
  );
}

// ─── Section: Claims ─────────────────────────────────────────────────────────

function ClaimsSection({ claims = [] }) {
  const records = claims || [];
  const CLAIM_STATUS_TONE = { approved: "info", pending: "warn", rejected: "danger", draft: "default" };
  return (
    <SectionCard>
      <SectionHeader icon="document-text-outline" title={`Claims (${records.length})`} />
      {records.length === 0 ? (
        <EmptyNote text="No warranty or return claims on record." />
      ) : (
        records.map((c) => (
          <View key={String(c.claim_id)} style={styles.claimRow}>
            <View>
              <Text style={styles.claimKind}>{String(c.kind || "claim").replace(/_/g, " ")}</Text>
              <Text style={styles.claimDate}>{humanDate(c.created_date)}</Text>
            </View>
            <Chip label={c.status || "draft"} tone={CLAIM_STATUS_TONE[c.status] || "default"} />
          </View>
        ))
      )}
    </SectionCard>
  );
}

// ─── Section: Exports ─────────────────────────────────────────────────────────

function ExportsSection({ exports: exps = [] }) {
  const records = exps || [];
  return (
    <SectionCard>
      <SectionHeader icon="share-outline" title={`Exports (${records.length})`} />
      {records.length === 0 ? (
        <EmptyNote text="No proof packs or exports generated yet." />
      ) : (
        records.map((e) => (
          <TouchableOpacity
            key={String(e.export_id)}
            style={styles.exportRow}
            activeOpacity={0.82}
            onPress={() => e.public_url && Linking.openURL(e.public_url)}
          >
            <Ionicons name="document-attach-outline" size={scale(18)} color={VaultColors.textPrimary} />
            <View style={styles.exportInfo}>
              <Text style={styles.exportName} numberOfLines={1}>{e.filename || String(e.kind || "export")}</Text>
              <Text style={styles.exportMeta}>{e.status} · {humanDate(e.generated_at || e.created_at_ms)}</Text>
            </View>
            {e.public_url ? <Ionicons name="open-outline" size={scale(15)} color={VaultColors.textMuted} /> : null}
          </TouchableOpacity>
        ))
      )}
    </SectionCard>
  );
}

// ─── Section: AI Actions ──────────────────────────────────────────────────────

function AISection({ hubId, aiConversations = [], navigation }) {
  const convs = aiConversations || [];
  return (
    <SectionCard>
      <SectionHeader icon="sparkles-outline" title="AI Assistant" action="Open AI" onAction={() => navigation.navigate("AIAssistant")} />
      <Text style={styles.aiSubtitle}>Ask VaultHive AI about this purchase, warranty, or return.</Text>
      {convs.length > 0 ? (
        <View style={styles.aiConvList}>
          {convs.slice(0, 2).map((c) => (
            <View key={String(c.conversation_id)} style={styles.aiConvRow}>
              <Ionicons name="chatbubble-ellipses-outline" size={scale(14)} color={VaultColors.textSecondary} />
              <Text style={styles.aiConvPreview} numberOfLines={2}>
                {c.last_message_preview || c.title || "Conversation"}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </SectionCard>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function HubDetailScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const alert    = useAlert();
  const uid      = user?.uid;
  const { fmt, fmtOriginal } = useCurrency();
  const hubId = route?.params?.hubId;

  const [detail,  setDetail]  = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!uid || !hubId) return;
    setLoading(true);
    try {
      const d = await getHubDetail(uid, hubId);
      setDetail(d);
    } catch {
      alert?.error?.("Error", "Failed to load purchase details.");
    } finally {
      setLoading(false);
    }
  }, [uid, hubId, alert]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleDelete = useCallback(() => {
    alert?.confirm?.(
      "Delete purchase",
      "This will remove the purchase hub. Receipts and warranties will remain. Continue?",
      async () => {
        try {
          await deletePurchaseHubOffline(uid, hubId);
          navigation.goBack();
        } catch {
          alert?.error?.("Error", "Could not delete purchase.");
        }
      }
    );
  }, [uid, hubId, alert, navigation]);

  if (loading || !detail) {
    return (
      <SafeAreaView style={styles.container} edges={["bottom"]}>
        <StatusBar barStyle="dark-content" backgroundColor={VaultColors.appBackground} />
        <View style={[styles.loadingHeader, { paddingTop: insets.top + getSpacing(10) }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.82}>
            <Ionicons name="chevron-back" size={scale(20)} color={VaultColors.textPrimary} />
          </TouchableOpacity>
        </View>
        <View style={styles.loadingBody}>
          <Ionicons name="cube-outline" size={scale(36)} color={VaultColors.textMuted} />
          <Text style={styles.loadingText}>{loading ? "Loading…" : "Purchase not found."}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const { hub, receipt, warranty, attachments, serviceHistory, claims, reminders, exports: exps, aiConversations } = detail;
  const st = statusCfg(hub.status);
  const returnDays = daysUntil(hub.return_deadline);
  const allAttachments = [
    ...(attachments || []),
    ...(receipt?.attachments || []),
    ...(warranty?.attachments || []),
  ].filter((a, i, arr) => arr.findIndex((b) => b.attachment_id === a.attachment_id) === i);

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <StatusBar barStyle="dark-content" backgroundColor={VaultColors.appBackground} />

      {/* Header */}
      <View style={[styles.topBar, { paddingTop: insets.top + getSpacing(8) }]}>
        <TouchableOpacity style={styles.backBtn} activeOpacity={0.82} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={scale(20)} color={VaultColors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle} numberOfLines={1}>{hub.title || "Purchase"}</Text>
        <TouchableOpacity style={styles.deleteBtn} activeOpacity={0.82} onPress={handleDelete}>
          <Ionicons name="trash-outline" size={scale(18)} color={VaultColors.error} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: verticalScale(40) }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero card */}
        <View style={styles.heroCard}>
          {/* Status badge */}
          <View style={[styles.statusBadge, { backgroundColor: st.bg, borderColor: st.border }]}>
            <Ionicons name={st.icon} size={scale(13)} color={st.text} />
            <Text style={[styles.statusText, { color: st.text }]}>{st.label}</Text>
          </View>

          <Text style={styles.heroTitle}>{hub.title || "Purchase"}</Text>
          {hub.merchant_name ? <Text style={styles.heroMerchant}>{hub.merchant_name}</Text> : null}

          <View style={styles.heroAmountRow}>
            <Text style={styles.heroAmount}>{fmt(hub.total_amount, hub.currency_code || "SAR")}</Text>
            {hub.currency_code && hub.currency_code !== user?.base_currency ? (
              <Text style={styles.heroAmountOrig}>{fmtOriginal(hub.total_amount, hub.currency_code)}</Text>
            ) : null}
          </View>

          {hub.sync_status === "pending" ? (
            <View style={styles.pendingBanner}>
              <Ionicons name="cloud-upload-outline" size={scale(13)} color={VaultColors.warning} />
              <Text style={styles.pendingText}>Syncing — saved locally</Text>
            </View>
          ) : null}

          <View style={styles.heroMetaGrid}>
            <InfoRow label="Purchase date" value={humanDate(hub.purchase_date)} icon="calendar-outline" />
            {hub.return_deadline ? (
              <InfoRow
                label="Return by"
                value={`${humanDate(hub.return_deadline)}${returnDays !== null ? ` (${returnDays < 0 ? "closed" : `${returnDays}d left`})` : ""}`}
                icon="time-outline"
              />
            ) : null}
            {hub.category_name_snapshot ? <InfoRow label="Category" value={hub.category_name_snapshot} icon="pricetag-outline" /> : null}
            {hub.serial_number ? <InfoRow label="Serial No." value={hub.serial_number} icon="barcode-outline" /> : null}
            {hub.note ? <InfoRow label="Notes" value={hub.note} icon="document-text-outline" /> : null}
          </View>
        </View>

        {/* All child sections */}
        <ReceiptSection receipt={receipt} navigation={navigation} uid={uid} fmt={fmt} />
        <WarrantySection warranty={warranty} navigation={navigation} />
        <AttachmentsSection attachments={allAttachments} />
        <RemindersSection reminders={reminders} navigation={navigation} />
        <ServiceHistorySection serviceHistory={serviceHistory} hubId={hubId} navigation={navigation} />
        <ClaimsSection claims={claims} />
        <ExportsSection exports={exps} />
        <AISection hubId={hubId} aiConversations={aiConversations} navigation={navigation} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: VaultColors.appBackground },
  content: { paddingHorizontal: VaultSpacing.screenPadding, paddingTop: getSpacing(8) },

  topBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: VaultSpacing.screenPadding, paddingBottom: getSpacing(10), gap: getSpacing(10) },
  backBtn: { width: scale(40), height: scale(40), borderRadius: scale(14), backgroundColor: VaultColors.surfaceAlt, borderWidth: 1.5, borderColor: VaultColors.border, alignItems: "center", justifyContent: "center", ...Platform.select({ android: { elevation: 1 }, ios: VaultShadows.sm }) },
  topBarTitle: { flex: 1, fontSize: getFontSize(17), color: VaultColors.textPrimary, fontFamily: "Poppins", fontWeight: "900" },
  deleteBtn: { width: scale(40), height: scale(40), borderRadius: scale(14), backgroundColor: VaultColors.errorSoft, borderWidth: 1.5, borderColor: "#F5BABA", alignItems: "center", justifyContent: "center" },

  loadingHeader: { paddingHorizontal: VaultSpacing.screenPadding, paddingBottom: getSpacing(10) },
  loadingBody: { flex: 1, alignItems: "center", justifyContent: "center", gap: getSpacing(12) },
  loadingText: { fontSize: getFontSize(14), color: VaultColors.textMuted, fontFamily: "Poppins", fontWeight: "600" },

  // Hero
  heroCard: { backgroundColor: VaultColors.surfaceAlt, borderRadius: scale(24), borderWidth: 1.5, borderColor: VaultColors.border, padding: getSpacing(16), marginBottom: getSpacing(12), ...Platform.select({ android: { elevation: 2 }, ios: VaultShadows.sm }) },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: scale(5), alignSelf: "flex-start", paddingVertical: getSpacing(5), paddingHorizontal: getSpacing(10), borderRadius: VaultRadius.full, borderWidth: 1, marginBottom: getSpacing(10) },
  statusText: { fontSize: getFontSize(11), fontFamily: "Poppins", fontWeight: "900" },
  heroTitle: { fontSize: getFontSize(20), color: VaultColors.textPrimary, fontFamily: "Poppins", fontWeight: "900" },
  heroMerchant: { marginTop: getSpacing(3), fontSize: getFontSize(13), color: VaultColors.textMuted, fontFamily: "Poppins", fontWeight: "600" },
  heroAmountRow: { flexDirection: "row", alignItems: "baseline", gap: getSpacing(8), marginTop: getSpacing(10) },
  heroAmount: { fontSize: getFontSize(28), color: VaultColors.textPrimary, fontFamily: "Poppins", fontWeight: "900" },
  heroAmountOrig: { fontSize: getFontSize(13), color: VaultColors.textMuted, fontFamily: "Poppins", fontWeight: "600" },
  pendingBanner: { flexDirection: "row", alignItems: "center", gap: getSpacing(6), marginTop: getSpacing(10), paddingVertical: getSpacing(6), paddingHorizontal: getSpacing(10), borderRadius: scale(12), backgroundColor: VaultColors.warningSoft, borderWidth: 1, borderColor: VaultColors.warning },
  pendingText: { fontSize: getFontSize(11), color: VaultColors.warning, fontFamily: "Poppins", fontWeight: "800" },
  heroMetaGrid: { marginTop: getSpacing(14), paddingTop: getSpacing(12), borderTopWidth: 1, borderTopColor: VaultColors.border, gap: getSpacing(8) },

  // Section card
  sectionCard: { backgroundColor: VaultColors.surfaceAlt, borderRadius: scale(22), borderWidth: 1.5, borderColor: VaultColors.border, padding: getSpacing(14), marginBottom: getSpacing(12), ...Platform.select({ android: { elevation: 1 }, ios: VaultShadows.sm }) },
  sectionHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: getSpacing(12) },
  sectionHeaderLeft: { flexDirection: "row", alignItems: "center", gap: getSpacing(8) },
  sectionIconWrap: { width: scale(30), height: scale(30), borderRadius: scale(10), backgroundColor: VaultColors.brandGoldSoft, alignItems: "center", justifyContent: "center" },
  sectionTitle: { fontSize: getFontSize(14), color: VaultColors.textPrimary, fontFamily: "Poppins", fontWeight: "900" },
  sectionAction: { fontSize: getFontSize(12), color: VaultColors.brandGoldDark, fontFamily: "Poppins", fontWeight: "800" },

  // InfoRow
  infoRow: { flexDirection: "row", alignItems: "flex-start", gap: getSpacing(8), marginBottom: getSpacing(7) },
  infoIcon: { marginTop: 2 },
  infoLabel: { fontSize: getFontSize(12), color: VaultColors.textMuted, fontFamily: "Poppins", fontWeight: "700", width: scale(90) },
  infoValue: { flex: 1, fontSize: getFontSize(12), color: VaultColors.textPrimary, fontFamily: "Poppins", fontWeight: "800" },

  // Chip
  chip: { flexDirection: "row", alignItems: "center", gap: scale(4), alignSelf: "flex-start", paddingVertical: getSpacing(4), paddingHorizontal: getSpacing(9), borderRadius: VaultRadius.full, backgroundColor: VaultColors.appBackground, borderWidth: 1, borderColor: VaultColors.border, marginTop: getSpacing(4) },
  chipText: { fontSize: getFontSize(10), color: VaultColors.textMuted, fontFamily: "Poppins", fontWeight: "800" },
  chipWarn: { backgroundColor: VaultColors.warningSoft, borderColor: VaultColors.warning },
  chipTextWarn: { fontSize: getFontSize(10), color: VaultColors.warning, fontFamily: "Poppins", fontWeight: "800" },
  chipDanger: { backgroundColor: VaultColors.errorSoft, borderColor: VaultColors.error },
  chipTextDanger: { fontSize: getFontSize(10), color: VaultColors.error, fontFamily: "Poppins", fontWeight: "800" },
  chipInfo: { backgroundColor: VaultColors.infoSoft, borderColor: VaultColors.info },
  chipTextInfo: { fontSize: getFontSize(10), color: VaultColors.info, fontFamily: "Poppins", fontWeight: "800" },

  emptyNote: { fontSize: getFontSize(12), color: VaultColors.textMuted, fontFamily: "Poppins", fontWeight: "600", fontStyle: "italic" },

  // Receipt line items
  itemList: { marginTop: getSpacing(10), paddingTop: getSpacing(10), borderTopWidth: 1, borderTopColor: VaultColors.border },
  itemListLabel: { fontSize: getFontSize(11), color: VaultColors.textMuted, fontFamily: "Poppins", fontWeight: "700", marginBottom: getSpacing(6) },
  lineItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: getSpacing(5) },
  lineItemName: { flex: 1, fontSize: getFontSize(12), color: VaultColors.textPrimary, fontFamily: "Poppins", fontWeight: "700" },
  lineItemAmt: { fontSize: getFontSize(12), color: VaultColors.textSecondary, fontFamily: "Poppins", fontWeight: "900" },
  itemsMore: { fontSize: getFontSize(11), color: VaultColors.textMuted, fontFamily: "Poppins", fontWeight: "600", marginTop: getSpacing(4) },

  // Attachments
  attachRow: { flexDirection: "row", alignItems: "center", gap: getSpacing(10), paddingVertical: getSpacing(8), borderBottomWidth: 1, borderBottomColor: VaultColors.border },
  attachIcon: { width: scale(36), height: scale(36), borderRadius: scale(12), backgroundColor: VaultColors.brandGoldSoft, alignItems: "center", justifyContent: "center" },
  attachInfo: { flex: 1 },
  attachName: { fontSize: getFontSize(12), color: VaultColors.textPrimary, fontFamily: "Poppins", fontWeight: "800" },
  attachMeta: { fontSize: getFontSize(10), color: VaultColors.textMuted, fontFamily: "Poppins", fontWeight: "600", marginTop: 2 },

  // Reminders
  reminderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: getSpacing(8), borderBottomWidth: 1, borderBottomColor: VaultColors.border },
  reminderLeft: { flexDirection: "row", alignItems: "flex-start", gap: getSpacing(8) },
  reminderType: { fontSize: getFontSize(12), color: VaultColors.textPrimary, fontFamily: "Poppins", fontWeight: "800", textTransform: "capitalize" },
  reminderDate: { fontSize: getFontSize(11), color: VaultColors.textMuted, fontFamily: "Poppins", fontWeight: "600", marginTop: 2 },

  // Service history
  serviceRow: { paddingVertical: getSpacing(8), borderBottomWidth: 1, borderBottomColor: VaultColors.border },
  serviceLeft: { flexDirection: "row", alignItems: "flex-start", gap: getSpacing(10) },
  serviceDot: { width: scale(8), height: scale(8), borderRadius: scale(4), backgroundColor: VaultColors.brandGoldDark, marginTop: scale(5) },
  serviceTitle: { fontSize: getFontSize(12), color: VaultColors.textPrimary, fontFamily: "Poppins", fontWeight: "800", textTransform: "capitalize" },
  serviceMeta: { fontSize: getFontSize(11), color: VaultColors.textMuted, fontFamily: "Poppins", fontWeight: "600", marginTop: 2 },

  // Claims
  claimRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: getSpacing(8), borderBottomWidth: 1, borderBottomColor: VaultColors.border },
  claimKind: { fontSize: getFontSize(12), color: VaultColors.textPrimary, fontFamily: "Poppins", fontWeight: "800", textTransform: "capitalize" },
  claimDate: { fontSize: getFontSize(11), color: VaultColors.textMuted, fontFamily: "Poppins", fontWeight: "600", marginTop: 2 },

  // Exports
  exportRow: { flexDirection: "row", alignItems: "center", gap: getSpacing(10), paddingVertical: getSpacing(8), borderBottomWidth: 1, borderBottomColor: VaultColors.border },
  exportInfo: { flex: 1 },
  exportName: { fontSize: getFontSize(12), color: VaultColors.textPrimary, fontFamily: "Poppins", fontWeight: "800" },
  exportMeta: { fontSize: getFontSize(10), color: VaultColors.textMuted, fontFamily: "Poppins", fontWeight: "600", marginTop: 2 },

  // AI
  aiSubtitle: { fontSize: getFontSize(12), color: VaultColors.textMuted, fontFamily: "Poppins", fontWeight: "600", marginBottom: getSpacing(10) },
  aiConvList: { gap: getSpacing(8) },
  aiConvRow: { flexDirection: "row", alignItems: "flex-start", gap: getSpacing(8), paddingVertical: getSpacing(6), borderTopWidth: 1, borderTopColor: VaultColors.border },
  aiConvPreview: { flex: 1, fontSize: getFontSize(12), color: VaultColors.textPrimary, fontFamily: "Poppins", fontWeight: "600" },
});
