/**
 * aiContextBuilder
 *
 * Builds the AI reasoning context by reading all relevant SQLite tables.
 * The result is cached in local_cache (key: ai_ctx:{uid}) with a 30-min TTL
 * so repeated sends within a session never re-query the database.
 *
 * Consumed by: aiService.chat(), AIAssistantScreen (via useAIContext hook).
 *
 * Context shape:
 * {
 *   generated_at:     number   — epoch ms
 *   spending_summary: { total_spend, top_categories, top_vendor, by_category }
 *   recent_hubs:      HubSummary[]        — last 15, ordered by date
 *   recent_receipts:  ReceiptSummary[]    — last 10
 *   recent_warranties:WarrantySummary[]   — last 10
 *   expiring_warranties: WarrantySummary[] — ending ≤90 days
 *   upcoming_reminders:  ReminderSummary[] — due ≤60 days, max 12
 *   attention_items:  AttentionSummary[]  — open high/medium only, max 8
 *   service_history:  ServiceSummary[]    — last 8
 *   claims:           ClaimSummary[]      — last 8, non-closed
 *   favorite_stores:  StoreSummary[]      — max 8
 *   store_candidates: StoreSummary[]      — scored per-request (empty here)
 * }
 */

import { listHubsFiltered }         from "./repo/repoHubs";
import { listReceipts }              from "./repo/repoReceipts";
import { listWarranties }            from "./repo/repoWarranties";
import { listUpcomingReminders }     from "./repo/repoReminders";
import { listAttentionItems }        from "./repo/repoAttention";
import { listFavoriteStores, listStores } from "./repo/repoStores";
import { getAIContextCache, setAIContextCache } from "./repo/repoCache";
import { getDb }                     from "../db/db";

// ─── Constants ────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min

export const CATEGORY_BY_ID = {
  1: "groceries",
  2: "electronics",
  3: "fashion",
  4: "pharmacy",
  5: "home",
  6: "subscriptions",
  7: "shopping",
};

// ─── Direct DB queries for tables not in the public repo API ──────────────────

async function queryServiceHistory(userUid, limit = 8) {
  try {
    const db = await getDb();
    return await db.getAllAsync(
      `SELECT service_id, hub_id, title, type, service_date, note
       FROM service_history
       WHERE user_uid=? AND is_deleted=0
       ORDER BY service_date DESC, created_at_ms DESC
       LIMIT ?`,
      [String(userUid), Number(limit)]
    );
  } catch {
    return [];
  }
}

async function queryClaims(userUid, limit = 8) {
  try {
    const db = await getDb();
    return await db.getAllAsync(
      `SELECT claim_id, hub_id, kind, status, note, created_date
       FROM claims
       WHERE user_uid=? AND is_deleted=0 AND status != 'closed'
       ORDER BY created_at_ms DESC
       LIMIT ?`,
      [String(userUid), Number(limit)]
    );
  } catch {
    return [];
  }
}

// ─── Spend summary ────────────────────────────────────────────────────────────

function computeSpendSummary(receipts = []) {
  const byCategory = {};
  const byVendor = {};
  let total = 0;

  for (const r of receipts) {
    const cat = CATEGORY_BY_ID[Number(r.category_id || 0)] || "shopping";
    const amt = Number(r.total_amount || 0);
    byCategory[cat] = (byCategory[cat] || 0) + amt;
    total += amt;

    const vendor = String(r.vendor_name || "").trim();
    if (vendor) byVendor[vendor] = (byVendor[vendor] || 0) + amt;
  }

  const topCategories = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k]) => k);

  const topVendor =
    Object.entries(byVendor).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  return { total_spend: total, top_categories: topCategories, top_vendor: topVendor, by_category: byCategory };
}

// ─── Warranty expiry filter ───────────────────────────────────────────────────

function filterExpiring(warranties = [], maxDays = 90) {
  return warranties.filter((w) => {
    if (!w.warranty_end) return false;
    try {
      const d = new Date(`${w.warranty_end}T00:00:00`);
      const days = Math.ceil((d.getTime() - Date.now()) / 86400000);
      return days >= 0 && days <= maxDays;
    } catch {
      return false;
    }
  });
}

// ─── Shape mappers ────────────────────────────────────────────────────────────

const mapHub = (h) => ({
  hub_id:          h.hub_id,
  title:           h.title,
  merchant_name:   h.merchant_name,
  store_id:        h.store_id,
  purchase_date:   h.purchase_date,
  return_deadline: h.return_deadline,
  total_amount:    h.total_amount,
  currency_code:   h.currency_code,
  status:          h.status,
  category_name:   h.category_name_snapshot,
});

const mapReceipt = (r) => ({
  receipt_id:    r.receipt_id,
  vendor_name:   r.vendor_name,
  purchase_date: r.purchase_date,
  total_amount:  r.total_amount,
  currency_code: r.currency_code,
  category:      CATEGORY_BY_ID[Number(r.category_id || 0)] || "shopping",
  note:          r.note || null,
});

const mapWarranty = (w) => ({
  warranty_id:   w.warranty_id,
  product_name:  w.product_name,
  warranty_end:  w.warranty_end,
  warranty_start:w.warranty_start,
  serial_number: w.serial_number,
  terms_note:    w.terms_note || null,
  hub_id:        w.hub_id || null,
  receipt_id:    w.receipt_id || null,
});

const mapReminder = (r) => ({
  reminder_id:  r.reminder_id,
  type:         r.type,
  due_date:     r.due_date,
  target_type:  r.target_type,
  target_id:    r.target_id,
});

const mapAttention = (a) => ({
  attention_id:        a.attention_id,
  title:               a.title,
  description:         a.description,
  severity:            a.severity,
  type:                a.type,
  due_date:            a.due_date,
  linked_entity_type:  a.linked_entity_type,
  linked_entity_id:    a.linked_entity_id,
});

const mapService = (s) => ({
  service_id:   s.service_id,
  hub_id:       s.hub_id,
  title:        s.title,
  type:         s.type,
  service_date: s.service_date,
  note:         s.note || null,
});

const mapClaim = (c) => ({
  claim_id:     c.claim_id,
  hub_id:       c.hub_id,
  kind:         c.kind,
  status:       c.status,
  note:         c.note || null,
  created_date: c.created_date || null,
});

const mapStore = (s) => ({
  store_id: s.store_id,
  name:     s.name,
  city:     s.city || null,
  verified: !!s.verified,
  url:      s.url || null,
});

// ─── Main builder ─────────────────────────────────────────────────────────────

/**
 * Build (or return cached) AI context for a user.
 *
 * @param {string} userUid
 * @param {{ forceRefresh?: boolean }} opts
 * @returns {Promise<object|null>}
 */
export async function buildAIContext(userUid, { forceRefresh = false } = {}) {
  if (!userUid) return null;

  // ── Try cache first ─────────────────────────────────────────────────────────
  if (!forceRefresh) {
    try {
      const cached = await getAIContextCache(userUid);
      if (cached && !cached.stale) return cached;
    } catch {}
  }

  // ── Parallel data fetch ─────────────────────────────────────────────────────
  const [
    hubs,
    receipts,
    warranties,
    reminders,
    attentionItems,
    favoriteStores,
    serviceHistory,
    claims,
  ] = await Promise.all([
    listHubsFiltered(userUid, { sort: "date_desc", limit: 20 }).catch(() => []),
    listReceipts(userUid, 30).catch(() => []),
    listWarranties(userUid, 20).catch(() => []),
    listUpcomingReminders(userUid, 60, 15).catch(() => []),
    listAttentionItems(userUid, 12).catch(() => []),
    listFavoriteStores(userUid, 8).catch(() => []),
    queryServiceHistory(userUid, 8),
    queryClaims(userUid, 8),
  ]);

  const spendingSummary    = computeSpendSummary(receipts);
  const expiringWarranties = filterExpiring(warranties, 90);

  // Attention: only high/medium are AI-actionable
  const urgentAttention = (attentionItems || []).filter(
    (a) => a.severity === "high" || a.severity === "medium"
  );

  const context = {
    generated_at:       Date.now(),
    spending_summary:   spendingSummary,
    recent_hubs:        (hubs          || []).slice(0, 15).map(mapHub),
    recent_receipts:    (receipts      || []).slice(0, 10).map(mapReceipt),
    recent_warranties:  (warranties    || []).slice(0, 10).map(mapWarranty),
    expiring_warranties: expiringWarranties.slice(0, 6).map(mapWarranty),
    upcoming_reminders: (reminders     || []).slice(0, 12).map(mapReminder),
    attention_items:    urgentAttention.slice(0, 8).map(mapAttention),
    service_history:    (serviceHistory|| []).map(mapService),
    claims:             (claims        || []).map(mapClaim),
    favorite_stores:    (favoriteStores|| []).slice(0, 8).map(mapStore),
    store_candidates:   [],   // filled per-request in aiService
  };

  // ── Write cache ──────────────────────────────────────────────────────────────
  try {
    await setAIContextCache(userUid, context);
  } catch {}

  return context;
}

/**
 * Score and attach store candidates to an existing context object
 * based on the user's message intent. Mutates context.store_candidates.
 */
export async function attachStoreCandidates(context, userUid, messageText = "") {
  try {
    const allStores = await listStores({ limit: 60, userUid }).catch(() => []);
    const favoriteIds = new Set((context.favorite_stores || []).map((s) => String(s.store_id)));
    const spendCats = context.spending_summary?.top_categories || [];

    const msgLower = String(messageText).toLowerCase();
    let requestedCategory = "shopping";
    if (msgLower.includes("electronic") || msgLower.includes("laptop") || msgLower.includes("phone")) requestedCategory = "electronics";
    else if (msgLower.includes("grocer") || msgLower.includes("food") || msgLower.includes("supermarket")) requestedCategory = "groceries";
    else if (msgLower.includes("fashion") || msgLower.includes("cloth") || msgLower.includes("shoes")) requestedCategory = "fashion";
    else if (msgLower.includes("pharma") || msgLower.includes("medic") || msgLower.includes("health")) requestedCategory = "pharmacy";
    else if (msgLower.includes("home") || msgLower.includes("furniture") || msgLower.includes("kitchen")) requestedCategory = "home";

    const scored = (allStores || []).map((store) => {
      let cats = [];
      try { cats = Object.keys(JSON.parse(store.categories_json || "{}")); } catch {}

      let score = store.verified ? 3 : 0;
      if (favoriteIds.has(String(store.store_id))) score += 5;
      if (cats.includes(requestedCategory)) score += 5;
      if (spendCats.includes(requestedCategory)) score += 2;

      let reason = "Good overall match";
      if (favoriteIds.has(String(store.store_id))) reason = "Already in your saved stores";
      else if (cats.includes(requestedCategory)) reason = `Strong match for ${requestedCategory}`;

      return { ...mapStore(store), score, reason, categories: cats };
    }).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)).slice(0, 6);

    context.store_candidates = scored;
  } catch {}

  return context;
}
