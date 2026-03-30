import { getDb } from "../../db/db";

const now = () => Date.now();

// ─── Reminders ────────────────────────────────────────────────────────────────

export async function listUpcomingReminders(userUid, daysAhead = 30, limit = 50) {
  const db = await getDb();
  const today = new Date();
  const start = today.toISOString().slice(0, 10);
  const end = new Date(today.getTime() + Number(daysAhead) * 86400000)
    .toISOString()
    .slice(0, 10);
  return await db.getAllAsync(
    `SELECT * FROM reminders
     WHERE user_uid=? AND is_deleted=0 AND (status IS NULL OR status='active')
       AND due_date IS NOT NULL AND due_date >= ? AND due_date <= ?
     ORDER BY due_date ASC
     LIMIT ?`,
    [String(userUid), start, end, Number(limit)]
  );
}

/** Write a reminder from the Firebase listener — dirty=0. */
export async function upsertReminderServer(userUid, r) {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO reminders
       (user_uid, reminder_id, type, target_type, target_id, due_date,
        lead_days, status, created_at, updated_at, local_notif_id, dirty, is_deleted)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)
     ON CONFLICT(user_uid, reminder_id) DO UPDATE SET
       type=excluded.type,
       target_type=excluded.target_type,
       target_id=excluded.target_id,
       due_date=excluded.due_date,
       lead_days=excluded.lead_days,
       status=excluded.status,
       created_at=excluded.created_at,
       updated_at=excluded.updated_at,
       local_notif_id=COALESCE(excluded.local_notif_id, reminders.local_notif_id),
       dirty=0,
       is_deleted=0`,
    [
      String(userUid), String(r.reminder_id),
      r.type || null, r.target_type || null, r.target_id || null,
      r.due_date || null, Number(r.lead_days || 7),
      r.status || "active",
      Number(r.created_at || now()),
      Number(r.updated_at || r.created_at || now()),
      r.local_notif_id || null,
    ]
  );
}

/** Write a reminder from a local user action — dirty=1. */
export async function upsertReminder(userUid, r) {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO reminders
       (user_uid, reminder_id, type, target_type, target_id, due_date,
        lead_days, status, created_at, updated_at, local_notif_id, dirty, is_deleted)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0)
     ON CONFLICT(user_uid, reminder_id) DO UPDATE SET
       type=excluded.type,
       target_type=excluded.target_type,
       target_id=excluded.target_id,
       due_date=excluded.due_date,
       lead_days=excluded.lead_days,
       status=excluded.status,
       created_at=excluded.created_at,
       updated_at=excluded.updated_at,
       local_notif_id=COALESCE(excluded.local_notif_id, reminders.local_notif_id),
       dirty=1,
       is_deleted=0`,
    [
      String(userUid), String(r.reminder_id),
      r.type || null, r.target_type || null, r.target_id || null,
      r.due_date || null, Number(r.lead_days || 7),
      r.status || "active",
      Number(r.created_at || now()),
      Number(r.updated_at || r.created_at || now()),
      r.local_notif_id || null,
    ]
  );
}

export async function softDeleteReminder(userUid, reminderId) {
  const db = await getDb();
  await db.runAsync(
    `UPDATE reminders SET is_deleted=1, dirty=1 WHERE user_uid=? AND reminder_id=?`,
    [String(userUid), String(reminderId)]
  );
}

export async function markReminderSynced(userUid, reminderId) {
  const db = await getDb();
  await db.runAsync(
    `UPDATE reminders SET dirty=0 WHERE user_uid=? AND reminder_id=?`,
    [String(userUid), String(reminderId)]
  );
}

// ─── Notifications ────────────────────────────────────────────────────────────

export async function listNotifications(userUid, limit = 100) {
  const db = await getDb();
  return await db.getAllAsync(
    `SELECT * FROM notifications WHERE user_uid=? ORDER BY created_at DESC LIMIT ?`,
    [String(userUid), Number(limit)]
  );
}

export async function countUnreadNotifications(userUid) {
  const db = await getDb();
  const row = await db.getFirstAsync(
    `SELECT COUNT(*) AS c FROM notifications
     WHERE user_uid=? AND (status IS NULL OR status='Unread')`,
    [String(userUid)]
  );
  return Number(row?.c || 0);
}

export async function upsertNotificationServer(userUid, n) {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO notifications
       (user_uid, notification_id, title, message, status, date,
        created_at, ref_type, ref_id, dirty)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
     ON CONFLICT(user_uid, notification_id) DO UPDATE SET
       title=excluded.title,
       message=excluded.message,
       status=excluded.status,
       date=excluded.date,
       created_at=excluded.created_at,
       ref_type=excluded.ref_type,
       ref_id=excluded.ref_id,
       dirty=0`,
    [
      String(userUid), String(n.notification_id),
      n.title || "", n.message || "",
      n.status || "Unread", n.date || null,
      Number(n.created_at || now()),
      n.ref_type || null, n.ref_id || null,
    ]
  );
}

export async function markNotificationRead(userUid, notificationId) {
  const db = await getDb();
  await db.runAsync(
    `UPDATE notifications SET status='Read', dirty=1 WHERE user_uid=? AND notification_id=?`,
    [String(userUid), String(notificationId)]
  );
}

export async function markNotificationSynced(userUid, notificationId) {
  const db = await getDb();
  await db.runAsync(
    `UPDATE notifications SET dirty=0 WHERE user_uid=? AND notification_id=?`,
    [String(userUid), String(notificationId)]
  );
}
