import { getDb } from "../../db/db";

const now = () => Date.now();
const toLower = (s) => String(s || "").toLowerCase();

// ─── Stores ───────────────────────────────────────────────────────────────────

export async function upsertStoreServer(store) {
  const db = await getDb();
  const categoriesJson = typeof store.categories === "object" && !Array.isArray(store.categories)
    ? JSON.stringify(store.categories)
    : Array.isArray(store.categories)
      ? JSON.stringify(Object.fromEntries(store.categories.map((c) => [c, true])))
      : store.categories_json || "{}";

  await db.runAsync(
    `INSERT INTO stores (store_id, name, name_lower, url, city, verified, categories_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(store_id) DO UPDATE SET
       name=excluded.name,
       name_lower=excluded.name_lower,
       url=excluded.url,
       city=excluded.city,
       verified=excluded.verified,
       categories_json=excluded.categories_json,
       created_at=excluded.created_at,
       updated_at=excluded.updated_at`,
    [
      String(store.store_id),
      String(store.name || ""),
      toLower(store.name || ""),
      store.url || null,
      store.city || null,
      store.verified ? 1 : 0,
      categoriesJson,
      Number(store.created_at || now()),
      Number(store.updated_at || now()),
    ]
  );
}

export async function replaceStoresByCategory(categoryKey, storeIds) {
  const db = await getDb();
  await db.runAsync(`DELETE FROM stores_by_category WHERE category_key=?`, [String(categoryKey)]);
  for (const sid of storeIds || []) {
    await db.runAsync(
      `INSERT INTO stores_by_category (category_key, store_id) VALUES (?, ?)
       ON CONFLICT(category_key, store_id) DO NOTHING`,
      [String(categoryKey), String(sid)]
    );
  }
}

export async function listStores({ query = "", categoryKey = null, limit = 200, userUid = null } = {}) {
  const db = await getDb();
  const q = toLower(String(query || "").trim());
  const params = [];
  let where = "1=1";

  if (q) {
    where += " AND s.name_lower LIKE ?";
    params.push(`%${q}%`);
  }

  let sql;
  if (categoryKey) {
    sql = `SELECT s.*, st.avg_rating AS avg_rating, st.count AS review_count
           FROM stores_by_category sb
           INNER JOIN stores s ON s.store_id = sb.store_id
           LEFT JOIN store_review_stats st ON st.store_id = s.store_id
           WHERE sb.category_key=? AND ${where}
           ORDER BY s.verified DESC, s.name_lower ASC
           LIMIT ?`;
    params.unshift(String(categoryKey));
  } else {
    sql = `SELECT s.*, st.avg_rating AS avg_rating, st.count AS review_count
           FROM stores s
           LEFT JOIN store_review_stats st ON st.store_id = s.store_id
           WHERE ${where}
           ORDER BY s.verified DESC, s.name_lower ASC
           LIMIT ?`;
  }
  params.push(Number(limit));

  const rows = await db.getAllAsync(sql, params);
  if (!userUid) return rows;

  const favs = await db.getAllAsync(
    `SELECT store_id FROM user_favorite_stores WHERE user_uid=? AND is_on=1`,
    [String(userUid)]
  );
  const favSet = new Set((favs || []).map((x) => String(x.store_id)));
  return rows.map((s) => ({ ...s, is_favorite: favSet.has(String(s.store_id)) }));
}

export async function getStoreDetails(storeId, userUid = null) {
  const db = await getDb();
  const store = await db.getFirstAsync(`SELECT * FROM stores WHERE store_id=?`, [String(storeId)]);
  if (!store) return null;
  const stats = await db.getFirstAsync(
    `SELECT * FROM store_review_stats WHERE store_id=?`, [String(storeId)]
  );
  const reviews = await db.getAllAsync(
    `SELECT * FROM store_reviews WHERE store_id=? ORDER BY created_at DESC LIMIT 60`,
    [String(storeId)]
  );
  let is_favorite = false;
  if (userUid) {
    const fav = await db.getFirstAsync(
      `SELECT is_on FROM user_favorite_stores WHERE user_uid=? AND store_id=?`,
      [String(userUid), String(storeId)]
    );
    is_favorite = Number(fav?.is_on || 0) === 1;
  }
  return {
    store: {
      ...store,
      categories: store.categories_json ? JSON.parse(store.categories_json) : {},
      verified: Number(store.verified || 0) === 1,
    },
    stats: {
      avg_rating:     Number(stats?.avg_rating || 0),
      count:          Number(stats?.count       || 0),
      review_count:   Number(stats?.review_count || stats?.count || 0),
      review_summary: stats?.review_summary || null,
    },
    reviews: (reviews || []).map((r) => ({ ...r, rating: Number(r.rating || 0) })),
    is_favorite,
  };
}

// ─── Reviews ──────────────────────────────────────────────────────────────────

export async function upsertStoreReviewServer(storeId, reviewId, review) {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO store_reviews (store_id, review_id, uid, rating, comment, created_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(store_id, review_id) DO UPDATE SET
       uid=excluded.uid, rating=excluded.rating,
       comment=excluded.comment, created_at=excluded.created_at`,
    [
      String(storeId), String(reviewId),
      review.uid ? String(review.uid) : null,
      Number(review.rating || 0),
      String(review.comment || ""),
      Number(review.created_at || now()),
    ]
  );
}

export async function upsertStoreReviewStatsServer(storeId, stats) {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO store_review_stats (store_id, avg_rating, count, review_count, review_summary, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(store_id) DO UPDATE SET
       avg_rating=excluded.avg_rating,
       count=excluded.count,
       review_count=COALESCE(excluded.review_count, store_review_stats.review_count),
       review_summary=COALESCE(excluded.review_summary, store_review_stats.review_summary),
       updated_at=excluded.updated_at`,
    [
      String(storeId),
      Number(stats.avg_rating || 0),
      Number(stats.count || stats.review_count || 0),
      Number(stats.review_count || stats.count || 0),
      stats.review_summary || null,
      Number(stats.updated_at || now()),
    ]
  );
}

export async function getStoreReviewStats(storeId) {
  const db = await getDb();
  return await db.getFirstAsync(
    `SELECT * FROM store_review_stats WHERE store_id=?`, [String(storeId)]
  );
}

/**
 * listStoresScored — recommendation engine query.
 *
 * Scores every store in SQLite against the user's context:
 *   +5  store is in user favorites
 *   +4  store matches a top-spend category (up to 2 categories)
 *   +3  store is verified
 *   +2  store matches a requested category filter
 *   +1  per point of avg_rating above 4.0 (max +3)
 *
 * Returns rows sorted by score DESC, then avg_rating DESC.
 * Each row carries a `score`, `recommendation_reason`, and `match_category`.
 *
 * @param {string}   userUid
 * @param {object}   opts
 * @param {string[]} opts.topCategories   — user's top spend categories
 * @param {string[]} opts.favoriteIds     — store IDs the user has saved
 * @param {string}   opts.categoryFilter  — optional single category to filter
 * @param {string}   opts.cityFilter      — optional city to filter
 * @param {string}   opts.query           — optional text search
 * @param {number}   opts.limit
 */
export async function listStoresScored(userUid, {
  topCategories  = [],
  favoriteIds    = [],
  categoryFilter = null,
  cityFilter     = null,
  query          = "",
  limit          = 200,
} = {}) {
  const db    = await getDb();
  const q     = toLower(String(query || "").trim());
  const favSet = new Set(favoriteIds.map(String));

  // Build base query depending on category or city filter
  let sql;
  const params = [];

  if (categoryFilter) {
    sql = `SELECT s.*, st.avg_rating, st.count, st.review_count, st.review_summary
           FROM stores_by_category sb
           INNER JOIN stores s ON s.store_id = sb.store_id
           LEFT JOIN store_review_stats st ON st.store_id = s.store_id
           WHERE sb.category_key = ?`;
    params.push(String(categoryFilter));
    if (q) { sql += ` AND s.name_lower LIKE ?`; params.push(`%${q}%`); }
  } else if (cityFilter) {
    sql = `SELECT s.*, st.avg_rating, st.count, st.review_count, st.review_summary
           FROM stores s
           LEFT JOIN store_review_stats st ON st.store_id = s.store_id
           WHERE LOWER(s.city) = ?`;
    params.push(toLower(cityFilter));
    if (q) { sql += ` AND s.name_lower LIKE ?`; params.push(`%${q}%`); }
  } else {
    sql = `SELECT s.*, st.avg_rating, st.count, st.review_count, st.review_summary
           FROM stores s
           LEFT JOIN store_review_stats st ON st.store_id = s.store_id
           WHERE 1=1`;
    if (q) { sql += ` AND s.name_lower LIKE ?`; params.push(`%${q}%`); }
  }
  sql += ` LIMIT ?`;
  params.push(Number(limit));

  const rows = await db.getAllAsync(sql, params);

  return (rows || [])
    .map((s) => {
      // Parse categories
      let cats = [];
      try { cats = Object.keys(JSON.parse(s.categories_json || "{}")); } catch {}

      // Score calculation
      let score = 0;
      let reasons = [];
      let matchCategory = null;

      if (favSet.has(String(s.store_id))) {
        score += 5;
        reasons.push("In your saved stores");
      }

      for (const tc of topCategories.slice(0, 2)) {
        if (cats.includes(tc)) {
          score += 4;
          matchCategory = matchCategory || tc;
          reasons.push(`Matches your ${tc} purchases`);
          break;
        }
      }

      if (Number(s.verified || 0)) {
        score += 3;
        if (!reasons.length) reasons.push("Verified store");
      }

      if (categoryFilter && cats.includes(categoryFilter)) {
        score += 2;
        matchCategory = matchCategory || categoryFilter;
      }

      const rating = Number(s.avg_rating || 0);
      if (rating > 4.0) score += Math.min(3, Math.floor((rating - 4.0) * 10));

      const reason = reasons[0] ||
        (matchCategory ? `Great for ${matchCategory}` : "Good overall match");

      return {
        ...s,
        is_favorite:            favSet.has(String(s.store_id)),
        score,
        recommendation_reason:  reason,
        match_category:         matchCategory,
        avg_rating:             rating,
        review_count:           Number(s.review_count || s.count || 0),
        review_summary:         s.review_summary || null,
        categories:             cats,
      };
    })
    .sort((a, b) => b.score - a.score || b.avg_rating - a.avg_rating);
}

/**
 * listStoresByCity — returns all distinct cities that have stores, plus
 * the store rows grouped under each city key.
 */
export async function listCities() {
  const db = await getDb();
  const rows = await db.getAllAsync(
    `SELECT DISTINCT city FROM stores WHERE city IS NOT NULL ORDER BY city ASC`
  );
  return (rows || []).map((r) => String(r.city)).filter(Boolean);
}

// ─── Favorites ────────────────────────────────────────────────────────────────

export async function replaceUserFavoriteStores(userUid, storeIds) {
  const db = await getDb();
  await db.runAsync(`DELETE FROM user_favorite_stores WHERE user_uid=?`, [String(userUid)]);
  const t = now();
  for (const sid of storeIds || []) {
    await db.runAsync(
      `INSERT INTO user_favorite_stores (user_uid, store_id, is_on, updated_at) VALUES (?, ?, 1, ?)
       ON CONFLICT(user_uid, store_id) DO UPDATE SET is_on=1, updated_at=excluded.updated_at`,
      [String(userUid), String(sid), t]
    );
  }
}

export async function setFavoriteStore(userUid, storeId, isOn) {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO user_favorite_stores (user_uid, store_id, is_on, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(user_uid, store_id) DO UPDATE SET is_on=excluded.is_on, updated_at=excluded.updated_at`,
    [String(userUid), String(storeId), isOn ? 1 : 0, now()]
  );
}

export async function listFavoriteStores(userUid, limit = 200) {
  const db = await getDb();
  return await db.getAllAsync(
    `SELECT s.*, st.avg_rating AS avg_rating, st.count AS review_count
     FROM user_favorite_stores f
     INNER JOIN stores s ON s.store_id = f.store_id
     LEFT JOIN store_review_stats st ON st.store_id = s.store_id
     WHERE f.user_uid=? AND f.is_on=1
     ORDER BY s.name_lower ASC
     LIMIT ?`,
    [String(userUid), Number(limit)]
  );
}
