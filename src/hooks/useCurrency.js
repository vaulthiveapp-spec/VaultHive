/**
 * useCurrency hook
 *
 * Single point of contact for all currency display logic in screens.
 * Screens never import currencyService directly — they use this hook.
 *
 * Usage:
 *   const { fmt, fmtOriginal, convert, ratesReady } = useCurrency();
 *
 *   // Format in user's base currency (converts if needed)
 *   fmt(item.total_amount, item.currency_code)
 *   // → "3,750.00 SAR"
 *
 *   // Format in the original transaction currency (no conversion)
 *   fmtOriginal(item.total_amount, item.currency_code)
 *   // → "1,000.00 USD"
 *
 *   // Use stored fx_snapshot (fastest, no API call)
 *   fmtSnapshot(item.total_amount, item.fx_snapshot_rate, item.fx_snapshot_base)
 *
 *   // Raw numeric conversion
 *   convert(amount, fromCode)   → number in baseCurrency
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import {
  getRatesSnapshot,
  convertSync,
  formatMoney,
  formatConverted,
  applyFxSnapshot,
  getCurrencyInfo,
  SUPPORTED_CURRENCIES,
} from "../services/currencyService";

const STALE_THRESHOLD_MS = 30 * 60 * 1000; // 30 min — matches CACHE_DURATION

export function useCurrency() {
  const { user } = useAuth();
  const baseCurrency = String(user?.base_currency || "SAR").toUpperCase();

  const [ratesSnap, setRatesSnap]   = useState(null);
  const [ratesReady, setRatesReady] = useState(false);
  const [ratesSource, setRatesSource] = useState(null); // "live"|"cached"|"stale"|"static"
  const mountedRef = useRef(true);

  const loadRates = useCallback(async () => {
    try {
      const snap = await getRatesSnapshot();
      if (!mountedRef.current) return;
      setRatesSnap(snap);
      setRatesSource(snap.source);
      setRatesReady(true);
    } catch {
      if (!mountedRef.current) return;
      setRatesReady(true); // still mark ready so UI renders with static fallback
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    loadRates();
    return () => { mountedRef.current = false; };
  }, [loadRates]);

  // ─── Formatters ─────────────────────────────────────────────────────────────

  /**
   * Format amount converting from recordCurrency → baseCurrency.
   * Shows baseCurrency symbol. If already in baseCurrency, no conversion.
   */
  const fmt = useCallback(
    (amount, recordCurrencyCode, opts = {}) =>
      formatConverted(
        amount,
        String(recordCurrencyCode || baseCurrency).toUpperCase(),
        baseCurrency,
        ratesSnap,
        opts
      ),
    [baseCurrency, ratesSnap]
  );

  /**
   * Format in the original transaction currency with no conversion.
   * Use on detail screens where you want to show the original price.
   */
  const fmtOriginal = useCallback(
    (amount, recordCurrencyCode, opts = {}) =>
      formatMoney(amount, String(recordCurrencyCode || baseCurrency).toUpperCase(), opts),
    [baseCurrency]
  );

  /**
   * Format using a stored fx_snapshot (fastest path — no live rates needed).
   * Falls back to ratesSnap if snapshot is missing.
   */
  const fmtSnapshot = useCallback(
    (amount, snapshotRate, snapshotBase, opts = {}) => {
      const converted = applyFxSnapshot(amount, snapshotRate, snapshotBase, baseCurrency, ratesSnap);
      return formatMoney(converted, baseCurrency, opts);
    },
    [baseCurrency, ratesSnap]
  );

  /**
   * Raw numeric conversion from recordCurrency → baseCurrency.
   */
  const convert = useCallback(
    (amount, recordCurrencyCode) => {
      const { convertedAmount } = convertSync(
        amount,
        String(recordCurrencyCode || baseCurrency).toUpperCase(),
        baseCurrency,
        ratesSnap
      );
      return convertedAmount;
    },
    [baseCurrency, ratesSnap]
  );

  /**
   * Sum an array of { total_amount, currency_code } rows into baseCurrency.
   */
  const sumToBase = useCallback(
    (rows) =>
      (rows || []).reduce(
        (acc, row) => acc + convert(row.total_amount || 0, row.currency_code || baseCurrency),
        0
      ),
    [convert, baseCurrency]
  );

  return {
    baseCurrency,
    ratesSnap,
    ratesReady,
    ratesSource,
    fmt,
    fmtOriginal,
    fmtSnapshot,
    convert,
    sumToBase,
    getCurrencyInfo,
    supportedCurrencies: SUPPORTED_CURRENCIES,
    refreshRates: loadRates,
  };
}

export default useCurrency;
