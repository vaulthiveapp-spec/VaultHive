export const DEFAULT_NOTIFICATION_TONE_KEY = "default";

export const NOTIFICATION_TONES = Object.freeze([
  {
    key: "default",
    label: "Default",
    icon: "notifications-outline",
    desc: "Default reminder tone.",
    previewAsset: require("../../assets/sounds/defult.wav"),
    notificationSound: "defult.wav",
    channelId: "vh-reminders-default",
    previewMs: 1400,
    isDefault: true,
  },
  {
    key: "alert",
    label: "Alert",
    icon: "alert-circle-outline",
    desc: "Short sharp alert tone.",
    previewAsset: require("../../assets/sounds/fail-notification.wav"),
    notificationSound: "fail-notification.wav",
    channelId: "vh-reminders-alert",
    previewMs: 1400,
    isDefault: false,
  },
  {
    key: "bell",
    label: "Bell",
    icon: "notifications-circle-outline",
    desc: "Classic bell tone.",
    previewAsset: require("../../assets/sounds/bell.wav"),
    notificationSound: "bell.wav",
    channelId: "vh-reminders-bell",
    previewMs: 1500,
    isDefault: false,
  },
  {
    key: "alarm",
    label: "Alarm",
    icon: "warning-outline",
    desc: "Stronger alarm reminder tone.",
    previewAsset: require("../../assets/sounds/wave-alarm.wav"),
    notificationSound: "wave-alarm.wav",
    channelId: "vh-reminders-alarm",
    previewMs: 1600,
    isDefault: false,
  },
  {
    key: "harp",
    label: "Harp",
    icon: "musical-notes-outline",
    desc: "Soft melodic harp tone.",
    previewAsset: require("../../assets/sounds/arabian-mystery-harp.wav"),
    notificationSound: "arabian-mystery-harp.wav",
    channelId: "vh-reminders-harp",
    previewMs: 1800,
    isDefault: false,
  },
  {
    key: "loop",
    label: "Loop",
    icon: "repeat-outline",
    desc: "Loop-style digital tone.",
    previewAsset: require("../../assets/sounds/simple-tone-loop.wav"),
    notificationSound: "simple-tone-loop.wav",
    channelId: "vh-reminders-loop",
    previewMs: 1700,
    isDefault: false,
  },
  {
    key: "silent",
    label: "Silent",
    icon: "volume-mute-outline",
    desc: "No sound.",
    previewAsset: null,
    notificationSound: null,
    channelId: "vh-reminders-silent",
    previewMs: 0,
    isDefault: false,
  },
]);

export const NOTIFICATION_TONE_MAP = NOTIFICATION_TONES.reduce((acc, tone) => {
  acc[tone.key] = tone;
  return acc;
}, {});

export function isValidNotificationTone(toneKey) {
  return Boolean(NOTIFICATION_TONE_MAP[String(toneKey || "")]);
}

export function getNotificationTone(toneKey) {
  return (
    NOTIFICATION_TONE_MAP[String(toneKey || "")] ||
    NOTIFICATION_TONE_MAP[DEFAULT_NOTIFICATION_TONE_KEY]
  );
}