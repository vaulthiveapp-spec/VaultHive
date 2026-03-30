import { ref, onValue } from "firebase/database";
import { database } from "../../config/firebase";
import {
  upsertReceiptServer,
  replaceReceiptItems,
  replaceReceiptTags,
  linkReceiptAttachments,
  upsertAttachment,
  upsertVendorServer,
} from "../localRepo";
import { getDb } from "../../db/db";

const now = () => Date.now();
const monthKey = (d) => { const s = String(d || ""); return s.length >= 7 ? s.slice(0, 7) : null; };

async function reconcileTable(tableName, idColumn, userUid, keepIds) {
  const db = await getDb();
  const rows = await db.getAllAsync(
    `SELECT ${idColumn} AS id FROM ${tableName} WHERE user_uid=?`, [String(userUid)]
  );
  const keep = new Set((keepIds || []).map(String));
  for (const { id } of rows) {
    if (!keep.has(String(id))) {
      await db.runAsync(
        `UPDATE ${tableName} SET is_deleted=1, dirty=0, updated_at=? WHERE user_uid=? AND ${idColumn}=?`,
        [now(), String(userUid), String(id)]
      );
    }
  }
}

export function registerListeners(userUid, unsubs) {
  // ── Receipts ─────────────────────────────────────────────────────────────────
  unsubs.push(onValue(ref(database, `receipts/${userUid}`), async (snap) => {
    const v = snap.val() || {};
    const keep = [];
    for (const [receipt_id, data] of Object.entries(v)) {
      if (!data) continue;
      keep.push(receipt_id);
      const ocr = data.ocr || {};
      await upsertReceiptServer(userUid, {
        receipt_id,
        vendor_id: data.vendor_id || null,
        vendor_name: data.vendor_name || "",
        purchase_date: data.purchase_date || null,
        purchase_month: data.purchase_month || monthKey(data.purchase_date),
        total_amount: data.total_amount || 0,
        currency_code: data.currency_code || "SAR",
        fx_snapshot_rate: data.fx_snapshot_rate != null ? Number(data.fx_snapshot_rate) : null,
        fx_snapshot_base: data.fx_snapshot_base || null,
        category_id: data.category_id || 7,
        receipt_number: data.receipt_number || "",
        return_deadline: data.return_deadline || null,
        note: data.note || "",
        ocr_raw_text: ocr.raw_text || "",
        ocr_parsed_json: JSON.stringify(ocr.parsed || {}),
        created_at: data.created_at || now(),
        updated_at: data.updated_at || now(),
      });
      const tagIds = Object.keys(data.tags || {}).filter((k) => !!(data.tags || {})[k]).map(Number);
      await replaceReceiptTags(userUid, receipt_id, tagIds);
      const attIds = Object.keys(data.attachments || {}).filter((k) => !!(data.attachments || {})[k]);
      await linkReceiptAttachments(userUid, receipt_id, attIds);
    }
    await reconcileTable("receipts", "receipt_id", userUid, keep);
  }));

  // ── Receipt line items ───────────────────────────────────────────────────────
  unsubs.push(onValue(ref(database, `receipt_items/${userUid}`), async (snap) => {
    const v = snap.val() || {};
    for (const [receipt_id, itemsObj] of Object.entries(v)) {
      const items = Object.entries(itemsObj || {})
        .filter(([, it]) => !!it)
        .map(([item_id, it]) => ({
          item_id,
          name: it.name || "",
          qty: Number(it.qty || 1),
          unit_price: Number(it.unit_price || 0),
          total: Number(it.total || 0),
        }));
      await replaceReceiptItems(userUid, receipt_id, items);
    }
  }));

  // ── Attachments ──────────────────────────────────────────────────────────────
  unsubs.push(onValue(ref(database, `attachments/${userUid}`), async (snap) => {
    const v = snap.val() || {};
    for (const [attachment_id, data] of Object.entries(v)) {
      if (!data) continue;
      const storage = data.storage || {};
      const file = data.file || {};
      await upsertAttachment(userUid, {
        attachment_id,
        owner_uid: data.owner_uid || userUid,
        linked_type: data.linked_type || null,
        linked_id: data.linked_id || null,
        provider: storage.provider || null,
        bucket: storage.bucket || null,
        path: storage.path || null,
        public_url: storage.public_url || null,
        filename: file.filename || null,
        content_type: file.content_type || null,
        size_bytes: file.size_bytes || 0,
        local_uri: null,
        upload_status: null,
        created_at: data.created_at || now(),
      });
    }
  }));

  // ── Legacy vendors ───────────────────────────────────────────────────────────
  unsubs.push(onValue(ref(database, `vendors/${userUid}`), async (snap) => {
    const v = snap.val() || {};
    for (const [vendor_id, data] of Object.entries(v)) {
      if (!data) continue;
      await upsertVendorServer(userUid, {
        vendor_id,
        name: data.name || "",
        phone: data.phone || "",
        address: data.address || "",
        created_at: data.created_at || now(),
      });
    }
  }));
}
