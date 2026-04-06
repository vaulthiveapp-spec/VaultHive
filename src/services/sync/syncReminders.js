import { ref, onValue } from "firebase/database";
import { database } from "../../config/firebase";
import { upsertReminderServer, upsertNotificationServer } from "../localRepo";
import { getDb } from "../../db/db";

const now = () => Date.now();

export function registerListeners(userUid, unsubs) {
  // ── Reminders ─────────────────────────────────────────────────────────────
  unsubs.push(onValue(ref(database, `reminders/${userUid}`), async (snap) => {
    const v = snap.val() || {};
    const keep = new Set();
    for (const [reminder_id, data] of Object.entries(v)) {
      if (!data) continue;
      keep.add(reminder_id);
      await upsertReminderServer(userUid, {
        reminder_id,
        type: data.type || null,
        target_type: data.target_type || null,
        target_id: data.target_id || null,
        due_date: data.due_date || null,
        lead_days: data.lead_days || 7,
        status: data.status || "active",
        created_at: data.created_at || now(),
      });
    }
    // Soft-delete reminders removed from Firebase
    const db = await getDb();
    const rows = await db.getAllAsync(
      `SELECT reminder_id AS id FROM reminders WHERE user_uid=?`, [String(userUid)]
    );
    for (const { id } of rows) {
      if (!keep.has(id)) {
        await db.runAsync(
          `UPDATE reminders SET is_deleted=1, dirty=0 WHERE user_uid=? AND reminder_id=?`,
          [String(userUid), String(id)]
        );
      }
    }
  }));

  // ── Notifications ─────────────────────────────────────────────────────────
  unsubs.push(onValue(ref(database, `notifications/${userUid}`), async (snap) => {
    const v = snap.val() || {};
    for (const [notification_id, data] of Object.entries(v)) {
      if (!data) continue;
      const refObj = data.ref || null;
      await upsertNotificationServer(userUid, {
        notification_id,
        title: data.title || "",
        message: data.message || "",
        status: data.status || "Unread",
        date: data.date || null,
        created_at: data.created_at || now(),
        ref_type: refObj?.type || null,
        ref_id: refObj?.id || null,
      });
    }
  }));
}
