import { ref, get, set, update } from "firebase/database";
import { database } from "../config/firebase";
import { makePushId } from "../utils/pushId";

const safeKey = (key) => String(key || "").trim().replace(/[.#$\[\]\/]/g, "_");

export async function checkConnection() {
  try {
    await get(ref(database, ".info/connected"));
    return { success: true };
  } catch (e) {
    return { success: false, error: e?.message || String(e) };
  }
}

export async function getUserProfile(uid) {
  try {
    const u = safeKey(uid);
    const snap = await get(ref(database, `users/${u}`));
    return { success: true, data: snap.exists() ? snap.val() : null };
  } catch (e) {
    return { success: false, error: e?.message || String(e) };
  }
}

export async function createUserProfile(uid, profile) {
  try {
    const u = safeKey(uid);
    await set(ref(database, `users/${u}`), profile || {});
    return { success: true };
  } catch (e) {
    return { success: false, error: e?.message || String(e) };
  }
}

export async function updateUserProfile(uid, patch) {
  try {
    const u = safeKey(uid);
    await update(ref(database, `users/${u}`), patch || {});
    return { success: true };
  } catch (e) {
    return { success: false, error: e?.message || String(e) };
  }
}

export async function getUserSettings(uid) {
  try {
    const u = safeKey(uid);
    const snap = await get(ref(database, `user_settings/${u}`));
    return { success: true, data: snap.exists() ? snap.val() : null };
  } catch (e) {
    return { success: false, error: e?.message || String(e) };
  }
}

export async function updateUserSettings(uid, patch) {
  try {
    const u = safeKey(uid);
    await update(ref(database, `user_settings/${u}`), patch || {});
    return { success: true };
  } catch (e) {
    return { success: false, error: e?.message || String(e) };
  }
}

export async function ensureDefaultUserSettings(uid) {
  const existing = await getUserSettings(uid);
  if (existing.success && existing.data) return existing;

  const defaults = {
    theme: "light",
    language: "en",
    push_enabled: true,
    biometric_enabled: false,
    notif_return_deadline: true,
    notif_warranty_expiry: true,
    notif_weekly_summary: true,
    base_currency: "SAR",
    notif_sound: "default",
    created_at: Date.now(),
    updated_at: Date.now(),
  };

  try {
    const u = safeKey(uid);
    await set(ref(database, `user_settings/${u}`), defaults);
    return { success: true, data: defaults };
  } catch (e) {
    return { success: false, error: e?.message || String(e) };
  }
}

export async function trackUserEvent(uid, eventName, payload = {}) {
  try {
    if (!uid || !eventName) return { success: false, skipped: true };
    const userId = safeKey(uid);
    const eventId = makePushId();
    await set(ref(database, `analytics_events/${userId}/${eventId}`), {
      event: String(eventName),
      payload: payload || {},
      created_at: Date.now(),
    });
    return { success: true, eventId };
  } catch (e) {
    return { success: false, error: e?.message || String(e) };
  }
}

export async function updateUserCategories(uid, categoriesMap) {
  try {
    const u = safeKey(uid);
    await update(ref(database, `user_categories/${u}/purchases`), categoriesMap || {});
    return { success: true };
  } catch (e) {
    return { success: false, error: e?.message || String(e) };
  }
}

export async function updateUserTags(uid, tagsMap) {
  try {
    const u = safeKey(uid);
    await update(ref(database, `user_tags/${u}`), tagsMap || {});
    return { success: true };
  } catch (e) {
    return { success: false, error: e?.message || String(e) };
  }
}

export default {
  checkConnection,
  getUserProfile,
  createUserProfile,
  updateUserProfile,
  getUserSettings,
  updateUserSettings,
  ensureDefaultUserSettings,
  trackUserEvent,
  updateUserCategories,
  updateUserTags,
};
