import { ref, onValue } from "firebase/database";
import { database } from "../../config/firebase";
import {
  upsertStoreServer,
  replaceStoresByCategory,
  upsertStoreReviewServer,
  upsertStoreReviewStatsServer,
} from "../localRepo";

const now = () => Date.now();

export function registerListeners(_userUid, unsubs) {
  // Stores is a global collection
  unsubs.push(onValue(ref(database, "stores"), async (snap) => {
    const v = snap.val() || {};
    for (const [store_id, data] of Object.entries(v)) {
      if (!data) continue;
      await upsertStoreServer({
        store_id,
        name: data.name || "",
        url: data.url || null,
        city: data.city || null,
        verified: !!data.verified,
        categories: data.categories || {},
        created_at: data.created_at || now(),
        updated_at: data.updated_at || now(),
      });
    }
  }));

  unsubs.push(onValue(ref(database, "stores_by_category"), async (snap) => {
    const v = snap.val() || {};
    for (const [category_key, map] of Object.entries(v)) {
      const storeIds = Object.keys(map || {}).filter((k) => !!(map || {})[k]);
      await replaceStoresByCategory(category_key, storeIds);
    }
  }));

  unsubs.push(onValue(ref(database, "store_review_stats"), async (snap) => {
    const v = snap.val() || {};
    for (const [store_id, data] of Object.entries(v)) {
      if (!data) continue;
      await upsertStoreReviewStatsServer(store_id, {
        avg_rating:     data.avg_rating     || 0,
        count:          data.count          || data.review_count || 0,
        review_count:   data.review_count   || data.count        || 0,
        review_summary: data.review_summary || null,
        updated_at:     data.updated_at     || now(),
      });
    }
  }));

  unsubs.push(onValue(ref(database, "store_reviews"), async (snap) => {
    const v = snap.val() || {};
    for (const [store_id, reviewsObj] of Object.entries(v)) {
      for (const [review_id, r] of Object.entries(reviewsObj || {})) {
        if (!r) continue;
        await upsertStoreReviewServer(store_id, review_id, {
          uid: r.uid || null,
          rating: r.rating || 0,
          comment: r.comment || "",
          created_at: r.created_at || now(),
        });
      }
    }
  }));
}
