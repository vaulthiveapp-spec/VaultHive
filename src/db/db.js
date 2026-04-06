import * as SQLite from "expo-sqlite";
import { LOCAL_DB_VERSION, SCHEMA_SQL } from "./schema";

let _db = null;

export async function getDb() {
  if (_db) return _db;
  _db = await SQLite.openDatabaseAsync("vaulthive.db");
  await migrateIfNeeded(_db);
  return _db;
}

// ---------------------------------------------------------------------------
// Migration runner
//
// Rules:
//   1. Fresh install (user_version = 0) — run full SCHEMA_SQL, stamp version.
//   2. Existing db (user_version < LOCAL_DB_VERSION) — run each version's
//      ALTER TABLE / data-patch steps, then run SCHEMA_SQL to create any new
//      tables added in this version (CREATE TABLE IF NOT EXISTS is safe to
//      re-run), then stamp.
//   3. tryExec swallows errors so ADD COLUMN is idempotent on repeat runs.
// ---------------------------------------------------------------------------
async function migrateIfNeeded(db) {
  const row = await db.getFirstAsync("PRAGMA user_version");
  const current = row?.user_version ?? 0;

  if (current >= LOCAL_DB_VERSION) return;

  const tryExec = async (sql) => {
    try { await db.execAsync(sql); } catch { /* idempotent — ignore */ }
  };

  // ── Fresh install ─────────────────────────────────────────────────────────
  if (current === 0) {
    await db.execAsync(SCHEMA_SQL);
    await db.execAsync(`PRAGMA user_version = ${LOCAL_DB_VERSION}`);
    return;
  }

  // ── v1 → v2 ───────────────────────────────────────────────────────────────
  if (current < 2) {
    await tryExec(`ALTER TABLE user_settings ADD COLUMN base_currency TEXT;`);
    await tryExec(`ALTER TABLE user_settings ADD COLUMN notif_sound TEXT;`);
    await tryExec(`UPDATE user_settings SET base_currency='SAR'    WHERE base_currency IS NULL OR base_currency='';`);
    await tryExec(`UPDATE user_settings SET notif_sound='default'  WHERE notif_sound IS NULL OR notif_sound='';`);

    await tryExec(`ALTER TABLE receipts ADD COLUMN currency_code TEXT;`);
    await tryExec(`UPDATE receipts SET currency_code='SAR' WHERE currency_code IS NULL OR currency_code='';`);

    await tryExec(`ALTER TABLE reminders ADD COLUMN updated_at INTEGER;`);
    await tryExec(`ALTER TABLE reminders ADD COLUMN local_notif_id TEXT;`);
    await tryExec(`UPDATE reminders SET updated_at=created_at WHERE updated_at IS NULL;`);
  }

  // ── v2 → v3 ───────────────────────────────────────────────────────────────
  if (current < 3) {
    // user_settings: enforce NOT NULL default on base_currency
    await tryExec(`UPDATE user_settings SET base_currency='SAR' WHERE base_currency IS NULL OR base_currency='';`);

    // New tables are created below via SCHEMA_SQL (CREATE TABLE IF NOT EXISTS).
    // Only columns added to EXISTING tables need explicit ALTER TABLE here.
    // (None required for v3 — all new entities are new tables.)
  }

  // ── v3 → v4 ───────────────────────────────────────────────────────────────
  // Adds fx_snapshot_rate / fx_snapshot_base to receipts and purchase_hubs.
  // These capture the exchange rate at the time of record creation so that
  // historical reports can display original-currency values without a live
  // API call.  Both columns are nullable — existing rows simply lack a snapshot.
  if (current < 4) {
    await tryExec(`ALTER TABLE receipts ADD COLUMN fx_snapshot_rate REAL;`);
    await tryExec(`ALTER TABLE receipts ADD COLUMN fx_snapshot_base TEXT;`);
    await tryExec(`ALTER TABLE purchase_hubs ADD COLUMN fx_snapshot_rate REAL;`);
    await tryExec(`ALTER TABLE purchase_hubs ADD COLUMN fx_snapshot_base TEXT;`);
  }

  // ── v4 → v5 ───────────────────────────────────────────────────────────────
  // Adds next_retry_at to sync_queue for exponential back-off.
  // Existing retry/pending rows get next_retry_at = NULL (immediate retry).
  if (current < 5) {
    await tryExec(`ALTER TABLE sync_queue ADD COLUMN next_retry_at INTEGER;`);
    // Drop the old index and recreate with next_retry_at included.
    await tryExec(`DROP INDEX IF EXISTS idx_queue_status;`);
    await tryExec(
      `CREATE INDEX IF NOT EXISTS idx_queue_status
         ON sync_queue(status, next_retry_at, created_at);`
    );
  }

  // ── v5 → v6 ───────────────────────────────────────────────────────────────
  // Adds review_summary (AI-generated text) and review_count (canonical count
  // from Firebase — Firebase uses review_count, old schema used count).
  if (current < 6) {
    await tryExec(`ALTER TABLE store_review_stats ADD COLUMN review_summary TEXT;`);
    await tryExec(`ALTER TABLE store_review_stats ADD COLUMN review_count INTEGER;`);
    await tryExec(`UPDATE store_review_stats SET review_count = count WHERE review_count IS NULL;`);
  }

  // ── Apply full baseline (creates all new v3 tables, safe to re-run) ───────
  await db.execAsync(SCHEMA_SQL);
  await db.execAsync(`PRAGMA user_version = ${LOCAL_DB_VERSION}`);
}