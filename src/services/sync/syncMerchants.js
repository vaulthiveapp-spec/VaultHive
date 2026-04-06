import { ref, onValue } from "firebase/database";
import { database } from "../../config/firebase";
import { upsertMerchant, upsertMerchantAlias } from "../localRepo";

const now = () => Date.now();

export function registerListeners(_userUid, unsubs) {
  // merchants is a global collection, not user-scoped
  unsubs.push(onValue(ref(database, "merchants"), async (snap) => {
    const v = snap.val() || {};
    for (const [merchant_id, data] of Object.entries(v)) {
      if (!data) continue;
      await upsertMerchant({
        merchant_id,
        name: data.name || "",
        categories: data.categories || [],
        city: data.city || null,
        verified: !!data.verified,
        created_at_ms: Number(data.created_at_ms || data.created_at || now()),
        updated_at_ms: Number(data.updated_at_ms || data.updated_at || now()),
      });
    }
  }));

  unsubs.push(onValue(ref(database, "merchant_aliases"), async (snap) => {
    const v = snap.val() || {};
    for (const [alias, merchant_id] of Object.entries(v)) {
      if (!alias || !merchant_id) continue;
      await upsertMerchantAlias(String(alias).toLowerCase(), String(merchant_id));
    }
  }));
}
