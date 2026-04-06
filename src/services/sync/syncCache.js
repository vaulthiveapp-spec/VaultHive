import { ref, onValue } from "firebase/database";
import { database } from "../../config/firebase";
import { setHomeCache, setReportSummary, setAIContextCache } from "../localRepo";

/**
 * Cache listeners write server-derived payloads into local_cache.
 * These nodes are NEVER written by the device — they are computed server-side.
 * Treating them as cached/derived means:
 *   - No dirty flag, no sync_queue entry, no offlineActions function
 *   - The app reads from local_cache first (fast, offline-safe)
 *   - Firebase listener refreshes local_cache whenever connectivity returns
 */
export function registerListeners(userUid, unsubs) {
  // ── home_cache ──────────────────────────────────────────────────────────────
  unsubs.push(onValue(ref(database, `home_cache/${userUid}`), async (snap) => {
    const v = snap.val();
    if (!v) return;
    await setHomeCache(userUid, v).catch(() => {});
  }));

  // ── report_summaries ────────────────────────────────────────────────────────
  unsubs.push(onValue(ref(database, `report_summaries/${userUid}`), async (snap) => {
    const v = snap.val();
    if (!v) return;
    // The node may contain multiple month keys or be a single report
    if (v.month_key) {
      await setReportSummary(userUid, v.month_key, v).catch(() => {});
    } else {
      // Keyed by month: { "2026-03": {...}, "2026-02": {...} }
      for (const [month, report] of Object.entries(v)) {
        if (!report?.month_key && !month.match(/^\d{4}-\d{2}$/)) continue;
        await setReportSummary(userUid, report.month_key || month, report).catch(() => {});
      }
    }
  }));

  // ── ai_context_cache ────────────────────────────────────────────────────────
  unsubs.push(onValue(ref(database, `ai_context_cache/${userUid}`), async (snap) => {
    const v = snap.val();
    if (!v) return;
    await setAIContextCache(userUid, v).catch(() => {});
  }));
}
