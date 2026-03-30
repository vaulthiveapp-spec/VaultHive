import { ref, onValue } from "firebase/database";
import { database } from "../../config/firebase";
import {
  upsertUser,
  upsertUserSettings,
  replaceUserCategories,
  replaceUserTags,
  upsertCategoryDefault,
  upsertTagDefault,
  upsertRequirementCategory,
  replaceUserFavoriteStores,
} from "../localRepo";

const now = () => Date.now();

export function registerListeners(userUid, unsubs) {
  // ── User profile ────────────────────────────────────────────────────────────
  unsubs.push(onValue(ref(database, `users/${userUid}`), async (snap) => {
    const v = snap.val();
    if (!v) return;
    await upsertUser({
      uid: userUid,
      name: v.name || v.userName || v.displayName || "",
      email: v.email || "",
      email_lower: v.email_lower || (v.email ? String(v.email).toLowerCase() : ""),
      username: v.username || v.userName || "",
      username_lower: v.username_lower || v.userNameLower || "",
      user_type: v.user_type || v.UserType || "user",
      registration_date: v.registration_date || v.RegistrationDate || null,
      created_at: v.created_at || v.createdAt || now(),
      updated_at: v.updated_at || v.updatedAt || now(),
    });
  }));

  // ── User settings ────────────────────────────────────────────────────────────
  unsubs.push(onValue(ref(database, `user_settings/${userUid}`), async (snap) => {
    const v = snap.val();
    if (!v) return;
    await upsertUserSettings({
      uid: userUid,
      theme: v.theme || "light",
      language: v.language || "en",
      push_enabled: !!v.push_enabled,
      biometric_enabled: !!v.biometric_enabled,
      notif_return_deadline: !!v.notif_return_deadline,
      notif_warranty_expiry: !!v.notif_warranty_expiry,
      notif_weekly_summary: !!v.notif_weekly_summary,
      base_currency: v.base_currency || v.currency || "SAR",
      notif_sound: v.notif_sound || "default",
      created_at: v.created_at || now(),
      updated_at: v.updated_at || now(),
    });
  }));

  // NOTE: exchange rates are NOT synced from Firebase RTDB.
  // Rates come from the Currencylayer API, cached in the local SQLite
  // `currencies` table by currencyService.getRatesSnapshot().

  // ── Global category defaults ─────────────────────────────────────────────────
  unsubs.push(onValue(ref(database, "category_defaults"), async (snap) => {
    const v = snap.val() || {};
    for (const scope of Object.keys(v)) {
      const arr = Array.isArray(v[scope]) ? v[scope] : [];
      for (const c of arr) {
        if (!c) continue;
        await upsertCategoryDefault({ scope, category_id: c.category_id, name: c.name, icon_key: c.icon_key, color: c.color });
      }
    }
  }));

  // ── Global tag defaults ──────────────────────────────────────────────────────
  unsubs.push(onValue(ref(database, "tag_defaults"), async (snap) => {
    const v = snap.val() || [];
    const arr = Array.isArray(v) ? v : Object.values(v);
    for (const t of arr) {
      if (!t) continue;
      await upsertTagDefault({ tag_id: t.tag_id, name: t.name, color: t.color });
    }
  }));

  // ── Requirement categories ───────────────────────────────────────────────────
  unsubs.push(onValue(ref(database, "requirement_categories"), async (snap) => {
    const v = snap.val() || {};
    for (const [key, data] of Object.entries(v)) {
      if (!data) continue;
      await upsertRequirementCategory(key, { name: data.name || "", icon_key: data.icon_key || null });
    }
  }));

  // ── User categories ──────────────────────────────────────────────────────────
  unsubs.push(onValue(ref(database, `user_categories/${userUid}`), async (snap) => {
    const v = snap.val();
    if (!v) return;
    for (const scope of Object.keys(v)) {
      // Firebase stores categories as { category_id: { ...fields } } — not an array.
      // Convert object values to array before passing to replaceUserCategories.
      const raw = v[scope];
      const arr = Array.isArray(raw)
        ? raw
        : raw && typeof raw === "object"
          ? Object.values(raw)
          : [];
      await replaceUserCategories(userUid, scope, arr);
    }
  }));

  // ── User tags ────────────────────────────────────────────────────────────────
  unsubs.push(onValue(ref(database, `user_tags/${userUid}`), async (snap) => {
    const v = snap.val();
    if (!v) return;
    const arr = Array.isArray(v) ? v : Object.values(v);
    await replaceUserTags(userUid, arr.map((t) => ({ tag_id: t.tag_id, name: t.name, color: t.color })));
  }));

  // ── User favorite stores ─────────────────────────────────────────────────────
  unsubs.push(onValue(ref(database, `user_favorites/${userUid}/stores`), async (snap) => {
    const v = snap.val() || {};
    const storeIds = Object.keys(v).filter((k) => !!v[k]);
    await replaceUserFavoriteStores(userUid, storeIds);
  }));
}
