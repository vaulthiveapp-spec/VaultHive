import { ref, onValue } from "firebase/database";
import { database } from "../../config/firebase";
import { upsertWarrantyServer, linkWarrantyAttachments } from "../localRepo";
import { getDb } from "../../db/db";

const now = () => Date.now();

async function reconcileWarranties(userUid, keepIds) {
  const db = await getDb();
  const rows = await db.getAllAsync(
    `SELECT warranty_id AS id FROM warranties WHERE user_uid=?`, [String(userUid)]
  );
  const keep = new Set((keepIds || []).map(String));
  for (const { id } of rows) {
    if (!keep.has(String(id))) {
      await db.runAsync(
        `UPDATE warranties SET is_deleted=1, dirty=0, updated_at=? WHERE user_uid=? AND warranty_id=?`,
        [now(), String(userUid), String(id)]
      );
    }
  }
}

export function registerListeners(userUid, unsubs) {
  unsubs.push(onValue(ref(database, `warranties/${userUid}`), async (snap) => {
    const v = snap.val() || {};
    const keep = [];
    for (const [warranty_id, data] of Object.entries(v)) {
      if (!data) continue;
      keep.push(warranty_id);
      await upsertWarrantyServer(userUid, {
        warranty_id,
        receipt_id: data.receipt_id || null,
        vendor_id: data.vendor_id || null,
        product_name: data.product_name || "",
        serial_number: data.serial_number || "",
        warranty_start: data.warranty_start || null,
        warranty_end: data.warranty_end || null,
        terms_note: data.terms_note || "",
        created_at: data.created_at || now(),
        updated_at: data.updated_at || now(),
      });
      const attIds = Object.keys(data.attachments || {}).filter((k) => !!(data.attachments || {})[k]);
      await linkWarrantyAttachments(userUid, warranty_id, attIds);
    }
    await reconcileWarranties(userUid, keep);
  }));
}
