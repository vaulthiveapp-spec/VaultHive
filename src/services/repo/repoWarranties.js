import { getDb } from "../../db/db";

const now = () => Date.now();

export async function listWarranties(userUid, limit = 50) {
  const db = await getDb();
  return await db.getAllAsync(
    `SELECT * FROM warranties
     WHERE user_uid=? AND is_deleted=0
     ORDER BY warranty_end ASC, created_at DESC
     LIMIT ?`,
    [String(userUid), Number(limit)]
  );
}

export async function listWarrantyIds(userUid) {
  const db = await getDb();
  const rows = await db.getAllAsync(
    `SELECT warranty_id FROM warranties WHERE user_uid=?`,
    [String(userUid)]
  );
  return rows.map((r) => String(r.warranty_id));
}

export async function getWarranty(userUid, warrantyId) {
  const db = await getDb();
  const warranty = await db.getFirstAsync(
    `SELECT * FROM warranties WHERE user_uid=? AND warranty_id=?`,
    [String(userUid), String(warrantyId)]
  );
  if (!warranty) return null;
  const atts = await db.getAllAsync(
    `SELECT a.* FROM attachments a
     INNER JOIN warranty_attachments wa
       ON wa.user_uid=a.user_uid AND wa.attachment_id=a.attachment_id
     WHERE wa.user_uid=? AND wa.warranty_id=?`,
    [String(userUid), String(warrantyId)]
  );
  return { warranty, attachments: atts };
}

async function _upsertWarranty(db, userUid, w, dirty) {
  const t = now();
  await db.runAsync(
    `INSERT INTO warranties (
       user_uid, warranty_id, receipt_id, vendor_id,
       product_name, serial_number, warranty_start, warranty_end,
       terms_note, created_at, updated_at, dirty, is_deleted
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
     ON CONFLICT(user_uid, warranty_id) DO UPDATE SET
       receipt_id=excluded.receipt_id,
       vendor_id=excluded.vendor_id,
       product_name=excluded.product_name,
       serial_number=excluded.serial_number,
       warranty_start=excluded.warranty_start,
       warranty_end=excluded.warranty_end,
       terms_note=excluded.terms_note,
       updated_at=excluded.updated_at,
       dirty=?,
       is_deleted=0`,
    [
      String(userUid), String(w.warranty_id),
      w.receipt_id || null, w.vendor_id || null,
      w.product_name || null, w.serial_number || null,
      w.warranty_start || null, w.warranty_end || null,
      w.terms_note || null,
      Number(w.created_at || t), Number(w.updated_at || t),
      dirty ? 1 : 0,
    ]
  );
}

export async function upsertWarranty(userUid, w) {
  const db = await getDb();
  await _upsertWarranty(db, userUid, w, true);
}

export async function upsertWarrantyServer(userUid, w) {
  const db = await getDb();
  await _upsertWarranty(db, userUid, w, false);
}

export async function linkWarrantyAttachments(userUid, warrantyId, attachmentIds) {
  const db = await getDb();
  await db.runAsync(
    `DELETE FROM warranty_attachments WHERE user_uid=? AND warranty_id=?`,
    [String(userUid), String(warrantyId)]
  );
  for (const attId of attachmentIds || []) {
    await db.runAsync(
      `INSERT INTO warranty_attachments (user_uid, warranty_id, attachment_id) VALUES (?, ?, ?)
       ON CONFLICT(user_uid, warranty_id, attachment_id) DO NOTHING`,
      [String(userUid), String(warrantyId), String(attId)]
    );
  }
}

export async function softDeleteWarranty(userUid, warrantyId) {
  const db = await getDb();
  await db.runAsync(
    `UPDATE warranties SET is_deleted=1, dirty=1, updated_at=? WHERE user_uid=? AND warranty_id=?`,
    [now(), String(userUid), String(warrantyId)]
  );
}

export async function markWarrantySynced(userUid, warrantyId) {
  const db = await getDb();
  await db.runAsync(
    `UPDATE warranties SET dirty=0, updated_at=? WHERE user_uid=? AND warranty_id=?`,
    [now(), String(userUid), String(warrantyId)]
  );
}
