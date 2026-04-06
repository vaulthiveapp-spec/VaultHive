import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Platform,
  ScrollView,
  Linking,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import Ionicons from "react-native-vector-icons/Ionicons";

import Button from "../../components/Button";
import { useAuth } from "../../context/AuthContext";
import { useAlert } from "../../components/AlertProvider";
import {
  scale,
  getFontSize,
  getSpacing,
  verticalScale,
} from "../../utils/responsive";
import {
  VaultColors,
  VaultRadius,
  VaultShadows,
  VaultSpacing,
} from "../../styles/DesignSystem";
import { getReceipt, listUserTags } from "../../services/localRepo";
import { useCurrency } from "../../hooks/useCurrency";
import { deleteReceiptOffline } from "../../services/offlineActions";

const daysUntil = (dateStr) => {
  if (!dateStr) return null;
  const d = new Date(`${String(dateStr)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86400000);
};

const metaTone = (d) => {
  if (d == null) {
    return { bg: VaultColors.appBackground, text: VaultColors.textMuted, border: VaultColors.border };
  }
  if (d < 0) {
    return { bg: "#FFF0F0", text: VaultColors.error, border: "#F2BDBD" };
  }
  if (d <= 7) {
    return { bg: "#FFF6E3", text: VaultColors.brandGoldDark, border: VaultColors.brandGoldLight };
  }
  return { bg: VaultColors.brandGoldSoft, text: VaultColors.textPrimary, border: VaultColors.border };
};

const SectionHeader = ({ title, actionText, onAction }) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {onAction ? (
      <TouchableOpacity activeOpacity={0.85} onPress={onAction}>
        <Text style={styles.sectionAction}>{actionText || "See all"}</Text>
      </TouchableOpacity>
    ) : null}
  </View>
);

const InfoTile = ({ label, value, icon }) => (
  <View style={styles.infoTile}>
    <View style={styles.infoIconWrap}>
      <Ionicons name={icon} size={scale(15)} color={VaultColors.textPrimary} />
    </View>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue} numberOfLines={1}>
      {value}
    </Text>
  </View>
);

export default function ReceiptDetailsScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const alert = useAlert();
  const uid = user?.uid;
  const { fmt, fmtOriginal } = useCurrency();
  const receiptId = route?.params?.receiptId;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [tagNames, setTagNames] = useState({});

  const load = useCallback(async () => {
    if (!uid || !receiptId) return;
    setLoading(true);
    try {
      const [receiptData, loadedTags] = await Promise.all([
        getReceipt(uid, receiptId),
        listUserTags(uid),
      ]);
      setData(receiptData || null);
      const map = {};
      (loadedTags || []).forEach((t) => {
        map[String(t.tag_id)] = t.name;
      });
      setTagNames(map);
    } catch {
      alert?.error?.("Error", "Failed to load receipt.");
    } finally {
      setLoading(false);
    }
  }, [uid, receiptId, alert]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const receipt = data?.receipt;
  const items = data?.items || [];
  const tags = data?.tags || [];
  const attachments = data?.attachments || [];
  const warranties = data?.warranties || [];

  const returnDays = useMemo(() => daysUntil(receipt?.return_deadline), [receipt?.return_deadline]);
  const returnTone = metaTone(returnDays);

  const returnText =
    returnDays == null
      ? "No return date"
      : returnDays < 0
      ? `${Math.abs(returnDays)} day${Math.abs(returnDays) === 1 ? "" : "s"} overdue`
      : returnDays === 0
      ? "Due today"
      : `${returnDays} day${returnDays === 1 ? "" : "s"} left`;

  const onDelete = () => {
    if (!uid || !receiptId) return;
    alert.open({
      type: "warning",
      title: "Delete receipt?",
      message: "This will remove the receipt from your vault.",
      actions: [
        { text: "Cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteReceiptOffline(uid, receiptId);
              alert?.success?.("Deleted", "Receipt deleted.");
              navigation.replace("Vault", { tab: "receipts" });
            } catch (e) {
              alert?.error?.("Error", e?.message || "Delete failed.");
            }
          },
        },
      ],
    });
  };

  const openUrl = async (url) => {
    try {
      if (!url) return;
      await Linking.openURL(url);
    } catch {
      alert?.error?.("Error", "Could not open attachment.");
    }
  };

  if (!receiptId) {
    return (
      <SafeAreaView style={styles.container} edges={["bottom"]}>
        <StatusBar barStyle="light-content" backgroundColor={VaultColors.appBackground} />
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <TouchableOpacity style={styles.headerBtn} activeOpacity={0.88} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={scale(20)} color={VaultColors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Receipt</Text>
        </View>
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Receipt not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor={VaultColors.appBackground} />

      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.headerBtn} activeOpacity={0.88} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={scale(20)} color={VaultColors.textPrimary} />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Receipt</Text>
          <Text style={styles.headerSubtitle}>Clean summary, files, and linked warranty info.</Text>
        </View>

        <TouchableOpacity
          style={styles.headerBtn}
          activeOpacity={0.88}
          onPress={() => navigation.navigate("AddReceipt", { receiptId })}
        >
          <Ionicons name="create-outline" size={scale(18)} color={VaultColors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.summaryCard}>
          <View style={styles.summaryTopRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.summaryEyebrow}>{loading ? "Loading…" : receipt?.purchase_date || "Saved purchase"}</Text>
              <Text style={styles.summaryTitle} numberOfLines={2}>
                {receipt?.vendor_name || "Receipt"}
              </Text>
            </View>
            <View style={styles.amountBadge}>
              <Text style={styles.amountBadgeText}>
                {fmtOriginal(receipt?.total_amount, receipt?.currency_code)}
              </Text>
            </View>
          </View>

          <View style={styles.summaryPillsRow}>
            <View style={[styles.statusPill, { backgroundColor: returnTone.bg, borderColor: returnTone.border }]}>
              <Ionicons name="time-outline" size={scale(14)} color={returnTone.text} />
              <Text style={[styles.statusPillText, { color: returnTone.text }]}>{returnText}</Text>
            </View>
            {receipt?.receipt_number ? (
              <View style={styles.statusPillMuted}>
                <Text style={styles.statusPillMutedText}>#{receipt.receipt_number}</Text>
              </View>
            ) : null}
          </View>

          {!!receipt?.note ? <Text style={styles.summaryNote}>{receipt.note}</Text> : null}
        </View>

        <View style={styles.infoGrid}>
          <InfoTile label="Purchase date" value={receipt?.purchase_date || "—"} icon="calendar-outline" />
          <InfoTile label="Return date" value={receipt?.return_deadline || "—"} icon="timer-outline" />
          <InfoTile label="Items" value={String(items.length)} icon="cube-outline" />
          <InfoTile label="Files" value={String(attachments.length)} icon="attach-outline" />
        </View>

        <SectionHeader title="Items" />
        {items.length ? (
          <View style={styles.blockCard}>
            {items.map((it, idx) => (
              <View key={it.item_id || idx} style={[styles.itemRow, idx > 0 && styles.itemRowBorder]}>
                <View style={{ flex: 1, paddingRight: scale(10) }}>
                  <Text style={styles.itemTitle} numberOfLines={1}>{it.name}</Text>
                  <Text style={styles.itemMeta} numberOfLines={1}>
                    Qty {Number(it.qty || 1)} • Unit {fmtOriginal(it.unit_price, receipt?.currency_code)}
                  </Text>
                </View>
                <Text style={styles.itemTotal}>{fmtOriginal(it.total, receipt?.currency_code)}</Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyCardCompact}>
            <Text style={styles.emptyText}>No line items saved.</Text>
          </View>
        )}

        <SectionHeader title="Tags" />
        {tags.length ? (
          <View style={styles.tagsWrap}>
            {tags.map((id) => (
              <View key={id} style={styles.tagChip}>
                <Text style={styles.tagText}>{tagNames[String(id)] || `Tag ${id}`}</Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyCardCompact}>
            <Text style={styles.emptyText}>No tags attached.</Text>
          </View>
        )}

        <SectionHeader title="Attachments" />
        {attachments.length ? (
          attachments.map((a) => (
            <TouchableOpacity
              key={a.attachment_id}
              style={styles.linkRow}
              activeOpacity={0.9}
              onPress={() => openUrl(a.public_url || a.local_uri)}
            >
              <View style={styles.linkIconWrap}>
                <Ionicons
                  name={String(a.content_type || "").startsWith("image/") ? "image-outline" : "document-text-outline"}
                  size={scale(17)}
                  color={VaultColors.textPrimary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.linkTitle} numberOfLines={1}>{a.filename || a.public_url || "Attachment"}</Text>
                <Text style={styles.linkMeta} numberOfLines={1}>
                  {a.public_url ? "Uploaded" : a.upload_status === "failed" ? "Upload failed" : a.local_uri ? "Pending upload" : "Attachment"}
                </Text>
              </View>
              <Ionicons name="open-outline" size={scale(16)} color={VaultColors.textMuted} />
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyCardCompact}>
            <Text style={styles.emptyText}>No attachments saved.</Text>
          </View>
        )}

        <SectionHeader
          title="Linked warranties"
          actionText="Add warranty"
          onAction={() => navigation.navigate("AddWarranty", { receiptId })}
        />
        {warranties.length ? (
          warranties.map((w) => (
            <TouchableOpacity
              key={w.warranty_id}
              style={styles.linkRow}
              activeOpacity={0.9}
              onPress={() => navigation.navigate("WarrantyDetails", { warrantyId: w.warranty_id })}
            >
              <View style={styles.linkIconWrap}>
                <Ionicons name="shield-checkmark-outline" size={scale(17)} color={VaultColors.textPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.linkTitle} numberOfLines={1}>{w.product_name || "Warranty"}</Text>
                <Text style={styles.linkMeta} numberOfLines={1}>
                  {w.warranty_end ? `Expires ${w.warranty_end}` : "No expiry date"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={scale(16)} color={VaultColors.textMuted} />
            </TouchableOpacity>
          ))
        ) : (
          <View style={styles.emptyCardCompact}>
            <Text style={styles.emptyText}>No linked warranties yet.</Text>
          </View>
        )}

        {receipt?.ocr_raw_text ? (
          <>
            <SectionHeader title="OCR text" />
            <View style={styles.blockCard}>
              <Text style={styles.ocrText}>{receipt.ocr_raw_text}</Text>
            </View>
          </>
        ) : null}

        <View style={styles.actionsCard}>
          <Button
            title="Edit receipt"
            variant="secondary"
            onPress={() => navigation.navigate("AddReceipt", { receiptId })}
            size="md"
            style={{ width: "100%" }}
          />
          <Button
            title="Delete receipt"
            variant="danger"
            onPress={onDelete}
            size="md"
            style={{ width: "100%" }}
          />
        </View>

        <View style={{ height: verticalScale(34) }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: VaultColors.appBackground },

  header: {
    paddingHorizontal: VaultSpacing.screenPadding,
    paddingBottom: scale(10),
    flexDirection: "row",
    alignItems: "center",
    gap: scale(12),
  },

  headerBtn: {
    width: scale(42),
    height: scale(42),
    borderRadius: VaultRadius.lg,
    backgroundColor: VaultColors.surfaceAlt,
    borderWidth: 1,
    borderColor: VaultColors.border,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({ android: { elevation: 2 }, ios: VaultShadows.sm }),
  },

  headerTitle: {
    fontSize: getFontSize(18),
    color: VaultColors.textPrimary,
    fontFamily: "Poppins",
    fontWeight: "900",
  },

  headerSubtitle: {
    marginTop: 2,
    fontSize: getFontSize(10.5),
    color: VaultColors.textMuted,
    fontFamily: "Poppins",
    fontWeight: "600",
  },

  content: {
    paddingHorizontal: VaultSpacing.screenPadding,
    paddingBottom: verticalScale(20),
    maxWidth: scale(620),
    width: "100%",
    alignSelf: "center",
  },

  summaryCard: {
    backgroundColor: VaultColors.surfaceAlt,
    borderRadius: scale(24),
    borderWidth: 1,
    borderColor: VaultColors.brandGoldLight,
    padding: scale(16),
    ...Platform.select({ android: { elevation: 3 }, ios: VaultShadows.md }),
  },

  summaryTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: scale(12),
  },

  summaryEyebrow: {
    fontSize: getFontSize(10.5),
    color: VaultColors.textMuted,
    fontFamily: "Poppins",
    fontWeight: "800",
    textTransform: "uppercase",
  },

  summaryTitle: {
    marginTop: scale(4),
    fontSize: getFontSize(20),
    color: VaultColors.textPrimary,
    fontFamily: "Poppins",
    fontWeight: "900",
  },

  amountBadge: {
    paddingHorizontal: scale(12),
    paddingVertical: scale(10),
    borderRadius: scale(16),
    backgroundColor: VaultColors.appBackground,
    borderWidth: 1,
    borderColor: VaultColors.border,
  },

  amountBadgeText: {
    fontSize: getFontSize(13),
    color: VaultColors.textPrimary,
    fontFamily: "Poppins",
    fontWeight: "900",
  },

  summaryPillsRow: {
    marginTop: scale(14),
    flexDirection: "row",
    flexWrap: "wrap",
    gap: scale(8),
  },

  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(6),
    paddingHorizontal: scale(10),
    paddingVertical: scale(8),
    borderRadius: VaultRadius.full,
    borderWidth: 1,
  },

  statusPillText: {
    fontSize: getFontSize(11),
    fontFamily: "Poppins",
    fontWeight: "900",
  },

  statusPillMuted: {
    paddingHorizontal: scale(10),
    paddingVertical: scale(8),
    borderRadius: VaultRadius.full,
    backgroundColor: VaultColors.appBackground,
    borderWidth: 1,
    borderColor: VaultColors.border,
  },

  statusPillMutedText: {
    fontSize: getFontSize(11),
    color: VaultColors.textSecondary,
    fontFamily: "Poppins",
    fontWeight: "900",
  },

  summaryNote: {
    marginTop: scale(12),
    fontSize: getFontSize(12),
    lineHeight: getFontSize(18),
    color: VaultColors.textSecondary,
    fontFamily: "Poppins",
    fontWeight: "600",
  },

  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginTop: scale(14),
  },

  infoTile: {
    width: "48.2%",
    minHeight: scale(100),
    backgroundColor: VaultColors.surfaceAlt,
    borderRadius: scale(20),
    borderWidth: 1,
    borderColor: VaultColors.border,
    padding: scale(12),
    marginBottom: scale(12),
    ...Platform.select({ android: { elevation: 2 }, ios: VaultShadows.sm }),
  },

  infoIconWrap: {
    width: scale(34),
    height: scale(34),
    borderRadius: scale(12),
    backgroundColor: VaultColors.brandGoldSoft,
    alignItems: "center",
    justifyContent: "center",
  },

  infoLabel: {
    marginTop: scale(12),
    fontSize: getFontSize(11),
    color: VaultColors.textMuted,
    fontFamily: "Poppins",
    fontWeight: "700",
  },

  infoValue: {
    marginTop: scale(4),
    fontSize: getFontSize(14),
    color: VaultColors.textPrimary,
    fontFamily: "Poppins",
    fontWeight: "900",
  },

  sectionHeader: {
    marginTop: scale(8),
    marginBottom: scale(10),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: scale(10),
  },

  sectionTitle: {
    fontSize: getFontSize(15),
    color: VaultColors.textPrimary,
    fontFamily: "Poppins",
    fontWeight: "900",
  },

  sectionAction: {
    fontSize: getFontSize(11.5),
    color: VaultColors.brandGoldDark,
    fontFamily: "Poppins",
    fontWeight: "900",
  },

  blockCard: {
    backgroundColor: VaultColors.surfaceAlt,
    borderRadius: scale(22),
    borderWidth: 1,
    borderColor: VaultColors.border,
    overflow: "hidden",
    ...Platform.select({ android: { elevation: 2 }, ios: VaultShadows.sm }),
  },

  itemRow: {
    paddingHorizontal: scale(14),
    paddingVertical: scale(14),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  itemRowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: VaultColors.divider,
  },

  itemTitle: {
    fontSize: getFontSize(13),
    color: VaultColors.textPrimary,
    fontFamily: "Poppins",
    fontWeight: "900",
  },

  itemMeta: {
    marginTop: 2,
    fontSize: getFontSize(10.5),
    color: VaultColors.textMuted,
    fontFamily: "Poppins",
    fontWeight: "600",
  },

  itemTotal: {
    fontSize: getFontSize(12),
    color: VaultColors.textPrimary,
    fontFamily: "Poppins",
    fontWeight: "900",
  },

  tagsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: scale(8),
  },

  tagChip: {
    backgroundColor: VaultColors.brandGoldSoft,
    borderRadius: VaultRadius.full,
    borderWidth: 1,
    borderColor: VaultColors.brandGoldDark,
    paddingVertical: scale(8),
    paddingHorizontal: scale(12),
  },

  tagText: {
    fontSize: getFontSize(11.5),
    color: VaultColors.textPrimary,
    fontFamily: "Poppins",
    fontWeight: "900",
  },

  linkRow: {
    backgroundColor: VaultColors.surfaceAlt,
    borderRadius: scale(20),
    borderWidth: 1,
    borderColor: VaultColors.border,
    padding: scale(12),
    marginBottom: scale(10),
    flexDirection: "row",
    alignItems: "center",
    gap: scale(10),
    ...Platform.select({ android: { elevation: 2 }, ios: VaultShadows.sm }),
  },

  linkIconWrap: {
    width: scale(38),
    height: scale(38),
    borderRadius: scale(14),
    backgroundColor: VaultColors.brandGoldSoft,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: VaultColors.border,
  },

  linkTitle: {
    fontSize: getFontSize(12),
    color: VaultColors.textPrimary,
    fontFamily: "Poppins",
    fontWeight: "900",
  },

  linkMeta: {
    marginTop: 2,
    fontSize: getFontSize(10.5),
    color: VaultColors.textMuted,
    fontFamily: "Poppins",
    fontWeight: "600",
  },

  ocrText: {
    fontSize: getFontSize(11),
    lineHeight: getFontSize(17),
    color: VaultColors.textSecondary,
    fontFamily: "Poppins",
    fontWeight: "600",
    padding: scale(14),
  },

  actionsCard: {
    marginTop: scale(14),
    gap: scale(10),
  },

  emptyCard: {
    marginHorizontal: VaultSpacing.screenPadding,
    backgroundColor: VaultColors.surfaceAlt,
    borderRadius: scale(22),
    borderWidth: 1,
    borderColor: VaultColors.border,
    padding: scale(20),
    alignItems: "center",
    justifyContent: "center",
  },

  emptyCardCompact: {
    backgroundColor: VaultColors.surfaceAlt,
    borderRadius: scale(18),
    borderWidth: 1,
    borderColor: VaultColors.border,
    padding: scale(14),
  },

  emptyTitle: {
    fontSize: getFontSize(15),
    color: VaultColors.textPrimary,
    fontFamily: "Poppins",
    fontWeight: "900",
  },

  emptyText: {
    fontSize: getFontSize(11.5),
    color: VaultColors.textMuted,
    fontFamily: "Poppins",
    fontWeight: "600",
    textAlign: "center",
  },
});
