import { getDb } from "../../db/db";

const now = () => Date.now();
const toLower = (s) => String(s || "").toLowerCase();
const monthKey = (dateStr) => {
  const s = String(dateStr || "");
  return s.length >= 7 ? s.slice(0, 7) : null;
};

// ─── Receipts ─────────────────────────────────────────────────────────────────

export async function listReceipts(userUid, limit = 50) {
  const db = await getDb();
  return await db.getAllAsync(
    `SELECT * FROM receipts
     WHERE user_uid=? AND is_deleted=0
     ORDER BY purchase_date DESC, created_at DESC
     LIMIT ?`,
    [String(userUid), Number(limit)]
  );
}

export async function listReceiptIds(userUid) {
  const db = await getDb();
  const rows = await db.getAllAsync(
    `SELECT receipt_id FROM receipts WHERE user_uid=?`,
    [String(userUid)]
  );
  return rows.map((r) => String(r.receipt_id));
}

export async function getReceipt(userUid, receiptId) {
  const db = await getDb();
  const receipt = await db.getFirstAsync(
    `SELECT * FROM receipts WHERE user_uid=? AND receipt_id=?`,
    [String(userUid), String(receiptId)]
  );
  if (!receipt) return null;
  const items = await db.getAllAsync(
    `SELECT * FROM receipt_items WHERE user_uid=? AND receipt_id=? ORDER BY rowid ASC`,
    [String(userUid), String(receiptId)]
  );
  const tags = await db.getAllAsync(
    `SELECT tag_id FROM receipt_tags WHERE user_uid=? AND receipt_id=?`,
    [String(userUid), String(receiptId)]
  );
  const atts = await db.getAllAsync(
    `SELECT a.* FROM attachments a
     INNER JOIN receipt_attachments ra
       ON ra.user_uid=a.user_uid AND ra.attachment_id=a.attachment_id
     WHERE ra.user_uid=? AND ra.receipt_id=?`,
    [String(userUid), String(receiptId)]
  );
  const warranties = await db.getAllAsync(
    `SELECT * FROM warranties WHERE user_uid=? AND receipt_id=? AND is_deleted=0 ORDER BY warranty_end ASC`,
    [String(userUid), String(receiptId)]
  );
  return { receipt, items, tags: tags.map((t) => t.tag_id), attachments: atts, warranties };
}

async function _upsertReceipt(db, userUid, receipt, dirty) {
  const t = now();
  await db.runAsync(
    `INSERT INTO receipts (
       user_uid, receipt_id, vendor_id, vendor_name, vendor_name_lower,
       purchase_date, purchase_month, total_amount, currency_code,
       fx_snapshot_rate, fx_snapshot_base,
       category_id, receipt_number, return_deadline, note,
       ocr_raw_text, ocr_parsed_json, created_at, updated_at, dirty, is_deleted
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
     ON CONFLICT(user_uid, receipt_id) DO UPDATE SET
       vendor_id=excluded.vendor_id,
       vendor_name=excluded.vendor_name,
       vendor_name_lower=excluded.vendor_name_lower,
       purchase_date=excluded.purchase_date,
       purchase_month=excluded.purchase_month,
       total_amount=excluded.total_amount,
       currency_code=excluded.currency_code,
       fx_snapshot_rate=COALESCE(excluded.fx_snapshot_rate, receipts.fx_snapshot_rate),
       fx_snapshot_base=COALESCE(excluded.fx_snapshot_base, receipts.fx_snapshot_base),
       category_id=excluded.category_id,
       receipt_number=excluded.receipt_number,
       return_deadline=excluded.return_deadline,
       note=excluded.note,
       ocr_raw_text=excluded.ocr_raw_text,
       ocr_parsed_json=excluded.ocr_parsed_json,
       updated_at=excluded.updated_at,
       dirty=?,
       is_deleted=0`,
    [
      String(userUid),
      String(receipt.receipt_id),
      receipt.vendor_id || null,
      receipt.vendor_name || null,
      toLower(receipt.vendor_name || ""),
      receipt.purchase_date || null,
      receipt.purchase_month || monthKey(receipt.purchase_date),
      Number(receipt.total_amount || 0),
      String(receipt.currency_code || "SAR").toUpperCase(),
      receipt.fx_snapshot_rate != null ? Number(receipt.fx_snapshot_rate) : null,
      receipt.fx_snapshot_base || null,
      Number(receipt.category_id || 7),
      receipt.receipt_number || null,
      receipt.return_deadline || null,
      receipt.note || null,
      receipt.ocr_raw_text || null,
      receipt.ocr_parsed_json || null,
      Number(receipt.created_at || t),
      Number(receipt.updated_at || t),
      dirty ? 1 : 0,
    ]
  );
}

/** Write receipt from local user action — marks dirty=1 for sync. */
export async function upsertReceipt(userUid, receipt) {
  const db = await getDb();
  await _upsertReceipt(db, userUid, receipt, true);
}

/** Write receipt arriving from Firebase listener — marks dirty=0. */
export async function upsertReceiptServer(userUid, receipt) {
  const db = await getDb();
  await _upsertReceipt(db, userUid, receipt, false);
}

export async function softDeleteReceipt(userUid, receiptId) {
  const db = await getDb();
  await db.runAsync(
    `UPDATE receipts SET is_deleted=1, dirty=1, updated_at=? WHERE user_uid=? AND receipt_id=?`,
    [now(), String(userUid), String(receiptId)]
  );
}

export async function markReceiptSynced(userUid, receiptId) {
  const db = await getDb();
  await db.runAsync(
    `UPDATE receipts SET dirty=0, updated_at=? WHERE user_uid=? AND receipt_id=?`,
    [now(), String(userUid), String(receiptId)]
  );
}

export async function listAvailableMonths(userUid, limit = 24) {
  const db = await getDb();
  const rows = await db.getAllAsync(
    `SELECT DISTINCT purchase_month AS m
     FROM receipts
     WHERE user_uid=? AND is_deleted=0 AND purchase_month IS NOT NULL
     ORDER BY purchase_month DESC
     LIMIT ?`,
    [String(userUid), Number(limit)]
  );
  return (rows || []).map((r) => r.m).filter(Boolean);
}

/**
 * Compute a monthly spending report for a user.
 *
 * Phase 5 — currency-aware aggregation.
 *
 * @param {string} userUid
 * @param {string} month      — "YYYY-MM"
 * @param {object} [opts]
 * @param {string} [opts.baseCurrency]  — target display currency, e.g. "SAR"
 * @param {object} [opts.ratesSnap]     — rates snapshot from currencyService.getRatesSnapshot()
 *
 * Conversion priority per receipt row:
 *   1. fx_snapshot_rate (stored at write time)  — fastest, zero network
 *   2. ratesSnap live/cached Currencylayer rates — online or SQLite-cached
 *   3. raw amount                               — graceful fallback when no rates
 *
 * All three amounts in the return value (total_spend, by_category totals,
 * by_vendor totals) are expressed in baseCurrency.
 */
export async function computeMonthlyReport(userUid, month, opts = {}) {
  const { baseCurrency = null, ratesSnap = null } = opts;
  const db = await getDb();
  const m  = String(month || "");

  // Fetch the minimal columns needed for currency-aware aggregation.
  const rows = await db.getAllAsync(
    `SELECT total_amount, currency_code,
            fx_snapshot_rate, fx_snapshot_base,
            category_id, vendor_name
     FROM receipts
     WHERE user_uid=? AND is_deleted=0 AND purchase_month=?`,
    [String(userUid), m]
  );

  if (!rows || rows.length === 0) {
    return {
      period: m,
      total_spend: 0,
      receipt_count: 0,
      by_category: [],
      by_vendor: [],
    };
  }

  // ── Per-row conversion ────────────────────────────────────────────────────
  // Returns the row's amount expressed in baseCurrency.
  // When baseCurrency is null (no preference set), returns raw amount.
  const toBase = (row) => {
    const amt  = Number(row.total_amount || 0);
    if (!baseCurrency) return amt;

    const code = String(row.currency_code || "SAR").toUpperCase();
    const base = String(baseCurrency).toUpperCase();

    // No conversion needed.
    if (code === base) return amt;

    // Priority 1 — stored fx_snapshot captured at receipt creation.
    const snapRate = row.fx_snapshot_rate != null ? Number(row.fx_snapshot_rate) : null;
    const snapBase = String(row.fx_snapshot_base || "").toUpperCase();
    if (snapRate && snapBase === base) {
      return Number((amt * snapRate).toFixed(2));
    }

    // Priority 2 — live / SQLite-cached Currencylayer rates.
    if (ratesSnap?.rates) {
      const fromRate = code === "USD" ? 1 : (ratesSnap.rates[`USD${code}`] ?? null);
      const toRate   = base === "USD" ? 1 : (ratesSnap.rates[`USD${base}`]   ?? null);
      if (fromRate && toRate) {
        const usd = code === "USD" ? amt : amt / fromRate;
        return Number((base === "USD" ? usd : usd * toRate).toFixed(2));
      }
    }

    // Fallback — no rates available; return raw amount.
    return amt;
  };

  // ── Aggregate in JS so conversion runs per-row ────────────────────────────
  let totalSpend = 0;
  const catMap    = {}; // category_id → converted total
  const vendorMap = {}; // vendor_name → converted total

  for (const row of rows) {
    const converted = toBase(row);
    totalSpend += converted;

    const catKey    = String(row.category_id ?? "0");
    catMap[catKey]  = (catMap[catKey]  || 0) + converted;

    const vendorKey      = String(row.vendor_name || "Unknown");
    vendorMap[vendorKey] = (vendorMap[vendorKey] || 0) + converted;
  }

  const by_category = Object.entries(catMap)
    .map(([category_id, total]) => ({ category_id: Number(category_id), total: Number(total.toFixed(2)) }))
    .sort((a, b) => b.total - a.total);

  const by_vendor = Object.entries(vendorMap)
    .map(([vendor, total]) => ({ vendor, total: Number(total.toFixed(2)) }))
    .sort((a, b) => b.total - a.total);

  return {
    period:        m,
    total_spend:   Number(totalSpend.toFixed(2)),
    receipt_count: rows.length,
    by_category,
    by_vendor,
  };
}

/**
 * computeFullReport — Phase 11 upgrade.
 *
 * Extends computeMonthlyReport with hub-level protection metrics and
 * warranty state so ReportsScreen can display a complete financial health view.
 *
 * Additional fields returned:
 *   protected_value         — total of active + under_warranty hub amounts (base currency)
 *   recovered_value         — total of returned/claimed hub amounts (base currency)
 *   expiring_warranty_count — warranties ending within 90 days
 *   hub_count               — distinct hubs with receipts this month
 *   by_merchant             — hub-level merchant aggregation (parallel to by_vendor)
 *   trend                   — array of { month, total_spend } for up to 6 past months
 *
 * Like computeMonthlyReport, all money values are expressed in baseCurrency.
 */
export async function computeFullReport(userUid, month, opts = {}) {
  const { baseCurrency = null, ratesSnap = null } = opts;
  const db = await getDb();

  // Run base report
  const base = await computeMonthlyReport(userUid, month, opts);

  // ── Hub metrics ────────────────────────────────────────────────────────────
  const toBase = (amt, currCode, snapRate, snapBase) => {
    const amount = Number(amt || 0);
    if (!baseCurrency || !amount) return amount;
    const code = String(currCode || "SAR").toUpperCase();
    const base = String(baseCurrency).toUpperCase();
    if (code === base) return amount;

    const sr = snapRate != null ? Number(snapRate) : null;
    const sb = String(snapBase || "").toUpperCase();
    if (sr && sb === base) return Number((amount * sr).toFixed(2));

    if (ratesSnap?.rates) {
      const fromRate = code === "USD" ? 1 : (ratesSnap.rates[`USD${code}`] ?? null);
      const toRate   = base === "USD" ? 1 : (ratesSnap.rates[`USD${base}`] ?? null);
      if (fromRate && toRate) {
        const usd = code === "USD" ? amount : amount / fromRate;
        return Number((base === "USD" ? usd : usd * toRate).toFixed(2));
      }
    }
    return amount;
  };

  // Protected value = all active + under_warranty hubs
  const activeHubs = await db.getAllAsync(
    `SELECT total_amount, currency_code, fx_snapshot_rate, fx_snapshot_base
     FROM purchase_hubs
     WHERE user_uid=? AND is_deleted=0
       AND status IN ('active','under_warranty','returnable','return_risk')`,
    [String(userUid)]
  );
  const protected_value = (activeHubs || []).reduce(
    (sum, h) => sum + toBase(h.total_amount, h.currency_code, h.fx_snapshot_rate, h.fx_snapshot_base),
    0
  );

  // Recovered value = hubs that were returned or have closed claims
  const returnedHubs = await db.getAllAsync(
    `SELECT total_amount, currency_code, fx_snapshot_rate, fx_snapshot_base
     FROM purchase_hubs
     WHERE user_uid=? AND is_deleted=0 AND status = 'returned'`,
    [String(userUid)]
  );
  const recovered_value = (returnedHubs || []).reduce(
    (sum, h) => sum + toBase(h.total_amount, h.currency_code, h.fx_snapshot_rate, h.fx_snapshot_base),
    0
  );

  // Expiring warranties — next 90 days
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + 90);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const today     = new Date().toISOString().slice(0, 10);
  const expiringRows = await db.getAllAsync(
    `SELECT COUNT(*) as cnt FROM warranties
     WHERE user_uid=? AND is_deleted=0
       AND warranty_end IS NOT NULL
       AND warranty_end >= ? AND warranty_end <= ?`,
    [String(userUid), today, cutoffStr]
  );
  const expiring_warranty_count = Number(expiringRows?.[0]?.cnt || 0);

  // Hub merchant breakdown for this month
  const monthHubs = await db.getAllAsync(
    `SELECT merchant_name, total_amount, currency_code, fx_snapshot_rate, fx_snapshot_base
     FROM purchase_hubs
     WHERE user_uid=? AND is_deleted=0
       AND purchase_date >= ? AND purchase_date <= ?`,
    [String(userUid), `${month}-01`, `${month}-31`]
  );
  const merchantMap = {};
  for (const h of monthHubs || []) {
    const key = String(h.merchant_name || "Other");
    merchantMap[key] = (merchantMap[key] || 0) +
      toBase(h.total_amount, h.currency_code, h.fx_snapshot_rate, h.fx_snapshot_base);
  }
  const by_merchant = Object.entries(merchantMap)
    .map(([merchant, total]) => ({ merchant, total: Number(total.toFixed(2)) }))
    .sort((a, b) => b.total - a.total);

  // Trend — last 6 available months
  const trendMonths = await db.getAllAsync(
    `SELECT DISTINCT purchase_month AS m
     FROM receipts
     WHERE user_uid=? AND is_deleted=0 AND purchase_month IS NOT NULL
       AND purchase_month <= ?
     ORDER BY purchase_month DESC LIMIT 6`,
    [String(userUid), String(month)]
  );
  const trend = [];
  for (const row of (trendMonths || []).reverse()) {
    const tr = await computeMonthlyReport(userUid, row.m, opts);
    trend.push({ month: row.m, total_spend: tr.total_spend });
  }

  return {
    ...base,
    protected_value:         Number(protected_value.toFixed(2)),
    recovered_value:         Number(recovered_value.toFixed(2)),
    expiring_warranty_count,
    hub_count:               (monthHubs || []).length,
    by_merchant,
    trend,
  };
}

// ─── Receipt child tables ─────────────────────────────────────────────────────

export async function replaceReceiptItems(userUid, receiptId, items) {
  const db = await getDb();
  await db.runAsync(
    `DELETE FROM receipt_items WHERE user_uid=? AND receipt_id=?`,
    [String(userUid), String(receiptId)]
  );
  for (const it of items || []) {
    await db.runAsync(
      `INSERT INTO receipt_items (user_uid, receipt_id, item_id, name, qty, unit_price, total)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_uid, receipt_id, item_id) DO UPDATE SET
         name=excluded.name, qty=excluded.qty, unit_price=excluded.unit_price, total=excluded.total`,
      [
        String(userUid), String(receiptId), String(it.item_id),
        String(it.name || ""), Number(it.qty || 1),
        Number(it.unit_price || 0), Number(it.total || 0),
      ]
    );
  }
}

export async function replaceReceiptTags(userUid, receiptId, tagIds) {
  const db = await getDb();
  await db.runAsync(
    `DELETE FROM receipt_tags WHERE user_uid=? AND receipt_id=?`,
    [String(userUid), String(receiptId)]
  );
  for (const tagId of tagIds || []) {
    await db.runAsync(
      `INSERT INTO receipt_tags (user_uid, receipt_id, tag_id) VALUES (?, ?, ?)
       ON CONFLICT(user_uid, receipt_id, tag_id) DO NOTHING`,
      [String(userUid), String(receiptId), Number(tagId)]
    );
  }
}

export async function linkReceiptAttachments(userUid, receiptId, attachmentIds) {
  const db = await getDb();
  await db.runAsync(
    `DELETE FROM receipt_attachments WHERE user_uid=? AND receipt_id=?`,
    [String(userUid), String(receiptId)]
  );
  for (const attId of attachmentIds || []) {
    await db.runAsync(
      `INSERT INTO receipt_attachments (user_uid, receipt_id, attachment_id) VALUES (?, ?, ?)
       ON CONFLICT(user_uid, receipt_id, attachment_id) DO NOTHING`,
      [String(userUid), String(receiptId), String(attId)]
    );
  }
}

// ─── Attachments ──────────────────────────────────────────────────────────────

export async function upsertAttachment(userUid, att) {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO attachments (
       user_uid, attachment_id, owner_uid, linked_type, linked_id,
       provider, bucket, path, public_url, filename, content_type,
       size_bytes, local_uri, upload_status, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_uid, attachment_id) DO UPDATE SET
       owner_uid=excluded.owner_uid,
       linked_type=excluded.linked_type,
       linked_id=excluded.linked_id,
       provider=excluded.provider,
       bucket=excluded.bucket,
       path=excluded.path,
       public_url=excluded.public_url,
       filename=excluded.filename,
       content_type=excluded.content_type,
       size_bytes=excluded.size_bytes,
       local_uri=excluded.local_uri,
       upload_status=excluded.upload_status`,
    [
      String(userUid), String(att.attachment_id),
      att.owner_uid || String(userUid),
      att.linked_type || null, att.linked_id || null,
      att.provider || null, att.bucket || null,
      att.path || null, att.public_url || null,
      att.filename || null, att.content_type || null,
      Number(att.size_bytes || 0),
      att.local_uri || null, att.upload_status || null,
      Number(att.created_at || now()),
    ]
  );
}

export async function listPendingAttachments(userUid, limit = 10) {
  const db = await getDb();
  return await db.getAllAsync(
    `SELECT * FROM attachments
     WHERE user_uid=? AND owner_uid=?
       AND local_uri IS NOT NULL
       AND (upload_status IS NULL OR upload_status != 'uploaded')
     ORDER BY created_at ASC LIMIT ?`,
    [String(userUid), String(userUid), Number(limit)]
  );
}
