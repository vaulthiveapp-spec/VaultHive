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
import { getWarranty } from "../../services/localRepo";
import { deleteWarrantyOffline } from "../../services/offlineActions";

const daysUntil = (dateStr) => {
  if (!dateStr) return null;
  const d = new Date(`${String(dateStr)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86400000);
};

const toneForExpiry = (days) => {
  if (days == null) {
    return { bg: VaultColors.appBackground, text: VaultColors.textMuted, border: VaultColors.border };
  }
  if (days < 0) {
    return { bg: "#FFF0F0", text: VaultColors.error, border: "#F2BDBD" };
  }
  if (days <= 30) {
    return { bg: "#FFF6E3", text: VaultColors.brandGoldDark, border: VaultColors.brandGoldLight };
  }
  return { bg: VaultColors.brandGoldSoft, text: VaultColors.textPrimary, border: VaultColors.border };
};

const SectionHeader = ({ title }) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionTitle}>{title}</Text>
  </View>
);

export default function WarrantyDetailsScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const alert = useAlert();
  const uid = user?.uid;

  const warrantyId = route?.params?.warrantyId;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    if (!uid || !warrantyId) return;
    setLoading(true);
    try {
      const warrantyData = await getWarranty(uid, warrantyId);
      setData(warrantyData || null);
    } catch {
      alert?.error?.("Error", "Failed to load warranty.");
    } finally {
      setLoading(false);
    }
  }, [uid, warrantyId, alert]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const w = data?.warranty;
  const attachments = data?.attachments || [];
  const expiryDays = useMemo(() => daysUntil(w?.warranty_end), [w?.warranty_end]);
  const expiryTone = toneForExpiry(expiryDays);

  const expiryText =
    expiryDays == null
      ? "No expiry date"
      : expiryDays < 0
      ? `${Math.abs(expiryDays)} day${Math.abs(expiryDays) === 1 ? "" : "s"} expired`
      : expiryDays === 0
      ? "Expires today"
      : `${expiryDays} day${expiryDays === 1 ? "" : "s"} left`;

  const onDelete = () => {
    if (!uid || !warrantyId) return;
    alert.open({
      type: "warning",
      title: "Delete warranty?",
      message: "This will remove the warranty from your vault.",
      actions: [
        { text: "Cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteWarrantyOffline(uid, warrantyId);
              alert?.success?.("Deleted", "Warranty deleted.");
              navigation.replace("Vault", { tab: "warranties" });
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

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor={VaultColors.appBackground} />

      <View style={[styles.header, { paddingTop: insets.top + scale(10) }]}>
        <TouchableOpacity style={styles.headerBtn} activeOpacity={0.85} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={scale(20)} color={VaultColors.textPrimary} />
        </TouchableOpacity>

        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Warranty</Text>
          <Text style={styles.headerSubtitle}>Coverage details, files, and linked receipt.</Text>
        </View>

        <TouchableOpacity
          style={styles.headerBtn}
          activeOpacity={0.85}
          onPress={() => navigation.navigate("AddWarranty", { warrantyId })}
        >
          <Ionicons name="create-outline" size={scale(18)} color={VaultColors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.summaryCard}>
          <View style={styles.summaryTopRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.summaryEyebrow}>{loading ? "Loading…" : "Saved coverage"}</Text>
              <Text style={styles.summaryTitle} numberOfLines={2}>
                {w?.product_name || "Warranty"}
              </Text>
            </View>
            <View style={styles.summaryBadge}>
              <Text style={styles.summaryBadgeText}>{attachments.length} file{attachments.length === 1 ? "" : "s"}</Text>
            </View>
          </View>

          <View style={[styles.statusPill, { backgroundColor: expiryTone.bg, borderColor: expiryTone.border }]}>
            <Ionicons name="shield-checkmark-outline" size={scale(14)} color={expiryTone.text} />
            <Text style={[styles.statusPillText, { color: expiryTone.text }]}>{expiryText}</Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Serial number</Text>
            <Text style={styles.infoValue}>{w?.serial_number || "—"}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Start date</Text>
            <Text style={styles.infoValue}>{w?.warranty_start || "—"}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>End date</Text>
            <Text style={styles.infoValue}>{w?.warranty_end || "—"}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Linked receipt</Text>
            {w?.receipt_id ? (
              <TouchableOpacity activeOpacity={0.85} onPress={() => navigation.navigate("ReceiptDetails", { receiptId: w.receipt_id })}>
                <Text style={[styles.infoValue, styles.linkText]}>Open receipt</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.infoValue}>—</Text>
            )}
          </View>
        </View>

        {!!w?.terms_note ? (
          <>
            <SectionHeader title="Notes" />
            <View style={styles.noteCard}>
              <Text style={styles.noteText}>{w.terms_note}</Text>
            </View>
          </>
        ) : null}

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

        <View style={styles.actionsCard}>
          <Button
            title="Edit warranty"
            variant="secondary"
            onPress={() => navigation.navigate("AddWarranty", { warrantyId })}
            size="md"
            style={{ width: "100%" }}
          />
          <Button
            title="Delete warranty"
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
    color: VaultColors.textPrimary,
    fontSize: getFontSize(18),
    fontFamily: "Poppins",
    fontWeight: "900",
  },

  headerSubtitle: {
    marginTop: 2,
    color: VaultColors.textMuted,
    fontSize: getFontSize(10.5),
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
    justifyContent: "space-between",
  },

  summaryEyebrow: {
    color: VaultColors.textMuted,
    fontSize: getFontSize(10.5),
    fontFamily: "Poppins",
    fontWeight: "800",
    textTransform: "uppercase",
  },

  summaryTitle: {
    marginTop: scale(4),
    color: VaultColors.textPrimary,
    fontSize: getFontSize(20),
    fontFamily: "Poppins",
    fontWeight: "900",
  },

  summaryBadge: {
    paddingHorizontal: scale(12),
    paddingVertical: scale(10),
    borderRadius: scale(16),
    backgroundColor: VaultColors.appBackground,
    borderWidth: 1,
    borderColor: VaultColors.border,
  },

  summaryBadgeText: {
    color: VaultColors.textPrimary,
    fontSize: getFontSize(12),
    fontFamily: "Poppins",
    fontWeight: "900",
  },

  statusPill: {
    alignSelf: "flex-start",
    marginTop: scale(14),
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

  infoCard: {
    marginTop: scale(14),
    backgroundColor: VaultColors.surfaceAlt,
    borderRadius: scale(22),
    borderWidth: 1,
    borderColor: VaultColors.border,
    paddingHorizontal: scale(14),
    ...Platform.select({ android: { elevation: 2 }, ios: VaultShadows.sm }),
  },

  infoRow: {
    minHeight: scale(54),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: scale(12),
  },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: VaultColors.divider,
  },

  infoLabel: {
    color: VaultColors.textMuted,
    fontSize: getFontSize(11.5),
    fontFamily: "Poppins",
    fontWeight: "700",
  },

  infoValue: {
    flexShrink: 1,
    textAlign: "right",
    color: VaultColors.textPrimary,
    fontSize: getFontSize(12),
    fontFamily: "Poppins",
    fontWeight: "900",
  },

  linkText: {
    color: VaultColors.brandGoldDark,
  },

  sectionHeader: {
    marginTop: scale(18),
    marginBottom: scale(10),
  },

  sectionTitle: {
    color: VaultColors.textPrimary,
    fontSize: getFontSize(15),
    fontFamily: "Poppins",
    fontWeight: "900",
  },

  noteCard: {
    backgroundColor: VaultColors.surfaceAlt,
    borderRadius: scale(20),
    borderWidth: 1,
    borderColor: VaultColors.border,
    padding: scale(14),
    ...Platform.select({ android: { elevation: 2 }, ios: VaultShadows.sm }),
  },

  noteText: {
    color: VaultColors.textSecondary,
    fontSize: getFontSize(11.5),
    lineHeight: getFontSize(18),
    fontFamily: "Poppins",
    fontWeight: "600",
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

  actionsCard: {
    marginTop: scale(14),
    gap: scale(10),
  },

  emptyCardCompact: {
    backgroundColor: VaultColors.surfaceAlt,
    borderRadius: scale(18),
    borderWidth: 1,
    borderColor: VaultColors.border,
    padding: scale(14),
  },

  emptyText: {
    fontSize: getFontSize(11.5),
    color: VaultColors.textMuted,
    fontFamily: "Poppins",
    fontWeight: "600",
    textAlign: "center",
  },
});
