import { getDb } from "../../db/db";

const now = () => Date.now();
const toLower = (s) => String(s || "").toLowerCase();

// ─── Merchants (v3) ───────────────────────────────────────────────────────────

export async function upsertMerchant(merchant) {
  const db = await getDb();
  const t = now();
  const cats = Array.isArray(merchant.categories)
    ? JSON.stringify(Object.fromEntries(merchant.categories.map((c) => [c, true])))
    : merchant.categories_json || null;

  await db.runAsync(
    `INSERT INTO merchants (
       merchant_id, name, name_lower, categories_json, city, verified,
       created_at_ms, updated_at_ms
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(merchant_id) DO UPDATE SET
       name=excluded.name,
       name_lower=excluded.name_lower,
       categories_json=excluded.categories_json,
       city=excluded.city,
       verified=excluded.verified,
       updated_at_ms=excluded.updated_at_ms`,
    [
      String(merchant.merchant_id),
      String(merchant.name || ""),
      toLower(merchant.name || ""),
      cats,
      merchant.city || null,
      merchant.verified ? 1 : 0,
      Number(merchant.created_at_ms || merchant.created_at || t),
      Number(merchant.updated_at_ms || merchant.updated_at || t),
    ]
  );
}

export async function getMerchant(merchantId) {
  const db = await getDb();
  return await db.getFirstAsync(
    `SELECT * FROM merchants WHERE merchant_id=?`,
    [String(merchantId)]
  );
}

export async function listMerchants({ query = "", limit = 200 } = {}) {
  const db = await getDb();
  const q = toLower(String(query || "").trim());
  if (q) {
    return await db.getAllAsync(
      `SELECT * FROM merchants WHERE name_lower LIKE ? ORDER BY name_lower ASC LIMIT ?`,
      [`%${q}%`, Number(limit)]
    );
  }
  return await db.getAllAsync(
    `SELECT * FROM merchants ORDER BY name_lower ASC LIMIT ?`,
    [Number(limit)]
  );
}

export async function upsertMerchantAlias(aliasLower, merchantId) {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO merchant_aliases (alias_lower, merchant_id) VALUES (?, ?)
     ON CONFLICT(alias_lower) DO UPDATE SET merchant_id=excluded.merchant_id`,
    [String(aliasLower).toLowerCase(), String(merchantId)]
  );
}

/** Resolve a free-text merchant name to a merchant_id. Returns null if unknown. */
export async function resolveMerchantByName(name) {
  if (!name) return null;
  const db = await getDb();
  const lower = toLower(name);
  // Try direct name match first
  const direct = await db.getFirstAsync(
    `SELECT merchant_id FROM merchants WHERE name_lower=?`,
    [lower]
  );
  if (direct) return direct.merchant_id;
  // Try alias table
  const alias = await db.getFirstAsync(
    `SELECT merchant_id FROM merchant_aliases WHERE alias_lower=?`,
    [lower]
  );
  return alias?.merchant_id || null;
}

// ─── Legacy vendors (v2 compat — kept for firebaseSync.js) ───────────────────

export async function upsertVendorServer(userUid, vendor) {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO vendors (user_uid, vendor_id, name, name_lower, phone, address, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_uid, vendor_id) DO UPDATE SET
       name=excluded.name, name_lower=excluded.name_lower,
       phone=excluded.phone, address=excluded.address`,
    [
      String(userUid), String(vendor.vendor_id),
      String(vendor.name || ""), toLower(vendor.name || ""),
      vendor.phone || "", vendor.address || "",
      Number(vendor.created_at || now()),
    ]
  );
}

export async function listVendors(userUid, limit = 200) {
  const db = await getDb();
  return await db.getAllAsync(
    `SELECT * FROM vendors WHERE user_uid=? ORDER BY name_lower ASC LIMIT ?`,
    [String(userUid), Number(limit)]
  );
}
