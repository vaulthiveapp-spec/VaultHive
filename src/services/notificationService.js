import { Platform } from "react-native";
import {
  DEFAULT_NOTIFICATION_TONE_KEY,
  getNotificationTone,
} from "../constants/notificationTones";

let Notifications = null;
try {
  Notifications = require("expo-notifications");
} catch {
  console.log("[Notifications] expo-notifications not available, notifications disabled");
}

if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

function isoToDate(dateStr, hour = 9, minute = 0) {
  const s = String(dateStr || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;

  const d = new Date(`${s}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;

  d.setHours(hour, minute, 0, 0);
  return d;
}

function buildTrigger(dueDate, leadDays) {
  const base = isoToDate(dueDate, 9, 0);
  if (!base) return null;

  const lead = Math.max(Number(leadDays || 0), 0);
  const scheduledAt = new Date(base.getTime() - lead * 24 * 60 * 60 * 1000);

  if (scheduledAt.getTime() < Date.now() - 60 * 1000) {
    return { seconds: 10 };
  }

  return { date: scheduledAt };
}

function contentForReminder(reminder) {
  const type = String(reminder?.type || "");

  if (type === "warranty_expiry") {
    return {
      title: "Warranty reminder",
      body: "Your warranty is getting close. Review coverage and keep your proof of purchase ready.",
    };
  }

  if (type === "custom") {
    return {
      title: "Reminder",
      body: "You have an upcoming reminder in VaultHive.",
    };
  }

  return {
    title: "Return deadline reminder",
    body: "Your return window is getting close. Review the receipt and return policy before it expires.",
  };
}

async function ensurePermissions() {
  if (!Notifications) return false;

  try {
    const existing = await Notifications.getPermissionsAsync();
    if (existing?.status === "granted") return true;

    const requested = await Notifications.requestPermissionsAsync();
    return requested?.status === "granted";
  } catch {
    return false;
  }
}

async function ensureAndroidChannelForTone(toneKey = DEFAULT_NOTIFICATION_TONE_KEY) {
  if (!Notifications || Platform.OS !== "android") return;

  const tone = getNotificationTone(toneKey);

  await Notifications.setNotificationChannelAsync(tone.channelId, {
    name: `VaultHive reminders — ${tone.label}`,
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 180, 250],
    lightColor: "#B37A1F",
    sound: tone.notificationSound || undefined,
  });
}

async function configureChannels(selectedToneKey = DEFAULT_NOTIFICATION_TONE_KEY) {
  if (!Notifications || Platform.OS !== "android") return;

  const keysToPrepare = [
    "default",
    "alert",
    "bell",
    "alarm",
    "harp",
    "loop",
    "silent",
    selectedToneKey,
  ];

  const uniqueKeys = [...new Set(keysToPrepare.filter(Boolean))];

  for (const key of uniqueKeys) {
    await ensureAndroidChannelForTone(key);
  }
}

function buildNotificationRequest(reminder, toneKey = DEFAULT_NOTIFICATION_TONE_KEY) {
  const triggerBase = buildTrigger(reminder?.due_date, reminder?.lead_days);
  if (!triggerBase) return null;

  const tone = getNotificationTone(toneKey);
  const { title, body } = contentForReminder(reminder);

  const content = {
    title,
    body,
    data: {
      kind: "vh_reminder",
      reminder_id: reminder?.reminder_id ?? null,
      type: reminder?.type ?? null,
      target_type: reminder?.target_type ?? null,
      target_id: reminder?.target_id ?? null,
      tone_key: tone.key,
    },
    ...(tone.notificationSound ? { sound: tone.notificationSound } : {}),
  };

  const trigger =
    Platform.OS === "android"
      ? { ...triggerBase, channelId: tone.channelId }
      : triggerBase;

  return { content, trigger };
}

async function scheduleReminderNotification(
  reminder,
  { toneKey = null, soundKey = null } = {}
) {
  if (!Notifications) return null;

  try {
    const ok = await ensurePermissions();
    if (!ok) return null;

    const resolvedToneKey = String(
      toneKey || soundKey || DEFAULT_NOTIFICATION_TONE_KEY
    );

    await configureChannels(resolvedToneKey);

    const request = buildNotificationRequest(reminder, resolvedToneKey);
    if (!request) return null;

    const id = await Notifications.scheduleNotificationAsync(request);
    return id;
  } catch (error) {
    console.log("[Notifications] schedule failed:", error);
    return null;
  }
}

async function cancelScheduled(id) {
  if (!Notifications) return false;

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