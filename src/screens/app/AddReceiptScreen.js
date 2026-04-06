import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, StatusBar,
  Platform, ScrollView, Image, Switch,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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
import { getReceipt, listUserTags, listUserCategories, listHubs } from "../../services/localRepo";
import { createOrUpdateReceiptOffline, createOrUpdatePurchaseHubOffline } from "../../services/offlineActions";
import { makePushId } from "../../utils/pushId";
import { runOcrPipeline, isWeakConfidence } from "../../services/ocrPipeline";
import aiService from "../../services/aiService";
import { buildFxSnapshot } from "../../services/currencyService";
import { useCurrency } from "../../hooks/useCurrency";
import { buildAttachmentPath, getBuckets, uploadAttachmentIfOnline } from "../../services/uploadService";

const toNum = (v) => { const n = Number(String(v || "").replace(",", ".")); return Number.isFinite(n) ? n : 0; };
const today = () => new Date().toISOString().slice(0, 10);
const isIsoDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
const isImageType = (ct, uri) => {
  const c = String(ct || "").toLowerCase();
  if (c.startsWith("image/")) return true;
  const u = String(uri || "").toLowerCase();
  return [".jpg", ".jpeg", ".png", ".webp"].some((x) => u.endsWith(x));
};
function shortName(name) {
  const s = String(name || "");
  return s.length <= 24 ? s : `${s.slice(0, 15)}\u2026${s.slice(-6)}`;
}

// ── Shared atoms ──────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────

export default function AddReceiptScreen({ navigation, route }) {
  const { user } = useAuth();
  const alert    = useAlert();
  const { fmtOriginal } = useCurrency();

  const uid = user?.uid;
  const existingReceiptId  = route?.params?.receiptId         || null;
  const prefilledHubId     = route?.params?.hubId             || null;
  // Capture as ref so the on-mount useEffect closure is stable
  const startWithFileRef   = useRef(route?.params?.startWithFilePicker === true);

  const stableReceiptIdRef = useRef(existingReceiptId || makePushId());
  const receiptId          = stableReceiptIdRef.current;

  // ── Form state ─────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [saving,  setSaving]  = useState(false);

  const [vendorName,      setVendorName]      = useState("");
  const [purchaseDate,    setPurchaseDate]     = useState(today());
  const [currencyCode,    setCurrencyCode]     = useState(String(user?.base_currency || "SAR").toUpperCase());
  const [totalAmount,     setTotalAmount]      = useState("");
  const [receiptNumber,   setReceiptNumber]    = useState("");
  const [returnDeadline,  setReturnDeadline]   = useState("");
  const [note,            setNote]             = useState("");

  const [items,           setItems]            = useState([{ item_id: makePushId(), name: "", qty: "1", unit_price: "" }]);
  const [categories,      setCategories]       = useState([]);
  const [categoryId,      setCategoryId]       = useState(7);
  const [tags,            setTags]             = useState([]);
  const [selectedTagIds,  setSelectedTagIds]   = useState([]);
  const [attachments,     setAttachments]      = useState([]);
  const [ocrState,        setOcrState]         = useState({
    raw_text:    "",       // raw normalised OCR text — always preserved
    parsed:      null,     // structured guesses from client extraction
    suggestions: null,     // per-field { value, confidence } objects
    merchant:    null,     // resolved merchant row or null
    status:      "idle",   // idle | running | success | partial | failed | not_configured
    provider:    "none",
    error:       null,
    retryable:   false,
  });
  const [autoOcr,         setAutoOcr]          = useState(true);

  // Hub linking
  const [availableHubs,   setAvailableHubs]    = useState([]);
  const [linkedHubId,     setLinkedHubId]      = useState(prefilledHubId || null);
  const [createHub,       setCreateHub]        = useState(!prefilledHubId);
  const [hubTitle,        setHubTitle]         = useState("");

  // Reminder opt-in
  const [createReminder,  setCreateReminder]   = useState(false);

  // Warranty suggestion
  const [suggestWarranty, setSuggestWarranty]  = useState(false);

  // ── Loaders ────────────────────────────────────────────────────────────────

  const loadOptions = useCallback(async () => {
    if (!uid) return;
    try {
      const [t, c, h] = await Promise.all([
        listUserTags(uid),
        listUserCategories(uid, "purchases"),
        listHubs(uid, 50),
      ]);
      setTags(t || []);
      setCategories(c || []);
      setAvailableHubs(h || []);
    } catch {}
  }, [uid]);

  const loadEdit = useCallback(async () => {
    if (!uid || !existingReceiptId) return;
    try {
      setLoading(true);
      const data = await getReceipt(uid, existingReceiptId);
      if (!data?.receipt) return;
      const r = data.receipt;
      setVendorName(r.vendor_name || "");
      setPurchaseDate(r.purchase_date || today());
      setCurrencyCode(String(r.currency_code || user?.base_currency || "SAR").toUpperCase());
      setTotalAmount(r.total_amount != null ? String(r.total_amount) : "");
      setReceiptNumber(r.receipt_number || "");
      setReturnDeadline(r.return_deadline || "");
      setNote(r.note || "");
      setSelectedTagIds(Array.isArray(data.tags) ? data.tags : []);
      setCategoryId(Number(r.category_id || 7));
      const it = Array.isArray(data.items) ? data.items : [];
      if (it.length) setItems(it.map((x) => ({ item_id: x.item_id || makePushId(), name: x.name || "", qty: String(x.qty || "1"), unit_price: String(x.unit_price || "") })));
      const atts = Array.isArray(data.attachments) ? data.attachments : [];
      setAttachments(atts.map((a) => ({
        attachment_id: a.attachment_id, filename: a.filename || "attachment",
        content_type: a.content_type || null, size_bytes: Number(a.size_bytes || 0),
        provider: a.provider || "supabase", bucket: a.bucket || getBuckets().attachments,
        path: a.path || null, public_url: a.public_url || null,
        local_uri: a.local_uri || null, upload_status: a.upload_status || (a.public_url ? "uploaded" : null),
        created_at: a.created_at || Date.now(), linked_type: "receipt", linked_id: receiptId,
      })));
      setOcrState({ raw_text: r.ocr_raw_text || "", parsed: r.ocr_parsed_json ? JSON.parse(r.ocr_parsed_json) : null });
      setCreateHub(false);
    } catch {
      alert?.error?.("Error", "Failed to load receipt.");
    } finally {
      setLoading(false);
    }
  }, [uid, existingReceiptId, alert, receiptId, user?.base_currency]);

  useFocusEffect(useCallback(() => { loadOptions(); loadEdit(); }, [loadOptions, loadEdit]));

  // ── Derived ────────────────────────────────────────────────────────────────

  const effectiveTotal = useMemo(() => {
    const manual = toNum(totalAmount);
    if (manual > 0) return Number(manual.toFixed(2));
    return Number((items || []).reduce((acc, it) => acc + Math.max(toNum(it.qty), 1) * Math.max(toNum(it.unit_price), 0), 0).toFixed(2));
  }, [totalAmount, items]);

  const previewImage = useMemo(
    () => attachments.find((a) => isImageType(a.content_type, a.local_uri || a.public_url)),
    [attachments]
  );

  const toggleTag = (tagId) => setSelectedTagIds((prev) => prev.includes(tagId) ? prev.filter((x) => x !== tagId) : [...prev, tagId]);
  const removeAttachment = (id) => setAttachments((prev) => prev.filter((a) => a.attachment_id !== id));

  // Apply pipeline suggestions to form fields.
  // Only fills fields the user has not yet touched (empty / still at default date).
  // Weak-confidence suggestions are still applied; the UI shows a confidence indicator.
  const applyPipelineSuggestions = (result) => {
    if (!result?.suggestions) return;
    const s = result.suggestions;
    if (!String(vendorName || "").trim() && s.vendor_name?.value)               setVendorName(s.vendor_name.value);
    if ((!purchaseDate || purchaseDate === today()) && s.purchase_date?.value)   setPurchaseDate(s.purchase_date.value);
    if (!String(totalAmount || "").trim() && s.total_amount?.value != null)      setTotalAmount(String(s.total_amount.value));
    if (s.currency_code?.value)                                                   setCurrencyCode(s.currency_code.value);
    if (s.category_id?.category_id)                                               setCategoryId(Number(s.category_id.category_id));
  };

  // ── Attachment handling ────────────────────────────────────────────────────

  const addAttachment = async ({ uri, name, mimeType, size }) => {
    if (!uid || !uri) return;
    const attachment_id = makePushId();
    const bucket = getBuckets().attachments;
    const path = buildAttachmentPath({ userUid: uid, linkedType: "receipt", linkedId: receiptId, attachmentId: attachment_id, filename: name || "attachment" });
    const att = { attachment_id, owner_uid: uid, linked_type: "receipt", linked_id: receiptId, provider: "supabase", bucket, path, public_url: null, filename: name || "attachment", content_type: mimeType || null, size_bytes: Number(size || 0), local_uri: uri, upload_status: "pending", created_at: Date.now() };
    setAttachments((prev) => [att, ...prev]);

    // Auto OCR on first image — full pipeline with merchant normalisation + category suggestion
    try {
      if (autoOcr && isImageType(mimeType, uri) && !ocrState?.raw_text) {
        setOcrState((prev) => ({ ...prev, status: "running", error: null }));
        const result = await runOcrPipeline(
          { uri, mimeType, filename: name },
          { mode: "receipt", userUid: uid, userCategories: categories }
        );
        setOcrState({ ...result });
        if (result.status === "success" || result.status === "partial") {
          applyPipelineSuggestions(result);
        }
      }
    } catch {}

    // Try immediate upload
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

  // Auto-open document picker when arriving from the "Upload file" shortcut in AddScreen.
  // Using a ref means the closure never goes stale and [] dep array is genuinely correct.
  useEffect(() => {
    if (!startWithFileRef.current) return;
    const timer = setTimeout(() => pickPdf(), 400);
    return () => clearTimeout(timer);
  }, []); // intentionally empty — fires once on mount only

  // ── OCR ────────────────────────────────────────────────────────────────────

  const runOcr = async () => {
    const first = (attachments || []).find(
      (a) => isImageType(a.content_type, a.local_uri || a.public_url) || String(a.content_type || "").toLowerCase().includes("pdf")
    );
    if (!first) return alert?.warning?.("OCR", "Add an image or PDF first.");

    setLoading(true);
    setOcrState((prev) => ({ ...prev, status: "running", error: null }));
    try {
      const result = await runOcrPipeline(
        { uri: first.local_uri || first.public_url, mimeType: first.content_type, filename: first.filename },
        { mode: "receipt", userUid: uid, userCategories: categories }
      );
      setOcrState({ ...result });

      if (result.status === "not_configured") {
        return alert?.warning?.("OCR not available", result.error || "Supabase not configured.");
      }
      if (result.status === "failed") {
        const msg = result.retryable ? `${result.error} Tap Run OCR to try again.` : (result.error || "OCR failed.");
        return alert?.warning?.("OCR failed", msg);
      }
      applyPipelineSuggestions(result);

      const label = result.status === "partial"
        ? "Some fields need review — weak confidence shown with a dot."
        : result.merchant?.verified
          ? `Recognised: ${result.merchant.name}. Fields pre-filled.`
          : "Fields pre-filled. Review before saving.";
      alert?.success?.("OCR complete", label);
    } finally {
      setLoading(false);
    }
  };

  // ── AI suggestions ─────────────────────────────────────────────────────────

  const useAiSuggestions = async () => {
    if (!uid) return;
    setLoading(true);
    try {
      const context = { screen: "add_receipt", receiptVendor: vendorName, receiptDate: purchaseDate, receiptTotal: effectiveTotal, receiptCurrency: currencyCode };
      const prompt  = `Suggest category and tags for a receipt: Vendor=${vendorName}, Date=${purchaseDate}, Total=${effectiveTotal} ${currencyCode}, Note=${note}. OCR: ${ocrState?.raw_text?.slice(0, 400) || "none"}`;
      const res = await aiService.chat({ uid, message: prompt, context });
      const text = res?.text || "";

      // Try to match a category name
      if (Array.isArray(categories) && categories.length) {
        const match = categories.find((c) => text.toLowerCase().includes(String(c.name || "").toLowerCase()));
        if (match?.category_id != null) setCategoryId(Number(match.category_id));
      }
      // Try to match tag names
      if (Array.isArray(tags) && tags.length) {
        const matched = tags.filter((t) => text.toLowerCase().includes(String(t.name || "").toLowerCase()));
        if (matched.length) setSelectedTagIds((prev) => Array.from(new Set([...prev, ...matched.map((t) => t.tag_id)])));
      }
      alert?.success?.("AI suggestions", "Smart organization applied based on your receipt.");
    } catch (e) {
      alert?.error?.("AI error", e?.message || "AI request failed.");
    } finally {
      setLoading(false);
    }
  };

  // ── Save ───────────────────────────────────────────────────────────────────

  const save = async () => {
    if (!uid) return;
    const vendor = String(vendorName || "").trim();
    if (!vendor)                                        return alert?.warning?.("Missing", "Please enter a vendor name.");
    if (!purchaseDate || !isIsoDate(purchaseDate))      return alert?.warning?.("Invalid date", "Purchase date must be YYYY-MM-DD.");
    if (returnDeadline && !isIsoDate(returnDeadline))   return alert?.warning?.("Invalid date", "Return deadline must be YYYY-MM-DD.");

    setSaving(true);
    try {
      const fxSnap = await buildFxSnapshot(
        String(currencyCode || "SAR").toUpperCase(),
        String(user?.base_currency || "SAR").toUpperCase()
      );

      // 1. Save receipt
      const savedReceiptId = await createOrUpdateReceiptOffline(uid, {
        receipt_id:        receiptId,
        vendor_name:       vendor,
        purchase_date:     purchaseDate,
        purchase_month:    purchaseDate.slice(0, 7),
        total_amount:      effectiveTotal,
        currency_code:     String(currencyCode || "SAR").toUpperCase(),
        fx_snapshot_rate:  fxSnap.fx_snapshot_rate,
        fx_snapshot_base:  fxSnap.fx_snapshot_base,
        category_id:       Number(categoryId || 7),
        receipt_number:    String(receiptNumber || "").trim(),
        return_deadline:   returnDeadline || null,
        note:              String(note || "").trim(),
        items:             (items || []).filter((it) => String(it.name || "").trim()).map((it) => ({
          item_id:    it.item_id || makePushId(),
          name:       String(it.name || "").trim(),
          qty:        Math.max(toNum(it.qty), 1),
          unit_price: Math.max(toNum(it.unit_price), 0),
        })),
        tag_ids:           selectedTagIds,
        lead_days:         createReminder ? 3 : undefined,
        ocr:               { raw_text: ocrState.raw_text || "", parsed: ocrState.parsed || {} },
        attachments:       attachments.map((a) => ({
          attachment_id:  a.attachment_id,
          provider:       a.provider || "supabase",
          bucket:         a.bucket   || getBuckets().attachments,
          path:           a.path     || null,
          public_url:     a.public_url || null,
          filename:       a.filename  || null,
          content_type:   a.content_type || null,
          size_bytes:     Number(a.size_bytes || 0),
          local_uri:      a.local_uri || null,
          upload_status:  a.upload_status || null,
          created_at:     a.created_at || Date.now(),
        })),
      });

      // 2. Create or link purchase hub
      let finalHubId = linkedHubId;
      if (createHub && !existingReceiptId) {
        finalHubId = await createOrUpdatePurchaseHubOffline(uid, {
          title:                  hubTitle.trim() || vendor,
          merchant_name:          vendor,
          purchase_date:          purchaseDate,
          return_deadline:        returnDeadline || null,
          total_amount:           effectiveTotal,
          currency_code:          String(currencyCode || "SAR").toUpperCase(),
          category_id:            categoryId,
          receipt_id:             savedReceiptId,
          status:                 "active",
          create_return_reminder: createReminder,
        });
      }

      // 3. Navigate
      if (suggestWarranty) {
        alert?.success?.("Receipt saved!", "Now add a warranty for this purchase.");
        navigation.replace("AddWarranty", { receiptId: savedReceiptId, hubId: finalHubId });
      } else if (finalHubId && !existingReceiptId) {
        alert?.success?.("Saved", "Purchase added to your vault.");
        navigation.replace("HubDetail", { hubId: finalHubId });
      } else {
        alert?.success?.("Saved", "Receipt saved successfully.");
        navigation.replace("ReceiptDetails", { receiptId: savedReceiptId });
      }
    } catch (e) {
      alert?.error?.("Error", e?.message || "Failed to save receipt.");
    } finally {
      setSaving(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor={VaultColors.appBackground} />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} activeOpacity={0.85} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={scale(20)} color={VaultColors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>{existingReceiptId ? "Edit Receipt" : "Add Receipt"}</Text>
        <View style={{ width: scale(40) }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* ── Basics ── */}
        <SectionCard title="Receipt basics" subtitle="Fill the essentials first, then let OCR and AI help.">
          <Input label="Vendor / store name" placeholder="e.g. Jarir Bookstore" value={vendorName} onChangeText={setVendorName} />
          <View style={styles.row2}>
            <View style={{ flex: 1 }}><DateInput label="Purchase date" value={purchaseDate} onChangeText={setPurchaseDate} /></View>
            <View style={{ width: scale(10) }} />
            <View style={{ flex: 1 }}><Input label="Currency" placeholder="SAR" value={currencyCode} onChangeText={(v) => setCurrencyCode(String(v).toUpperCase())} autoCapitalize="characters" /></View>
          </View>
          <View style={styles.row2}>
            <View style={{ flex: 1 }}><Input label="Total amount" placeholder="0.00" keyboardType="decimal-pad" value={totalAmount} onChangeText={setTotalAmount} /></View>
            <View style={{ width: scale(10) }} />
            <View style={{ flex: 1 }}><Input label="Receipt no." placeholder="Optional" value={receiptNumber} onChangeText={setReceiptNumber} /></View>
          </View>
          <DateInput label="Return deadline (optional)" value={returnDeadline} onChangeText={setReturnDeadline} />
          <Input label="Note" placeholder="Anything important about this purchase…" value={note} onChangeText={setNote} multiline numberOfLines={3} />
        </SectionCard>

        {/* ── Attachments + OCR ── */}
        <SectionCard title="Attachments & OCR" subtitle="Camera images work best for OCR." actionText={loading ? "Working…" : "Run OCR"} onAction={runOcr}>
          <ToggleRow label="Auto-run OCR on first image" value={autoOcr} onValueChange={setAutoOcr} />
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

          {previewImage?.local_uri || previewImage?.public_url ? (
            <View style={styles.previewBox}>
              <Image source={{ uri: previewImage.local_uri || previewImage.public_url }} style={styles.previewImage} resizeMode="cover" />
            </View>
          ) : null}

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
          ) : (
            <Text style={styles.emptySmall}>No attachments yet. Camera images work best for OCR.</Text>
          )}

          {/* OCR pipeline state display */}
          {ocrState.status === "running" ? (
            <View style={styles.ocrStatusBox}>
              <Ionicons name="sync-outline" size={scale(15)} color={VaultColors.brandGoldDark} />
              <Text style={styles.ocrStatusText}>Extracting text and analysing receipt…</Text>
            </View>
          ) : ocrState.status === "failed" ? (
            <View style={[styles.ocrStatusBox, styles.ocrStatusFailed]}>
              <Ionicons name="alert-circle-outline" size={scale(15)} color={VaultColors.error} />
              <Text style={[styles.ocrStatusText, { color: VaultColors.error }]}>
                {ocrState.error || "OCR failed."}{ocrState.retryable ? " Tap Run OCR to retry." : ""}
              </Text>
            </View>
          ) : ocrState.raw_text ? (
            <View style={styles.ocrBox}>
              <View style={styles.ocrBoxHeader}>
                <Text style={styles.ocrTitle}>OCR extracted</Text>
                {ocrState.merchant?.name ? (
                  <View style={[styles.ocrMerchantBadge, ocrState.merchant.verified && styles.ocrMerchantVerified]}>
                    <Ionicons
                      name={ocrState.merchant.verified ? "checkmark-circle" : "storefront-outline"}
                      size={scale(12)}
                      color={ocrState.merchant.verified ? VaultColors.success : VaultColors.textSecondary}
                    />
                    <Text style={[styles.ocrMerchantText, ocrState.merchant.verified && styles.ocrMerchantTextVerified]}>
                      {ocrState.merchant.name}
                    </Text>
                  </View>
                ) : null}
                {ocrState.status === "partial" ? (
                  <View style={styles.ocrWeakBadge}>
                    <Text style={styles.ocrWeakText}>Needs review</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.ocrText} numberOfLines={8}>{ocrState.raw_text}</Text>

              {/* Per-field confidence row */}
              {ocrState.suggestions ? (
                <View style={styles.confRow}>
                  {Object.entries(ocrState.suggestions).map(([field, sug]) => {
                    if (!sug || sug.value == null) return null;
                    const weak = isWeakConfidence(sug);
                    const labels = {
                      vendor_name: "Vendor", purchase_date: "Date",
                      total_amount: "Total", currency_code: "Currency", category_id: "Category",
                    };
                    if (!labels[field]) return null;
                    return (
                      <View key={field} style={[styles.confChip, weak && styles.confChipWeak]}>
                        <View style={[styles.confDot, weak ? styles.confDotWeak : styles.confDotStrong]} />
                        <Text style={[styles.confChipText, weak && styles.confChipTextWeak]}>{labels[field]}</Text>
                      </View>
                    );
                  })}
                </View>
              ) : null}
            </View>
          ) : null}
        </SectionCard>

        {/* ── AI organize ── */}
        <SectionCard title="Smart organization" subtitle="AI applies category and tag suggestions from your receipt context.">
          <TouchableOpacity style={styles.aiBtn} activeOpacity={0.88} onPress={useAiSuggestions} disabled={loading}>
            <Ionicons name="sparkles-outline" size={scale(16)} color={VaultColors.buttonTextOnGold} />
            <Text style={styles.aiBtnText}>{loading ? "Working…" : "Apply AI suggestions"}</Text>
          </TouchableOpacity>
        </SectionCard>

        {/* ── Line items ── */}
        <SectionCard title="Line items" subtitle="Optional — add item-level detail for richer records.">
          {(items || []).map((item, index) => (
            <View key={item.item_id} style={styles.itemCard}>
              <View style={styles.itemHead}>
                <Text style={styles.itemTitle}>Item {index + 1}</Text>
                {items.length > 1 ? (
                  <TouchableOpacity activeOpacity={0.85} onPress={() => setItems((prev) => prev.filter((x) => x.item_id !== item.item_id))}>
                    <Text style={styles.removeText}>Remove</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              <Input label="Item name" placeholder="e.g. AirPods Pro" value={item.name} onChangeText={(v) => setItems((prev) => prev.map((x) => x.item_id === item.item_id ? { ...x, name: v } : x))} />
              <View style={styles.row2}>
                <View style={{ flex: 1 }}><Input label="Qty" placeholder="1" keyboardType="decimal-pad" value={item.qty} onChangeText={(v) => setItems((prev) => prev.map((x) => x.item_id === item.item_id ? { ...x, qty: v } : x))} /></View>
                <View style={{ width: scale(10) }} />
                <View style={{ flex: 1 }}><Input label="Unit price" placeholder="0.00" keyboardType="decimal-pad" value={item.unit_price} onChangeText={(v) => setItems((prev) => prev.map((x) => x.item_id === item.item_id ? { ...x, unit_price: v } : x))} /></View>
              </View>
            </View>
          ))}
          <TouchableOpacity style={styles.addLineBtn} activeOpacity={0.9} onPress={() => setItems((prev) => [...prev, { item_id: makePushId(), name: "", qty: "1", unit_price: "" }])}>
            <Ionicons name="add-circle-outline" size={scale(16)} color={VaultColors.textPrimary} />
            <Text style={styles.addLineText}>Add another item</Text>
          </TouchableOpacity>
        </SectionCard>

        {/* ── Category ── */}
        <SectionCard title="Category" subtitle="Pick the best category for cleaner reports.">
          <View style={styles.tagWrap}>
            {(categories || []).map((c) => {
              const active = Number(categoryId) === Number(c.category_id);
              return (
                <TouchableOpacity key={c.category_id} style={[styles.tagChip, active && styles.tagChipActive]} activeOpacity={0.9} onPress={() => setCategoryId(Number(c.category_id))}>
                  <Text style={[styles.tagChipText, active && styles.tagChipTextActive]}>{c.name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </SectionCard>

        {/* ── Tags ── */}
        <SectionCard title="Tags" subtitle="Optional tags for searching and grouping.">
          {(tags || []).length === 0 ? (
            <Text style={styles.emptySmall}>No tags set up yet. Add tags in Settings → Categories & Tags.</Text>
          ) : (
            <View style={styles.tagWrap}>
              {(tags || []).map((t) => {
                const active = selectedTagIds.includes(t.tag_id);
                return (
                  <TouchableOpacity key={t.tag_id} style={[styles.tagChip, active && styles.tagChipActive]} activeOpacity={0.9} onPress={() => toggleTag(t.tag_id)}>
                    <Text style={[styles.tagChipText, active && styles.tagChipTextActive]}>{t.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </SectionCard>

        {/* ── Purchase hub ── */}
        {!existingReceiptId ? (
          <SectionCard title="Purchase hub" subtitle="Group this receipt into a hub alongside a warranty, service history, and more.">
            <ToggleRow label="Create a purchase hub" subtitle="Recommended for tracking full lifecycle of a product." value={createHub} onValueChange={(v) => { setCreateHub(v); if (v) setLinkedHubId(null); }} />
            {createHub ? (
              <Input label="Hub title (optional)" placeholder={vendorName || "e.g. iPhone 15 purchase"} value={hubTitle} onChangeText={setHubTitle} />
            ) : (
              <>
                <Text style={styles.hubPickerLabel}>Link to existing hub</Text>
                {availableHubs.length === 0 ? (
                  <Text style={styles.emptySmall}>No existing hubs. Toggle above to create one.</Text>
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hubPickerRow}>
                    {availableHubs.map((h) => {
                      const active = linkedHubId === h.hub_id;
                      return (
                        <TouchableOpacity key={h.hub_id} style={[styles.hubChip, active && styles.hubChipActive]} activeOpacity={0.88} onPress={() => setLinkedHubId(active ? null : h.hub_id)}>
                          <Text style={[styles.hubChipText, active && styles.hubChipTextActive]} numberOfLines={1}>{h.title || h.merchant_name || h.hub_id}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                )}
              </>
            )}
          </SectionCard>
        ) : null}

        {/* ── Options ── */}
        <SectionCard title="Options" subtitle="Fine-tune what happens after saving.">
          {(returnDeadline || createHub) ? (
            <ToggleRow
              label="Create a return reminder"
              subtitle={returnDeadline ? `Remind 3 days before ${returnDeadline}` : "Set a return deadline above first."}
              value={createReminder}
              onValueChange={setCreateReminder}
            />
          ) : null}
          <ToggleRow
            label="Add warranty after saving"
            subtitle="Jump straight to the warranty form after this receipt is saved."
            value={suggestWarranty}
            onValueChange={setSuggestWarranty}
          />
        </SectionCard>

        {/* ── Total summary ── */}
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Current total</Text>
          <Text style={styles.totalValue}>{fmtOriginal(effectiveTotal, currencyCode)}</Text>
        </View>

        <Button title={saving ? "Saving…" : "Save receipt"} onPress={save} loading={saving} disabled={saving || loading} size="md" style={{ width: "100%" }} />
        <View style={{ height: verticalScale(40) }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: VaultColors.appBackground },
  header: { paddingHorizontal: VaultSpacing.screenPadding, paddingBottom: scale(12), flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backBtn: { width: scale(44), height: scale(44), alignItems: "center", justifyContent: "center" },
  title: { color: VaultColors.textPrimary, fontSize: getFontSize(18), fontWeight: "900", fontFamily: "Poppins" },
  content: { paddingHorizontal: VaultSpacing.screenPadding, paddingBottom: verticalScale(20), maxWidth: scale(560), width: "100%", alignSelf: "center" },

  sectionCard: { marginTop: scale(14), backgroundColor: VaultColors.surfaceAlt, borderRadius: VaultRadius.xl, borderWidth: 1.5, borderColor: VaultColors.border, padding: scale(16), ...Platform.select({ android: { elevation: 2 }, ios: VaultShadows.sm }) },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: scale(10), marginBottom: scale(12) },
  sectionTitle: { color: VaultColors.textPrimary, fontSize: getFontSize(14), fontWeight: "900", fontFamily: "Poppins" },
  sectionSubtitle: { marginTop: scale(3), color: VaultColors.textMuted, fontSize: getFontSize(11), lineHeight: getFontSize(16), fontWeight: "600", fontFamily: "Poppins" },
  sectionAction: { color: VaultColors.brandGoldDark, fontWeight: "900", fontSize: getFontSize(12), fontFamily: "Poppins" },

  row2: { flexDirection: "row", alignItems: "flex-start", marginTop: scale(6) },

  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: scale(10), borderBottomWidth: 1, borderBottomColor: VaultColors.border, marginBottom: scale(4) },
  toggleLabel: { fontSize: getFontSize(13), color: VaultColors.textPrimary, fontWeight: "800", fontFamily: "Poppins" },
  toggleSub: { marginTop: 2, fontSize: getFontSize(10), color: VaultColors.textMuted, fontWeight: "600", fontFamily: "Poppins" },

  attachBtns: { flexDirection: "row", gap: scale(10), marginTop: scale(10) },
  attachBtn: { flex: 1, minHeight: scale(44), borderRadius: VaultRadius.lg, backgroundColor: VaultColors.appBackground, borderWidth: 1.5, borderColor: VaultColors.border, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: scale(6) },
  attachText: { color: VaultColors.textPrimary, fontWeight: "900", fontSize: getFontSize(12), fontFamily: "Poppins" },

  previewBox: { marginTop: scale(12), borderRadius: VaultRadius.xl, overflow: "hidden", borderWidth: 1, borderColor: VaultColors.border },
  previewImage: { width: "100%", height: verticalScale(180), backgroundColor: VaultColors.surfaceAlt },

  attRow: { backgroundColor: VaultColors.appBackground, borderRadius: VaultRadius.lg, borderWidth: 1, borderColor: VaultColors.border, padding: scale(12), flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: scale(8) },
  attLeft: { flexDirection: "row", alignItems: "center", gap: scale(10), flex: 1, paddingRight: scale(10) },
  iconBox: { width: scale(34), height: scale(34), borderRadius: VaultRadius.md, backgroundColor: VaultColors.brandGoldSoft, borderWidth: 1, borderColor: VaultColors.border, alignItems: "center", justifyContent: "center" },
  attName: { color: VaultColors.textPrimary, fontWeight: "900", fontSize: getFontSize(12), fontFamily: "Poppins" },
  attSub: { marginTop: scale(2), color: VaultColors.textMuted, fontWeight: "700", fontSize: getFontSize(10), fontFamily: "Poppins" },
  attRemove: { width: scale(28), height: scale(28), borderRadius: scale(14), alignItems: "center", justifyContent: "center" },

  ocrBox: { marginTop: scale(12), backgroundColor: VaultColors.appBackground, borderRadius: VaultRadius.lg, borderWidth: 1, borderColor: VaultColors.border, padding: scale(12) },
  ocrBoxHeader: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: scale(6), marginBottom: scale(6) },
  ocrTitle: { color: VaultColors.textPrimary, fontSize: getFontSize(12), fontWeight: "900", fontFamily: "Poppins" },
  ocrText: { color: VaultColors.textSecondary, fontSize: getFontSize(11), lineHeight: getFontSize(16), fontWeight: "600", fontFamily: "Poppins" },
  ocrMerchantBadge: { flexDirection: "row", alignItems: "center", gap: scale(4), paddingHorizontal: scale(8), paddingVertical: scale(3), borderRadius: VaultRadius.full, backgroundColor: VaultColors.surfaceMuted, borderWidth: 1, borderColor: VaultColors.border },
  ocrMerchantVerified: { backgroundColor: VaultColors.successSoft, borderColor: "#A8DFC0" },
  ocrMerchantText: { fontSize: getFontSize(10), color: VaultColors.textSecondary, fontWeight: "800", fontFamily: "Poppins" },
  ocrMerchantTextVerified: { color: VaultColors.success },
  ocrWeakBadge: { paddingHorizontal: scale(8), paddingVertical: scale(3), borderRadius: VaultRadius.full, backgroundColor: VaultColors.warningSoft, borderWidth: 1, borderColor: VaultColors.warning },
  ocrWeakText: { fontSize: getFontSize(10), color: VaultColors.warning, fontWeight: "900", fontFamily: "Poppins" },
  ocrStatusBox: { flexDirection: "row", alignItems: "center", gap: scale(8), marginTop: scale(10), paddingVertical: scale(10), paddingHorizontal: scale(12), backgroundColor: VaultColors.brandGoldSoft, borderRadius: VaultRadius.lg, borderWidth: 1, borderColor: VaultColors.brandGoldDark },
  ocrStatusFailed: { backgroundColor: VaultColors.errorSoft, borderColor: VaultColors.error },
  ocrStatusText: { flex: 1, fontSize: getFontSize(12), color: VaultColors.textSecondary, fontWeight: "700", fontFamily: "Poppins" },
  confRow: { flexDirection: "row", flexWrap: "wrap", gap: scale(6), marginTop: scale(10) },
  confChip: { flexDirection: "row", alignItems: "center", gap: scale(5), paddingHorizontal: scale(9), paddingVertical: scale(4), borderRadius: VaultRadius.full, backgroundColor: VaultColors.successSoft, borderWidth: 1, borderColor: "#A8DFC0" },
  confChipWeak: { backgroundColor: VaultColors.warningSoft, borderColor: VaultColors.warning },
  confDot: { width: scale(6), height: scale(6), borderRadius: scale(3) },
  confDotStrong: { backgroundColor: VaultColors.success },
  confDotWeak: { backgroundColor: VaultColors.warning },
  confChipText: { fontSize: getFontSize(10), color: VaultColors.success, fontWeight: "800", fontFamily: "Poppins" },
  confChipTextWeak: { color: VaultColors.warning },

  aiBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: scale(8), backgroundColor: VaultColors.brandGoldDark, borderRadius: VaultRadius.full, paddingVertical: scale(12), paddingHorizontal: scale(20) },
  aiBtnText: { color: VaultColors.buttonTextOnGold, fontWeight: "900", fontSize: getFontSize(13), fontFamily: "Poppins" },

  itemCard: { marginTop: scale(12), backgroundColor: VaultColors.appBackground, borderRadius: VaultRadius.lg, borderWidth: 1, borderColor: VaultColors.border, padding: scale(12) },
  itemHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: scale(8) },
  itemTitle: { color: VaultColors.textPrimary, fontWeight: "900", fontSize: getFontSize(12), fontFamily: "Poppins" },
  removeText: { color: VaultColors.error, fontWeight: "900", fontSize: getFontSize(11), fontFamily: "Poppins" },
  addLineBtn: { marginTop: scale(12), minHeight: scale(44), borderRadius: VaultRadius.lg, backgroundColor: VaultColors.appBackground, borderWidth: 1.5, borderColor: VaultColors.border, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: scale(8) },
  addLineText: { color: VaultColors.textPrimary, fontWeight: "900", fontSize: getFontSize(12), fontFamily: "Poppins" },

  tagWrap: { flexDirection: "row", flexWrap: "wrap", gap: scale(8), marginTop: scale(4) },
  tagChip: { borderRadius: scale(999), paddingHorizontal: scale(14), paddingVertical: scale(9), backgroundColor: VaultColors.appBackground, borderWidth: 1.5, borderColor: VaultColors.border },
  tagChipActive: { backgroundColor: VaultColors.brandGoldDark, borderColor: VaultColors.brandGoldDark },
  tagChipText: { color: VaultColors.textPrimary, fontSize: getFontSize(12), fontWeight: "900", fontFamily: "Poppins" },
  tagChipTextActive: { color: VaultColors.buttonTextOnGold },

  hubPickerLabel: { fontSize: getFontSize(12), color: VaultColors.textMuted, fontWeight: "700", fontFamily: "Poppins", marginTop: scale(4), marginBottom: scale(8) },
  hubPickerRow: { gap: scale(8), paddingVertical: scale(4) },
  hubChip: { paddingHorizontal: scale(14), paddingVertical: scale(10), borderRadius: VaultRadius.full, borderWidth: 1.5, borderColor: VaultColors.border, backgroundColor: VaultColors.appBackground, maxWidth: scale(180) },
  hubChipActive: { backgroundColor: VaultColors.brandGoldDark, borderColor: VaultColors.brandGoldDark },
  hubChipText: { fontSize: getFontSize(12), color: VaultColors.textPrimary, fontWeight: "800", fontFamily: "Poppins" },
  hubChipTextActive: { color: VaultColors.buttonTextOnGold },

  emptySmall: { marginTop: scale(8), color: VaultColors.textMuted, fontSize: getFontSize(12), fontWeight: "700", fontFamily: "Poppins" },

  totalCard: { marginTop: scale(14), backgroundColor: VaultColors.brandGoldSoft, borderRadius: VaultRadius.xl, borderWidth: 1.5, borderColor: VaultColors.brandGoldDark, padding: scale(14), marginBottom: scale(14) },
  totalLabel: { color: VaultColors.textSecondary, fontSize: getFontSize(12), fontWeight: "800", fontFamily: "Poppins" },
  totalValue: { marginTop: scale(4), color: VaultColors.textPrimary, fontSize: getFontSize(22), fontWeight: "900", fontFamily: "Poppins" },
});
