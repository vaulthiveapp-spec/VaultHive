function safeParseCategories(store) {
  try {
    if (store?.categories_json) {
      const obj = JSON.parse(store.categories_json || "{}");
      return Object.keys(obj || {}).filter((k) => !!obj[k]);
    }
  } catch {}
  if (Array.isArray(store?.categories)) return store.categories;
  return [];
}

const COVERS = {
  electronics: require("../../assets/store_covers/electronics.png"),
  groceries: require("../../assets/store_covers/groceries.png"),
  fashion: require("../../assets/store_covers/fashion.png"),
  pharmacy: require("../../assets/store_covers/pharmacy.png"),
  home: require("../../assets/store_covers/home.png"),
  shopping: require("../../assets/store_covers/shopping.png"),
  default: require("../../assets/store_covers/default.png"),
};

export function getStoreCoverSource(store) {
  const cats = safeParseCategories(store);
  const first = String(cats?.[0] || "").toLowerCase();
  if (first && COVERS[first]) return COVERS[first];
  return COVERS.default;
}

export function getStoreCategoryLabel(store) {
  const cats = safeParseCategories(store);
  const first = String(cats?.[0] || "shopping");
  return first.replace(/_/g, " ");
}
