import { getDb } from "../../db/db";

const now = () => Date.now();
const toLower = (s) => String(s || "").toLowerCase();

// ─── Purchase hubs ────────────────────────────────────────────────────────────

/**
 * Upsert a hub from a local user action (sync_status = 'pending').
 */
export async function upsertHub(userUid, hub) {
  await _upsertHub(userUid, hub, "pending");
}

/**
 * Upsert a hub arriving from the Firebase listener (sync_status = 'synced').
 */
export async function upsertHubServer(userUid, hub) {
  await _upsertHub(userUid, hub, "synced");
}

async function _upsertHub(userUid, hub, syncStatus) {
  const db = await getDb();
  const t = now();
  await db.runAsync(
    `INSERT INTO purchase_hubs (
       user_uid, hub_id, title, merchant_id, merchant_name, store_id,
       receipt_id, warranty_id, serial_number,
       purchase_date, return_deadline,
       total_amount, currency_code,
       fx_snapshot_rate, fx_snapshot_base,
       category_id, category_name_snapshot,
       status, note,
       service_history_count, claim_history_count,
       created_at_ms, updated_at_ms,
       sync_status, last_synced_at, is_deleted
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
     ON CONFLICT(user_uid, hub_id) DO UPDATE SET
       title=excluded.title,
       merchant_id=excluded.merchant_id,
       merchant_name=excluded.merchant_name,
       store_id=excluded.store_id,
       receipt_id=excluded.receipt_id,
       warranty_id=excluded.warranty_id,
       serial_number=excluded.serial_number,
       purchase_date=excluded.purchase_date,
       return_deadline=excluded.return_deadline,
       total_amount=excluded.total_amount,
       currency_code=excluded.currency_code,
       fx_snapshot_rate=COALESCE(excluded.fx_snapshot_rate, purchase_hubs.fx_snapshot_rate),
       fx_snapshot_base=COALESCE(excluded.fx_snapshot_base, purchase_hubs.fx_snapshot_base),
       category_id=excluded.category_id,
       category_name_snapshot=excluded.category_name_snapshot,
       status=excluded.status,
       note=excluded.note,
       service_history_count=excluded.service_history_count,
       claim_history_count=excluded.claim_history_count,
       updated_at_ms=excluded.updated_at_ms,
       sync_status=excluded.sync_status,
       last_synced_at=excluded.last_synced_at,
       is_deleted=0`,
    [
      String(userUid),
      String(hub.hub_id || hub.purchase_hub_id),
      String(hub.title || ""),
      hub.merchant_id || null,
      hub.merchant_name || null,
      hub.store_id || null,
      hub.receipt_id || null,
      hub.warranty_id || null,
      hub.serial_number || null,
      hub.purchase_date || null,
      hub.return_deadline || null,
      Number(hub.total_amount || 0),
      String(hub.currency_code || "SAR").toUpperCase(),
      hub.fx_snapshot_rate != null ? Number(hub.fx_snapshot_rate) : null,
      hub.fx_snapshot_base || null,
      hub.category_id || null,
      hub.category_name_snapshot || null,
      String(hub.status || "active"),
      hub.note || null,
      Number(hub.service_history_count || 0),
      Number(hub.claim_history_count || 0),
      Number(hub.created_at_ms || hub.created_at || t),
      Number(hub.updated_at_ms || hub.updated_at || t),
      syncStatus,
      syncStatus === "synced" ? t : null,
    ]
  );
}

export async function getHub(userUid, hubId) {
  const db = await getDb();
  return await db.getFirstAsync(
    `SELECT * FROM purchase_hubs WHERE user_uid=? AND hub_id=? AND is_deleted=0`,
    [String(userUid), String(hubId)]
  );
}

export async function listHubs(userUid, limit = 50) {
  const db = await getDb();
  return await db.getAllAsync(
    `SELECT * FROM purchase_hubs
     WHERE user_uid=? AND is_deleted=0
     ORDER BY updated_at_ms DESC, purchase_date DESC
     LIMIT ?`,
    [String(userUid), Number(limit)]
  );
}

export async function listHubsByStatus(userUid, status, limit = 50) {
  const db = await getDb();
  return await db.getAllAsync(
    `SELECT * FROM purchase_hubs
     WHERE user_uid=? AND status=? AND is_deleted=0
     ORDER BY updated_at_ms DESC
     LIMIT ?`,
    [String(userUid), String(status), Number(limit)]
  );
}

/**
 * Search + filter + sort hubs for the Vault list screen.
 *
 * @param {string} userUid
 * @param {object} opts
 * @param {string}  [opts.q]       — free-text search against title / merchant_name / category_name_snapshot
 * @param {string}  [opts.status]  — 'all' | 'active' | 'under_warranty' | 'returnable' | 'out_of_warranty' | 'expired'
 * @param {string}  [opts.sort]    — 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc' | 'title_asc'
 * @param {number}  [opts.limit]
 */
export async function listHubsFiltered(userUid, opts = {}) {
  const db    = await getDb();
  const { q = "", status = "all", sort = "date_desc", limit = 200 } = opts;

  const params = [String(userUid)];
  let whereClauses = ["user_uid=?", "is_deleted=0"];

  if (status && status !== "all") {
    whereClauses.push("status=?");
    params.push(String(status));
  }

  if (q && q.trim()) {
    const like = `%${q.trim().toLowerCase()}%`;
    whereClauses.push(
      `(lower(title) LIKE ? OR lower(merchant_name) LIKE ? OR lower(category_name_snapshot) LIKE ?)`
    );
    params.push(like, like, like);
  }

  const sortMap = {
    date_desc:   "purchase_date DESC, updated_at_ms DESC",
    date_asc:    "purchase_date ASC,  updated_at_ms ASC",
    amount_desc: "total_amount DESC",
    amount_asc:  "total_amount ASC",
    title_asc:   "lower(title) ASC",
  };
  const orderBy = sortMap[sort] || sortMap.date_desc;

  params.push(Number(limit));
  const sql = `SELECT * FROM purchase_hubs WHERE ${whereClauses.join(" AND ")} ORDER BY ${orderBy} LIMIT ?`;
  return await db.getAllAsync(sql, params);
}

/**
 * Load a hub and ALL of its related child records in a single call.
 * This is the data contract for HubDetailScreen.
 *
 * Returns:
 *   hub             — purchase_hubs row (or null)
 *   receipt         — receipts row + items + tags + attachments (or null)
 *   warranty        — warranties row + attachments (or null)
 *   serviceHistory  — service_history rows[]
 *   claims          — claims rows[]
 *   reminders       — reminders rows[]  (target_id = hub_id or linked receipt/warranty)
 *   attachments     — hub-linked attachments[] (linked_type='hub')
 *   exports         — generated_exports rows[]
 *   aiConversations — ai_conversations rows[] where linked_entity_id = hub_id
 */
export async function getHubDetail(userUid, hubId) {
  const db  = await getDb();
  const uid = String(userUid);
  const hid = String(hubId);

  const hub = await db.getFirstAsync(
    `SELECT * FROM purchase_hubs WHERE user_uid=? AND hub_id=? AND is_deleted=0`,
    [uid, hid]
  );
  if (!hub) return null;

  // ── Receipt ────────────────────────────────────────────────────────────────
  let receipt = null;
  if (hub.receipt_id) {
    const r = await db.getFirstAsync(
      `SELECT * FROM receipts WHERE user_uid=? AND receipt_id=? AND is_deleted=0`,
      [uid, String(hub.receipt_id)]
    );
    if (r) {
      const items = await db.getAllAsync(
        `SELECT * FROM receipt_items WHERE user_uid=? AND receipt_id=? ORDER BY rowid ASC`,
        [uid, r.receipt_id]
      );
      const tags = await db.getAllAsync(
        `SELECT tag_id FROM receipt_tags WHERE user_uid=? AND receipt_id=?`,
        [uid, r.receipt_id]
      );
      const atts = await db.getAllAsync(
        `SELECT a.* FROM attachments a
         INNER JOIN receipt_attachments ra ON ra.user_uid=a.user_uid AND ra.attachment_id=a.attachment_id
         WHERE ra.user_uid=? AND ra.receipt_id=?`,
        [uid, r.receipt_id]
      );
      receipt = { ...r, items: items || [], tags: (tags || []).map((t) => t.tag_id), attachments: atts || [] };
    }
  }

  // ── Warranty ───────────────────────────────────────────────────────────────
  let warranty = null;
  if (hub.warranty_id) {
    const w = await db.getFirstAsync(
      `SELECT * FROM warranties WHERE user_uid=? AND warranty_id=? AND is_deleted=0`,
      [uid, String(hub.warranty_id)]
    );
    if (w) {
      const atts = await db.getAllAsync(
        `SELECT a.* FROM attachments a
         INNER JOIN warranty_attachments wa ON wa.user_uid=a.user_uid AND wa.attachment_id=a.attachment_id
         WHERE wa.user_uid=? AND wa.warranty_id=?`,
        [uid, w.warranty_id]
      );
      warranty = { ...w, attachments: atts || [] };
    }
  }

  // ── Hub-linked attachments (linked_type = 'hub') ───────────────────────────
  const attachments = await db.getAllAsync(
    `SELECT * FROM attachments WHERE user_uid=? AND linked_type='hub' AND linked_id=?`,
    [uid, hid]
  );

  // ── Service history ────────────────────────────────────────────────────────
  const serviceHistory = await db.getAllAsync(
    `SELECT * FROM service_history WHERE user_uid=? AND hub_id=? AND is_deleted=0 ORDER BY service_date DESC, created_at_ms DESC`,
    [uid, hid]
  );

  // ── Claims ─────────────────────────────────────────────────────────────────
  const claims = await db.getAllAsync(
    `SELECT * FROM claims WHERE user_uid=? AND hub_id=? AND is_deleted=0 ORDER BY created_at_ms DESC`,
    [uid, hid]
  );

  // ── Reminders (for hub, its receipt, or its warranty) ─────────────────────
  const targetIds = [hid];
  if (hub.receipt_id)  targetIds.push(String(hub.receipt_id));
  if (hub.warranty_id) targetIds.push(String(hub.warranty_id));
  const placeholders = targetIds.map(() => "?").join(",");
  const reminders = await db.getAllAsync(
    `SELECT * FROM reminders WHERE user_uid=? AND target_id IN (${placeholders}) AND is_deleted=0 ORDER BY due_date ASC`,
    [uid, ...targetIds]
  );

  // ── Exports ────────────────────────────────────────────────────────────────
  const exports_ = await db.getAllAsync(
    `SELECT * FROM generated_exports WHERE user_uid=? AND hub_id=? ORDER BY created_at_ms DESC`,
    [uid, hid]
  );

  // ── AI Conversations linked to this hub ────────────────────────────────────
  const aiConversations = await db.getAllAsync(
    `SELECT * FROM ai_conversations WHERE user_uid=? AND linked_entity_type='hub' AND linked_entity_id=? AND status != 'archived' ORDER BY updated_at_ms DESC LIMIT 5`,
    [uid, hid]
  );

  return {
    hub,
    receipt,
    warranty,
    attachments:    attachments    || [],
    serviceHistory: serviceHistory || [],
    claims:         claims         || [],
    reminders:      reminders      || [],
    exports:        exports_       || [],
    aiConversations: aiConversations || [],
  };
}

export async function listPendingHubs(userUid) {
  const db = await getDb();
  return await db.getAllAsync(
    `SELECT * FROM purchase_hubs
     WHERE user_uid=? AND sync_status='pending' AND is_deleted=0
     ORDER BY updated_at_ms ASC`,
    [String(userUid)]
  );
}

export async function softDeleteHub(userUid, hubId) {
  const db = await getDb();
  await db.runAsync(
    `UPDATE purchase_hubs
     SET is_deleted=1, sync_status='pending', updated_at_ms=?
     WHERE user_uid=? AND hub_id=?`,
    [now(), String(userUid), String(hubId)]
  );
}

export async function markHubSynced(userUid, hubId) {
  const db = await getDb();
  await db.runAsync(
    `UPDATE purchase_hubs
     SET sync_status='synced', last_synced_at=?, updated_at_ms=?
     WHERE user_uid=? AND hub_id=?`,
    [now(), now(), String(userUid), String(hubId)]
  );
}

/**
 * Reconcile hub IDs after a Firebase snapshot: soft-delete any local hub
 * whose ID is no longer in the keepIds set.
 */
export async function reconcileHubs(userUid, keepIds) {
  const db = await getDb();
  const rows = await db.getAllAsync(
    `SELECT hub_id FROM purchase_hubs WHERE user_uid=? AND is_deleted=0`,
    [String(userUid)]
  );
  const keep = new Set((keepIds || []).map(String));
  for (const { hub_id } of rows) {
    if (!keep.has(String(hub_id))) {
      await db.runAsync(
        `UPDATE purchase_hubs
         SET is_deleted=1, sync_status='synced', updated_at_ms=?
         WHERE user_uid=? AND hub_id=?`,
        [now(), String(userUid), String(hub_id)]
      );
    }
  }
}
