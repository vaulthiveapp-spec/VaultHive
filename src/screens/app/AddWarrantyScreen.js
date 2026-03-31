import React, { useCallback, useRef, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar,
  Platform, ScrollView, Switch,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";
import { useFocusEffect } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";

import Input from "../../components/Input";
import DateInput from "../../components/DateInput";
import Button from "../../components/Button";
import { useAuth } from "../../context/AuthContext";
import { useAlert } from "../../components/AlertProvider";
import { scale, getFontSize, getSpacing, verticalScale } from "../../utils/responsive";
import { VaultColors, VaultRadius, VaultShadows, VaultSpacing } from "../../styles/DesignSystem";
import { getWarranty, listReceipts, listHubs } from "../../services/localRepo";
import { createOrUpdateWarrantyOffline } from "../../services/offlineActions";
import { makePushId } from "../../utils/pushId";
import { buildAttachmentPath, getBuckets, uploadAttachmentIfOnline } from "../../services/uploadService";
import { runOcrPipeline, isWeakConfidence } from "../../services/ocrPipeline";

const today = () => new Date().toISOString().slice(0, 10);
const isIsoDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
const isImageType = (ct, uri) => {
  const c = String(ct || "").toLowerCase();
  if (c.startsWith("image/")) return true;
  const u = String(uri || "").toLowerCase();
  return u.endsWith(".jpg") || u.endsWith(".jpeg") || u.endsWith(".png") || u.endsWith(".webp");
};
function shortName(name) {
  const s = String(name || "");
  return s.length <= 20 ? s : s.slice(0, 12) + "\u2026" + s.slice(-6);
}

const SectionCard = ({ title, subtitle, actionText, onAction, children }) => (
  <View style={styles.sectionCard}>
    <View style={styles.sectionHead}>
      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      </View>
      {actionText ? (
        <TouchableOpacity activeOpacity={0.85} onPress={onAction}>
          <Text style={styles.sectionAction}>{actionText}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
    {children}
  </View>
);

const ToggleRow = ({ label, subtitle, value, onValueChange }) => (
  <View style={styles.toggleRow}>
    <View style={{ flex: 1 }}>
      <Text style={styles.toggleLabel}>{label}</Text>
      {subtitle ? <Text style={styles.toggleSub}>{subtitle}</Text> : null}
    </View>
    <Switch
      value={value}
      onValueChange={onValueChange}
      trackColor={{ false: "#E1D6C5", true: VaultColors.brandGoldSoft }}
      thumbColor={value ? VaultColors.brandGoldDark : "#F8F6F0"}
    />
  </View>
);

export default function AddWarrantyScreen({ navigation, route }) {
  const insets   = useSafeAreaInsets();
  const { user } = useAuth();
  const alert    = useAlert();
  const uid      = user?.uid;

  const existingWarrantyId = route?.params?.warrantyId || null;
  const prelinkedReceiptId = route?.params?.receiptId  || null;
  const prelinkedHubId     = route?.params?.hubId      || null;

  const stableWarrantyIdRef = useRef(existingWarrantyId || makePushId());
  const warrantyId          = stableWarrantyIdRef.current;

  const [loading,      setLoading]      = useState(false);
  const [saving,       setSaving]       = useState(false);

  const [productName,  setProductName]  = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [warrantyStart, setWarrantyStart] = useState(today());
  const [warrantyEnd,  setWarrantyEnd]  = useState("");
  const [termsNote,    setTermsNote]    = useState("");

  const [attachments,  setAttachments]  = useState([]);
  const [ocrResult,    setOcrResult]    = useState({
    raw_text: "", status: "idle", error: null, retryable: false,
    suggestions: null, parsed: null,
  });

  // Links
  const [linkedReceiptId, setLinkedReceiptId] = useState(prelinkedReceiptId || null);
  const [linkedHubId,     setLinkedHubId]     = useState(prelinkedHubId || null);
  const [availableReceipts, setAvailableReceipts] = useState([]);
  const [availableHubs,     setAvailableHubs]     = useState([]);

  // Options
  const [createReminder, setCreateReminder] = useState(false);

  // ── Load ─────────────────────────────────────────────────────────────────

  const loadOptions = useCallback(async () => {
    if (!uid) return;
    try {
      const [r, h] = await Promise.all([listReceipts(uid, 50), listHubs(uid, 50)]);
      setAvailableReceipts(r || []);
      setAvailableHubs(h || []);
    } catch {}
  }, [uid]);

  const loadEdit = useCallback(async () => {
    if (!uid || !existingWarrantyId) return;
    try {
      setLoading(true);
      const data = await getWarranty(uid, existingWarrantyId);
      if (!data?.warranty) return;
      const w = data.warranty;
      setProductName(w.product_name || "");
      setSerialNumber(w.serial_number || "");
      setWarrantyStart(w.warranty_start || today());
      setWarrantyEnd(w.warranty_end || "");
      setTermsNote(w.terms_note || "");
      setLinkedReceiptId(w.receipt_id || null);
      const atts = Array.isArray(data.attachments) ? data.attachments : [];
      setAttachments(atts.map((a) => ({
        attachment_id: a.attachment_id, owner_uid: uid,
        linked_type: "warranty", linked_id: warrantyId,
        provider: a.provider || "supabase", bucket: a.bucket || getBuckets().attachments,
        path: a.path || null, public_url: a.public_url || null,
        filename: a.filename || "attachment", content_type: a.content_type || null,
        size_bytes: Number(a.size_bytes || 0), local_uri: a.local_uri || null,
        upload_status: a.upload_status || (a.public_url ? "uploaded" : null),
        created_at: a.created_at || Date.now(),
      })));
    } catch {
      alert?.error?.("Error", "Failed to load warranty.");
    } finally {
      setLoading(false);
    }
  }, [uid, existingWarrantyId, alert, warrantyId]);

  useFocusEffect(useCallback(() => { loadOptions(); loadEdit(); }, [loadOptions, loadEdit]));

  // ── Attachments ───────────────────────────────────────────────────────────

  const removeAttachment = (id) => setAttachments((prev) => prev.filter((a) => a.attachment_id !== id));

  const addAttachment = async ({ uri, name, mimeType, size }) => {
    if (!uid || !uri) return;
    const attachment_id = makePushId();
    const bucket = getBuckets().attachments;
    const path = buildAttachmentPath({ userUid: uid, linkedType: "warranty", linkedId: warrantyId, attachmentId: attachment_id, filename: name || "attachment" });
    const att = { attachment_id, owner_uid: uid, linked_type: "warranty", linked_id: warrantyId, provider: "supabase", bucket, path, public_url: null, filename: name || "attachment", content_type: mimeType || null, size_bytes: Number(size || 0), local_uri: uri, upload_status: "pending", created_at: Date.now() };
    setAttachments((prev) => [att, ...prev]);
    try {
      const up = await uploadAttachmentIfOnline(att);
      if (up?.public_url) {
        setAttachments((prev) => prev.map((x) => x.attachment_id === attachment_id
          ? { ...x, public_url: up.public_url, content_type: up.content_type || x.content_type, upload_status: "uploaded", local_uri: null }
          : x
        ));
      }
    } catch {
      setAttachments((prev) => prev.map((x) => x.attachment_id === attachment_id ? { ...x, upload_status: "failed" } : x));
    }
  };

  const pickFromCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return alert?.warning?.("Permission", "Camera permission is required.");
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.85 });
    if (res.canceled) return;
    const asset = res.assets?.[0];
    if (!asset?.uri) return;
    await addAttachment({ uri: asset.uri, name: asset.fileName || "camera.jpg", mimeType: asset.mimeType || "image/jpeg", size: asset.fileSize });
  };

  const pickFromGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return alert?.warning?.("Permission", "Photos permission is required.");
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.85 });
    if (res.canceled) return;
    const asset = res.assets?.[0];
    if (!asset?.uri) return;
    await addAttachment({ uri: asset.uri, name: asset.fileName || "photo.jpg", mimeType: asset.mimeType || "image/jpeg", size: asset.fileSize });
  };

  const pickPdf = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: ["application/pdf"], copyToCacheDirectory: true, multiple: false });
    if (res.canceled) return;
    const asset = res.assets?.[0];
    if (!asset?.uri) return;
    await addAttachment({ uri: asset.uri, name: asset.name || "document.pdf", mimeType: asset.mimeType || "application/pdf", size: asset.size });
  };

  // ── OCR ────────────────────────────────────────────────────────────────────

  const runOcr = async () => {
    const first = (attachments || []).find(
      (a) => isImageType(a.content_type, a.local_uri || a.public_url) || String(a.content_type || "").toLowerCase().includes("pdf")
    );
    if (!first) return alert?.warning?.("OCR", "Add an image or PDF first.");

    setLoading(true);
    setOcrResult((prev) => ({ ...prev, status: "running", error: null }));
    try {
      const result = await runOcrPipeline(
        { uri: first.local_uri || first.public_url, mimeType: first.content_type, filename: first.filename },
        { mode: "warranty" }
      );
      setOcrResult({ ...result });

      if (result.status === "not_configured") {
        return alert?.warning?.("OCR not available", result.error || "Supabase not configured.");
      }
      if (result.status === "failed") {
        const msg = result.retryable ? `${result.error} Tap Run OCR to retry.` : (result.error || "OCR failed.");
        return alert?.warning?.("OCR failed", msg);
      }

      // Apply suggestions — only fill empty fields
      const s = result.suggestions || {};
      if (!String(productName  || "").trim() && s.product_name?.value)   setProductName(s.product_name.value);
      if (!String(serialNumber || "").trim() && s.serial_number?.value)  setSerialNumber(s.serial_number.value);
      if (!String(warrantyStart|| "").trim() && s.warranty_start?.value) setWarrantyStart(s.warranty_start.value);
      if (!String(warrantyEnd  || "").trim() && s.warranty_end?.value)   setWarrantyEnd(s.warranty_end.value);

      const label = result.status === "partial"
        ? "Some fields need review — shown with a dot indicator."
        : "Fields pre-filled. Review before saving.";
      alert?.success?.("OCR complete", label);
    } finally {
      setLoading(false);
    }
  };

  // ── Save ───────────────────────────────────────────────────────────────────

  const save = async () => {
    if (!uid) return;
    const pn = String(productName || "").trim();
    if (!pn) return alert?.warning?.("Missing", "Please enter product name.");
    if (warrantyStart && !isIsoDate(warrantyStart)) return alert?.warning?.("Invalid date", "Warranty start must be YYYY-MM-DD.");
    if (warrantyEnd   && !isIsoDate(warrantyEnd))   return alert?.warning?.("Invalid date", "Warranty end must be YYYY-MM-DD.");

    setSaving(true);
    try {
      const id = await createOrUpdateWarrantyOffline(uid, {
        warranty_id:    warrantyId,
        receipt_id:     linkedReceiptId || null,
        product_name:   pn,
        serial_number:  String(serialNumber || "").trim(),
        warranty_start: warrantyStart || null,
        warranty_end:   warrantyEnd   || null,
        terms_note:     termsNote     || "",
        lead_days:      createReminder ? 30 : undefined,
        attachments:    attachments.map((a) => ({
          attachment_id: a.attachment_id,
          provider:      a.provider   || "supabase",
          bucket:        a.bucket     || getBuckets().attachments,
          path:          a.path       || null,
          public_url:    a.public_url || null,
          filename:      a.filename   || null,
          content_type:  a.content_type || null,
          size_bytes:    Number(a.size_bytes || 0),
          local_uri:     a.local_uri   || null,
          upload_status: a.upload_status || null,
          created_at:    a.created_at  || Date.now(),
        })),
      });

      alert?.success?.("Saved", "Warranty saved successfully.");

      // Navigate to hub if came from one, else warranty details
      if (linkedHubId) {
        navigation.replace("HubDetail", { hubId: linkedHubId });
      } else {
        navigation.replace("WarrantyDetails", { warrantyId: id });
      }
    } catch (e) {
      alert?.error?.("Error", e?.message || "Failed to save warranty.");
    } finally {
      setSaving(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor={VaultColors.appBackground} />

      <View style={[styles.header, { paddingTop: insets.top + scale(10) }]}>
        <TouchableOpacity style={styles.backBtn} activeOpacity={0.85} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={scale(20)} color={VaultColors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>{existingWarrantyId ? "Edit Warranty" : "Add Warranty"}</Text>
        <View style={{ width: scale(40) }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* ── Product details ── */}
        <SectionCard title="Product details" subtitle="Name and serial are the key fields for warranty lookup.">
          <Input label="Product name" placeholder="e.g. iPhone 15 Pro" value={productName} onChangeText={setProductName} />
          <Input label="Serial number (optional)" placeholder="Serial / IMEI / Model number" value={serialNumber} onChangeText={setSerialNumber} />
          <View style={styles.row2}>
            <View style={{ flex: 1 }}><DateInput label="Warranty start" value={warrantyStart} onChangeText={setWarrantyStart} /></View>
            <View style={{ width: scale(10) }} />
            <View style={{ flex: 1 }}><DateInput label="Warranty end" value={warrantyEnd} onChangeText={setWarrantyEnd} /></View>
          </View>
          <Input label="Terms / notes (optional)" placeholder="Warranty card notes, conditions, support contact…" value={termsNote} onChangeText={setTermsNote} multiline numberOfLines={3} />
        </SectionCard>

        {/* ── Attachments + OCR ── */}
        <SectionCard title="Attachments & OCR" subtitle="Add warranty card, invoice, or packaging photos." actionText={loading ? "Working…" : "Run OCR"} onAction={runOcr}>
          <View style={styles.attachBtns}>
            <TouchableOpacity style={styles.attachBtn} activeOpacity={0.9} onPress={pickFromCamera}>
              <Ionicons name="camera-outline" size={scale(16)} color={VaultColors.textPrimary} />
              <Text style={styles.attachText}>Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.attachBtn} activeOpacity={0.9} onPress={pickFromGallery}>
              <Ionicons name="images-outline" size={scale(16)} color={VaultColors.textPrimary} />
              <Text style={styles.attachText}>Gallery</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.attachBtn} activeOpacity={0.9} onPress={pickPdf}>
              <Ionicons name="document-outline" size={scale(16)} color={VaultColors.textPrimary} />
              <Text style={styles.attachText}>PDF</Text>
            </TouchableOpacity>
          </View>

          {ocrResult.status === "running" ? (
            <View style={styles.ocrStatusBox}>
              <Ionicons name="sync-outline" size={scale(15)} color={VaultColors.brandGoldDark} />
              <Text style={styles.ocrStatusText}>Extracting warranty details…</Text>
            </View>
          ) : ocrResult.status === "failed" ? (
            <View style={[styles.ocrStatusBox, styles.ocrStatusFailed]}>
              <Ionicons name="alert-circle-outline" size={scale(15)} color={VaultColors.error} />
              <Text style={[styles.ocrStatusText, { color: VaultColors.error }]}>
                {ocrResult.error || "OCR failed."}{ocrResult.retryable ? " Tap Run OCR to retry." : ""}
              </Text>
            </View>
          ) : ocrResult.raw_text ? (
            <View style={styles.ocrBox}>
              <View style={styles.ocrBoxHeader}>
                <Text style={styles.ocrTitle}>OCR extracted</Text>
                {ocrResult.status === "partial" ? (
                  <View style={styles.ocrWeakBadge}>
                    <Text style={styles.ocrWeakText}>Needs review</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.ocrText} numberOfLines={6}>{ocrResult.raw_text}</Text>
              {ocrResult.suggestions ? (
                <View style={styles.confRow}>
                  {[
                    { key: "product_name",   label: "Product"  },
                    { key: "serial_number",  label: "Serial"   },
                    { key: "warranty_start", label: "Start"    },
                    { key: "warranty_end",   label: "End date" },
                  ].map(({ key, label }) => {
                    const sug = ocrResult.suggestions[key];
                    if (!sug?.value) return null;
                    const weak = isWeakConfidence(sug);
                    return (
                      <View key={key} style={[styles.confChip, weak && styles.confChipWeak]}>
                        <View style={[styles.confDot, weak ? styles.confDotWeak : styles.confDotStrong]} />
                        <Text style={[styles.confChipText, weak && styles.confChipTextWeak]}>{label}</Text>
                      </View>
                    );
                  })}
                </View>
              ) : null}
            </View>
          ) : (
            <Text style={styles.emptySmall}>Add warranty card image or invoice PDF, then run OCR to auto-fill fields.</Text>
          )}

          {attachments.length > 0 ? (
            <View style={{ marginTop: scale(10) }}>
              {attachments.map((a) => {
                const uploaded = !!a.public_url || a.upload_status === "uploaded";
                const isImg = isImageType(a.content_type, a.local_uri || a.public_url);
                return (
                  <View key={a.attachment_id} style={styles.attRow}>
                    <View style={styles.attLeft}>
                      <View style={styles.iconBox}><Ionicons name={isImg ? "image-outline" : "document-text-outline"} size={scale(16)} color={VaultColors.textPrimary} /></View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.attName} numberOfLines={1}>{shortName(a.filename)}</Text>
                        <Text style={styles.attSub}>{uploaded ? "Uploaded" : a.upload_status === "failed" ? "Upload failed (will retry)" : "Pending upload"}</Text>
                      </View>
                    </View>
                    <TouchableOpacity style={styles.attRemove} activeOpacity={0.85} onPress={() => removeAttachment(a.attachment_id)}>
                      <Ionicons name="close" size={scale(16)} color={VaultColors.textMuted} />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          ) : null}
        </SectionCard>

        {/* ── Link receipt ── */}
        {!existingWarrantyId ? (
          <SectionCard title="Link to receipt" subtitle="Connect this warranty to an existing receipt for a complete purchase record.">
            {availableReceipts.length === 0 ? (
              <Text style={styles.emptySmall}>No receipts found. Add a receipt first or leave unlinked.</Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickerRow}>
                <TouchableOpacity
                  style={[styles.pickerChip, !linkedReceiptId && styles.pickerChipActive]}
                  activeOpacity={0.88}
                  onPress={() => setLinkedReceiptId(null)}
                >
                  <Text style={[styles.pickerChipText, !linkedReceiptId && styles.pickerChipTextActive]}>None</Text>
                </TouchableOpacity>
                {availableReceipts.slice(0, 20).map((r) => {
                  const active = linkedReceiptId === r.receipt_id;
                  return (
                    <TouchableOpacity key={r.receipt_id} style={[styles.pickerChip, active && styles.pickerChipActive]} activeOpacity={0.88} onPress={() => setLinkedReceiptId(active ? null : r.receipt_id)}>
                      <Text style={[styles.pickerChipText, active && styles.pickerChipTextActive]} numberOfLines={1}>{r.vendor_name || r.receipt_id}</Text>
                      {r.purchase_date ? <Text style={[styles.pickerChipSub, active && styles.pickerChipSubActive]}>{r.purchase_date}</Text> : null}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </SectionCard>
        ) : null}

        {/* ── Link hub ── */}
        {!existingWarrantyId && !prelinkedHubId ? (
          <SectionCard title="Link to purchase hub" subtitle="Attach this warranty to an existing purchase hub.">
            {availableHubs.length === 0 ? (
              <Text style={styles.emptySmall}>No purchase hubs found.</Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickerRow}>
                <TouchableOpacity
                  style={[styles.pickerChip, !linkedHubId && styles.pickerChipActive]}
                  activeOpacity={0.88}
                  onPress={() => setLinkedHubId(null)}
                >
                  <Text style={[styles.pickerChipText, !linkedHubId && styles.pickerChipTextActive]}>None</Text>
                </TouchableOpacity>
                {availableHubs.slice(0, 20).map((h) => {
                  const active = linkedHubId === h.hub_id;
                  return (
                    <TouchableOpacity key={h.hub_id} style={[styles.pickerChip, active && styles.pickerChipActive]} activeOpacity={0.88} onPress={() => setLinkedHubId(active ? null : h.hub_id)}>
                      <Text style={[styles.pickerChipText, active && styles.pickerChipTextActive]} numberOfLines={1}>{h.title || h.merchant_name || h.hub_id}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </SectionCard>
        ) : null}

        {/* ── Options ── */}
        <SectionCard title="Options">
          <ToggleRow
            label="Create expiry reminder"
            subtitle={warrantyEnd ? `Remind 30 days before ${warrantyEnd}` : "Set an end date above to enable."}
            value={createReminder}
            onValueChange={setCreateReminder}
          />
        </SectionCard>

        <Button title={saving ? "Saving…" : "Save warranty"} onPress={save} loading={saving} disabled={saving || loading} size="md" style={{ width: "100%", marginTop: scale(14) }} />
        <View style={{ height: verticalScale(40) }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: VaultColors.appBackground },
  header: { paddingHorizontal: VaultSpacing.screenPadding, paddingBottom: scale(10), flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backBtn: { width: scale(40), height: scale(40), borderRadius: VaultRadius.lg, backgroundColor: VaultColors.surfaceAlt, borderWidth: 1, borderColor: VaultColors.border, alignItems: "center", justifyContent: "center", ...Platform.select({ android: { elevation: 1 }, ios: VaultShadows.sm }) },
  title: { color: VaultColors.textPrimary, fontSize: getFontSize(18), fontWeight: "900", fontFamily: "Poppins" },
  content: { paddingHorizontal: VaultSpacing.screenPadding, paddingBottom: verticalScale(20), maxWidth: scale(560), width: "100%", alignSelf: "center" },

  sectionCard: { marginTop: scale(14), backgroundColor: VaultColors.surfaceAlt, borderRadius: VaultRadius.xl, borderWidth: 1.5, borderColor: VaultColors.border, padding: scale(16), ...Platform.select({ android: { elevation: 2 }, ios: VaultShadows.sm }) },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: scale(10), marginBottom: scale(12) },
  sectionTitle: { color: VaultColors.textPrimary, fontSize: getFontSize(14), fontWeight: "900", fontFamily: "Poppins" },
  sectionSubtitle: { marginTop: scale(3), color: VaultColors.textMuted, fontSize: getFontSize(11), lineHeight: getFontSize(16), fontWeight: "600", fontFamily: "Poppins" },
  sectionAction: { color: VaultColors.brandGoldDark, fontWeight: "900", fontSize: getFontSize(12), fontFamily: "Poppins" },

  row2: { flexDirection: "row", alignItems: "flex-start", marginTop: scale(6) },

  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: scale(10), borderBottomWidth: 1, borderBottomColor: VaultColors.border },
  toggleLabel: { fontSize: getFontSize(13), color: VaultColors.textPrimary, fontWeight: "800", fontFamily: "Poppins" },
  toggleSub: { marginTop: 2, fontSize: getFontSize(10), color: VaultColors.textMuted, fontWeight: "600", fontFamily: "Poppins" },

  attachBtns: { flexDirection: "row", gap: scale(10), marginBottom: scale(10) },
  attachBtn: { flex: 1, minHeight: scale(44), borderRadius: VaultRadius.lg, backgroundColor: VaultColors.appBackground, borderWidth: 1.5, borderColor: VaultColors.border, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: scale(6) },
  attachText: { color: VaultColors.textPrimary, fontWeight: "900", fontSize: getFontSize(12), fontFamily: "Poppins" },

  ocrBox: { marginTop: scale(10), backgroundColor: VaultColors.appBackground, borderRadius: VaultRadius.lg, borderWidth: 1, borderColor: VaultColors.border, padding: scale(12) },
  ocrTitle: { color: VaultColors.textPrimary, fontSize: getFontSize(12), fontWeight: "900", fontFamily: "Poppins" },
  ocrBox: { marginTop: scale(10), backgroundColor: VaultColors.appBackground, borderRadius: VaultRadius.lg, borderWidth: 1, borderColor: VaultColors.border, padding: scale(12) },
  ocrBoxHeader: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: scale(6), marginBottom: scale(6) },
  ocrTitle: { color: VaultColors.textPrimary, fontSize: getFontSize(12), fontWeight: "900", fontFamily: "Poppins" },
  ocrText: { color: VaultColors.textSecondary, fontSize: getFontSize(11), lineHeight: getFontSize(16), fontWeight: "600", fontFamily: "Poppins" },
  ocrWeakBadge: { paddingHorizontal: scale(8), paddingVertical: scale(3), borderRadius: VaultRadius.full, backgroundColor: VaultColors.warningSoft, borderWidth: 1, borderColor: VaultColors.warning },
  ocrWeakText: { fontSize: getFontSize(10), color: VaultColors.warning, fontWeight: "900", fontFamily: "Poppins" },
  ocrStatusBox: { flexDirection: "row", alignItems: "center", gap: scale(8), marginTop: scale(10), paddingVertical: scale(10), paddingHorizontal: scale(12), backgroundColor: VaultColors.brandGoldSoft, borderRadius: VaultRadius.lg, borderWidth: 1, borderColor: VaultColors.brandGoldDark },
  ocrStatusFailed: { backgroundColor: VaultColors.errorSoft, borderColor: VaultColors.error },
  ocrStatusText: { flex: 1, fontSize: getFontSize(12), color: VaultColors.textSecondary, fontWeight: "700", fontFamily: "Poppins" },
  confRow: { flexDirection: "row", flexWrap: "wrap", gap: scale(6), marginTop: scale(8) },
  confChip: { flexDirection: "row", alignItems: "center", gap: scale(5), paddingHorizontal: scale(9), paddingVertical: scale(4), borderRadius: VaultRadius.full, backgroundColor: VaultColors.successSoft, borderWidth: 1, borderColor: "#A8DFC0" },
  confChipWeak: { backgroundColor: VaultColors.warningSoft, borderColor: VaultColors.warning },
  confDot: { width: scale(6), height: scale(6), borderRadius: scale(3) },
  confDotStrong: { backgroundColor: VaultColors.success },
  confDotWeak: { backgroundColor: VaultColors.warning },
  confChipText: { fontSize: getFontSize(10), color: VaultColors.success, fontWeight: "800", fontFamily: "Poppins" },
  confChipTextWeak: { color: VaultColors.warning },

  attRow: { backgroundColor: VaultColors.appBackground, borderRadius: VaultRadius.lg, borderWidth: 1, borderColor: VaultColors.border, padding: scale(12), flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: scale(8) },
  attLeft: { flexDirection: "row", alignItems: "center", gap: scale(10), flex: 1, paddingRight: scale(10) },
  iconBox: { width: scale(34), height: scale(34), borderRadius: VaultRadius.md, backgroundColor: VaultColors.brandGoldSoft, borderWidth: 1, borderColor: VaultColors.border, alignItems: "center", justifyContent: "center" },
  attName: { color: VaultColors.textPrimary, fontWeight: "900", fontSize: getFontSize(12), fontFamily: "Poppins" },
  attSub: { marginTop: scale(2), color: VaultColors.textMuted, fontWeight: "700", fontSize: getFontSize(10), fontFamily: "Poppins" },
  attRemove: { width: scale(28), height: scale(28), borderRadius: scale(14), alignItems: "center", justifyContent: "center" },

  pickerRow: { gap: scale(8), paddingVertical: scale(4) },
  pickerChip: { paddingHorizontal: scale(14), paddingVertical: scale(10), borderRadius: VaultRadius.full, borderWidth: 1.5, borderColor: VaultColors.border, backgroundColor: VaultColors.appBackground, maxWidth: scale(180) },
  pickerChipActive: { backgroundColor: VaultColors.brandGoldDark, borderColor: VaultColors.brandGoldDark },
  pickerChipText: { fontSize: getFontSize(12), color: VaultColors.textPrimary, fontWeight: "800", fontFamily: "Poppins" },
  pickerChipTextActive: { color: VaultColors.buttonTextOnGold },
  pickerChipSub: { fontSize: getFontSize(10), color: VaultColors.textMuted, fontWeight: "600", fontFamily: "Poppins", marginTop: 1 },
  pickerChipSubActive: { color: "rgba(254,247,230,0.75)" },

  emptySmall: { color: VaultColors.textMuted, fontSize: getFontSize(12), fontWeight: "700", fontFamily: "Poppins" },
});
