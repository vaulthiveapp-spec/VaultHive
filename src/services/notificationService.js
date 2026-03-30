import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

// Default handler: show alert and play sound (if enabled for the notification).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function isoToDate(dateStr, hour = 9, minute = 0) {
  const s = String(dateStr || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(hour, minute, 0, 0);
  return d;
}

function buildTrigger(due_date, lead_days) {
  const base = isoToDate(due_date, 9, 0);
  if (!base) return null;
  const lead = Math.max(Number(lead_days || 0), 0);
  const t = new Date(base.getTime() - lead * 86400000);
  // If it's in the past, schedule for ~10 seconds from now so user still gets feedback.
  if (t.getTime() < Date.now() - 60000) {
    return { seconds: 10 };
  }
  return { date: t };
}

function contentForReminder(reminder) {
  const type = String(reminder?.type || "");
  if (type === "warranty_expiry") {
    return {
      title: "Warranty reminder",
      body: "Your warranty is getting close. Review coverage and keep your proof of purchase ready.",
    };
  }
  return {
    title: "Return deadline reminder",
    body: "Your return window is getting close. Review the receipt and return policy before it expires.",
  };
}

async function ensureAndroidChannel(soundKey = "default") {
  if (Platform.OS !== "android") return;

  // On Android, sound is controlled by the notification channel.
  // In Expo-managed apps, custom sounds require an EAS build that bundles raw resources.
  const channelId = "vh-reminders";
  await Notifications.setNotificationChannelAsync(channelId, {
    name: "VaultHive reminders",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#B37A1F",
    sound: soundKey === "silent" ? undefined : "default",
  });
}

async function ensurePermissions() {
  try {
    const existing = await Notifications.getPermissionsAsync();
    if (existing?.status === "granted") return true;
    const res = await Notifications.requestPermissionsAsync();
    return res?.status === "granted";
  } catch {
    return false;
  }
}

async function configureChannels(soundKey = "default") {
  await ensureAndroidChannel(soundKey);
}

async function scheduleReminderNotification(reminder, { soundKey = "default" } = {}) {
  try {
    const ok = await ensurePermissions();
    if (!ok) return null;

    await configureChannels(soundKey);
    const trigger = buildTrigger(reminder?.due_date, reminder?.lead_days);
    if (!trigger) return null;

    const { title, body } = contentForReminder(reminder);

    const content = {
      title,
      body,
      data: {
        kind: "vh_reminder",
        reminder_id: reminder?.reminder_id,
        type: reminder?.type,
        target_type: reminder?.target_type,
        target_id: reminder?.target_id,
      },
      // iOS supports custom sounds if bundled. For now: default or silent.
      sound: soundKey === "silent" ? null : "default",
    };

    const id = await Notifications.scheduleNotificationAsync({
      content,
      trigger,
    });
    return id;
  } catch {
    return null;
  }
}

async function cancelScheduled(id) {
  try {
    if (!id) return false;
    await Notifications.cancelScheduledNotificationAsync(String(id));
    return true;
  } catch {
    return false;
  }
}

export default {
  ensurePermissions,
  configureChannels,
  scheduleReminderNotification,
  cancelScheduled,
};
