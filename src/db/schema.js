export const LOCAL_DB_VERSION = 6;

// ---------------------------------------------------------------------------
// SCHEMA_SQL — baseline DDL for fresh installs and idempotent table creation.
// Every table uses CREATE TABLE IF NOT EXISTS so this block is safe to re-run
// after incremental ALTERs in the migration runner.
//
// Sync metadata conventions (applied to all user-owned mutable tables):
//   sync_status  TEXT NOT NULL DEFAULT 'pending'
//                'pending' | 'synced' | 'conflict' | 'failed'
//   updated_at_ms  INTEGER  — epoch-ms matching Firebase _ms fields
//   last_synced_at INTEGER  — epoch-ms of last successful Firebase write-back
//   is_deleted   INTEGER NOT NULL DEFAULT 0  — soft delete flag
//
// Legacy tables (v1/v2) keep their original `dirty` column for backward
// compatibility with the existing sync engine. `dirty=1` maps to
// sync_status='pending'; both coexist until Phase 4 sync refactor.
// ---------------------------------------------------------------------------
export const SCHEMA_SQL = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ═══════════════════════════════════════════════════════════
-- IDENTITY
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS users (
  uid              TEXT PRIMARY KEY NOT NULL,
  name             TEXT,
  email            TEXT,
  email_lower      TEXT,
  username         TEXT,
  username_lower   TEXT,
  user_type        TEXT,
  registration_date TEXT,
  created_at       INTEGER,
  updated_at       INTEGER
);

CREATE TABLE IF NOT EXISTS user_settings (
  uid                    TEXT PRIMARY KEY NOT NULL,
  theme                  TEXT,
  language               TEXT,
  push_enabled           INTEGER,
  biometric_enabled      INTEGER,
  notif_return_deadline  INTEGER,
  notif_warranty_expiry  INTEGER,
  notif_weekly_summary   INTEGER,
  base_currency          TEXT NOT NULL DEFAULT 'SAR',
  notif_sound            TEXT,
  created_at             INTEGER,
  updated_at             INTEGER,
  FOREIGN KEY(uid) REFERENCES users(uid) ON DELETE CASCADE
);

-- ═══════════════════════════════════════════════════════════
-- REFERENCE / SYSTEM (global, no user_uid)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS currencies (
  code          TEXT PRIMARY KEY NOT NULL,
  exchange_rate REAL NOT NULL,
  updated_at    INTEGER
);

CREATE TABLE IF NOT EXISTS category_defaults (
  scope       TEXT    NOT NULL,
  category_id INTEGER NOT NULL,
  name        TEXT    NOT NULL,
  icon_key    TEXT,
  color       TEXT,
  PRIMARY KEY(scope, category_id)
);

CREATE TABLE IF NOT EXISTS tag_defaults (
  tag_id INTEGER PRIMARY KEY NOT NULL,
  name   TEXT NOT NULL,
  color  TEXT
);

CREATE TABLE IF NOT EXISTS requirement_categories (
  key      TEXT PRIMARY KEY NOT NULL,
  name     TEXT NOT NULL,
  icon_key TEXT
);

CREATE TABLE IF NOT EXISTS app_config (
  id             INTEGER PRIMARY KEY NOT NULL,
  app_name       TEXT,
  schema_version INTEGER,
  support_email  TEXT,
  ai_enabled     INTEGER,
  ai_provider    TEXT,
  updated_at     INTEGER
);

-- Merchants is global (shared across users, like stores).
-- vendors table stays for v2 sync compat; new code uses merchants.
CREATE TABLE IF NOT EXISTS merchants (
  merchant_id    TEXT PRIMARY KEY NOT NULL,
  name           TEXT NOT NULL,
  name_lower     TEXT,
  categories_json TEXT,
  city           TEXT,
  verified       INTEGER NOT NULL DEFAULT 0,
  created_at_ms  INTEGER,
  updated_at_ms  INTEGER
);

CREATE TABLE IF NOT EXISTS merchant_aliases (
  alias_lower TEXT PRIMARY KEY NOT NULL,
  merchant_id TEXT NOT NULL,
  FOREIGN KEY(merchant_id) REFERENCES merchants(merchant_id) ON DELETE CASCADE
);

-- ═══════════════════════════════════════════════════════════
-- USER TAXONOMY
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS user_categories (
  user_uid    TEXT    NOT NULL,
  scope       TEXT    NOT NULL,
  category_id INTEGER NOT NULL,
  name        TEXT    NOT NULL,
  icon_key    TEXT,
  color       TEXT,
  PRIMARY KEY(user_uid, scope, category_id)
);

CREATE TABLE IF NOT EXISTS user_tags (
  user_uid TEXT    NOT NULL,
  tag_id   INTEGER NOT NULL,
  name     TEXT    NOT NULL,
  color    TEXT,
  PRIMARY KEY(user_uid, tag_id)
);

-- ═══════════════════════════════════════════════════════════
-- LEGACY VENDORS (v1/v2 compat — do not drop)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS vendors (
  user_uid   TEXT NOT NULL,
  vendor_id  TEXT NOT NULL,
  name       TEXT NOT NULL,
  name_lower TEXT,
  phone      TEXT,
  address    TEXT,
  created_at INTEGER,
  PRIMARY KEY(user_uid, vendor_id)
);

-- ═══════════════════════════════════════════════════════════
-- PURCHASE HUBS  (central domain entity — Phase 5 screens)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS purchase_hubs (
  user_uid               TEXT NOT NULL,
  hub_id                 TEXT NOT NULL,
  title                  TEXT NOT NULL,
  merchant_id            TEXT,
  merchant_name          TEXT,
  store_id               TEXT,
  receipt_id             TEXT,
  warranty_id            TEXT,
  serial_number          TEXT,
  purchase_date          TEXT,
  return_deadline        TEXT,
  total_amount           REAL,
  currency_code          TEXT NOT NULL DEFAULT 'SAR',
  fx_snapshot_rate       REAL,
  fx_snapshot_base       TEXT,
  category_id            TEXT,
  category_name_snapshot TEXT,
  status                 TEXT NOT NULL DEFAULT 'active',
  note                   TEXT,
  service_history_count  INTEGER NOT NULL DEFAULT 0,
  claim_history_count    INTEGER NOT NULL DEFAULT 0,
  created_at_ms          INTEGER,
  updated_at_ms          INTEGER,
  sync_status            TEXT NOT NULL DEFAULT 'pending',
  last_synced_at         INTEGER,
  is_deleted             INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(user_uid, hub_id)
);

-- ═══════════════════════════════════════════════════════════
-- ATTACHMENTS
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS attachments (
  user_uid      TEXT NOT NULL,
  attachment_id TEXT NOT NULL,
  owner_uid     TEXT,
  linked_type   TEXT,
  linked_id     TEXT,
  provider      TEXT,
  bucket        TEXT,
  path          TEXT,
  public_url    TEXT,
  filename      TEXT,
  content_type  TEXT,
  size_bytes    INTEGER,
  local_uri     TEXT,
  upload_status TEXT,
  created_at    INTEGER,
  PRIMARY KEY(user_uid, attachment_id)
);

-- ═══════════════════════════════════════════════════════════
-- RECEIPTS
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS receipts (
  user_uid          TEXT NOT NULL,
  receipt_id        TEXT NOT NULL,
  vendor_id         TEXT,
  vendor_name       TEXT,
  vendor_name_lower TEXT,
  purchase_date     TEXT,
  purchase_month    TEXT,
  total_amount      REAL,
  currency_code     TEXT,
  fx_snapshot_rate  REAL,
  fx_snapshot_base  TEXT,
  category_id       INTEGER,
  receipt_number    TEXT,
  return_deadline   TEXT,
  note              TEXT,
  ocr_raw_text      TEXT,
  ocr_parsed_json   TEXT,
  created_at        INTEGER,
  updated_at        INTEGER,
  dirty             INTEGER NOT NULL DEFAULT 0,
  is_deleted        INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(user_uid, receipt_id)
);

CREATE TABLE IF NOT EXISTS receipt_items (
  user_uid   TEXT NOT NULL,
  receipt_id TEXT NOT NULL,
  item_id    TEXT NOT NULL,
  name       TEXT NOT NULL,
  qty        REAL,
  unit_price REAL,
  total      REAL,
  PRIMARY KEY(user_uid, receipt_id, item_id),
  FOREIGN KEY(user_uid, receipt_id) REFERENCES receipts(user_uid, receipt_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS receipt_tags (
  user_uid   TEXT    NOT NULL,
  receipt_id TEXT    NOT NULL,
  tag_id     INTEGER NOT NULL,
  PRIMARY KEY(user_uid, receipt_id, tag_id),
  FOREIGN KEY(user_uid, receipt_id) REFERENCES receipts(user_uid, receipt_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS receipt_attachments (
  user_uid      TEXT NOT NULL,
  receipt_id    TEXT NOT NULL,
  attachment_id TEXT NOT NULL,
  PRIMARY KEY(user_uid, receipt_id, attachment_id),
  FOREIGN KEY(user_uid, receipt_id) REFERENCES receipts(user_uid, receipt_id) ON DELETE CASCADE
);

-- ═══════════════════════════════════════════════════════════
-- WARRANTIES
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS warranties (
  user_uid      TEXT NOT NULL,
  warranty_id   TEXT NOT NULL,
  receipt_id    TEXT,
  vendor_id     TEXT,
  product_name  TEXT,
  serial_number TEXT,
  warranty_start TEXT,
  warranty_end  TEXT,
  terms_note    TEXT,
  created_at    INTEGER,
  updated_at    INTEGER,
  dirty         INTEGER NOT NULL DEFAULT 0,
  is_deleted    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(user_uid, warranty_id)
);

CREATE TABLE IF NOT EXISTS warranty_attachments (
  user_uid      TEXT NOT NULL,
  warranty_id   TEXT NOT NULL,
  attachment_id TEXT NOT NULL,
  PRIMARY KEY(user_uid, warranty_id, attachment_id)
);

-- ═══════════════════════════════════════════════════════════
-- SERVICE HISTORY  (per hub)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS service_history (
  user_uid         TEXT NOT NULL,
  service_id       TEXT NOT NULL,
  hub_id           TEXT NOT NULL,
  receipt_id       TEXT,
  warranty_id      TEXT,
  title            TEXT,
  type             TEXT,
  service_date     TEXT,
  note             TEXT,
  created_at_ms    INTEGER,
  updated_at_ms    INTEGER,
  sync_status      TEXT NOT NULL DEFAULT 'pending',
  last_synced_at   INTEGER,
  is_deleted       INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(user_uid, service_id)
);

-- ═══════════════════════════════════════════════════════════
-- CLAIMS  (warranty / return claims per hub)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS claims (
  user_uid       TEXT NOT NULL,
  claim_id       TEXT NOT NULL,
  hub_id         TEXT NOT NULL,
  warranty_id    TEXT,
  kind           TEXT,
  status         TEXT NOT NULL DEFAULT 'draft',
  note           TEXT,
  created_date   TEXT,
  created_at_ms  INTEGER,
  updated_at_ms  INTEGER,
  sync_status    TEXT NOT NULL DEFAULT 'pending',
  last_synced_at INTEGER,
  is_deleted     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(user_uid, claim_id)
);

-- ═══════════════════════════════════════════════════════════
-- REMINDERS
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS reminders (
  user_uid       TEXT NOT NULL,
  reminder_id    TEXT NOT NULL,
  type           TEXT,
  target_type    TEXT,
  target_id      TEXT,
  due_date       TEXT,
  lead_days      INTEGER,
  status         TEXT,
  created_at     INTEGER,
  updated_at     INTEGER,
  local_notif_id TEXT,
  dirty          INTEGER NOT NULL DEFAULT 0,
  is_deleted     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(user_uid, reminder_id)
);

-- ═══════════════════════════════════════════════════════════
-- NOTIFICATIONS
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS notifications (
  user_uid        TEXT NOT NULL,
  notification_id TEXT NOT NULL,
  title           TEXT,
  message         TEXT,
  status          TEXT,
  date            TEXT,
  created_at      INTEGER,
  ref_type        TEXT,
  ref_id          TEXT,
  dirty           INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(user_uid, notification_id)
);

-- ═══════════════════════════════════════════════════════════
-- ATTENTION ITEMS  (server-generated, read-only on device)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS attention_items (
  user_uid           TEXT NOT NULL,
  attention_id       TEXT NOT NULL,
  title              TEXT NOT NULL,
  description        TEXT,
  type               TEXT,
  severity           TEXT NOT NULL DEFAULT 'low',
  status             TEXT NOT NULL DEFAULT 'open',
  sort_order         INTEGER NOT NULL DEFAULT 99,
  due_date           TEXT,
  linked_entity_type TEXT,
  linked_entity_id   TEXT,
  actions_json       TEXT,
  created_at_ms      INTEGER,
  updated_at_ms      INTEGER,
  last_synced_at     INTEGER,
  PRIMARY KEY(user_uid, attention_id)
);

-- ═══════════════════════════════════════════════════════════
-- REPORTS  (cached computed reports)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS reports (
  user_uid         TEXT NOT NULL,
  report_id        TEXT NOT NULL,
  period           TEXT,
  total_spend      REAL,
  by_category_json TEXT,
  by_vendor_json   TEXT,
  created_at       INTEGER,
  PRIMARY KEY(user_uid, report_id)
);

-- ═══════════════════════════════════════════════════════════
-- GENERATED EXPORTS  (PDF / proof packs)
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS generated_exports (
  user_uid       TEXT NOT NULL,
  export_id      TEXT NOT NULL,
  hub_id         TEXT,
  kind           TEXT,
  status         TEXT NOT NULL DEFAULT 'pending',
  filename       TEXT,
  content_type   TEXT,
  size_bytes     INTEGER,
  storage_bucket TEXT,
  storage_path   TEXT,
  public_url     TEXT,
  requested_by   TEXT,
  generated_at   INTEGER,
  created_at_ms  INTEGER,
  updated_at_ms  INTEGER,
  last_synced_at INTEGER,
  PRIMARY KEY(user_uid, export_id)
);

-- ═══════════════════════════════════════════════════════════
-- AI CONVERSATIONS + MESSAGES
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS ai_conversations (
  user_uid              TEXT NOT NULL,
  conversation_id       TEXT NOT NULL,
  title                 TEXT,
  status                TEXT NOT NULL DEFAULT 'active',
  screen_context        TEXT,
  linked_entity_type    TEXT,
  linked_entity_id      TEXT,
  last_message_preview  TEXT,
  rolling_summary       TEXT,
  message_count         INTEGER NOT NULL DEFAULT 0,
  created_at_ms         INTEGER,
  updated_at_ms         INTEGER,
  last_synced_at        INTEGER,
  PRIMARY KEY(user_uid, conversation_id)
);

CREATE TABLE IF NOT EXISTS ai_messages (
  user_uid         TEXT NOT NULL,
  message_id       TEXT NOT NULL,
  conversation_id  TEXT NOT NULL,
  role             TEXT NOT NULL,
  text             TEXT,
  structured_json  TEXT,
  attachment_json  TEXT,
  message_status   TEXT NOT NULL DEFAULT 'complete',
  created_at_ms    INTEGER,
  updated_at_ms    INTEGER,
  PRIMARY KEY(user_uid, message_id),
  FOREIGN KEY(user_uid, conversation_id)
    REFERENCES ai_conversations(user_uid, conversation_id) ON DELETE CASCADE
);

-- ═══════════════════════════════════════════════════════════
-- LOCAL CACHE  (generic key/value blob cache)
-- Stores: home_cache, report_summaries, ai_context_cache, etc.
-- cache_key convention:  'home:{uid}', 'report:{uid}:{month}', 'ai_ctx:{uid}'
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS local_cache (
  cache_key    TEXT PRIMARY KEY NOT NULL,
  user_uid     TEXT,
  payload_json TEXT NOT NULL,
  version      INTEGER NOT NULL DEFAULT 1,
  generated_at INTEGER,
  expires_at   INTEGER
);

-- ═══════════════════════════════════════════════════════════
-- STORES / DISCOVERY
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS stores (
  store_id        TEXT PRIMARY KEY NOT NULL,
  name            TEXT NOT NULL,
  name_lower      TEXT,
  url             TEXT,
  city            TEXT,
  verified        INTEGER,
  categories_json TEXT,
  created_at      INTEGER,
  updated_at      INTEGER
);

CREATE TABLE IF NOT EXISTS stores_by_category (
  category_key TEXT NOT NULL,
  store_id     TEXT NOT NULL,
  PRIMARY KEY(category_key, store_id)
);

CREATE TABLE IF NOT EXISTS store_reviews (
  store_id   TEXT NOT NULL,
  review_id  TEXT NOT NULL,
  uid        TEXT,
  rating     REAL,
  comment    TEXT,
  created_at INTEGER,
  PRIMARY KEY(store_id, review_id)
);

CREATE TABLE IF NOT EXISTS store_review_stats (
  store_id       TEXT PRIMARY KEY NOT NULL,
  avg_rating     REAL,
  count          INTEGER,
  review_count   INTEGER,
  review_summary TEXT,
  updated_at     INTEGER
);

CREATE TABLE IF NOT EXISTS user_favorite_stores (
  user_uid   TEXT    NOT NULL,
  store_id   TEXT    NOT NULL,
  is_on      INTEGER NOT NULL DEFAULT 1,
  updated_at INTEGER,
  PRIMARY KEY(user_uid, store_id)
);

-- ═══════════════════════════════════════════════════════════
-- SYNC OUTBOX
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS sync_queue (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  user_uid       TEXT    NOT NULL,
  kind           TEXT    NOT NULL,
  updates_json   TEXT    NOT NULL,
  meta_json      TEXT,
  status         TEXT    NOT NULL,
  tries          INTEGER NOT NULL DEFAULT 0,
  last_error     TEXT,
  next_retry_at  INTEGER,          -- epoch-ms; NULL means retry immediately
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL
);

-- ═══════════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════════

-- receipts
CREATE INDEX IF NOT EXISTS idx_receipts_user_month  ON receipts(user_uid, purchase_month);
CREATE INDEX IF NOT EXISTS idx_receipts_user_date   ON receipts(user_uid, purchase_date);

-- warranties
CREATE INDEX IF NOT EXISTS idx_warranties_user_end  ON warranties(user_uid, warranty_end);

-- purchase_hubs
CREATE INDEX IF NOT EXISTS idx_hubs_user_date       ON purchase_hubs(user_uid, purchase_date);
CREATE INDEX IF NOT EXISTS idx_hubs_user_status     ON purchase_hubs(user_uid, status);
CREATE INDEX IF NOT EXISTS idx_hubs_user_updated    ON purchase_hubs(user_uid, updated_at_ms);

-- service_history / claims
CREATE INDEX IF NOT EXISTS idx_service_hub          ON service_history(user_uid, hub_id);
CREATE INDEX IF NOT EXISTS idx_claims_hub           ON claims(user_uid, hub_id);

-- reminders
CREATE INDEX IF NOT EXISTS idx_reminders_user_due   ON reminders(user_uid, due_date);

-- notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user   ON notifications(user_uid, date);

-- attention_items
CREATE INDEX IF NOT EXISTS idx_attention_user_status ON attention_items(user_uid, status, sort_order);
CREATE INDEX IF NOT EXISTS idx_attention_user_sev    ON attention_items(user_uid, severity, sort_order);

-- ai
CREATE INDEX IF NOT EXISTS idx_ai_conv_user         ON ai_conversations(user_uid, updated_at_ms);
CREATE INDEX IF NOT EXISTS idx_ai_msg_conv          ON ai_messages(user_uid, conversation_id, created_at_ms);

-- exports
CREATE INDEX IF NOT EXISTS idx_exports_hub          ON generated_exports(user_uid, hub_id);

-- cache
CREATE INDEX IF NOT EXISTS idx_cache_user           ON local_cache(user_uid, cache_key);

-- sync queue
CREATE INDEX IF NOT EXISTS idx_queue_status         ON sync_queue(status, next_retry_at, created_at);
`;