/**
 * offlineActions
 *
 * All user-initiated write operations follow the same pattern:
 *   1. Write to SQLite immediately (UI is already reactive)
 *   2. Build the Firebase RTDB update object
 *   3. Enqueue to sync_queue — drained by runSyncCycle when online
 *
 * Never attempt a direct Firebase write from here. That is syncCore's job.
 */

import { makePushId } from "../utils/pushId";
import {
  upsertReceipt, replaceReceiptItems, replaceReceiptTags,
  upsertAttachment, linkReceiptAttachments, softDeleteReceipt,
  upsertWarranty, linkWarrantyAttachments, softDeleteWarranty,
  upsertHub, getHub, softDeleteHub,
  upsertReminder, softDeleteReminder,
  setFavoriteStore, upsertStoreReviewServer, upsertStoreReviewStatsServer, getStoreReviewStats,
  upsertServiceRecord, softDeleteServiceRecord,
  upsertClaim, softDeleteClaim,
  dismissAttentionItem,
  upsertConversation, getConversation, upsertMessage, updateConversationPreview,
  getUserSettings,
  getBaseCurrency,
  markNotificationRead,   // Phase 4: flip dirty locally before enqueue
} from "./localRepo";
import { buildFxSnapshot } from "./currencyService";
import { enqueueUpdates } from "./queueService";
import notificationService from "./notificationService";

const toLower = (s) => String(s || "").toLowerCase();
const monthKey = (d) => d ? String(d).slice(0, 7) : null;
const nowMs = () => Date.now();

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

async function scheduleLocalReminderIfEnabled(userUid, reminder) {
  try {
    const settings = await getUserSettings(userUid);
    if (!settings?.push_enabled) return null;
    if (reminder?.type === "return_deadline" && !settings?.notif_return_deadline) return null;
    if (reminder?.type === "warranty_expiry" && !settings?.notif_warranty_expiry) return null;
    const soundKey = String(settings?.notif_sound || "default");
    return await notificationService.scheduleReminderNotification(reminder, { soundKey });
  } catch {
    return null;
  }
}

function buildAttachmentMeta(a, linkedType, linkedId) {
  return {
    attachment_id: a.attachment_id || makePushId(),
    owner_uid: null, // filled by caller
    linked_type: linkedType,
    linked_id: linkedId,
    provider: a.provider || "supabase",
    bucket: a.bucket || "vh-attachments",
    path: a.path || null,
    public_url: a.public_url || null,
    filename: a.filename || null,
    content_type: a.content_type || null,
    size_bytes: Number(a.size_bytes || 0),
    local_uri: a.local_uri || null,
    upload_status: a.upload_status || null,
    created_at: a.created_at || nowMs(),
  };
}

function fbAttachmentNode(userUid, am, linkedType, linkedId) {
  if (!am.public_url) return null; // pending upload — syncCore handles it
  return {
    owner_uid: userUid,
    linked_type: linkedType,
    linked_id: linkedId,
    created_at: am.created_at || nowMs(),
    storage: {
      provider: am.provider || "supabase",
      bucket: am.bucket || "vh-attachments",
      path: am.path || null,
      public_url: am.public_url,
    },
    file: {
      filename: am.filename || null,
      content_type: am.content_type || null,
      size_bytes: Number(am.size_bytes || 0),
    },
  };
}

// ---------------------------------------------------------------------------
// Receipts
// ---------------------------------------------------------------------------

export async function createOrUpdateReceiptOffline(userUid, input) {
  const receiptId = input.receipt_id || makePushId();
  const createdAt = input.created_at || nowMs();

  // Capture fx rate at write time for offline-safe historical display
  const fxSnap = await buildFxSnapshot(
    String(input.currency_code || "SAR").toUpperCase(),
    String(input.fx_snapshot_base || await getBaseCurrency(userUid) || "SAR").toUpperCase(),
    null
  );

  const receipt = {
    receipt_id: receiptId,
    vendor_id: input.vendor_id || null,
    vendor_name: input.vendor_name || "",
    vendor_name_lower: toLower(input.vendor_name || ""),
    purchase_date: input.purchase_date || null,
    purchase_month: monthKey(input.purchase_date),
    total_amount: Number(input.total_amount || 0),
    currency_code: String(input.currency_code || "SAR").toUpperCase(),
    fx_snapshot_rate: input.fx_snapshot_rate != null ? Number(input.fx_snapshot_rate) : fxSnap.fx_snapshot_rate,
    fx_snapshot_base: input.fx_snapshot_base || fxSnap.fx_snapshot_base,
    category_id: Number(input.category_id || 7),
    receipt_number: input.receipt_number || "",
    return_deadline: input.return_deadline || null,
    note: input.note || "",
    ocr_raw_text: input.ocr?.raw_text || "",
    ocr_parsed_json: JSON.stringify(input.ocr?.parsed || {}),
    created_at: createdAt,
    updated_at: nowMs(),
  };

  await upsertReceipt(userUid, receipt);

  const items = (input.items || []).map((it) => ({
    item_id: it.item_id || makePushId(),
    name: it.name || "",
    qty: Number(it.qty || 1),
    unit_price: Number(it.unit_price || 0),
    total: Number(it.total || Number(it.qty || 1) * Number(it.unit_price || 0)),
  }));
  await replaceReceiptItems(userUid, receiptId, items);

  const tagIds = (input.tag_ids || []).map(Number);
  await replaceReceiptTags(userUid, receiptId, tagIds);

  const attachmentIds = [];
  const attachmentMetas = [];
  for (const a of input.attachments || []) {
    const meta = buildAttachmentMeta(a, "receipt", receiptId);
    meta.owner_uid = userUid;
    attachmentIds.push(meta.attachment_id);
    attachmentMetas.push(meta);
    await upsertAttachment(userUid, meta);
  }
  await linkReceiptAttachments(userUid, receiptId, attachmentIds);

  const updates = {};
  updates[`receipts/${userUid}/${receiptId}`] = {
    vendor_id: receipt.vendor_id,
    vendor_name: receipt.vendor_name,
    vendor_name_lower: receipt.vendor_name_lower,
    purchase_date: receipt.purchase_date,
    purchase_month: receipt.purchase_month,
    total_amount: receipt.total_amount,
    currency_code: receipt.currency_code,
    fx_snapshot_rate: receipt.fx_snapshot_rate || null,
    fx_snapshot_base: receipt.fx_snapshot_base || null,
    category_id: receipt.category_id,
    receipt_number: receipt.receipt_number,
    return_deadline: receipt.return_deadline,
    note: receipt.note,
    ocr: { raw_text: receipt.ocr_raw_text, parsed: JSON.parse(receipt.ocr_parsed_json || "{}") },
    created_at: receipt.created_at,
    updated_at: receipt.updated_at,
  };

  for (const it of items) {
    updates[`receipt_items/${userUid}/${receiptId}/${it.item_id}`] = {
      name: it.name, qty: it.qty, unit_price: it.unit_price, total: it.total,
    };
  }

  const tagsMap = {};
  for (const tagId of tagIds) tagsMap[String(tagId)] = true;
  updates[`receipts/${userUid}/${receiptId}/tags`] = tagsMap;

  const attMap = {};
  for (const attId of attachmentIds) attMap[attId] = true;
  updates[`receipts/${userUid}/${receiptId}/attachments`] = attMap;

  for (const am of attachmentMetas) {
    const node = fbAttachmentNode(userUid, am, "receipt", receiptId);
    if (node) updates[`attachments/${userUid}/${am.attachment_id}`] = node;
  }

  if (receipt.return_deadline) {
    const reminderId = input.reminder_id || makePushId();
    const reminderPayload = {
      reminder_id: reminderId,
      type: "return_deadline",
      target_type: "receipt",
      target_id: receiptId,
      due_date: receipt.return_deadline,
      lead_days: Number(input.lead_days || 3),
      status: "active",
      created_at: nowMs(),
      updated_at: nowMs(),
    };
    const localNotifId = await scheduleLocalReminderIfEnabled(userUid, reminderPayload);
    await upsertReminder(userUid, { ...reminderPayload, local_notif_id: localNotifId || null });
    updates[`reminders/${userUid}/${reminderId}`] = {
      type: "return_deadline", target_type: "receipt", target_id: receiptId,
      due_date: receipt.return_deadline, lead_days: Number(input.lead_days || 3),
      status: "active", created_at: nowMs(),
    };
  }

  await enqueueUpdates(userUid, "firebase_update", updates, {
    type: "receipt_upsert", user_uid: userUid, receipt_id: receiptId,
  });
  return receiptId;
}

export async function deleteReceiptOffline(userUid, receiptId) {
  await softDeleteReceipt(userUid, receiptId);
  await enqueueUpdates(userUid, "firebase_update", {
    [`receipts/${userUid}/${receiptId}`]: null,
    [`receipt_items/${userUid}/${receiptId}`]: null,
  }, { type: "receipt_delete", user_uid: userUid, receipt_id: receiptId });
}

// ---------------------------------------------------------------------------
// Warranties
// ---------------------------------------------------------------------------

export async function createOrUpdateWarrantyOffline(userUid, input) {
  const warrantyId = input.warranty_id || makePushId();
  const createdAt = input.created_at || nowMs();

  const warranty = {
    warranty_id: warrantyId,
    receipt_id: input.receipt_id || null,
    vendor_id: input.vendor_id || null,
    product_name: input.product_name || "",
    serial_number: input.serial_number || "",
    warranty_start: input.warranty_start || null,
    warranty_end: input.warranty_end || null,
    terms_note: input.terms_note || "",
    created_at: createdAt,
    updated_at: nowMs(),
  };

  await upsertWarranty(userUid, warranty);

  const attachmentIds = [];
  const attachmentMetas = [];
  for (const a of input.attachments || []) {
    const meta = buildAttachmentMeta(a, "warranty", warrantyId);
    meta.owner_uid = userUid;
    attachmentIds.push(meta.attachment_id);
    attachmentMetas.push(meta);
    await upsertAttachment(userUid, meta);
  }
  await linkWarrantyAttachments(userUid, warrantyId, attachmentIds);

  const updates = {};
  updates[`warranties/${userUid}/${warrantyId}`] = {
    receipt_id: warranty.receipt_id, vendor_id: warranty.vendor_id,
    product_name: warranty.product_name, serial_number: warranty.serial_number,
    warranty_start: warranty.warranty_start, warranty_end: warranty.warranty_end,
    terms_note: warranty.terms_note, created_at: warranty.created_at, updated_at: warranty.updated_at,
  };

  const attMap = {};
  for (const attId of attachmentIds) attMap[attId] = true;
  updates[`warranties/${userUid}/${warrantyId}/attachments`] = attMap;

  for (const am of attachmentMetas) {
    const node = fbAttachmentNode(userUid, am, "warranty", warrantyId);
    if (node) updates[`attachments/${userUid}/${am.attachment_id}`] = node;
  }

  if (warranty.warranty_end) {
    const reminderId = input.reminder_id || makePushId();
    const reminderPayload = {
      reminder_id: reminderId,
      type: "warranty_expiry",
      target_type: "warranty",
      target_id: warrantyId,
      due_date: warranty.warranty_end,
      lead_days: Number(input.lead_days || 30),
      status: "active",
      created_at: nowMs(),
      updated_at: nowMs(),
    };
    const localNotifId = await scheduleLocalReminderIfEnabled(userUid, reminderPayload);
    await upsertReminder(userUid, { ...reminderPayload, local_notif_id: localNotifId || null });
    updates[`reminders/${userUid}/${reminderId}`] = {
      type: "warranty_expiry", target_type: "warranty", target_id: warrantyId,
      due_date: warranty.warranty_end, lead_days: Number(input.lead_days || 30),
      status: "active", created_at: nowMs(),
    };
  }

  await enqueueUpdates(userUid, "firebase_update", updates, {
    type: "warranty_upsert", user_uid: userUid, warranty_id: warrantyId,
  });
  return warrantyId;
}

export async function deleteWarrantyOffline(userUid, warrantyId) {
  await softDeleteWarranty(userUid, warrantyId);
  await enqueueUpdates(userUid, "firebase_update", {
    [`warranties/${userUid}/${warrantyId}`]: null,
  }, { type: "warranty_delete", user_uid: userUid, warranty_id: warrantyId });
}

// ---------------------------------------------------------------------------
// Purchase hubs
// ---------------------------------------------------------------------------

export async function createOrUpdatePurchaseHubOffline(userUid, input) {
  const hubId = input.hub_id || input.purchase_hub_id || makePushId();
  const t = nowMs();

  // Capture fx rate at write time
  const hubFxSnap = await buildFxSnapshot(
    String(input.currency_code || "SAR").toUpperCase(),
    String(await getBaseCurrency(userUid) || "SAR").toUpperCase(),
    null
  );

  const hub = {
    hub_id: hubId,
    title: input.title || "",
    merchant_id: input.merchant_id || null,
    merchant_name: input.merchant_name || null,
    store_id: input.store_id || null,
    receipt_id: input.receipt_id || null,
    warranty_id: input.warranty_id || null,
    serial_number: input.serial_number || null,
    purchase_date: input.purchase_date || null,
    return_deadline: input.return_deadline || null,
    total_amount: Number(input.total_amount || 0),
    currency_code: String(input.currency_code || "SAR").toUpperCase(),
    fx_snapshot_rate: input.fx_snapshot_rate != null ? Number(input.fx_snapshot_rate) : hubFxSnap.fx_snapshot_rate,
    fx_snapshot_base: input.fx_snapshot_base || hubFxSnap.fx_snapshot_base,
    category_id: input.category_id || null,
    category_name_snapshot: input.category_name_snapshot || null,
    status: input.status || "active",
    note: input.note || null,
    service_history_count: Number(input.service_history_count || 0),
    claim_history_count: Number(input.claim_history_count || 0),
    created_at_ms: input.created_at_ms || t,
    updated_at_ms: t,
  };

  await upsertHub(userUid, hub);

  const updates = {};
  updates[`purchase_hubs/${userUid}/${hubId}`] = {
    title: hub.title,
    merchant_id: hub.merchant_id,
    merchant_name: hub.merchant_name,
    store_id: hub.store_id,
    receipt_id: hub.receipt_id,
    warranty_id: hub.warranty_id,
    serial_number: hub.serial_number,
    purchase_date: hub.purchase_date,
    return_deadline: hub.return_deadline,
    total_amount: hub.total_amount,
    currency_code: hub.currency_code,
    fx_snapshot_rate: hub.fx_snapshot_rate || null,
    fx_snapshot_base: hub.fx_snapshot_base || null,
    category_id: hub.category_id,
    category_name_snapshot: hub.category_name_snapshot,
    status: hub.status,
    note: hub.note,
    service_history_count: hub.service_history_count,
    claim_history_count: hub.claim_history_count,
    created_at_ms: hub.created_at_ms,
    updated_at_ms: hub.updated_at_ms,
  };

  // If hub creation also creates a return-deadline reminder
  if (hub.return_deadline && input.create_return_reminder !== false) {
    const reminderId = makePushId();
    const reminderPayload = {
      reminder_id: reminderId,
      type: "return_deadline",
      target_type: "purchase_hub",
      target_id: hubId,
      due_date: hub.return_deadline,
      lead_days: Number(input.lead_days || 3),
      status: "active",
      created_at: t,
      updated_at: t,
    };
    const localNotifId = await scheduleLocalReminderIfEnabled(userUid, reminderPayload);
    await upsertReminder(userUid, { ...reminderPayload, local_notif_id: localNotifId || null });
    updates[`reminders/${userUid}/${reminderId}`] = {
      type: "return_deadline", target_type: "purchase_hub", target_id: hubId,
      due_date: hub.return_deadline, lead_days: Number(input.lead_days || 3),
      status: "active", created_at: t,
    };
  }

  await enqueueUpdates(userUid, "firebase_update", updates, {
    type: "hub_upsert", user_uid: userUid, hub_id: hubId,
  });
  return hubId;
}

export async function deletePurchaseHubOffline(userUid, hubId) {
  await softDeleteHub(userUid, hubId);
  await enqueueUpdates(userUid, "firebase_update", {
    [`purchase_hubs/${userUid}/${hubId}`]: null,
  }, { type: "hub_delete", user_uid: userUid, hub_id: hubId });
}

// ---------------------------------------------------------------------------
// Service history
// ---------------------------------------------------------------------------

export async function addServiceHistoryOffline(userUid, input) {
  const serviceId = input.service_id || makePushId();
  const t = nowMs();

  const record = {
    service_id: serviceId,
    hub_id: input.hub_id || input.purchase_hub_id || "",
    receipt_id: input.receipt_id || null,
    warranty_id: input.warranty_id || null,
    title: input.title || null,
    type: input.type || null,
    service_date: input.service_date || null,
    note: input.note || null,
    created_at_ms: t,
    updated_at_ms: t,
  };

  await upsertServiceRecord(userUid, record);

  const updates = {};
  updates[`service_history/${userUid}/${serviceId}`] = {
    purchase_hub_id: record.hub_id,
    receipt_id: record.receipt_id,
    warranty_id: record.warranty_id,
    title: record.title,
    type: record.type,
    service_date: record.service_date,
    note: record.note,
    created_at_ms: record.created_at_ms,
    updated_at_ms: record.updated_at_ms,
  };

  // Update counter on the hub using locally-computed absolute value.
  // Server values ({".sv":"increment"}) get JSON-serialized in sync_queue
  // and lose their special meaning when deserialized — always use absolute values.
  if (record.hub_id) {
    try {
      const hub = await getHub(userUid, record.hub_id);
      const nextCount = Number(hub?.service_history_count || 0) + 1;
      updates[`purchase_hubs/${userUid}/${record.hub_id}/service_history_count`] = nextCount;
    } catch {
      // Hub not found locally yet — omit the counter update; Firebase listener
      // will correct it when the hub syncs down.
    }
  }

  await enqueueUpdates(userUid, "firebase_update", updates, {
    type: "service_upsert", user_uid: userUid, service_id: serviceId, hub_id: record.hub_id,
  });
  return serviceId;
}

export async function deleteServiceHistoryOffline(userUid, serviceId) {
  await softDeleteServiceRecord(userUid, serviceId);
  await enqueueUpdates(userUid, "firebase_update", {
    [`service_history/${userUid}/${serviceId}`]: null,
  }, { type: "service_delete", user_uid: userUid, service_id: serviceId });
}

// ---------------------------------------------------------------------------
// Claims
// ---------------------------------------------------------------------------

export async function createOrUpdateClaimOffline(userUid, input) {
  const claimId = input.claim_id || makePushId();
  const t = nowMs();

  const claim = {
    claim_id: claimId,
    hub_id: input.hub_id || input.purchase_hub_id || "",
    warranty_id: input.warranty_id || null,
    kind: input.kind || null,
    status: input.status || "draft",
    note: input.note || null,
    created_date: input.created_date || new Date().toISOString().slice(0, 10),
    created_at_ms: t,
    updated_at_ms: t,
  };

  await upsertClaim(userUid, claim);

  const updates = {};
  updates[`claims/${userUid}/${claimId}`] = {
    purchase_hub_id: claim.hub_id,
    warranty_id: claim.warranty_id,
    kind: claim.kind,
    status: claim.status,
    note: claim.note,
    created_date: claim.created_date,
    created_at_ms: claim.created_at_ms,
    updated_at_ms: claim.updated_at_ms,
  };

  // Update counter on the hub using locally-computed absolute value.
  if (claim.hub_id) {
    try {
      const hub = await getHub(userUid, claim.hub_id);
      const nextCount = Number(hub?.claim_history_count || 0) + 1;
      updates[`purchase_hubs/${userUid}/${claim.hub_id}/claim_history_count`] = nextCount;
    } catch {
      // Hub not found locally yet — omit the counter update.
    }
  }

  await enqueueUpdates(userUid, "firebase_update", updates, {
    type: "claim_upsert", user_uid: userUid, claim_id: claimId, hub_id: claim.hub_id,
  });
  return claimId;
}

export async function deleteClaimOffline(userUid, claimId) {
  await softDeleteClaim(userUid, claimId);
  await enqueueUpdates(userUid, "firebase_update", {
    [`claims/${userUid}/${claimId}`]: null,
  }, { type: "claim_delete", user_uid: userUid, claim_id: claimId });
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export async function markNotificationReadOffline(userUid, notificationId) {
  // Optimistic local flip (dirty=1 → synced later)
  await markNotificationRead(userUid, notificationId).catch(() => {});
  await enqueueUpdates(userUid, "firebase_update", {
    [`notifications/${userUid}/${notificationId}/status`]: "Read",
  }, { type: "notification_read", user_uid: userUid, notification_id: notificationId });
}

// ---------------------------------------------------------------------------
// Favorites
// ---------------------------------------------------------------------------

export async function toggleFavoriteStoreOffline(userUid, storeId, nextIsOn) {
  await setFavoriteStore(userUid, storeId, !!nextIsOn);
  await enqueueUpdates(userUid, "firebase_update", {
    [`user_favorites/${userUid}/stores/${storeId}`]: nextIsOn ? true : null,
  }, { type: "favorite_toggle", user_uid: userUid, store_id: storeId, is_on: !!nextIsOn });
}

// ---------------------------------------------------------------------------
// Store reviews
// ---------------------------------------------------------------------------

export async function addStoreReviewOffline(userUid, storeId, { rating = 0, comment = "" } = {}) {
  const reviewId = makePushId();
  const createdAt = nowMs();
  const cleanRating = Math.max(1, Math.min(5, Number(rating || 0)));
  const cleanComment = String(comment || "").trim();

  await upsertStoreReviewServer(storeId, reviewId, { uid: userUid, rating: cleanRating, comment: cleanComment, created_at: createdAt });

  let nextAvg = cleanRating, nextCount = 1;
  try {
    const prev = await getStoreReviewStats(storeId);
    const prevAvg = Number(prev?.avg_rating || 0);
    const prevCount = Number(prev?.count || 0);
    nextCount = prevCount + 1;
    nextAvg = (prevAvg * prevCount + cleanRating) / nextCount;
  } catch {}

  await upsertStoreReviewStatsServer(storeId, {
    avg_rating: Number(nextAvg.toFixed(2)),
    count: nextCount,
    updated_at: nowMs(),
  });

  await enqueueUpdates(userUid, "firebase_update", {
    [`store_reviews/${storeId}/${reviewId}`]: { uid: userUid, rating: cleanRating, comment: cleanComment, created_at: createdAt },
    [`store_review_stats/${storeId}`]: { avg_rating: Number(nextAvg.toFixed(2)), count: nextCount, updated_at: nowMs() },
  }, { type: "store_review_add", user_uid: userUid, store_id: storeId, review_id: reviewId });

  return reviewId;
}

// ---------------------------------------------------------------------------
// Attention items
// ---------------------------------------------------------------------------

export async function dismissAttentionItemOffline(userUid, attentionId) {
  // Optimistic local dismiss — server confirms on next sync via reconciliation
  await dismissAttentionItem(userUid, attentionId);
  // No Firebase write needed: the item will be removed from attention_items/{uid}
  // by the server-side resolution function. We do not author attention items.
}

// ---------------------------------------------------------------------------
// AI conversations
// ---------------------------------------------------------------------------

export async function createAIConversationOffline(userUid, input) {
  const conversationId = input.conversation_id || makePushId();
  const t = nowMs();

  const conv = {
    conversation_id: conversationId,
    title: input.title || null,
    status: "active",
    screen_context: input.screen_context || null,
    linked_entity: input.linked_entity || null,
    message_count: 0,
    created_at_ms: t,
    updated_at_ms: t,
  };

  await upsertConversation(userUid, conv);

  await enqueueUpdates(userUid, "firebase_update", {
    [`ai_conversations/${userUid}/${conversationId}`]: {
      title: conv.title,
      status: conv.status,
      screen_context: conv.screen_context,
      linked_entity: conv.linked_entity,
      message_count: 0,
      created_at_ms: conv.created_at_ms,
      updated_at_ms: conv.updated_at_ms,
    },
  }, { type: "ai_conversation_create", user_uid: userUid, conversation_id: conversationId });

  return conversationId;
}

export async function appendAIMessageOffline(userUid, conversationId, input) {
  const messageId = input.message_id || makePushId();
  const t = nowMs();

  const msg = {
    message_id: messageId,
    conversation_id: conversationId,
    role: input.role || "user",
    text: input.text || null,
    structured_json: input.structured ? JSON.stringify(input.structured) : null,
    attachment_json: input.attachment ? JSON.stringify(input.attachment) : null,
    message_status: input.message_status || "complete",
    created_at_ms: t,
    updated_at_ms: t,
  };

  await upsertMessage(userUid, msg);
  await updateConversationPreview(userUid, conversationId, input.text || "", input.summary || null);

  await enqueueUpdates(userUid, "firebase_update", {
    [`ai_conversations/${userUid}/${conversationId}/messages/${messageId}`]: {
      role: msg.role,
      text: msg.text,
      message_status: msg.message_status,
      created_at_ms: msg.created_at_ms,
      updated_at_ms: msg.updated_at_ms,
    },
    [`ai_conversations/${userUid}/${conversationId}/message_count`]: await (async () => {
      try {
        const conv = await getConversation(userUid, conversationId);
        return Number(conv?.message_count || 0) + 1;
      } catch { return 1; }
    })(),
    [`ai_conversations/${userUid}/${conversationId}/updated_at_ms`]: t,
  }, { type: "ai_message_append", user_uid: userUid, conversation_id: conversationId, message_id: messageId });

  return messageId;
}
// ---------------------------------------------------------------------------
// Standalone reminders
// ---------------------------------------------------------------------------

/**
 * Create or update a reminder that is not auto-generated by a receipt or
 * warranty save. Used by AddReminderScreen.
 *
 * @param {string} userUid
 * @param {object} input
 *   reminder_id?    — omit to create new
 *   type            — "return_deadline" | "warranty_expiry" | "custom"
 *   target_type?    — "receipt" | "warranty" | "hub" | null
 *   target_id?      — foreign key for target_type
 *   due_date        — "YYYY-MM-DD"
 *   lead_days?      — advance notification days (default 1)
 *   note?           — human-readable label
 */
export async function createStandaloneReminderOffline(userUid, input) {
  const reminderId = input.reminder_id || makePushId();
  const t = nowMs();

  const reminder = {
    reminder_id:  reminderId,
    type:         input.type        || "custom",
    target_type:  input.target_type || null,
    target_id:    input.target_id   || null,
    due_date:     input.due_date    || null,
    lead_days:    Number(input.lead_days || 1),
    status:       "active",
    created_at:   t,
    updated_at:   t,
  };

  const localNotifId = await scheduleLocalReminderIfEnabled(userUid, reminder);
  await upsertReminder(userUid, { ...reminder, local_notif_id: localNotifId || null });

  await enqueueUpdates(userUid, "firebase_update", {
    [`reminders/${userUid}/${reminderId}`]: {
      type:        reminder.type,
      target_type: reminder.target_type,
      target_id:   reminder.target_id,
      due_date:    reminder.due_date,
      lead_days:   reminder.lead_days,
      status:      reminder.status,
      note:        input.note || null,
      created_at:  t,
    },
  }, { type: "reminder_upsert", user_uid: userUid, reminder_id: reminderId });

  return reminderId;
}

/**
 * Soft-delete a reminder and remove its Firebase node.
 */
export async function deleteReminderOffline(userUid, reminderId) {
  await softDeleteReminder(userUid, reminderId);
  await enqueueUpdates(userUid, "firebase_update", {
    [`reminders/${userUid}/${reminderId}`]: null,
  }, { type: "reminder_delete", user_uid: userUid, reminder_id: reminderId });
}
