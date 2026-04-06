/**
 * homeService
 *
 * Single data contract for HomeScreen. Reads:
 *   1. Firebase home_cache/{uid}          – pre-aggregated summary + store recs
 *   2. Firebase attention_items/{uid}     – open attention items (sorted by severity)
 *   3. Firebase purchase_hubs/{uid}       – recent hubs (newest 5)
 *   4. SQLite reminders                   – upcoming deadlines (always local)
 *   5. SQLite user_settings               – base_currency
 *   6. SQLite stores / receipts / warranties – fallback when Firebase is stale/absent
 *
 * Phase 3 will add SQLite tables for hubs and attention_items so the Firebase
 * reads here become secondary reads of an always-warm local cache. The service
 * interface stays identical — HomeScreen never changes.
 */

import { ref, get } from "firebase/database";
import { database } from "../config/firebase";
import {
  getUserSettings,
  listUpcomingReminders,
  listStores,
  computeMonthlyReport,
} from "./localRepo";
import { formatMoney as _formatMoney } from "./currencyService";

// ─── Types (JSDoc) ─────────────────────────────────────────────────────────────
/**
 * @typedef {Object} HomeSummary
 * @property {string}  monthKey
 * @property {number}  totalSpendThisMonth
 * @property {string}  currency
 * @property {number}  totalPurchases
 * @property {number}  activeWarrantyCount
 * @property {number}  openAttentionCount
 * @property {string|null} topCategoryName
 * @property {string|null} topMerchantName
 */

/**
 * @typedef {Object} AttentionItem
 * @property {string} attention_id
 * @property {string} title
 * @property {string} description
 * @property {'high'|'medium'|'low'} severity
 * @property {string} type
 * @property {string|null} due_date
 * @property {{id:string,type:string}|null} linked_entity
 * @property {string[]} actions
 */

/**
 * @typedef {Object} RecentHub
 * @property {string} hub_id
 * @property {string} title
 * @property {string} merchant_name
 * @property {string} purchase_date
 * @property {number} total_amount
 * @property {string} currency_code
 * @property {string} status
 * @property {string} category_name_snapshot
 * @property {string|null} return_deadline
 * @property {string|null} warranty_id
 */

/**
 * @typedef {Object} HomeReminder
 * @property {string} reminder_id
 * @property {string} type
 * @property {string} due_date
 * @property {string} target_type
 * @property {string} target_id
 */

/**
 * @typedef {Object} HomeStore
 * @property {string} store_id
 * @property {string} name
 * @property {number} avg_rating
 * @property {number} review_count
 * @property {string[]} categories
 * @property {string} reason
 * @property {boolean} is_favorite
 */

/**
 * @typedef {Object} HomeData
 * @property {HomeSummary}     summary
 * @property {AttentionItem[]} attentionItems
 * @property {RecentHub[]}     recentHubs
 * @property {HomeReminder[]}  reminders
 * @property {HomeStore[]}     recommendedStores
 * @property {string}          baseCurrency
 * @property {boolean}         fromCache        – true when summary came from home_cache
 * @property {number|null}     cacheAgeMs
 */

// ─── Helpers ───────────────────────────────────────────────────────────────────

const safeGet = async (path) => {
  try {
    const snap = await get(ref(database, path));
    return snap.exists() ? snap.val() : null;
  } catch {
    return null;
  }
};

const currentMonthKey = () => new Date().toISOString().slice(0, 7);

const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 };

function normalizeAttentionItems(raw) {
  if (!raw || typeof raw !== "object") return [];
  return Object.values(raw)
    .filter((item) => item?.status === "open")
    .map((item) => ({
      attention_id: String(item.attention_id || ""),
      title: String(item.title || ""),
      description: String(item.description || ""),
      severity: item.severity || "low",
      type: String(item.type || ""),
      due_date: item.due_date || null,
      linked_entity: item.linked_entity || null,
      actions: Array.isArray(item.actions) ? item.actions : [],
      sort_order: Number(item.sort_order ?? 99),
    }))
    .sort(
      (a, b) =>
        (SEVERITY_ORDER[a.severity] ?? 2) - (SEVERITY_ORDER[b.severity] ?? 2) ||
        a.sort_order - b.sort_order
    )
    .slice(0, 5);
}

function normalizeHubs(raw) {
  if (!raw || typeof raw !== "object") return [];
  return Object.values(raw)
    .filter((h) => h?.purchase_hub_id)
    .map((h) => ({
      hub_id: String(h.purchase_hub_id),
      title: String(h.title || ""),
      merchant_name: String(h.merchant_name || ""),
      purchase_date: String(h.purchase_date || ""),
      total_amount: Number(h.total_amount || 0),
      currency_code: String(h.currency_code || "SAR").toUpperCase(),
      status: String(h.status || "active"),
      category_name_snapshot: String(h.category_name_snapshot || ""),
      return_deadline: h.return_deadline || null,
      warranty_id: h.warranty_id || null,
      updated_at_ms: Number(h.updated_at_ms || h.created_at_ms || 0),
    }))
    .sort((a, b) => b.updated_at_ms - a.updated_at_ms)
    .slice(0, 5);
}

function normalizeCachedStores(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, 4).map((s) => ({
    store_id: String(s.store_id || ""),
    name: String(s.name || ""),
    avg_rating: Number(s.avg_rating || 0),
    review_count: Number(s.review_count || 0),
    categories: Array.isArray(s.categories) ? s.categories : [],
    reason: String(s.reason || ""),
    is_favorite: false,
  }));
}

function normalizeLocalStores(rows) {
  return (rows || []).slice(0, 4).map((s) => {
    let cats = [];
    try {
      if (s.categories_json) cats = Object.keys(JSON.parse(s.categories_json));
    } catch {}
    return {
      store_id: String(s.store_id || ""),
      name: String(s.name || ""),
      avg_rating: Number(s.avg_rating || 0),
      review_count: Number(s.review_count || 0),
      categories: cats,
      reason: "Recommended for you",
      is_favorite: s.is_favorite === true || Number(s.is_favorite) === 1,
    };
  });
}

function normalizeReminders(rows) {
  return (rows || []).slice(0, 5).map((r) => ({
    reminder_id: String(r.reminder_id || ""),
    type: String(r.type || ""),
    due_date: String(r.due_date || ""),
    target_type: String(r.target_type || ""),
    target_id: String(r.target_id || ""),
  }));
}

// ─── Main loader ───────────────────────────────────────────────────────────────

/**
 * Load all data needed by HomeScreen.
 * Never throws — returns partial data with errors surfaced via the caller's
 * try/catch or network-check layer.
 *
 * @param {string} uid
 * @returns {Promise<HomeData>}
 */
export async function loadHomeData(uid) {
  if (!uid) {
    return emptyHomeData("SAR");
  }

  // 1. Base currency from SQLite (always available after first login)
  let baseCurrency = "SAR";
  try {
    const settings = await getUserSettings(uid);
    baseCurrency = String(settings?.base_currency || "SAR").toUpperCase();
  } catch {}

  // 2. Firebase reads — run concurrently, fail independently
  const [homeCache, attentionRaw, hubsRaw] = await Promise.all([
    safeGet(`home_cache/${uid}`),
    safeGet(`attention_items/${uid}`),
    safeGet(`purchase_hubs/${uid}`),
  ]);

  // 3. Always-local reads
  const [reminderRows, localStoreRows] = await Promise.all([
    listUpcomingReminders(uid, 45, 5).catch(() => []),
    listStores({ userUid: uid, limit: 8 }).catch(() => []),
  ]);

  // 4. Build summary — prefer home_cache, fall back to live SQLite query
  let summary;
  let fromCache = false;
  let cacheAgeMs = null;

  if (homeCache?.summary) {
    const s = homeCache.summary;
    const generatedAt = homeCache.generated_at
      ? new Date(homeCache.generated_at).getTime()
      : null;
    cacheAgeMs = generatedAt ? Date.now() - generatedAt : null;

    summary = {
      monthKey: String(homeCache.month_key || currentMonthKey()),
      totalSpendThisMonth: Number(s.total_spend_this_month || 0),
      currency: baseCurrency,
      totalPurchases: Number(s.total_purchases || 0),
      activeWarrantyCount: Number(s.active_warranty_count || 0),
      openAttentionCount: Number(s.open_attention_count || 0),
      topCategoryName: s.top_category_name || null,
      topMerchantName: s.top_merchant_name || null,
    };
    fromCache = true;
  } else {
    // Fallback: compute from SQLite receipts for current month
    const month = currentMonthKey();
    let report = { total_spend: 0, by_vendor: [] };
    try {
      report = await computeMonthlyReport(uid, month);
    } catch {}

    summary = {
      monthKey: month,
      totalSpendThisMonth: Number(report.total_spend || 0),
      currency: baseCurrency,
      totalPurchases: (report.by_vendor || []).length,
      activeWarrantyCount: 0,
      openAttentionCount: 0,
      topCategoryName: null,
      topMerchantName: report.by_vendor?.[0]?.vendor || null,
    };
  }

  // 5. Attention items
  const attentionItems = normalizeAttentionItems(attentionRaw);

  // 6. Recent hubs
  const recentHubs = normalizeHubs(hubsRaw);

  // 7. Reminders
  const reminders = normalizeReminders(reminderRows);

  // 8. Recommended stores — prefer home_cache list, fall back to local
  let recommendedStores;
  if (homeCache?.recommended_stores?.length) {
    recommendedStores = normalizeCachedStores(homeCache.recommended_stores);
  } else {
    recommendedStores = normalizeLocalStores(localStoreRows);
  }

  return {
    summary,
    attentionItems,
    recentHubs,
    reminders,
    recommendedStores,
    baseCurrency,
    fromCache,
    cacheAgeMs,
  };
}

/**
 * @deprecated Phase 5 — use the `useCurrency()` hook's `fmt()` function instead.
 *
 * This wrapper only formats numbers — it does NOT convert between currencies.
 * A hub stored in USD will display as "1000.00 USD" regardless of the user's
 * base_currency setting.  Screens that previously imported this function have
 * been migrated to `useCurrency().fmt(amount, currencyCode)` which performs
 * full Currencylayer conversion through the cached rates pipeline.
 *
 * This export is retained temporarily so callers outside the screen layer
 * (e.g. notification builders, server-side scripts) can still format amounts
 * without a React hook.  Do NOT add new callers.
 */
export function formatMoney(amount, currencyCode) {
  try {
    return _formatMoney(Number(amount || 0), String(currencyCode || "SAR"));
  } catch {
    return `${String(currencyCode || "SAR")} ${Number(amount || 0).toFixed(2)}`;
  }
}

/**
 * Empty skeleton when uid is missing.
 * @param {string} baseCurrency
 * @returns {HomeData}
 */
function emptyHomeData(baseCurrency) {
  return {
    summary: {
      monthKey: currentMonthKey(),
      totalSpendThisMonth: 0,
      currency: baseCurrency,
      totalPurchases: 0,
      activeWarrantyCount: 0,
      openAttentionCount: 0,
      topCategoryName: null,
      topMerchantName: null,
    },
    attentionItems: [],
    recentHubs: [],
    reminders: [],
    recommendedStores: [],
    baseCurrency,
    fromCache: false,
    cacheAgeMs: null,
  };
}
