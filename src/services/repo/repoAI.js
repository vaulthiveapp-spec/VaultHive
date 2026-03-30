import { getDb } from "../../db/db";

const now = () => Date.now();

// ─── AI Conversations ─────────────────────────────────────────────────────────

export async function upsertConversation(userUid, conv) {
  const db = await getDb();
  const t = now();
  const linked = conv.linked_entity || {};
  await db.runAsync(
    `INSERT INTO ai_conversations (
       user_uid, conversation_id, title, status, screen_context,
       linked_entity_type, linked_entity_id,
       last_message_preview, rolling_summary, message_count,
       created_at_ms, updated_at_ms, last_synced_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_uid, conversation_id) DO UPDATE SET
       title=excluded.title,
       status=excluded.status,
       screen_context=excluded.screen_context,
       linked_entity_type=excluded.linked_entity_type,
       linked_entity_id=excluded.linked_entity_id,
       last_message_preview=excluded.last_message_preview,
       rolling_summary=excluded.rolling_summary,
       message_count=excluded.message_count,
       updated_at_ms=excluded.updated_at_ms,
       last_synced_at=excluded.last_synced_at`,
    [
      String(userUid),
      String(conv.conversation_id),
      conv.title || null,
      String(conv.status || "active"),
      conv.screen_context || null,
      linked.type || conv.linked_entity_type || null,
      linked.id   || conv.linked_entity_id   || null,
      conv.last_message_preview || null,
      conv.rolling_summary || null,
      Number(conv.message_count || 0),
      Number(conv.created_at_ms || conv.created_at || t),
      Number(conv.updated_at_ms || conv.updated_at || t),
      t,
    ]
  );
}

export async function getConversation(userUid, conversationId) {
  const db = await getDb();
  return await db.getFirstAsync(
    `SELECT * FROM ai_conversations WHERE user_uid=? AND conversation_id=?`,
    [String(userUid), String(conversationId)]
  );
}

export async function listConversations(userUid, limit = 20) {
  const db = await getDb();
  return await db.getAllAsync(
    `SELECT * FROM ai_conversations
     WHERE user_uid=? AND status != 'archived'
     ORDER BY updated_at_ms DESC
     LIMIT ?`,
    [String(userUid), Number(limit)]
  );
}

export async function archiveConversation(userUid, conversationId) {
  const db = await getDb();
  await db.runAsync(
    `UPDATE ai_conversations SET status='archived', updated_at_ms=?
     WHERE user_uid=? AND conversation_id=?`,
    [now(), String(userUid), String(conversationId)]
  );
}

export async function updateConversationPreview(userUid, conversationId, preview, summary = null) {
  const db = await getDb();
  const t = now();
  await db.runAsync(
    `UPDATE ai_conversations
     SET last_message_preview=?,
         rolling_summary=COALESCE(?, rolling_summary),
         updated_at_ms=?,
         message_count=message_count+1
     WHERE user_uid=? AND conversation_id=?`,
    [preview || null, summary || null, t, String(userUid), String(conversationId)]
  );
}

// ─── AI Messages ──────────────────────────────────────────────────────────────

export async function upsertMessage(userUid, message) {
  const db = await getDb();
  const t = now();
  await db.runAsync(
    `INSERT INTO ai_messages (
       user_uid, message_id, conversation_id, role, text,
       structured_json, attachment_json, message_status,
       created_at_ms, updated_at_ms
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_uid, message_id) DO UPDATE SET
       text=excluded.text,
       structured_json=excluded.structured_json,
       attachment_json=excluded.attachment_json,
       message_status=excluded.message_status,
       updated_at_ms=excluded.updated_at_ms`,
    [
      String(userUid),
      String(message.message_id),
      String(message.conversation_id),
      String(message.role || "user"),
      message.text || null,
      message.structured_json
        || (message.structured ? JSON.stringify(message.structured) : null),
      message.attachment_json
        || (message.attachment ? JSON.stringify(message.attachment) : null),
      String(message.message_status || "complete"),
      Number(message.created_at_ms || message.created_at || t),
      Number(message.updated_at_ms || message.updated_at || t),
    ]
  );
}

export async function listMessages(userUid, conversationId, limit = 100) {
  const db = await getDb();
  return await db.getAllAsync(
    `SELECT * FROM ai_messages
     WHERE user_uid=? AND conversation_id=?
     ORDER BY created_at_ms ASC
     LIMIT ?`,
    [String(userUid), String(conversationId), Number(limit)]
  );
}

export async function getLastMessages(userUid, conversationId, count = 8) {
  const db = await getDb();
  const rows = await db.getAllAsync(
    `SELECT * FROM ai_messages
     WHERE user_uid=? AND conversation_id=?
     ORDER BY created_at_ms DESC
     LIMIT ?`,
    [String(userUid), String(conversationId), Number(count)]
  );
  return (rows || []).reverse();
}
