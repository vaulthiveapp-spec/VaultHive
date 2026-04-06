import { ref, onValue } from "firebase/database";
import { database } from "../../config/firebase";
import { upsertAttentionItem, reconcileAttentionItems } from "../localRepo";

const now = () => Date.now();

export function registerListeners(userUid, unsubs) {
  unsubs.push(onValue(ref(database, `attention_items/${userUid}`), async (snap) => {
    const v = snap.val() || {};
    const keepIds = [];

    for (const [attention_id, data] of Object.entries(v)) {
      if (!data) continue;
      // Only sync open items; dismissed/resolved items are removed server-side
      if (data.status && data.status !== "open") continue;
      keepIds.push(attention_id);
      await upsertAttentionItem(userUid, {
        attention_id,
        title: data.title || "",
        description: data.description || null,
        type: data.type || null,
        severity: data.severity || "low",
        status: data.status || "open",
        sort_order: Number(data.sort_order ?? 99),
        due_date: data.due_date || null,
        linked_entity: data.linked_entity || null,
        actions: Array.isArray(data.actions) ? data.actions : [],
        created_at_ms: Number(data.created_at_ms || now()),
        updated_at_ms: Number(data.updated_at_ms || now()),
      });
    }

    // Remove items the server has resolved (no longer in snapshot)
    await reconcileAttentionItems(userUid, keepIds);
  }));
}
