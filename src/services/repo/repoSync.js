/**
 * repoSync.js — Sync outbox (sync_queue table) operations.
 *
 * Phase 4 additions:
 *   - Exponential back-off via next_retry_at column (DB schema v5)
 *   - Network-error reset: transient failures don't burn retry budget
 *   - Full getQueueStats / countPendingJobs for UI observability
 *   - clearStaleQueue for periodic housekeeping
 *
 * Back-off schedule (tries → delay before next attempt):
 *   1 →  30 s
 *   2 →  2 min
 *   3 →  10 min
 *   4 →  30 min
 *   5+ → permanently 'failed'
 */

import { getDb } from "../../db/db";

const now = () => Date.now();

// Exponential back-off delays, indexed by tries (1-based).
const BACKOFF_MS = [
  0,          // tries=0 (unused sentinel)
  30_000,     // tries=1 → 30 s
  120_000,    // tries=2 → 2 min
  600_000,    // tries=3 → 10 min
  1_800_000,  // tries=4 → 30 min
];
const MAX_TRIES = 5;

// ─── Enqueue ──────────────────────────────────────────────────────────────────

export async function enqueueUpdates(userUid, kind, updatesObj, meta = null) {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO sync_queue
       (user_uid, kind, updates_json, meta_json, status, tries,
        last_error, next_retry_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'pending', 0, NULL, NULL, ?, ?)`,
    [
      String(userUid),
      String(kind || "firebase_update"),
      JSON.stringify(updatesObj || {}),
      meta ? JSON.stringify(meta) : null,
      now(), now(),
    ]
  );
}

// ─── Drain (read ready jobs) ──────────────────────────────────────────────────

/**
 * Returns jobs that are due for execution right now.
 * Respects next_retry_at so back-off windows are honoured.
 */
export async function getPendingQueue(limit = 50) {
  const db = await getDb();
  const ts = now();
  return await db.getAllAsync(
    `SELECT * FROM sync_queue
     WHERE status IN ('pending', 'retry')
       AND (next_retry_at IS NULL OR next_retry_at <= ?)
     ORDER BY created_at ASC
     LIMIT ?`,
    [ts, Number(limit)]
  );
}

// ─── Post-drain state updates ─────────────────────────────────────────────────

export async function markQueueDone(id) {
  const db = await getDb();
  await db.runAsync(
    `UPDATE sync_queue
     SET status='done', next_retry_at=NULL, updated_at=?
     WHERE id=?`,
    [now(), Number(id)]
  );
}

/**
 * Mark a job as failed due to a logic/server error.
 * Increments the try counter and schedules the next back-off window.
 * After MAX_TRIES the job is permanently 'failed'.
 */
export async function markQueueFailed(id, errorMessage) {
  const db       = await getDb();
  const row      = await db.getFirstAsync(
    `SELECT tries FROM sync_queue WHERE id=?`, [Number(id)]
  );
  const tries       = Number(row?.tries || 0) + 1;
  const isPermanent = tries >= MAX_TRIES;
  const status      = isPermanent ? "failed" : "retry";
  const delayMs     = isPermanent
    ? null
    : (BACKOFF_MS[tries] ?? BACKOFF_MS[BACKOFF_MS.length - 1]);
  const nextRetryAt = delayMs != null ? now() + delayMs : null;

  await db.runAsync(
    `UPDATE sync_queue
     SET status=?, tries=?, last_error=?, next_retry_at=?, updated_at=?
     WHERE id=?`,
    [status, tries, String(errorMessage || "Unknown error"), nextRetryAt, now(), Number(id)]
  );
}

/**
 * Reset jobs that failed purely because the device was offline back to
 * 'pending' WITHOUT incrementing tries or imposing a back-off delay.
 *
 * syncCore tags network-failed jobs with last_error='__network__' so
 * they can be identified here. Call this at the start of each cycle
 * after confirming connectivity.
 */
export async function resetNetworkFailedJobs(userUid) {
  const db = await getDb();
  await db.runAsync(
    `UPDATE sync_queue
     SET status='pending', next_retry_at=NULL, last_error=NULL, updated_at=?
     WHERE user_uid=?
       AND status='retry'
       AND last_error='__network__'
       AND tries < ?`,
    [now(), String(userUid), MAX_TRIES]
  );
}

// ─── Housekeeping ─────────────────────────────────────────────────────────────

/**
 * Delete 'done' rows older than olderThanMs (default: 7 days).
 * Called periodically by syncCore to prevent unbounded table growth.
 */
export async function clearDoneQueue(olderThanMs = 7 * 24 * 3600 * 1000) {
  const db     = await getDb();
  const cutoff = now() - Number(olderThanMs);
  await db.runAsync(
    `DELETE FROM sync_queue WHERE status='done' AND updated_at < ?`,
    [cutoff]
  );
}

// Alias kept for callers that imported the old name.
export const clearStaleQueue = clearDoneQueue;

// ─── Observability ────────────────────────────────────────────────────────────

/**
 * Per-status counts for the useSyncStatus hook.
 * 'pending' in the return value is the total of jobs ready to run right now.
 */
export async function getQueueStats(userUid) {
  const db = await getDb();
  const ts = now();
  const row = await db.getFirstAsync(
    `SELECT
       COUNT(*) FILTER (WHERE status='pending' AND (next_retry_at IS NULL OR next_retry_at <= ?)) AS ready,
       COUNT(*) FILTER (WHERE status='retry'   AND (next_retry_at IS NULL OR next_retry_at <= ?)) AS retry_ready,
       COUNT(*) FILTER (WHERE status='retry'   AND next_retry_at > ?)                             AS retry_waiting,
       COUNT(*) FILTER (WHERE status='failed')                                                     AS failed,
       COUNT(*) FILTER (WHERE status='done')                                                       AS done
     FROM sync_queue
     WHERE user_uid=?`,
    [ts, ts, ts, String(userUid)]
  );
  return {
    ready:        Number(row?.ready         || 0),
    retryReady:   Number(row?.retry_ready   || 0),
    retryWaiting: Number(row?.retry_waiting || 0),
    failed:       Number(row?.failed        || 0),
    done:         Number(row?.done          || 0),
    pending:      Number(row?.ready || 0) + Number(row?.retry_ready || 0),
  };
}

/**
 * Lightweight pending count for notification badges.
 */
export async function countPendingJobs(userUid) {
  const db  = await getDb();
  const ts  = now();
  const row = await db.getFirstAsync(
    `SELECT COUNT(*) AS c FROM sync_queue
     WHERE user_uid=?
       AND status IN ('pending','retry')
       AND (next_retry_at IS NULL OR next_retry_at <= ?)`,
    [String(userUid), ts]
  );
  return Number(row?.c || 0);
}
