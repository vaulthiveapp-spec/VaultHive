/**
 * useReports — Phase 11
 *
 * Data hook for ReportsScreen.
 *
 * Loading strategy (offline-first):
 *   1. Read report_summary from local_cache  (written by syncCache Firebase listener)
 *      → gives executive_summary, protected_value, recovered_value, expiring_warranty_count
 *        sourced from server-computed Firebase node
 *   2. Run computeFullReport against SQLite receipts/hubs/warranties
 *      → gives real-time category breakdown, merchant breakdown, trend array
 *      → overrides Firebase cached totals with local truth when available
 *   3. Merge both sources: Firebase fields fill gaps, local computation wins on totals
 *
 * Currency: all money values passed to the hook consumer are already converted
 * to user.base_currency via computeFullReport's opts.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useCurrency } from "./useCurrency";
import { listAvailableMonths, computeFullReport } from "../services/repo/repoReceipts";
import { listUserCategories } from "../services/repo/repoUser";
import { getReportSummary } from "../services/repo/repoCache";

const EMPTY_REPORT = {
  period:                  null,
  total_spend:             0,
  receipt_count:           0,
  hub_count:               0,
  protected_value:         0,
  recovered_value:         0,
  expiring_warranty_count: 0,
  executive_summary:       null,
  by_category:             [],
  by_vendor:               [],
  by_merchant:             [],
  trend:                   [],
};

export function useReports() {
  const { user } = useAuth();
  const { baseCurrency, ratesSnap } = useCurrency();
  const uid = user?.uid;

  const [months,         setMonths]         = useState([]);
  const [selectedMonth,  setSelectedMonth]  = useState(null);
  const [report,         setReport]         = useState(EMPTY_REPORT);
  const [prevReport,     setPrevReport]     = useState(null);
  const [catMap,         setCatMap]         = useState({});
  const [loading,        setLoading]        = useState(true);
  const [refreshing,     setRefreshing]     = useState(false);

  const mountedRef = useRef(true);

  // ── Build category name map ─────────────────────────────────────────────
  const loadCatMap = useCallback(async () => {
    if (!uid) return {};
    try {
      const cats = await listUserCategories(uid, "purchases");
      const map  = {};
      (cats || []).forEach((c) => { map[String(c.category_id)] = c.name; });
      return map;
    } catch { return {}; }
  }, [uid]);

  // ── Merge Firebase cache + local computation ────────────────────────────
  const buildReport = useCallback(async (month) => {
    if (!uid || !month) return EMPTY_REPORT;

    const opts = { baseCurrency, ratesSnap };

    // Parallel: local computation + Firebase cache read
    const [computed, cached] = await Promise.all([
      computeFullReport(uid, month, opts).catch(() => null),
      getReportSummary(uid, month).catch(() => null),
    ]);

    if (!computed && !cached) return { ...EMPTY_REPORT, period: month };

    // Local computation is the truth for totals and breakdowns.
    // Firebase cache fills in server-derived fields (executive_summary,
    // protected_value as server-computed, recovered_value).
    const base = computed || { ...EMPTY_REPORT, period: month };

    return {
      ...base,
      // Prefer server protected_value when local is 0 (hub data may lag)
      protected_value: base.protected_value > 0
        ? base.protected_value
        : Number(cached?.protected_value || 0),
      recovered_value: base.recovered_value > 0
        ? base.recovered_value
        : Number(cached?.recovered_value || 0),
      expiring_warranty_count: Math.max(
        base.expiring_warranty_count,
        Number(cached?.expiring_warranty_count || 0)
      ),
      // Executive summary only comes from Firebase (server-generated)
      executive_summary: cached?.executive_summary || null,
      // by_merchant: merge local hub computation with Firebase's by_merchant
      by_merchant: base.by_merchant?.length > 0
        ? base.by_merchant
        : Object.entries(cached?.by_merchant || {}).map(([merchant, total]) => ({
            merchant,
            total: Number(total),
          })).sort((a, b) => b.total - a.total),
    };
  }, [uid, baseCurrency, ratesSnap]);

  // ── Main load ────────────────────────────────────────────────────────────
  const load = useCallback(async (monthOverride = null) => {
    if (!uid) { setLoading(false); return; }

    try {
      const [monthList, map] = await Promise.all([
        listAvailableMonths(uid, 24),
        loadCatMap(),
      ]);

      const list    = monthList || [];
      const current = monthOverride || selectedMonth || list[0] || null;

      if (!mountedRef.current) return;
      setMonths(list);
      setCatMap(map);

      if (!current) {
        setReport(EMPTY_REPORT);
        setPrevReport(null);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (!monthOverride) setSelectedMonth(current);

      // Load current + previous month in parallel
      const prevIdx   = list.findIndex((m) => m === current) + 1;
      const prevMonth = list[prevIdx] || null;

      const [cur, prev] = await Promise.all([
        buildReport(current),
        prevMonth ? buildReport(prevMonth) : Promise.resolve(null),
      ]);

      if (!mountedRef.current) return;
      setReport(cur);
      setPrevReport(prev);
    } catch {
      // Non-fatal
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [uid, selectedMonth, loadCatMap, buildReport]);

  useEffect(() => {
    mountedRef.current = true;
    setLoading(true);
    load();
    return () => { mountedRef.current = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, baseCurrency]);  // re-run when currency changes

  // ── Select a different month ─────────────────────────────────────────────
  const selectMonth = useCallback(async (month) => {
    if (!uid || month === selectedMonth) return;
    setSelectedMonth(month);
    setLoading(true);
    await load(month);
  }, [uid, selectedMonth, load]);

  // ── Refresh ──────────────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load(selectedMonth);
  }, [load, selectedMonth]);

  return {
    months,
    selectedMonth,
    report,
    prevReport,
    catMap,
    loading,
    refreshing,
    selectMonth,
    refresh,
    baseCurrency,
  };
}

export default useReports;
