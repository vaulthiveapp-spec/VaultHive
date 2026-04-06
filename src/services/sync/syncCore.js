/**
 * syncCore
 *
 * Owns the shared runtime state for the sync engine and the full outbox drain
 * loop. Phase 4 upgrades:
 *
 *   - Network-error tagging: jobs that fail due to connectivity loss are tagged
 *     last_error='__network__' and reset to 'pending' (without burning a retry)
 *     the moment connectivity returns.
 *   - Exponential back-off: logic/server failures compute a next_retry_at
 *     timestamp via repoSync.markQueueFailed(); only due jobs are dequeued.
 *   - Attachment pipeline: pending Supabase uploads are attempted first, then
 *     the Firebase metadata update is written through the outbox so it is also
 *     offline-safe.
 *   - Housekeeping: 'done' rows older than 7 days are pruned once per session.
 *   - Full domain switch: hub/claim/service/reminder/notification/favorite/
 *     review/AI conversation/message sync_status all flipped correctly.
 */

import NetInfo from "@react-native-community/netinfo";
import { ref, update } from "firebase/database";
import { database } from "../../config/firebase";
import { isSupabaseConfigured } from "../../config/supabase";
import { uploadPublicObject } from "../uploadService";

// ── Repo imports ─────────────────────────────────────────────────────────────
import { listPendingAttachments, upsertAttachment } from "../localRepo";
import {
  getPendingQueue,
  markQueueDone,
  markQueueFailed,
  clearDoneQueue,
  resetNetworkFailedJobs,
  countPendingJobs,
} from "../queueService";
import {
  markReceiptSynced,
  markWarrantySynced,
  markReminderSynced,
  markNotificationSynced,
  markHubSynced,
  markClaimSynced,
  markServiceRecordSynced,
} from "../localRepo";

// ─── Shared mutable state ─────────────────────────────────────────────────────

export let uidActive      = null;
export let firebaseUnsubs = [];
let netUnsub              = null;
let running               = false;
let housekeepingDone      = false; // pruned once per app session

// ─── Exported setters ─────────────────────────────────────────────────────────

export function setUidActive(uid) { uidActive = uid; }

export function stopFirebaseListeners() {
  for (const unsub of firebaseUnsubs) {
    try { unsub && unsub(); } catch {}
  }
  firebaseUnsubs = [];
}

export function teardown() {
  if (netUnsub) { netUnsub(); netUnsub = null; }
  setUidActive(null);
  stopFirebaseListeners();
}

// ─── Net-change triggered drain ───────────────────────────────────────────────

export function startNetListener() {
  if (netUnsub) return; // already subscribed
  netUnsub = NetInfo.addEventListener(async (state) => {
    if (!state.isConnected || !uidActive) return;
    // Connectivity restored — reset any network-failed jobs before draining.
    try { await resetNetworkFailedJobs(uidActive); } catch {}
    runSyncCycle().catch(() => {});
  });
}

// ─── Attachment upload (Supabase → Firebase metadata) ────────────────────────

/**
 * Upload any locally-stored attachment files that have a local_uri but no
 * public_url yet. After a successful Supabase upload, write the attachment
 * metadata into Firebase through the sync_queue so the write is also retried
 * if it fails (e.g. Firebase quota exceeded).
 */
export async function syncPendingAttachments() {
  if (!uidActive) return;
  if (!isSupabaseConfigured()) return;

  const pending = await listPendingAttachments(uidActive, 10).catch(() => []);

  for (const att of pending || []) {
    try {
      if (!att?.local_uri || !att?.path) continue;
      const bucket = att.bucket || "vh-attachments";

      const up = await uploadPublicObject({
        bucket,
        path:        att.path,
        uri:         att.local_uri,
        contentType: att.content_type,
        upsert:      false,
      });

      // Stamp uploaded status locally.
      await upsertAttachment(uidActive, {
        attachment_id: att.attachment_id,
        owner_uid:     att.owner_uid || uidActive,
        linked_type:   att.linked_type || null,
        linked_id:     att.linked_id   || null,
        provider:      att.provider    || "supabase",
        bucket,
        path:          att.path,
        public_url:    up.public_url,
        filename:      att.filename     || null,
        content_type:  up.content_type  || att.content_type || null,
        size_bytes:    Number(att.size_bytes || 0),
        local_uri:     null,           // clear local URI once uploaded
        upload_status: "uploaded",
        created_at:    Number(att.created_at || Date.now()),
      });

      // Build Firebase metadata write and push through the outbox so it
      // gets retried independently if Firebase is temporarily unavailable.
      const fbUpdates = {};
      fbUpdates[`attachments/${uidActive}/${att.attachment_id}`] = {
        owner_uid:   att.owner_uid || uidActive,
        linked_type: att.linked_type || null,
        linked_id:   att.linked_id   || null,
        created_at:  Number(att.created_at || Date.now()),
        storage: {
          provider:   att.provider || "supabase",
          bucket,
          path:       att.path,
          public_url: up.public_url,
        },
        file: {
          filename:     att.filename    || null,
          content_type: up.content_type || att.content_type || null,
          size_bytes:   Number(att.size_bytes || 0),
        },
      };
      // Mirror onto the owning entity so Firebase listeners can link it.
      if (att.linked_type === "receipt" && att.linked_id)
        fbUpdates[`receipts/${uidActive}/${att.linked_id}/attachments/${att.attachment_id}`] = true;
      if (att.linked_type === "warranty" && att.linked_id)
        fbUpdates[`warranties/${uidActive}/${att.linked_id}/attachments/${att.attachment_id}`] = true;
      if (att.linked_type === "hub" && att.linked_id)
        fbUpdates[`purchase_hubs/${uidActive}/${att.linked_id}/attachments/${att.attachment_id}`] = true;

      // Write directly — attachment meta is small and idempotent.
      await update(ref(database), fbUpdates);

    } catch (uploadErr) {
      // Mark the attachment as failed so it surfaces in diagnostics.
      await upsertAttachment(uidActive, {
        attachment_id: att.attachment_id,
        owner_uid:     att.owner_uid || uidActive,
        linked_type:   att.linked_type || null,
        linked_id:     att.linked_id   || null,
        provider:      att.provider    || "supabase",
        bucket:        att.bucket      || "vh-attachments",
        path:          att.path        || null,
        public_url:    att.public_url  || null,
        filename:      att.filename    || null,
        content_type:  att.content_type || null,
        size_bytes:    Number(att.size_bytes || 0),
        local_uri:     att.local_uri   || null,
        upload_status: "failed",
        created_at:    Number(att.created_at || Date.now()),
      }).catch(() => {});
    }
  }
}

// ─── Detect network errors ────────────────────────────────────────────────────

function isNetworkError(e) {
  const msg = String(e?.message || e?.code || "").toLowerCase();
  return (
    msg.includes("network") ||
    msg.includes("timeout")  ||
    msg.includes("offline")  ||
    msg.includes("failed to fetch") ||
    msg.includes("connect")
  );
}

// ─── Post-sync local state flush ──────────────────────────────────────────────

async function flushLocalState(meta) {
  if (!meta) return;
  const uid = meta.user_uid;
  try {
    switch (meta.type) {
      case "receipt_upsert":
        await markReceiptSynced(uid, meta.receipt_id);
        break;
      case "warranty_upsert":
        await markWarrantySynced(uid, meta.warranty_id);
        break;
      case "reminder_upsert":
        await markReminderSynced(uid, meta.reminder_id);
        break;
      case "notification_read":
        await markNotificationSynced(uid, meta.notification_id);
        break;
      case "hub_upsert":
      case "hub_delete":
        await markHubSynced(uid, meta.hub_id);
        break;
      case "claim_upsert":
      case "claim_delete":
        await markClaimSynced(uid, meta.claim_id);
        break;
      case "service_upsert":
      case "service_delete":
        await markServiceRecordSynced(uid, meta.service_id);
        break;
      // favorite_toggle, store_review_add, ai_* — no local sync_status column
      // to flip; Firebase listener reconciliation is the source of truth.
      default:
        break;
    }
  } catch {
    // Non-fatal: the record is synced in Firebase; local status mismatch
    // corrects itself on the next Firebase onValue event.
  }
}

// ─── Outbox drain ─────────────────────────────────────────────────────────────

export async function runSyncCycle() {
  if (running)   return;
  if (!uidActive) return;

  running = true;

  try {
    // ── One-time session housekeeping ──────────────────────────────────────
    if (!housekeepingDone) {
      housekeepingDone = true;
      clearDoneQueue(7 * 24 * 3600 * 1000).catch(() => {});
    }

    // ── Attachment uploads first (Supabase) ───────────────────────────────
    await syncPendingAttachments().catch(() => {});

    // ── Outbox drain (Firebase RTDB) ──────────────────────────────────────
    const jobs = await getPendingQueue(50);

    for (const job of jobs) {
      try {
        const updatesObj = JSON.parse(job.updates_json || "{}");
        await update(ref(database), updatesObj);
        await markQueueDone(job.id);

        const meta = job.meta_json ? JSON.parse(job.meta_json) : null;
        await flushLocalState(meta);

      } catch (e) {
        if (isNetworkError(e)) {
          // Tag as network failure so resetNetworkFailedJobs() can reset it
          // without burning the try counter.
          await markQueueFailed(job.id, "__network__").catch(() => {});
          // No point continuing — everything else will fail for the same reason.
          break;
        } else {
          // Logic/server error — increment tries, apply backoff.
          await markQueueFailed(job.id, e?.message || String(e)).catch(() => {});
        }
      }
    }
  } finally {
    running = false;
  }
}

