import { getDb } from "../../db/db";

const now = () => Date.now();

// ─── Local cache helpers ──────────────────────────────────────────────────────
// Key convention:
//   home:{uid}                    – home_cache payload
//   report:{uid}:{month}          – report_summaries payload
//   ai_ctx:{uid}                  – ai_context_cache payload
//
// All callers should use the exported key builders below to stay consistent.

export const cacheKey = {
  home: (uid) => `home:${uid}`,
  report: (uid, month) => `report:${uid}:${month}`,
  aiContext: (uid) => `ai_ctx:${uid}`,
};

// ─── Read / write ─────────────────────────────────────────────────────────────

/**
 * Write a cache entry. Pass expiresInMs to set a TTL (optional).
 */
export async function setCacheEntry(key, userUid, payload, { version = 1, generatedAt = null, expiresInMs = null } = {}) {
  const db = await getDb();
  const generated = generatedAt ? new Date(generatedAt).getTime() : now();
  const expires = expiresInMs ? generated + Number(expiresInMs) : null;
  await db.runAsync(
    `INSERT INTO local_cache (cache_key, user_uid, payload_json, version, generated_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(cache_key) DO UPDATE SET
       user_uid=excluded.user_uid,
       payload_json=excluded.payload_json,
       version=excluded.version,
       generated_at=excluded.generated_at,
       expires_at=excluded.expires_at`,
    [
      String(key),
      userUid ? String(userUid) : null,
      JSON.stringify(payload),
      Number(version || 1),
      generated,
      expires,
    ]
  );
}

/**
 * Read a cache entry. Returns null if missing or expired.
 */
export async function getCacheEntry(key) {
  const db = await getDb();
  const row = await db.getFirstAsync(
    `SELECT * FROM local_cache WHERE cache_key=?`,
    [String(key)]
  );
  if (!row) return null;
  if (row.expires_at && now() > Number(row.expires_at)) {
    // Stale — still return it so callers can decide whether to use it
    return { ...parseRow(row), stale: true };
  }
  return { ...parseRow(row), stale: false };
}

function parseRow(row) {
  let payload = null;
  try { payload = JSON.parse(row.payload_json); } catch {}
  return {
    key: row.cache_key,
    userUid: row.user_uid,
    payload,
    version: row.version,
    generatedAt: row.generated_at,
    expiresAt: row.expires_at,
  };
}

export async function deleteCacheEntry(key) {
  const db = await getDb();
  await db.runAsync(`DELETE FROM local_cache WHERE cache_key=?`, [String(key)]);
}

export async function clearUserCache(userUid) {
  const db = await getDb();
  await db.runAsync(`DELETE FROM local_cache WHERE user_uid=?`, [String(userUid)]);
}

// ─── Typed convenience wrappers ───────────────────────────────────────────────

/** Store a home_cache snapshot from Firebase. 30-minute TTL. */
export async function setHomeCache(userUid, payload) {
  await setCacheEntry(cacheKey.home(userUid), userUid, payload, {
    version: payload?.version || 1,
    generatedAt: payload?.generated_at || null,
    expiresInMs: 30 * 60 * 1000,
  });
}

export async function getHomeCache(userUid) {
  const entry = await getCacheEntry(cacheKey.home(userUid));
  return entry?.payload || null;
}

/** Store a report_summary snapshot. 1-hour TTL. */
export async function setReportSummary(userUid, month, payload) {
  await setCacheEntry(cacheKey.report(userUid, month), userUid, payload, {
    generatedAt: payload?.generated_at || null,
    expiresInMs: 60 * 60 * 1000,
  });
}

export async function getReportSummary(userUid, month) {
  const entry = await getCacheEntry(cacheKey.report(userUid, month));
  return entry?.payload || null;
}

/** Store an ai_context_cache snapshot. 30-minute TTL. */
export async function setAIContextCache(userUid, payload) {
  await setCacheEntry(cacheKey.aiContext(userUid), userUid, payload, {
    generatedAt: payload?.generated_at || null,
    expiresInMs: 30 * 60 * 1000,
  });
}

export async function getAIContextCache(userUid) {
  const entry = await getCacheEntry(cacheKey.aiContext(userUid));
  return entry?.payload || null;
}
