/**
 * useSyncStatus
 *
 * Polls the sync_queue table and exposes live counts so any screen or
 * component can observe the current offline-sync state without coupling
 * to the sync engine internals.
 *
 * Usage:
 *   const { pending, failed, isSyncing, hasFailed, refresh } = useSyncStatus();
 *
 * Where:
 *   pending   — number of jobs ready to run right now (respects back-off)
 *   failed    — permanently failed jobs needing attention
 *   isSyncing — true while a sync cycle is in progress (optimistic)
 *   hasFailed — convenience bool (failed > 0)
 *   refresh   — manually re-poll (useful after a forced sync action)
 *
 * Poll interval: 10 s while app is foregrounded, paused otherwise.
 * The interval intentionally does NOT trigger a sync cycle — it only
 * reads the DB. The sync engine itself is driven by NetInfo events and
 * the AuthContext bootstrap.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useAuth } from "../context/AuthContext";
import { getQueueStats } from "../services/queueService";
import { runSyncCycle } from "../services/firebaseSync";

const POLL_MS = 10_000; // 10 s

const EMPTY_STATS = {
  pending:      0,
  retryReady:   0,
  retryWaiting: 0,
  failed:       0,
  done:         0,
};

export function useSyncStatus() {
  const { user, isAuthenticated } = useAuth();
  const uid = user?.uid;

  const [stats, setStats]       = useState(EMPTY_STATS);
  const [isSyncing, setIsSyncing] = useState(false);
  const mountedRef = useRef(true);
  const timerRef   = useRef(null);

  const poll = useCallback(async () => {
    if (!uid || !isAuthenticated) return;
    try {
      const s = await getQueueStats(uid);
      if (mountedRef.current) setStats(s);
    } catch {}
  }, [uid, isAuthenticated]);

  // Start / stop the poll timer based on AppState.
  useEffect(() => {
    mountedRef.current = true;

    const startTimer = () => {
      poll();
      timerRef.current = setInterval(poll, POLL_MS);
    };
    const stopTimer = () => {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    };

    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") startTimer();
      else stopTimer();
    });

    startTimer();

    return () => {
      mountedRef.current = false;
      stopTimer();
      sub.remove();
    };
  }, [poll]);

  // Manual trigger: runs a sync cycle then re-polls.
  const refresh = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsSyncing(true);
    try {
      await runSyncCycle();
    } catch {}
    setIsSyncing(false);
    await poll();
  }, [isAuthenticated, poll]);

  return {
    pending:      stats.pending,
    retryWaiting: stats.retryWaiting,
    failed:       stats.failed,
    done:         stats.done,
    hasFailed:    stats.failed > 0,
    isSyncing,
    refresh,
  };
}

export default useSyncStatus;
