import { getDb } from "../../db/db";

const now = () => Date.now();
const toLower = (s) => String(s || "").toLowerCase();

// ─── Users ────────────────────────────────────────────────────────────────────

export async function upsertUser(user) {
  const db = await getDb();
  const t = now();
  await db.runAsync(
    `INSERT INTO users (uid, name, email, email_lower, username, username_lower, user_type, registration_date, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(uid) DO UPDATE SET
       name=excluded.name,
       email=excluded.email,
       email_lower=excluded.email_lower,
       username=excluded.username,
       username_lower=excluded.username_lower,
       user_type=excluded.user_type,
       registration_date=excluded.registration_date,
       updated_at=excluded.updated_at`,
    [
      String(user.uid),
      user.name || null,
      user.email || null,
      user.email_lower || (user.email ? toLower(user.email) : null),
      user.username || null,
      user.username_lower || (user.username ? toLower(user.username) : null),
      user.user_type || "user",
      user.registration_date || null,
      Number(user.created_at || t),
      Number(user.updated_at || t),
    ]
  );
}

export async function getUser(uid) {
  const db = await getDb();
  return await db.getFirstAsync(`SELECT * FROM users WHERE uid=?`, [String(uid)]);
}

// ─── User settings ────────────────────────────────────────────────────────────

export async function upsertUserSettings(settings) {
  const db = await getDb();
  const t = now();
  await db.runAsync(
    `INSERT INTO user_settings
       (uid, theme, language, push_enabled, biometric_enabled,
        notif_return_deadline, notif_warranty_expiry, notif_weekly_summary,
        base_currency, notif_sound, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(uid) DO UPDATE SET
       theme=excluded.theme,
       language=excluded.language,
       push_enabled=excluded.push_enabled,
       biometric_enabled=excluded.biometric_enabled,
       notif_return_deadline=excluded.notif_return_deadline,
       notif_warranty_expiry=excluded.notif_warranty_expiry,
       notif_weekly_summary=excluded.notif_weekly_summary,
       base_currency=excluded.base_currency,
       notif_sound=excluded.notif_sound,
       updated_at=excluded.updated_at`,
    [
      String(settings.uid),
      settings.theme || "light",
      settings.language || "en",
      settings.push_enabled ? 1 : 0,
      settings.biometric_enabled ? 1 : 0,
      settings.notif_return_deadline ? 1 : 0,
      settings.notif_warranty_expiry ? 1 : 0,
      settings.notif_weekly_summary ? 1 : 0,
      String(settings.base_currency || "SAR").toUpperCase(),
      String(settings.notif_sound || "default"),
      Number(settings.created_at || t),
      Number(settings.updated_at || t),
    ]
  );
}

export async function getUserSettings(uid) {
  const db = await getDb();
  return await db.getFirstAsync(`SELECT * FROM user_settings WHERE uid=?`, [String(uid)]);
}

/** Convenience: read just the base currency, defaulting to SAR. */
export async function getBaseCurrency(uid) {
  const s = await getUserSettings(uid);
  return String(s?.base_currency || "SAR").toUpperCase();
}

// ─── User categories ──────────────────────────────────────────────────────────

export async function replaceUserCategories(userUid, scope, arr) {
  const db = await getDb();
  await db.runAsync(
    `DELETE FROM user_categories WHERE user_uid=? AND scope=?`,
    [String(userUid), String(scope)]
  );
  for (const c of arr || []) {
    await db.runAsync(
      `INSERT INTO user_categories (user_uid, scope, category_id, name, icon_key, color)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_uid, scope, category_id) DO UPDATE SET
         name=excluded.name, icon_key=excluded.icon_key, color=excluded.color`,
      [String(userUid), String(scope), Number(c.category_id), String(c.name || ""), c.icon_key || null, c.color || null]
    );
  }
}

export async function listUserCategories(userUid, scope = "purchases") {
  const db = await getDb();
  return await db.getAllAsync(
    `SELECT * FROM user_categories WHERE user_uid=? AND scope=? ORDER BY category_id ASC`,
    [String(userUid), String(scope)]
  );
}

// ─── User tags ────────────────────────────────────────────────────────────────

export async function replaceUserTags(userUid, arr) {
  const db = await getDb();
  await db.runAsync(`DELETE FROM user_tags WHERE user_uid=?`, [String(userUid)]);
  for (const t of arr || []) {
    await db.runAsync(
      `INSERT INTO user_tags (user_uid, tag_id, name, color)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(user_uid, tag_id) DO UPDATE SET name=excluded.name, color=excluded.color`,
      [String(userUid), Number(t.tag_id), String(t.name || ""), t.color || null]
    );
  }
}

export async function listUserTags(userUid) {
  const db = await getDb();
  return await db.getAllAsync(
    `SELECT * FROM user_tags WHERE user_uid=? ORDER BY tag_id ASC`,
    [String(userUid)]
  );
}

// ─── System taxonomy (global, not user-scoped) ────────────────────────────────

export async function upsertCategoryDefault({ scope, category_id, name, icon_key, color }) {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO category_defaults (scope, category_id, name, icon_key, color)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(scope, category_id) DO UPDATE SET
       name=excluded.name, icon_key=excluded.icon_key, color=excluded.color`,
    [String(scope || "purchases"), Number(category_id), String(name || ""), icon_key || null, color || null]
  );
}

export async function upsertTagDefault({ tag_id, name, color }) {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO tag_defaults (tag_id, name, color)
     VALUES (?, ?, ?)
     ON CONFLICT(tag_id) DO UPDATE SET name=excluded.name, color=excluded.color`,
    [Number(tag_id), String(name || ""), color || null]
  );
}

export async function upsertRequirementCategory(key, { name, icon_key }) {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO requirement_categories (key, name, icon_key)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET name=excluded.name, icon_key=excluded.icon_key`,
    [String(key), String(name || ""), icon_key || null]
  );
}

export async function listRequirementCategories() {
  const db = await getDb();
  return await db.getAllAsync(`SELECT * FROM requirement_categories ORDER BY name ASC`);
}

// ---------------------------------------------------------------------------
// Currency rates
//
// The `currencies` table is written exclusively by currencyService.js via its
// internal writeRatesToDb() function, which is called every time
// getRatesSnapshot() fetches live data from the Currencylayer API.
//
// upsertCurrency below is a DEAD EXPORT — it duplicates that internal logic
// and has zero callers in the codebase.  It is retained only so the repo/index
// barrel export doesn't break if someone imports it by name.
//
// @deprecated Phase 5 — do NOT add new callers.
//   To write rates: call currencyService.getRatesSnapshot() or refreshRates().
//   To read rates:  call currencyService.getRatesSnapshot() or use useCurrency().
// ---------------------------------------------------------------------------
/** @deprecated Use currencyService.getRatesSnapshot() — see comment above. */
export async function upsertCurrency({ code, exchange_rate, updated_at }) {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO currencies (code, exchange_rate, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(code) DO UPDATE SET
       exchange_rate=excluded.exchange_rate, updated_at=excluded.updated_at`,
    [String(code).toUpperCase(), Number(exchange_rate || 0), Number(updated_at || Date.now())]
  );
}
