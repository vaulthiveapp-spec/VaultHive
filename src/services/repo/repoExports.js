import { getDb } from "../../db/db";

const now = () => Date.now();

// ─── Generated exports (PDF proof packs, etc.) ────────────────────────────────

export async function upsertExport(userUid, exp) {
  const db = await getDb();
  const t = now();
  const storage = exp.storage || {};
  const file = exp.file || {};
  await db.runAsync(
    `INSERT INTO generated_exports (
       user_uid, export_id, hub_id, kind, status,
       filename, content_type, size_bytes,
       storage_bucket, storage_path, public_url,
       requested_by, generated_at,
       created_at_ms, updated_at_ms, last_synced_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_uid, export_id) DO UPDATE SET
       hub_id=excluded.hub_id,
       kind=excluded.kind,
       status=excluded.status,
       filename=excluded.filename,
       content_type=excluded.content_type,
       size_bytes=excluded.size_bytes,
       storage_bucket=excluded.storage_bucket,
       storage_path=excluded.storage_path,
       public_url=excluded.public_url,
       requested_by=excluded.requested_by,
       generated_at=excluded.generated_at,
       updated_at_ms=excluded.updated_at_ms,
       last_synced_at=excluded.last_synced_at`,
    [
      String(userUid),
      String(exp.export_id),
      exp.hub_id || exp.purchase_hub_id || null,
      exp.kind || null,
      String(exp.status || "pending"),
      file.filename || exp.filename || null,
      file.content_type || exp.content_type || null,
      Number(file.size_bytes || exp.size_bytes || 0),
      storage.bucket || exp.storage_bucket || null,
      storage.path   || exp.storage_path   || null,
      storage.public_url || exp.public_url || null,
      exp.requested_by || null,
      exp.generated_at ? new Date(exp.generated_at).getTime() : null,
      Number(exp.created_at_ms || exp.created_at || t),
      Number(exp.updated_at_ms || exp.updated_at || t),
      t,
    ]
  );
}

export async function listExports(userUid, limit = 20) {
  const db = await getDb();
  return await db.getAllAsync(
    `SELECT * FROM generated_exports
     WHERE user_uid=?
     ORDER BY created_at_ms DESC
     LIMIT ?`,
    [String(userUid), Number(limit)]
  );
}

export async function getExport(userUid, exportId) {
  const db = await getDb();
  return await db.getFirstAsync(
    `SELECT * FROM generated_exports WHERE user_uid=? AND export_id=?`,
    [String(userUid), String(exportId)]
  );
}

export async function listExportsByHub(userUid, hubId) {
  const db = await getDb();
  return await db.getAllAsync(
    `SELECT * FROM generated_exports
     WHERE user_uid=? AND hub_id=?
     ORDER BY created_at_ms DESC`,
    [String(userUid), String(hubId)]
  );
}
