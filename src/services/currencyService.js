/**
 * currencyService
 *
 * Architecture rules implemented here:
 *   - user_settings.base_currency is the source of truth for display currency
 *   - each receipt / hub stores its own total_amount + currency_code (original)
 *   - exchange rates come from Currencylayer API, cached in the SQLite
 *     `currencies` table — not from Firebase RTDB
 *   - AsyncStorage is NOT used for rates (was the v2 approach)
 *   - formatMoney / convert are pure functions given a rates snapshot —
 *     screens never call the API directly; they use the useCurrency hook
 *   - fx_snapshot helpers let callers capture the rate at record-creation time
 */

import CURRENCY_CONFIG, {
  getCurrencyFlags,
  getCurrencyNames,
  getCurrencySymbols,
} from "../config/currencyConfig";
import { getDb } from "../db/db";

// ─── Static metadata (never changes) ─────────────────────────────────────────

const NAMES   = getCurrencyNames();
const SYMBOLS = getCurrencySymbols();
const FLAGS   = getCurrencyFlags();

const GCC_CODES = new Set(["AED", "SAR", "KWD", "QAR", "OMR", "BHD"]);

export const SUPPORTED_CURRENCIES = {};
CURRENCY_CONFIG.SUPPORTED_CURRENCIES.forEach((code) => {
  SUPPORTED_CURRENCIES[code] = {
    code,
    name:     NAMES[code]   || code,
    symbol:   SYMBOLS[code] || code,
    flag:     FLAGS[code]   || "",
    region:   GCC_CODES.has(code) ? "GCC" : "International",
    // GCC currencies display after the amount (e.g. "100.00 SAR")
    // International currencies display before (e.g. "$100.00")
    position: GCC_CODES.has(code) ? "after" : "before",
  };
});

export function getCurrencyInfo(code) {
  return SUPPORTED_CURRENCIES[String(code || "").toUpperCase()] || null;
}

export function isCurrencySupported(code) {
  return !!getCurrencyInfo(code);
}

export function getCurrencyDisplayName(code) {
  const info = getCurrencyInfo(code);
  return info ? `${info.flag} ${info.name}` : String(code || "");
}

// ─── SQLite rate cache ────────────────────────────────────────────────────────

/**
 * Read all cached rates from the `currencies` table.
 * Returns a map like { USDSAR: 3.75, USDAED: 3.67, ... } or null if empty.
 */
async function readCachedRatesFromDb() {
  try {
    const db = await getDb();
    const rows = await db.getAllAsync(
      `SELECT code, exchange_rate, updated_at FROM currencies`,
      []
    );
    if (!rows || rows.length === 0) return null;

    const rates = {};
    let oldestTs = Date.now();
    for (const row of rows) {
      rates[`USD${row.code}`] = Number(row.exchange_rate);
      if (row.updated_at && row.updated_at < oldestTs) oldestTs = row.updated_at;
    }
    return { rates, timestamp: oldestTs };
  } catch {
    return null;
  }
}

/**
 * Persist a rates map to the `currencies` table.
 * Expects { USDSAR: 3.75, ... } keyed as Currencylayer returns.
 */
async function writeRatesToDb(quotesMap, timestampMs) {
  try {
    const db = await getDb();
    for (const [key, rate] of Object.entries(quotesMap)) {
      // key format: "USDSAR" → code = "SAR"
      if (!key.startsWith("USD") || key.length !== 6) continue;
      const code = key.slice(3).toUpperCase();
      if (!isCurrencySupported(code)) continue;
      await db.runAsync(
        `INSERT INTO currencies (code, exchange_rate, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(code) DO UPDATE SET
           exchange_rate=excluded.exchange_rate,
           updated_at=excluded.updated_at`,
        [code, Number(rate), Number(timestampMs)]
      );
    }
  } catch {
    // non-fatal — we still have static fallback
  }
}

// ─── Static fallback rates ────────────────────────────────────────────────────

function getStaticRates() {
  return {
    rates: {
      USDAED: 3.6725,
      USDSAR: 3.75,
      USDKWD: 0.3075,
      USDQAR: 3.64,
      USDOMR: 0.385,
      USDBHD: 0.376,
      USDUSD: 1.0,
      USDEUR: 0.92,
      USDGBP: 0.79,
    },
    timestamp: Date.now(),
    source: "static",
  };
}

// ─── Live fetch ───────────────────────────────────────────────────────────────

let _fetchPromise = null; // prevents parallel fetches

async function fetchLiveRates() {
  if (_fetchPromise) return _fetchPromise;

  _fetchPromise = (async () => {
    try {
      const apiKey = CURRENCY_CONFIG.API_KEY;
      if (!apiKey) {
        console.warn("[currencyService] No API key — using cached/static rates.");
        return null;
      }

      const codes = CURRENCY_CONFIG.SUPPORTED_CURRENCIES.join(",");
      const url = `${CURRENCY_CONFIG.BASE_URL}?access_key=${apiKey}&currencies=${codes}&format=1`;

      const res  = await fetch(url);
      const data = await res.json();

      if (data?.success && data.quotes) {
        const ts = (data.timestamp || Math.floor(Date.now() / 1000)) * 1000;
        await writeRatesToDb(data.quotes, ts);
        return { rates: data.quotes, timestamp: ts, source: "live" };
      }
      console.warn("[currencyService] API returned error:", data?.error?.info);
      return null;
    } catch (e) {
      console.warn("[currencyService] Fetch failed:", e?.message);
      return null;
    } finally {
      _fetchPromise = null;
    }
  })();

  return _fetchPromise;
}

// ─── Main rate resolver ───────────────────────────────────────────────────────

/**
 * Get a rates snapshot, following this priority chain:
 *   1. SQLite cache (if fresh — within CACHE_DURATION)
 *   2. Live Currencylayer fetch → persisted to SQLite
 *   3. SQLite cache (even if stale — better than nothing)
 *   4. Static fallback hardcoded rates
 *
 * Returns { rates, timestamp, source } where source ∈ "live"|"cached"|"stale"|"static"
 */
export async function getRatesSnapshot() {
  const cached = await readCachedRatesFromDb();
  const now    = Date.now();
  const maxAge = CURRENCY_CONFIG.CACHE_DURATION || 30 * 60 * 1000;

  if (cached && now - cached.timestamp <= maxAge) {
    return { ...cached, source: "cached" };
  }

  // Cache is missing or stale — try live fetch
  const live = await fetchLiveRates();
  if (live) return { ...live, source: "live" };

  // Live failed — return stale cache if we have it
  if (cached) return { ...cached, source: "stale" };

  // No cache at all — static fallback
  return getStaticRates();
}

/**
 * Convenience: get the rate age in minutes/hours, or null if no cache.
 */
export async function getRateAge() {
  const cached = await readCachedRatesFromDb();
  if (!cached) return null;
  const ageMs = Date.now() - cached.timestamp;
  return {
    minutes:   Math.floor(ageMs / 60000),
    hours:     Math.floor(ageMs / 3600000),
    isExpired: ageMs > (CURRENCY_CONFIG.CACHE_DURATION || 30 * 60 * 1000),
    source:    cached.source || "cached",
  };
}

/**
 * Force a refresh regardless of cache age. Use in settings or pull-to-refresh.
 */
export async function refreshRates() {
  return fetchLiveRates();
}

// ─── Conversion ───────────────────────────────────────────────────────────────

/**
 * Convert an amount between two currencies using a provided rates snapshot.
 * This is a PURE function — no async, no SQLite, no network.
 * Callers should call getRatesSnapshot() once and reuse it.
 *
 * @param {number} amount
 * @param {string} fromCode  — e.g. "SAR"
 * @param {string} toCode    — e.g. "USD"
 * @param {object} ratesSnap — { rates: { USDSAR: 3.75, ... } }
 * @returns {{ convertedAmount: number, rate: number }}
 */
export function convertSync(amount, fromCode, toCode, ratesSnap) {
  const from = String(fromCode || "USD").toUpperCase();
  const to   = String(toCode   || "USD").toUpperCase();

  if (from === to) return { convertedAmount: Number(amount), rate: 1 };

  const rates    = ratesSnap?.rates || getStaticRates().rates;
  const fromRate = from === "USD" ? 1 : (rates[`USD${from}`] || null);
  const toRate   = to   === "USD" ? 1 : (rates[`USD${to}`]   || null);

  if (!fromRate || !toRate) {
    // Unsupported currency — return original amount
    return { convertedAmount: Number(amount), rate: 1 };
  }

  const usdAmount       = from === "USD" ? Number(amount) : Number(amount) / fromRate;
  const convertedAmount = to   === "USD" ? usdAmount      : usdAmount * toRate;
  const rate            = toRate / fromRate;

  return {
    convertedAmount: Number(convertedAmount.toFixed(2)),
    rate:            Number(rate.toFixed(6)),
  };
}

/**
 * Async convenience wrapper for single one-off conversions.
 * Prefer convertSync + getRatesSnapshot() when converting multiple amounts.
 */
export async function convert(amount, fromCode, toCode) {
  const snap = await getRatesSnapshot();
  return convertSync(amount, fromCode, toCode, snap);
}

// ─── Formatting ───────────────────────────────────────────────────────────────

/**
 * Format an amount in a given currency for display.
 * Pure function — no async.
 *
 * @param {number} amount
 * @param {string} code   — e.g. "SAR"
 * @param {object} opts   — { showSymbol?: bool, compact?: bool }
 */
export function formatMoney(amount, code, { showSymbol = true, compact = false } = {}) {
  const info     = getCurrencyInfo(code) || { symbol: String(code || ""), position: "after" };
  const num      = Number(amount || 0);
  const decimals = compact && num >= 1000 ? 0 : 2;

  const formatted = num.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  if (!showSymbol) return formatted;
  return info.position === "before"
    ? `${info.symbol}${formatted}`
    : `${formatted} ${info.symbol}`;
}

/**
 * Convert an amount to the user's base currency then format it.
 * Pure function given a rates snapshot.
 */
export function formatConverted(amount, fromCode, toCode, ratesSnap, opts = {}) {
  if (fromCode === toCode) return formatMoney(amount, toCode, opts);
  const { convertedAmount } = convertSync(amount, fromCode, toCode, ratesSnap);
  return formatMoney(convertedAmount, toCode, opts);
}

// ─── fx_snapshot helpers ──────────────────────────────────────────────────────

/**
 * Build the fx_snapshot fields to persist on a new receipt or hub.
 * Call once at record-creation time, store on the entity.
 *
 * Returns { fx_snapshot_rate, fx_snapshot_base } or { null, null } on failure.
 *
 * @param {string} recordCurrencyCode — the currency the amount is in
 * @param {string} baseCurrencyCode   — user's display/base currency
 * @param {object|null} ratesSnap     — if null, will fetch from DB/API
 */
export async function buildFxSnapshot(recordCurrencyCode, baseCurrencyCode, ratesSnap = null) {
  try {
    const from = String(recordCurrencyCode || "SAR").toUpperCase();
    const to   = String(baseCurrencyCode   || "SAR").toUpperCase();

    if (from === to) {
      return { fx_snapshot_rate: 1, fx_snapshot_base: to };
    }

    const snap = ratesSnap || await getRatesSnapshot();
    const { rate } = convertSync(1, from, to, snap);
    return { fx_snapshot_rate: rate, fx_snapshot_base: to };
  } catch {
    return { fx_snapshot_rate: null, fx_snapshot_base: null };
  }
}

/**
 * Use a stored fx_snapshot to convert an amount WITHOUT an API call.
 * Falls back to the live rates if the snapshot is missing.
 *
 * @param {number} amount
 * @param {number|null} snapshotRate — stored fx_snapshot_rate
 * @param {string|null} snapshotBase — stored fx_snapshot_base
 * @param {string}      displayCode  — user's current base_currency
 * @param {object}      ratesSnap    — current rates for fallback
 */
export function applyFxSnapshot(amount, snapshotRate, snapshotBase, displayCode, ratesSnap) {
  const to   = String(displayCode  || "SAR").toUpperCase();
  const base = String(snapshotBase || "").toUpperCase();

  // If snapshot base matches current display currency, use stored rate directly
  if (base === to && snapshotRate) {
    return Number((Number(amount) * Number(snapshotRate)).toFixed(2));
  }

  // Otherwise fall through to live rates
  const { convertedAmount } = convertSync(amount, base || "SAR", to, ratesSnap);
  return convertedAmount;
}

// ─── Default export (singleton-style object for callers expecting the old API) ─

export default {
  SUPPORTED_CURRENCIES,
  getCurrencyInfo,
  isCurrencySupported,
  getCurrencyDisplayName,
  getRatesSnapshot,
  getRateAge,
  refreshRates,
  convertSync,
  convert,
  formatMoney,
  formatConverted,
  buildFxSnapshot,
  applyFxSnapshot,
  // Legacy alias used by homeService.js
  formatCurrency: formatMoney,
};
