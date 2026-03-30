import { ref, onValue } from "firebase/database";
import { database } from "../../config/firebase";
import { upsertConversation, upsertMessage } from "../localRepo";

const now = () => Date.now();

export function registerListeners(userUid, unsubs) {
  // ── AI conversations ────────────────────────────────────────────────────────
  unsubs.push(onValue(ref(database, `ai_conversations/${userUid}`), async (snap) => {
    const v = snap.val() || {};
    for (const [conversation_id, data] of Object.entries(v)) {
      if (!data) continue;
      await upsertConversation(userUid, {
        conversation_id,
        title: data.title || null,
        status: data.status || "active",
        screen_context: data.screen_context || null,
        linked_entity: data.linked_entity || null,
        last_message_preview: data.last_message_preview || null,
        rolling_summary: data.rolling_summary || null,
        message_count: Number(data.message_count || 0),
        created_at_ms: Number(data.created_at_ms || now()),
        updated_at_ms: Number(data.updated_at_ms || now()),
      });

      // Sync messages for this conversation
      const messages = data.messages || {};
      for (const [message_id, msg] of Object.entries(messages)) {
        if (!msg) continue;
        await upsertMessage(userUid, {
          message_id,
          conversation_id,
          role: msg.role || "user",
          text: msg.text || null,
          structured_json: msg.structured ? JSON.stringify(msg.structured) : null,
          attachment_json: msg.attachment ? JSON.stringify(msg.attachment) : null,
          message_status: msg.message_status || "complete",
          created_at_ms: Number(msg.created_at_ms || now()),
          updated_at_ms: Number(msg.updated_at_ms || now()),
        });
      }
    }
  }));
}
