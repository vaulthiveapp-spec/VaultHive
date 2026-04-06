import { getDb } from "../../db/db";

const now = () => Date.now();

// ─── Service history ──────────────────────────────────────────────────────────

export async function upsertServiceRecord(userUid, record) {
  await _upsertServiceRecord(userUid, record, "pending");
}

export async function upsertServiceRecordServer(userUid, record) {
  await _upsertServiceRecord(userUid, record, "synced");
}

async function _upsertServiceRecord(userUid, record, syncStatus) {
  const db = await getDb();
  const t = now();
  await db.runAsync(
    `INSERT INTO service_history (
       user_uid, service_id, hub_id, receipt_id, warranty_id,
       title, type, service_date, note,
       created_at_ms, updated_at_ms,
       sync_status, last_synced_at, is_deleted
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
     ON CONFLICT(user_uid, service_id) DO UPDATE SET
       hub_id=excluded.hub_id,
       receipt_id=excluded.receipt_id,
       warranty_id=excluded.warranty_id,
       title=excluded.title,
       type=excluded.type,
       service_date=excluded.service_date,
       note=excluded.note,
       updated_at_ms=excluded.updated_at_ms,
       sync_status=excluded.sync_status,
       last_synced_at=excluded.last_synced_at,
       is_deleted=0`,
    [
      String(userUid),
      String(record.service_id),
      String(record.hub_id || record.purchase_hub_id || ""),
      record.receipt_id || null,
      record.warranty_id || null,
      record.title || null,
      record.type || null,
      record.service_date || null,
      record.note || null,
      Number(record.created_at_ms || record.created_at || t),
      Number(record.updated_at_ms || record.updated_at || t),
      syncStatus,
      syncStatus === "synced" ? t : null,
    ]
  );
}

export async function listServiceHistory(userUid, hubId, limit = 50) {
  const db = await getDb();
  return await db.getAllAsync(
    `SELECT * FROM service_history
     WHERE user_uid=? AND hub_id=? AND is_deleted=0
     ORDER BY service_date DESC, created_at_ms DESC
     LIMIT ?`,
    [String(userUid), String(hubId), Number(limit)]
  );
}

export async function softDeleteServiceRecord(userUid, serviceId) {
  const db = await getDb();
  await db.runAsync(
    `UPDATE service_history
     SET is_deleted=1, sync_status='pending', updated_at_ms=?
     WHERE user_uid=? AND service_id=?`,
    [now(), String(userUid), String(serviceId)]
  );
}

export async function markServiceRecordSynced(userUid, serviceId) {
  const db = await getDb();
  await db.runAsync(
    `UPDATE service_history
     SET sync_status='synced', last_synced_at=?
     WHERE user_uid=? AND service_id=?`,
    [now(), String(userUid), String(serviceId)]
  );
}

// ─── Claims ───────────────────────────────────────────────────────────────────

export async function upsertClaim(userUid, claim) {
  await _upsertClaim(userUid, claim, "pending");
}

export async function upsertClaimServer(userUid, claim) {
  await _upsertClaim(userUid, claim, "synced");
}

async function _upsertClaim(userUid, claim, syncStatus) {
  const db = await getDb();
  const t = now();
  await db.runAsync(
    `INSERT INTO claims (
       user_uid, claim_id, hub_id, warranty_id,
       kind, status, note, created_date,
       created_at_ms, updated_at_ms,
       sync_status, last_synced_at, is_deleted
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
     ON CONFLICT(user_uid, claim_id) DO UPDATE SET
       hub_id=excluded.hub_id,
       warranty_id=excluded.warranty_id,
       kind=excluded.kind,
       status=excluded.status,
       note=excluded.note,
       created_date=excluded.created_date,
       updated_at_ms=excluded.updated_at_ms,
       sync_status=excluded.sync_status,
       last_synced_at=excluded.last_synced_at,
       is_deleted=0`,
    [
      String(userUid),
      String(claim.claim_id),
      String(claim.hub_id || claim.purchase_hub_id || ""),
      claim.warranty_id || null,
      claim.kind || null,
      String(claim.status || "draft"),
      claim.note || null,
      claim.created_date || null,
      Number(claim.created_at_ms || claim.created_at || t),
      Number(claim.updated_at_ms || claim.updated_at || t),
      syncStatus,
      syncStatus === "synced" ? t : null,
    ]
  );
}

export async function listClaims(userUid, hubId, limit = 50) {
  const db = await getDb();
  return await db.getAllAsync(
    `SELECT * FROM claims
     WHERE user_uid=? AND hub_id=? AND is_deleted=0
     ORDER BY created_at_ms DESC
     LIMIT ?`,
    [String(userUid), String(hubId), Number(limit)]
  );
}

export async function softDeleteClaim(userUid, claimId) {
  const db = await getDb();
  await db.runAsync(
    `UPDATE claims SET is_deleted=1, sync_status='pending', updated_at_ms=?
     WHERE user_uid=? AND claim_id=?`,
    [now(), String(userUid), String(claimId)]
  );
}

export async function markClaimSynced(userUid, claimId) {
  const db = await getDb();
  await db.runAsync(
    `UPDATE claims SET sync_status='synced', last_synced_at=?
     WHERE user_uid=? AND claim_id=?`,
    [now(), String(userUid), String(claimId)]
  );
}
