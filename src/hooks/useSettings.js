import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  getUserSettings,
  upsertUserSettings,
  listUserCategories,
  replaceUserCategories,
  listUserTags,
  replaceUserTags,
} from "../services/repo/repoUser";
import databaseService from "../services/databaseService";
import notificationService from "../services/notificationService";
import { makePushId } from "../utils/pushId";
import {
  DEFAULT_NOTIFICATION_TONE_KEY,
  isValidNotificationTone,
} from "../constants/notificationTones";

export {
  DEFAULT_NOTIFICATION_TONE_KEY,
  NOTIFICATION_TONES,
} from "../constants/notificationTones";

const DEFAULT_SETTINGS = {
  push_enabled: false,
  biometric_enabled: false,
  notif_return_deadline: true,
  notif_warranty_expiry: true,
  notif_weekly_summary: false,
  base_currency: "SAR",
  notif_sound: DEFAULT_NOTIFICATION_TONE_KEY,
  language: "en",
};

export const SUPPORTED_CURRENCIES = [
  { code: "SAR", name: "Saudi Riyal", flag: "🇸🇦" },
  { code: "AED", name: "UAE Dirham", flag: "🇦🇪" },
  { code: "KWD", name: "Kuwaiti Dinar", flag: "🇰🇼" },
  { code: "QAR", name: "Qatari Riyal", flag: "🇶🇦" },
  { code: "OMR", name: "Omani Rial", flag: "🇴🇲" },
  { code: "BHD", name: "Bahraini Dinar", flag: "🇧🇭" },
  { code: "USD", name: "US Dollar", flag: "🇺🇸" },
  { code: "EUR", name: "Euro", flag: "🇪🇺" },
  { code: "GBP", name: "British Pound", flag: "🇬🇧" },
];

export const CATEGORY_COLORS = [
  "#C9973A",
  "#5B3B1F",
  "#18A957",
  "#2E6BD8",
  "#D64545",
  "#8A5509",
  "#A9711B",
  "#1D9E75",
];

export const CATEGORY_ICONS = [
  { key: "bag-outline", label: "Shopping" },
  { key: "phone-portrait-outline", label: "Electronics" },
  { key: "shirt-outline", label: "Fashion" },
  { key: "basket-outline", label: "Groceries" },
  { key: "home-outline", label: "Home" },
  { key: "medkit-outline", label: "Pharmacy" },
  { key: "briefcase-outline", label: "Work" },
  { key: "book-outline", label: "Books" },
  { key: "happy-outline", label: "Baby" },
  { key: "fitness-outline", label: "Sports" },
  { key: "pricetag-outline", label: "Other" },
];

export const TAG_COLORS = [
  "#C9973A",
  "#18A957",
  "#2E6BD8",
  "#D64545",
  "#8A5509",
  "#A9711B",
  "#1D9E75",
  "#8B5CF6",
];

function normalizeSettings(raw, uid) {
  return {
    ...DEFAULT_SETTINGS,
    ...(raw || {}),
    uid,
    push_enabled: !!Number(raw?.push_enabled ?? DEFAULT_SETTINGS.push_enabled),
    biometric_enabled: !!Number(raw?.biometric_enabled ?? DEFAULT_SETTINGS.biometric_enabled),
    notif_return_deadline: !!Number(raw?.notif_return_deadline ?? DEFAULT_SETTINGS.notif_return_deadline),
    notif_warranty_expiry: !!Number(raw?.notif_warranty_expiry ?? DEFAULT_SETTINGS.notif_warranty_expiry),
    notif_weekly_summary: !!Number(raw?.notif_weekly_summary ?? DEFAULT_SETTINGS.notif_weekly_summary),
    base_currency: String(raw?.base_currency || DEFAULT_SETTINGS.base_currency).toUpperCase(),
    language: String(raw?.language || DEFAULT_SETTINGS.language),
    notif_sound: isValidNotificationTone(raw?.notif_sound)
      ? String(raw?.notif_sound)
      : DEFAULT_NOTIFICATION_TONE_KEY,
  };
}

export function useSettings() {
  const { user } = useAuth();
  const uid = user?.uid;

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const mountedRef = useRef(true);

  const load = useCallback(async () => {
    if (!uid) {
      setLoading(false);
      return;
    }

    try {
      const [s, cats, tagList] = await Promise.all([
        getUserSettings(uid),
        listUserCategories(uid, "purchases"),
        listUserTags(uid),
      ]);

      if (!mountedRef.current) return;

      setSettings(normalizeSettings(s, uid));
      setCategories(cats || []);
      setTags(tagList || []);
    } catch {
      if (mountedRef.current) {
        setSettings(normalizeSettings({}, uid));
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    mountedRef.current = true;
    load();

    return () => {
      mountedRef.current = false;
    };
  }, [load]);

  const patchSetting = useCallback(
    async (patch) => {
      if (!uid) return { success: false, error: "missing-user" };

      const previous = settings;
      const next = normalizeSettings({ ...settings, ...patch }, uid);

      setSettings(next);
      setSaving(true);

      try {
        if ("push_enabled" in patch && next.push_enabled) {
          const granted = await notificationService.ensurePermissions();
          if (!granted) {
            throw new Error("Notification permission was not granted");
          }
        }

        if ("notif_sound" in patch) {
          await notificationService.configureChannels(next.notif_sound);
        }

        const now = Date.now();

        await upsertUserSettings({
          ...next,
          created_at: previous?.created_at || now,
          updated_at: now,
        });

        await databaseService.updateUserSettings(uid, {
          ...patch,
          updated_at: now,
        });

        return { success: true, data: next };
      } catch (error) {
        if (mountedRef.current) setSettings(previous);
        return { success: false, error };
      } finally {
        if (mountedRef.current) setSaving(false);
      }
    },
    [uid, settings]
  );

  const saveCategory = useCallback(
    async (category) => {
      if (!uid) return;

      const isNew = !category.category_id;
      const cat = {
        category_id: category.category_id || `cat_custom_${makePushId().slice(0, 10).toLowerCase()}`,
        name: String(category.name || "").trim(),
        icon_key: category.icon_key || "pricetag-outline",
        color: category.color || CATEGORY_COLORS[0],
      };

      if (!cat.name) return;

      const next = isNew
        ? [...categories, cat]
        : categories.map((c) =>
            String(c.category_id) === String(cat.category_id) ? { ...c, ...cat } : c
          );

      setCategories(next);

      try {
        await replaceUserCategories(uid, "purchases", next);

        const fbMap = {};
        for (const c of next) {
          fbMap[String(c.category_id)] = {
            category_id: c.category_id,
            name: c.name,
            icon_key: c.icon_key,
            color: c.color,
            source: "custom",
            updated_at: new Date().toISOString(),
          };
        }

        await databaseService.updateUserCategories(uid, fbMap).catch(() => {});
      } catch {
        setCategories(categories);
      }
    },
    [uid, categories]
  );

  const deleteCategory = useCallback(
    async (categoryId) => {
      if (!uid) return;

      const next = categories.filter((c) => String(c.category_id) !== String(categoryId));
      setCategories(next);

      try {
        await replaceUserCategories(uid, "purchases", next);

        const fbMap = {};
        for (const c of next) {
          fbMap[String(c.category_id)] = {
            category_id: c.category_id,
            name: c.name,
            icon_key: c.icon_key,
            color: c.color,
            source: "custom",
          };
        }

        await databaseService.updateUserCategories(uid, fbMap).catch(() => {});
      } catch {
        setCategories(categories);
      }
    },
    [uid, categories]
  );

  const saveTag = useCallback(
    async (tag) => {
      if (!uid) return;

      const isNew = !tag.tag_id;
      const t = {
        tag_id: tag.tag_id || `tag_custom_${makePushId().slice(0, 8).toLowerCase()}`,
        name: String(tag.name || "").trim(),
        color: tag.color || TAG_COLORS[0],
      };

      if (!t.name) return;

      const next = isNew
        ? [...tags, t]
        : tags.map((x) =>
            String(x.tag_id) === String(t.tag_id) ? { ...x, ...t } : x
          );

      setTags(next);

      try {
        await replaceUserTags(uid, next);

        const fbMap = {};
        for (const x of next) {
          fbMap[String(x.tag_id)] = {
            tag_id: x.tag_id,
            name: x.name,
            color: x.color,
          };
        }

        await databaseService.updateUserTags(uid, fbMap).catch(() => {});
      } catch {
        setTags(tags);
      }
    },
    [uid, tags]
  );

  const deleteTag = useCallback(
    async (tagId) => {
      if (!uid) return;

      const next = tags.filter((t) => String(t.tag_id) !== String(tagId));
      setTags(next);

      try {
        await replaceUserTags(uid, next);

        const fbMap = {};
        for (const t of next) {
          fbMap[String(t.tag_id)] = {
            tag_id: t.tag_id,
            name: t.name,
            color: t.color,
          };
        }

        await databaseService.updateUserTags(uid, fbMap).catch(() => {});
      } catch {
        setTags(tags);
      }
    },
    [uid, tags]
  );

  return {
    settings,
    categories,
    tags,
    saving,
    loading,
    patchSetting,
    saveCategory,
    deleteCategory,
    saveTag,
    deleteTag,
    reload: load,
  };
}

export default useSettings;