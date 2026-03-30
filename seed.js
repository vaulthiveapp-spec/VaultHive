"use strict";

const admin = require("firebase-admin");
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const dns = require("dns");
const dayjs = require("dayjs");

try {
  if (typeof dns.setDefaultResultOrder === "function") {
    dns.setDefaultResultOrder("ipv4first");
  }
} catch {}

function loadEnv() {
  const candidates = [
    path.resolve(process.cwd(), ".env.seed"),
    path.resolve(process.cwd(), ".env.local"),
    path.resolve(process.cwd(), ".env"),
    path.resolve(__dirname, ".env.seed"),
    path.resolve(__dirname, ".env.local"),
    path.resolve(__dirname, ".env"),
  ];

  for (const filePath of candidates) {
    if (!fs.existsSync(filePath)) continue;

    const raw = fs.readFileSync(filePath, "utf8");
    raw.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;

      const eq = trimmed.indexOf("=");
      if (eq === -1) return;

      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (!process.env[key]) {
        process.env[key] = value;
      }
    });
  }
}

loadEnv();

const SEED_VERSION = "vaulthive_seed_v15_2026_03_15";

const FIREBASE_DATABASE_URL =
  process.env.FIREBASE_DATABASE_URL ||
  process.env.FIREBASE_RTDB_URL ||
  process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL ||
  "";

const FIREBASE_SERVICE_ACCOUNT =
  process.env.FIREBASE_SERVICE_ACCOUNT ||
  path.resolve(process.cwd(), "serviceAccount.json");

const SEED_CREATE_AUTH_USERS = /^(1|true|yes)$/i.test(
  String(process.env.SEED_CREATE_AUTH_USERS || "false")
);

const SEED_USE_PUBLIC_STORAGE_URLS = /^(1|true|yes)$/i.test(
  String(process.env.SEED_USE_PUBLIC_STORAGE_URLS || "false")
);

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  "";

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const SUPABASE_BUCKET_ATTACHMENTS =
  process.env.SUPABASE_BUCKET_ATTACHMENTS || "vh-attachments";

const SUPABASE_BUCKET_AVATARS =
  process.env.SUPABASE_BUCKET_AVATARS || "vh-avatars";

const SUPABASE_BUCKET_EXPORTS =
  process.env.SUPABASE_BUCKET_EXPORTS || "vh-exports";

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!FIREBASE_DATABASE_URL) {
  fail("Missing FIREBASE_DATABASE_URL.");
}

if (!fs.existsSync(FIREBASE_SERVICE_ACCOUNT)) {
  fail(`Missing Firebase service account file: ${FIREBASE_SERVICE_ACCOUNT}`);
}

if (!SUPABASE_URL) {
  fail("Missing SUPABASE_URL.");
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  fail("Missing SUPABASE_SERVICE_ROLE_KEY.");
}

const serviceAccount = require(FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: FIREBASE_DATABASE_URL,
});

const db = admin.database();
const auth = admin.auth();

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});

const SAMPLE_JPEG_BASE64 =
  "/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAALCAABAAEBAREA/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAH/AP/EABQQAQAAAAAAAAAAAAAAAAAAAAH/2gAIAQEAAQUCcf/EABQRAQAAAAAAAAAAAAAAAAAAAAH/2gAIAQMBAT8Bcf/EABQRAQAAAAAAAAAAAAAAAAAAAAH/2gAIAQIBAT8Bcf/EABQQAQAAAAAAAAAAAAAAAAAAAAH/2gAIAQEABj8Ccf/EABQQAQAAAAAAAAAAAAAAAAAAAAH/2gAIAQEAAT8hcf/Z";

const SAMPLE_PDF_BASE64 =
  "JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCAyMDAgMjAwXSAvQ29udGVudHMgNCAwIFIgL1Jlc291cmNlcyA8PCA+PiA+PgplbmRvYmoKNCAwIG9iago8PCAvTGVuZ3RoIDQ0ID4+CnN0cmVhbQpCVAovRjEgMTIgVGYKMTAwIDEwMCBUZAooVmF1bHRIaXZlIFNlZWQgRmlsZSkgVGoKRVQKZW5kc3RyZWFtCmVuZG9iagp4cmVmCjAgNQowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMTUgMDAwMDAgbiAKMDAwMDAwMDA2NCAwMDAwMCBuIAowMDAwMDAwMTIzIDAwMDAwIG4gCjAwMDAwMDAyMzAgMDAwMDAgbiAKdHJhaWxlcgo8PCAvU2l6ZSA1IC9Sb290IDEgMCBSID4+CnN0YXJ0eHJlZgozMTAKJSVFT0Y=";

function b64ToBuffer(b64) {
  return Buffer.from(String(b64 || ""), "base64");
}

function lower(value) {
  return String(value || "").trim().toLowerCase();
}

function slug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function firebaseKey(value) {
  const raw = String(value || "").trim().toLowerCase();

  const cleaned = raw
    .replace(/\s+/g, "_")
    .replace(/[.#$[\]/]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (cleaned) return cleaned;

  const hash = crypto
    .createHash("sha1")
    .update(raw || "empty")
    .digest("hex")
    .slice(0, 16);

  return `key_${hash}`;
}

function stableUid(email) {
  const hash = crypto
    .createHash("sha1")
    .update(String(email || ""))
    .digest("hex")
    .slice(0, 20);

  return `seed_${hash}`;
}

function monthKey(dateValue) {
  return dayjs(dateValue).format("YYYY-MM");
}

function audit(createdAt, updatedAt) {
  const created = dayjs(createdAt || new Date());
  const updated = dayjs(updatedAt || created);

  return {
    created_at: created.toISOString(),
    created_at_ms: created.valueOf(),
    updated_at: updated.toISOString(),
    updated_at_ms: updated.valueOf(),
  };
}

function withAudit(data, createdAt, updatedAt) {
  return { ...data, ...audit(createdAt, updatedAt) };
}

function setUpdate(updates, pathKey, value) {
  updates[pathKey] = value;
}

async function uploadSeedFile({ bucket, objectPath, buffer, contentType }) {
  const { error } = await supabase.storage.from(bucket).upload(objectPath, buffer, {
    contentType,
    upsert: true,
  });

  if (error) {
    throw new Error(`Supabase upload failed for ${objectPath}: ${error.message}`);
  }

  let publicUrl = null;
  if (SEED_USE_PUBLIC_STORAGE_URLS) {
    const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);
    publicUrl = data?.publicUrl || null;
  }

  return {
    provider: "supabase",
    bucket,
    path: objectPath,
    public_url: publicUrl,
    uploaded: true,
  };
}

const BRAND_TOKENS = {
  name: "VaultHive",
  palette: {
    app_background: "#F6F0E6",
    surface: "#FFF8EB",
    surface_alt: "#F3E6CC",
    text_primary: "#3E2815",
    text_secondary: "#6C4A2F",
    text_muted: "#8A725D",
    brown: "#5B3B1F",
    brown_dark: "#3A2414",
    gold: "#C99739",
    gold_dark: "#A9711B",
    gold_soft: "#EEDCA0",
    cream: "#FEF7E6",
    border: "#D8C2A2",
    success: "#2E7D32",
    warning: "#C17E14",
    error: "#C0392B",
  },
  gradients: {
    hero: ["#5B3B1F", "#C99739"],
    premium_card: ["#FFF8EB", "#EEDCA0"],
    button_primary: ["#A9711B", "#C99739"],
    assistant: ["#CFA146", "#F3E1A2", "#D2A449"],
  },
};

const FEATURE_FLAGS = {
  ai_enabled: true,
  ai_web_search_enabled: true,
  ai_file_understanding_enabled: true,
  voice_note_enabled: true,
  ocr_enabled: true,
  proof_pack_enabled: true,
  reports_enabled: true,
  store_recommendations_enabled: true,
  claim_center_enabled: true,
};

const SYSTEM_CATEGORIES = [
  { category_id: "cat_system_groceries", name: "Groceries", icon_key: "cart", color: "#C99739", source: "system", status: "active", sort_order: 1 },
  { category_id: "cat_system_electronics", name: "Electronics", icon_key: "cpu", color: "#5B3B1F", source: "system", status: "active", sort_order: 2 },
  { category_id: "cat_system_fashion", name: "Fashion", icon_key: "shirt", color: "#A9711B", source: "system", status: "active", sort_order: 3 },
  { category_id: "cat_system_pharmacy", name: "Pharmacy", icon_key: "medical", color: "#C99739", source: "system", status: "active", sort_order: 4 },
  { category_id: "cat_system_home", name: "Home", icon_key: "home", color: "#5B3B1F", source: "system", status: "active", sort_order: 5 },
  { category_id: "cat_system_subscriptions", name: "Subscriptions", icon_key: "repeat", color: "#A9711B", source: "system", status: "active", sort_order: 6 },
  { category_id: "cat_system_other", name: "Other", icon_key: "ellipsis-horizontal", color: "#8A725D", source: "system", status: "active", sort_order: 7 },
];

const SYSTEM_TAGS = [
  { tag_id: "tag_important", name: "Important", color: "#C99739" },
  { tag_id: "tag_returnable", name: "Returnable", color: "#A9711B" },
  { tag_id: "tag_warranty", name: "Warranty", color: "#5B3B1F" },
  { tag_id: "tag_follow_up", name: "Follow Up", color: "#8A725D" },
  { tag_id: "tag_recurring", name: "Recurring", color: "#C99739" },
];

const MERCHANTS = {
  merchant_jarir: {
    name: "Jarir Bookstore",
    aliases: ["jarir", "jarir bookstore", "مكتبة جرير", "جرير"],
    city: "Riyadh",
    categories: ["electronics", "office", "books"],
  },
  merchant_extra: {
    name: "Extra Stores",
    aliases: ["extra", "extra stores", "اكسترا"],
    city: "Riyadh",
    categories: ["electronics", "home"],
  },
  merchant_panda: {
    name: "Panda",
    aliases: ["panda", "بنده"],
    city: "Riyadh",
    categories: ["groceries"],
  },
  merchant_nahdi: {
    name: "Nahdi Pharmacy",
    aliases: ["nahdi", "nahdi pharmacy", "صيدلية النهدي", "النهدي"],
    city: "Jeddah",
    categories: ["pharmacy"],
  },
  merchant_noon: {
    name: "Noon",
    aliases: ["noon", "نون"],
    city: "Online",
    categories: ["electronics", "fashion", "home", "baby"],
  },
  merchant_namshi: {
    name: "Namshi",
    aliases: ["namshi", "نمشي"],
    city: "Online",
    categories: ["fashion"],
  },
  merchant_ikea: {
    name: "IKEA",
    aliases: ["ikea", "ايكيا"],
    city: "Riyadh",
    categories: ["home"],
  },
};

const STORES = {
  jarir: {
    name: "Jarir Bookstore",
    url: "https://www.jarir.com",
    city: "Riyadh",
    verified: true,
    categories: ["electronics", "office", "books"],
    avg_rating: 4.7,
    review_count: 128,
    review_summary: "Strong for electronics, product variety, and reliable post-purchase support.",
    review_themes: ["Reliable", "Wide selection", "Good after-sales support"],
  },
  extra: {
    name: "Extra Stores",
    url: "https://www.extra.com",
    city: "Riyadh",
    verified: true,
    categories: ["electronics", "home"],
    avg_rating: 4.4,
    review_count: 91,
    review_summary: "Strong for appliances and promotions, but quality can vary by branch and timing.",
    review_themes: ["Promotions", "Appliances", "Branch quality varies"],
  },
  panda: {
    name: "Panda",
    url: "https://www.panda.com.sa",
    city: "Riyadh",
    verified: true,
    categories: ["groceries"],
    avg_rating: 4.2,
    review_count: 84,
    review_summary: "Good grocery coverage and convenient recurring shopping.",
    review_themes: ["Convenient", "Groceries", "Good recurring value"],
  },
  nahdi: {
    name: "Nahdi Pharmacy",
    url: "https://www.nahdionline.com",
    city: "Jeddah",
    verified: true,
    categories: ["pharmacy", "care"],
    avg_rating: 4.5,
    review_count: 76,
    review_summary: "Reliable for pharmacy needs and repeat health-related purchases.",
    review_themes: ["Reliable", "Health", "Fast essentials"],
  },
  noon: {
    name: "Noon",
    url: "https://www.noon.com/saudi-en/",
    city: "Online",
    verified: true,
    categories: ["electronics", "fashion", "home", "baby"],
    avg_rating: 4.1,
    review_count: 172,
    review_summary: "Useful for variety and online convenience, especially when comparing options.",
    review_themes: ["Variety", "Online convenience", "Deals"],
  },
  namshi: {
    name: "Namshi",
    url: "https://www.namshi.com",
    city: "Online",
    verified: true,
    categories: ["fashion"],
    avg_rating: 4.3,
    review_count: 61,
    review_summary: "Good for fashion-focused purchases with strong category relevance.",
    review_themes: ["Fashion", "Style variety", "Online ease"],
  },
  ikea: {
    name: "IKEA",
    url: "https://www.ikea.com/sa/en/",
    city: "Riyadh",
    verified: true,
    categories: ["home"],
    avg_rating: 4.6,
    review_count: 110,
    review_summary: "Strong for furniture, home setup, and long-lifecycle home items.",
    review_themes: ["Furniture", "Home setup", "Reliable home selection"],
  },
};

const DEMO_USERS = [
  {
    key: "reem",
    displayName: "Reem",
    email: "reem@vaulthive.app",
    password: "Reem@1234",
    city: "Riyadh",
    baseCurrency: "SAR",
    customCategories: [
      {
        category_id: "cat_custom_work_setup",
        name: "Work Setup",
        icon_key: "laptop",
        color: "#A9711B",
        source: "user",
        status: "active",
        sort_order: 20,
        keywords: { macbook: true, keyboard: true, monitor: true },
      },
      {
        category_id: "cat_custom_baby_items",
        name: "Baby Items",
        icon_key: "gift",
        color: "#C99739",
        source: "user",
        status: "active",
        sort_order: 21,
        keywords: { baby: true, stroller: true, diaper: true },
      },
    ],
    favorites: ["jarir", "extra", "noon"],
    storeReviews: [
      { storeId: "jarir", reviewId: "review_reem_jarir_1", rating: 5, comment: "Very reliable for electronics and after-sales service." },
      { storeId: "noon", reviewId: "review_reem_noon_1", rating: 4, comment: "Useful for variety, especially for baby products." },
    ],
    bundles: [
      {
        hubId: "hub_reem_macbook",
        title: "MacBook Pro 14-inch",
        merchantId: "merchant_jarir",
        storeId: "jarir",
        categoryId: "cat_custom_work_setup",
        purchaseDate: dayjs().subtract(48, "day").format("YYYY-MM-DD"),
        amount: 7499,
        currency: "SAR",
        receiptId: "receipt_reem_macbook",
        receiptNumber: "JR-2026-10021",
        returnDeadline: dayjs().subtract(34, "day").format("YYYY-MM-DD"),
        tags: ["tag_important", "tag_warranty"],
        notes: "Bought for remote work and product design.",
        itemLines: [{ item_id: "item_reem_macbook_1", name: "MacBook Pro 14-inch", qty: 1, unit_price: 7499 }],
        receiptAttachment: {
          attachment_id: "att_receipt_reem_macbook",
          filename: "reem-macbook-receipt.jpg",
          contentType: "image/jpeg",
          buffer: b64ToBuffer(SAMPLE_JPEG_BASE64),
        },
        warranty: {
          warrantyId: "warranty_reem_macbook",
          productName: "MacBook Pro 14-inch",
          serialNumber: "MBP-REEM-14026",
          startDate: dayjs().subtract(48, "day").format("YYYY-MM-DD"),
          endDate: dayjs().add(20, "month").format("YYYY-MM-DD"),
          termsNote: "2-year protection coverage including hardware service.",
          attachment: {
            attachment_id: "att_warranty_reem_macbook",
            filename: "reem-macbook-warranty.pdf",
            contentType: "application/pdf",
            buffer: b64ToBuffer(SAMPLE_PDF_BASE64),
          },
        },
        serviceEntries: [
          {
            entryId: "service_reem_macbook_1",
            type: "inspection",
            title: "Battery health check",
            serviceDate: dayjs().subtract(7, "day").format("YYYY-MM-DD"),
            note: "No issue found. Device remains in good condition.",
          },
        ],
        claims: [],
        exportFiles: [
          {
            exportId: "export_reem_macbook_proof_1",
            kind: "proof_pack",
            filename: "reem-macbook-proof-pack.pdf",
          },
        ],
      },
      {
        hubId: "hub_reem_stroller",
        title: "Baby Stroller",
        merchantId: "merchant_noon",
        storeId: "noon",
        categoryId: "cat_custom_baby_items",
        purchaseDate: dayjs().subtract(11, "day").format("YYYY-MM-DD"),
        amount: 1180,
        currency: "SAR",
        receiptId: "receipt_reem_stroller",
        receiptNumber: "NOON-REEM-8831",
        returnDeadline: dayjs().add(3, "day").format("YYYY-MM-DD"),
        tags: ["tag_returnable", "tag_follow_up"],
        notes: "Need to confirm if manufacturer warranty card was included.",
        itemLines: [{ item_id: "item_reem_stroller_1", name: "Baby Stroller", qty: 1, unit_price: 1180 }],
        receiptAttachment: {
          attachment_id: "att_receipt_reem_stroller",
          filename: "reem-stroller-receipt.jpg",
          contentType: "image/jpeg",
          buffer: b64ToBuffer(SAMPLE_JPEG_BASE64),
        },
        serviceEntries: [],
        claims: [],
        exportFiles: [],
      },
    ],
  },
  {
    key: "atheer",
    displayName: "Atheer",
    email: "atheer@vaulthive.app",
    password: "Atheer@1234",
    city: "Riyadh",
    baseCurrency: "SAR",
    customCategories: [
      {
        category_id: "cat_custom_air_quality",
        name: "Air Quality",
        icon_key: "leaf",
        color: "#A9711B",
        source: "user",
        status: "active",
        sort_order: 20,
        keywords: { purifier: true, filter: true, air: true },
      },
    ],
    favorites: ["panda", "nahdi", "extra"],
    storeReviews: [
      { storeId: "panda", reviewId: "review_atheer_panda_1", rating: 4, comment: "Convenient for recurring weekly groceries." },
      { storeId: "extra", reviewId: "review_atheer_extra_1", rating: 4, comment: "Good appliance choices and promotions." },
    ],
    bundles: [
      {
        hubId: "hub_atheer_groceries",
        title: "Weekly Groceries",
        merchantId: "merchant_panda",
        storeId: "panda",
        categoryId: "cat_system_groceries",
        purchaseDate: dayjs().subtract(3, "day").format("YYYY-MM-DD"),
        amount: 186.4,
        currency: "SAR",
        receiptId: "receipt_atheer_groceries",
        receiptNumber: "PND-ATH-1477",
        returnDeadline: null,
        tags: ["tag_recurring"],
        notes: "Recurring family grocery basket.",
        itemLines: [{ item_id: "item_atheer_grocery_1", name: "Groceries Basket", qty: 1, unit_price: 186.4 }],
        receiptAttachment: {
          attachment_id: "att_receipt_atheer_groceries",
          filename: "atheer-grocery-receipt.jpg",
          contentType: "image/jpeg",
          buffer: b64ToBuffer(SAMPLE_JPEG_BASE64),
        },
        serviceEntries: [],
        claims: [],
        exportFiles: [],
      },
      {
        hubId: "hub_atheer_purifier",
        title: "Air Purifier",
        merchantId: "merchant_extra",
        storeId: "extra",
        categoryId: "cat_custom_air_quality",
        purchaseDate: dayjs().subtract(710, "day").format("YYYY-MM-DD"),
        amount: 1299,
        currency: "SAR",
        receiptId: "receipt_atheer_purifier",
        receiptNumber: "EXT-ATH-2211",
        returnDeadline: dayjs().subtract(696, "day").format("YYYY-MM-DD"),
        tags: ["tag_warranty", "tag_important"],
        notes: "Warranty should be checked before expiry.",
        itemLines: [{ item_id: "item_atheer_purifier_1", name: "Air Purifier", qty: 1, unit_price: 1299 }],
        receiptAttachment: {
          attachment_id: "att_receipt_atheer_purifier",
          filename: "atheer-purifier-receipt.jpg",
          contentType: "image/jpeg",
          buffer: b64ToBuffer(SAMPLE_JPEG_BASE64),
        },
        warranty: {
          warrantyId: "warranty_atheer_purifier",
          productName: "Air Purifier",
          serialNumber: "AIR-ATH-9923",
          startDate: dayjs().subtract(710, "day").format("YYYY-MM-DD"),
          endDate: dayjs().add(18, "day").format("YYYY-MM-DD"),
          termsNote: "24-month standard manufacturer coverage.",
          attachment: {
            attachment_id: "att_warranty_atheer_purifier",
            filename: "atheer-purifier-warranty.pdf",
            contentType: "application/pdf",
            buffer: b64ToBuffer(SAMPLE_PDF_BASE64),
          },
        },
        serviceEntries: [
          {
            entryId: "service_atheer_purifier_1",
            type: "repair",
            title: "Filter and airflow service",
            serviceDate: dayjs().subtract(14, "day").format("YYYY-MM-DD"),
            note: "Service center replaced internal filter assembly.",
          },
        ],
        claims: [
          {
            claimId: "claim_atheer_purifier_1",
            kind: "warranty_claim",
            status: "draft",
            createdDate: dayjs().subtract(2, "day").format("YYYY-MM-DD"),
            note: "Preparing documents before warranty expiry.",
          },
        ],
        exportFiles: [
          {
            exportId: "export_atheer_purifier_claim_1",
            kind: "claim_pack",
            filename: "atheer-purifier-claim-pack.pdf",
          },
        ],
      },
    ],
  },
  {
    key: "bushra",
    displayName: "Bushra",
    email: "bushra@vaulthive.app",
    password: "Bushra@1234",
    city: "Jeddah",
    baseCurrency: "SAR",
    customCategories: [
      {
        category_id: "cat_custom_coffee_corner",
        name: "Coffee Corner",
        icon_key: "cafe",
        color: "#5B3B1F",
        source: "user",
        status: "active",
        sort_order: 20,
        keywords: { coffee: true, espresso: true, capsule: true },
      },
    ],
    favorites: ["ikea", "extra", "noon"],
    storeReviews: [
      { storeId: "ikea", reviewId: "review_bushra_ikea_1", rating: 5, comment: "Excellent for durable home items and setup planning." },
      { storeId: "extra", reviewId: "review_bushra_extra_1", rating: 4, comment: "Good for appliance shopping and comparisons." },
    ],
    bundles: [
      {
        hubId: "hub_bushra_espresso",
        title: "Espresso Machine",
        merchantId: "merchant_extra",
        storeId: "extra",
        categoryId: "cat_custom_coffee_corner",
        purchaseDate: dayjs().subtract(9, "day").format("YYYY-MM-DD"),
        amount: 1599,
        currency: "SAR",
        receiptId: "receipt_bushra_espresso",
        receiptNumber: "EXT-BUS-8822",
        returnDeadline: dayjs().add(5, "day").format("YYYY-MM-DD"),
        tags: ["tag_returnable", "tag_follow_up"],
        notes: "Need to attach warranty card if found in box.",
        itemLines: [{ item_id: "item_bushra_espresso_1", name: "Espresso Machine", qty: 1, unit_price: 1599 }],
        receiptAttachment: {
          attachment_id: "att_receipt_bushra_espresso",
          filename: "bushra-espresso-receipt.jpg",
          contentType: "image/jpeg",
          buffer: b64ToBuffer(SAMPLE_JPEG_BASE64),
        },
        serviceEntries: [],
        claims: [],
        exportFiles: [],
      },
      {
        hubId: "hub_bushra_sofa",
        title: "Living Room Sofa",
        merchantId: "merchant_ikea",
        storeId: "ikea",
        categoryId: "cat_system_home",
        purchaseDate: dayjs().subtract(33, "day").format("YYYY-MM-DD"),
        amount: 2490,
        currency: "SAR",
        receiptId: "receipt_bushra_sofa",
        receiptNumber: "IKEA-BUS-5511",
        returnDeadline: dayjs().subtract(19, "day").format("YYYY-MM-DD"),
        tags: ["tag_important"],
        notes: "Need to save assembly note and care instructions.",
        itemLines: [{ item_id: "item_bushra_sofa_1", name: "Living Room Sofa", qty: 1, unit_price: 2490 }],
        receiptAttachment: {
          attachment_id: "att_receipt_bushra_sofa",
          filename: "bushra-sofa-receipt.jpg",
          contentType: "image/jpeg",
          buffer: b64ToBuffer(SAMPLE_JPEG_BASE64),
        },
        serviceEntries: [
          {
            entryId: "service_bushra_sofa_1",
            type: "assembly",
            title: "Assembly and setup note",
            serviceDate: dayjs().subtract(31, "day").format("YYYY-MM-DD"),
            note: "Assembly completed successfully with no defects.",
          },
        ],
        claims: [],
        exportFiles: [
          {
            exportId: "export_bushra_sofa_proof_1",
            kind: "proof_pack",
            filename: "bushra-sofa-proof-pack.pdf",
          },
        ],
      },
    ],
  },
  {
    key: "shooq",
    displayName: "Shooq",
    email: "shooq@vaulthive.app",
    password: "Shooq@1234",
    city: "Riyadh",
    baseCurrency: "SAR",
    customCategories: [
      {
        category_id: "cat_custom_study_tech",
        name: "Study Tech",
        icon_key: "tablet-portrait",
        color: "#A9711B",
        source: "user",
        status: "active",
        sort_order: 20,
        keywords: { ipad: true, stylus: true, notes: true },
      },
      {
        category_id: "cat_custom_event_style",
        name: "Event Style",
        icon_key: "sparkles",
        color: "#C99739",
        source: "user",
        status: "active",
        sort_order: 21,
        keywords: { dress: true, shoes: true, fashion: true },
      },
    ],
    favorites: ["namshi", "jarir", "noon"],
    storeReviews: [
      { storeId: "namshi", reviewId: "review_shooq_namshi_1", rating: 5, comment: "Very convenient for fashion and event shopping." },
      { storeId: "jarir", reviewId: "review_shooq_jarir_1", rating: 4, comment: "Good for study devices and accessories." },
    ],
    bundles: [
      {
        hubId: "hub_shooq_ipad",
        title: "iPad Air",
        merchantId: "merchant_jarir",
        storeId: "jarir",
        categoryId: "cat_custom_study_tech",
        purchaseDate: dayjs().subtract(22, "day").format("YYYY-MM-DD"),
        amount: 2599,
        currency: "SAR",
        receiptId: "receipt_shooq_ipad",
        receiptNumber: "JR-SHQ-9921",
        returnDeadline: dayjs().subtract(8, "day").format("YYYY-MM-DD"),
        tags: ["tag_warranty", "tag_important"],
        notes: "Used for study notes and daily planning.",
        itemLines: [{ item_id: "item_shooq_ipad_1", name: "iPad Air", qty: 1, unit_price: 2599 }],
        receiptAttachment: {
          attachment_id: "att_receipt_shooq_ipad",
          filename: "shooq-ipad-receipt.jpg",
          contentType: "image/jpeg",
          buffer: b64ToBuffer(SAMPLE_JPEG_BASE64),
        },
        warranty: {
          warrantyId: "warranty_shooq_ipad",
          productName: "iPad Air",
          serialNumber: "IPAD-SHQ-5521",
          startDate: dayjs().subtract(22, "day").format("YYYY-MM-DD"),
          endDate: dayjs().add(11, "month").format("YYYY-MM-DD"),
          termsNote: "1-year standard device coverage.",
          attachment: {
            attachment_id: "att_warranty_shooq_ipad",
            filename: "shooq-ipad-warranty.pdf",
            contentType: "application/pdf",
            buffer: b64ToBuffer(SAMPLE_PDF_BASE64),
          },
        },
        serviceEntries: [],
        claims: [],
        exportFiles: [
          {
            exportId: "export_shooq_ipad_proof_1",
            kind: "proof_pack",
            filename: "shooq-ipad-proof-pack.pdf",
          },
        ],
      },
      {
        hubId: "hub_shooq_dress",
        title: "Formal Dress",
        merchantId: "merchant_namshi",
        storeId: "namshi",
        categoryId: "cat_custom_event_style",
        purchaseDate: dayjs().subtract(5, "day").format("YYYY-MM-DD"),
        amount: 420,
        currency: "SAR",
        receiptId: "receipt_shooq_dress",
        receiptNumber: "NMS-SHQ-4401",
        returnDeadline: dayjs().add(6, "day").format("YYYY-MM-DD"),
        tags: ["tag_returnable", "tag_follow_up"],
        notes: "Bought for an upcoming event and may still be exchanged.",
        itemLines: [{ item_id: "item_shooq_dress_1", name: "Formal Dress", qty: 1, unit_price: 420 }],
        receiptAttachment: {
          attachment_id: "att_receipt_shooq_dress",
          filename: "shooq-dress-receipt.jpg",
          contentType: "image/jpeg",
          buffer: b64ToBuffer(SAMPLE_JPEG_BASE64),
        },
        serviceEntries: [],
        claims: [],
        exportFiles: [],
      },
    ],
  },
];

async function upsertFirebaseAuthUser(seedProfile) {
  if (!SEED_CREATE_AUTH_USERS) {
    return stableUid(seedProfile.email);
  }

  const existingUser = await auth.getUserByEmail(seedProfile.email).catch(() => null);

  if (existingUser) {
    const updated = await auth.updateUser(existingUser.uid, {
      displayName: seedProfile.displayName,
      emailVerified: true,
      disabled: false,
      password: seedProfile.password,
    });
    return updated.uid;
  }

  const created = await auth.createUser({
    displayName: seedProfile.displayName,
    email: seedProfile.email,
    password: seedProfile.password,
    emailVerified: true,
    disabled: false,
  });

  return created.uid;
}

async function ensureUserRecord(seedProfile) {
  const username = slug(seedProfile.displayName);
  const uid = await upsertFirebaseAuthUser(seedProfile);

  const userData = withAudit(
    {
      uid,
      name: seedProfile.displayName,
      email: seedProfile.email,
      email_lower: lower(seedProfile.email),
      username,
      username_lower: lower(username),
      city: seedProfile.city || "Riyadh",
      base_currency: seedProfile.baseCurrency || "SAR",
      profile_status: "active",
      seed_version: SEED_VERSION,
      auth_mode: SEED_CREATE_AUTH_USERS ? "firebase_auth" : "seed_only",
      ai_enabled: true,
    },
    dayjs().subtract(90, "day"),
    dayjs().subtract(1, "day")
  );

  return { uid, userData };
}

function categoryNameById(seedProfile, categoryId) {
  const all = [...SYSTEM_CATEGORIES, ...(seedProfile.customCategories || [])];
  return all.find((item) => item.category_id === categoryId)?.name || "Other";
}

function merchantNameById(merchantId) {
  return MERCHANTS[merchantId]?.name || "Unknown Merchant";
}

function buildUserCategories(seedProfile) {
  const result = {};
  const categories = [...SYSTEM_CATEGORIES, ...(seedProfile.customCategories || [])];

  categories.forEach((category, index) => {
    result[category.category_id] = withAudit(
      {
        ...category,
        sort_order: category.sort_order ?? index + 1,
        usage_count: 0,
      },
      dayjs().subtract(120, "day"),
      dayjs().subtract(2, "day")
    );
  });

  return result;
}

function buildUserTags() {
  const result = {};
  SYSTEM_TAGS.forEach((tag) => {
    result[tag.tag_id] = withAudit(tag, dayjs().subtract(120, "day"), dayjs().subtract(2, "day"));
  });
  return result;
}

async function buildAttachmentRecord({
  uid,
  attachment,
  linkedType,
  linkedId,
  folder,
  bucket,
}) {
  const storagePath = `${uid}/${folder}/${attachment.filename}`;

  const uploaded = await uploadSeedFile({
    bucket,
    objectPath: storagePath,
    buffer: attachment.buffer,
    contentType: attachment.contentType,
  });

  return [
    attachment.attachment_id,
    withAudit(
      {
        owner_uid: uid,
        linked_type: linkedType,
        linked_id: linkedId,
        storage: uploaded,
        file: {
          filename: attachment.filename,
          content_type: attachment.contentType,
          size_bytes: attachment.buffer.length,
        },
        processing: {
          ocr_status:
            attachment.contentType.startsWith("image/") ||
            attachment.contentType === "application/pdf"
              ? "ready"
              : "not_applicable",
          quality_status: "good",
        },
      },
      dayjs().subtract(30, "day"),
      dayjs().subtract(1, "day")
    ),
  ];
}

function buildFxSnapshot(seedProfile, bundle) {
  if (!bundle.currency || bundle.currency === seedProfile.baseCurrency) {
    return null;
  }

  return {
    provider: "currencylayer",
    source_currency: bundle.currency,
    target_currency: seedProfile.baseCurrency,
    rate: null,
    converted_amount: null,
    timestamp: null,
    status: "pending_live_conversion",
  };
}

function buildReceiptRecord({ seedProfile, bundle, attachmentIds }) {
  const createdAt = dayjs(bundle.purchaseDate).add(1, "hour");

  return withAudit(
    {
      receipt_id: bundle.receiptId,
      purchase_hub_id: bundle.hubId,
      merchant_id: bundle.merchantId,
      merchant_name: merchantNameById(bundle.merchantId),
      merchant_name_lower: lower(merchantNameById(bundle.merchantId)),
      store_id: bundle.storeId,
      purchase_date: bundle.purchaseDate,
      purchase_month: monthKey(bundle.purchaseDate),
      total_amount: bundle.amount,
      currency_code: bundle.currency,
      fx_snapshot: buildFxSnapshot(seedProfile, bundle),
      receipt_number: bundle.receiptNumber || "",
      category_id: bundle.categoryId,
      category_name_snapshot: categoryNameById(seedProfile, bundle.categoryId),
      category_source: bundle.categoryId.startsWith("cat_custom_") ? "user" : "system",
      tag_ids: bundle.tags || [],
      note: bundle.notes || "",
      return_deadline: bundle.returnDeadline || null,
      attachments: attachmentIds,
      line_items: bundle.itemLines || [],
      ocr: {
        raw_text: `${merchantNameById(bundle.merchantId)}\n${bundle.title}\n${bundle.amount} ${bundle.currency}\n${bundle.purchaseDate}`,
        parsed: {
          merchant_name: merchantNameById(bundle.merchantId),
          purchase_date: bundle.purchaseDate,
          total_amount: bundle.amount,
          currency_code: bundle.currency,
        },
        confidence: {
          merchant_name: 0.98,
          purchase_date: 0.97,
          total_amount: 0.99,
          category: 0.82,
        },
      },
      quality_status: "complete",
    },
    createdAt,
    createdAt
  );
}

function buildWarrantyRecord({ bundle, attachmentIds }) {
  if (!bundle.warranty) return null;

  const createdAt = dayjs(bundle.purchaseDate).add(2, "hour");

  return withAudit(
    {
      warranty_id: bundle.warranty.warrantyId,
      purchase_hub_id: bundle.hubId,
      receipt_id: bundle.receiptId,
      merchant_id: bundle.merchantId,
      product_name: bundle.warranty.productName,
      serial_number: bundle.warranty.serialNumber,
      warranty_start: bundle.warranty.startDate,
      warranty_end: bundle.warranty.endDate,
      terms_note: bundle.warranty.termsNote,
      attachments: attachmentIds,
      reminder_policy: {
        reminder_offsets_days: [30, 7, 1],
      },
      status: dayjs(bundle.warranty.endDate).isAfter(dayjs()) ? "active" : "expired",
      claim_status: bundle.claims?.length ? bundle.claims[0].status : "none",
    },
    createdAt,
    createdAt
  );
}

function buildPurchaseHubRecord({ seedProfile, bundle }) {
  const status = (() => {
    if (bundle.warranty && dayjs(bundle.warranty.endDate).diff(dayjs(), "day") <= 30) {
      return "warranty_ending_soon";
    }
    if (bundle.returnDeadline && dayjs(bundle.returnDeadline).isAfter(dayjs())) {
      return "returnable";
    }
    if (bundle.warranty) {
      return "under_warranty";
    }
    return "active";
  })();

  return withAudit(
    {
      purchase_hub_id: bundle.hubId,
      title: bundle.title,
      merchant_id: bundle.merchantId,
      merchant_name: merchantNameById(bundle.merchantId),
      store_id: bundle.storeId,
      category_id: bundle.categoryId,
      category_name_snapshot: categoryNameById(seedProfile, bundle.categoryId),
      purchase_date: bundle.purchaseDate,
      total_amount: bundle.amount,
      currency_code: bundle.currency,
      fx_snapshot: buildFxSnapshot(seedProfile, bundle),
      receipt_id: bundle.receiptId,
      warranty_id: bundle.warranty?.warrantyId || null,
      serial_number: bundle.warranty?.serialNumber || null,
      status,
      return_deadline: bundle.returnDeadline || null,
      note: bundle.notes || "",
      service_history_count: (bundle.serviceEntries || []).length,
      claim_history_count: (bundle.claims || []).length,
    },
    dayjs(bundle.purchaseDate),
    dayjs(bundle.purchaseDate)
  );
}

function buildRemindersForBundle(bundle) {
  const reminders = [];

  if (
    bundle.returnDeadline &&
    dayjs(bundle.returnDeadline).isAfter(dayjs().subtract(3650, "day"))
  ) {
    reminders.push({
      reminder_id: `reminder_${bundle.hubId}_return`,
      type: "return_deadline",
      target_type: "receipt",
      target_id: bundle.receiptId,
      due_date: bundle.returnDeadline,
      status: dayjs(bundle.returnDeadline).isAfter(dayjs()) ? "active" : "completed",
      lead_days: 3,
    });
  }

  if (bundle.warranty) {
    reminders.push({
      reminder_id: `reminder_${bundle.hubId}_warranty`,
      type: "warranty_expiry",
      target_type: "warranty",
      target_id: bundle.warranty.warrantyId,
      due_date: bundle.warranty.endDate,
      status: dayjs(bundle.warranty.endDate).isAfter(dayjs()) ? "active" : "completed",
      lead_days: 30,
    });
  }

  return reminders.map((item, index) => [
    item.reminder_id,
    withAudit(
      {
        ...item,
        sequence: index + 1,
      },
      dayjs(bundle.purchaseDate).add(1, "day"),
      dayjs(bundle.purchaseDate).add(1, "day")
    ),
  ]);
}

function buildAttentionItems(seedProfile) {
  const items = [];

  for (const bundle of seedProfile.bundles) {
    if (
      bundle.returnDeadline &&
      dayjs(bundle.returnDeadline).isAfter(dayjs()) &&
      dayjs(bundle.returnDeadline).diff(dayjs(), "day") <= 7
    ) {
      items.push({
        attention_id: `attention_${bundle.hubId}_return`,
        type: "return_risk",
        severity: "high",
        title: `${bundle.title} is still returnable`,
        description:
          "The return deadline is close, so review the receipt and decide whether to keep or return it.",
        linked_entity: { type: "receipt", id: bundle.receiptId },
        due_date: bundle.returnDeadline,
        status: "open",
        actions: ["open_receipt", "ask_ai", "export_pack"],
        dismissed_at: null,
        resolved_at: null,
        resolution_type: null,
      });
    }

    if (
      bundle.warranty &&
      dayjs(bundle.warranty.endDate).isAfter(dayjs()) &&
      dayjs(bundle.warranty.endDate).diff(dayjs(), "day") <= 30
    ) {
      items.push({
        attention_id: `attention_${bundle.hubId}_warranty`,
        type: "warranty_expiring",
        severity: "high",
        title: `${bundle.title} warranty is expiring soon`,
        description:
          "Review the item, confirm condition, and prepare any service or claim action before expiry.",
        linked_entity: { type: "warranty", id: bundle.warranty.warrantyId },
        due_date: bundle.warranty.endDate,
        status: "open",
        actions: ["open_warranty", "ask_ai", "generate_claim_pack"],
        dismissed_at: null,
        resolved_at: null,
        resolution_type: null,
      });
    }

    if (!bundle.warranty && bundle.amount >= 1000) {
      items.push({
        attention_id: `attention_${bundle.hubId}_missing_warranty`,
        type: "missing_link",
        severity: "medium",
        title: `${bundle.title} may need a warranty record`,
        description:
          "This is a higher-value purchase and there is no linked warranty yet.",
        linked_entity: { type: "purchase_hub", id: bundle.hubId },
        due_date: null,
        status: "open",
        actions: ["add_warranty", "ask_ai", "review_purchase_hub"],
        dismissed_at: null,
        resolved_at: null,
        resolution_type: null,
      });
    }
  }

  return items;
}

function buildCategoryLearning(seedProfile) {
  const output = {};
  const categorySignals = {};

  for (const bundle of seedProfile.bundles) {
    if (!categorySignals[bundle.categoryId]) {
      categorySignals[bundle.categoryId] = {
        usage_count: 0,
        merchants: {},
        keywords: {},
        last_used_at: dayjs(bundle.purchaseDate).toISOString(),
      };
    }

    categorySignals[bundle.categoryId].usage_count += 1;
    categorySignals[bundle.categoryId].merchants[bundle.merchantId] =
      (categorySignals[bundle.categoryId].merchants[bundle.merchantId] || 0) + 1;

    bundle.itemLines.forEach((item) => {
      String(item.name || "")
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean)
        .forEach((word) => {
          const safe = firebaseKey(word);
          categorySignals[bundle.categoryId].keywords[safe] =
            (categorySignals[bundle.categoryId].keywords[safe] || 0) + 1;
        });
    });
  }

  Object.entries(categorySignals).forEach(([categoryId, value]) => {
    output[categoryId] = withAudit(value, dayjs().subtract(14, "day"), dayjs().subtract(1, "day"));
  });

  return output;
}

function buildUserProfile(seedProfile) {
  const totalsByCategory = {};
  const totalsByMerchant = {};
  let totalSpend = 0;
  let activeWarranties = 0;

  for (const bundle of seedProfile.bundles) {
    totalSpend += bundle.amount;
    totalsByCategory[bundle.categoryId] =
      (totalsByCategory[bundle.categoryId] || 0) + bundle.amount;
    totalsByMerchant[bundle.merchantId] =
      (totalsByMerchant[bundle.merchantId] || 0) + bundle.amount;

    if (bundle.warranty && dayjs(bundle.warranty.endDate).isAfter(dayjs())) {
      activeWarranties += 1;
    }
  }

  const topCategoryId =
    Object.entries(totalsByCategory).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  const topMerchantId =
    Object.entries(totalsByMerchant).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  return withAudit(
    {
      total_spend_lifetime: Number(totalSpend.toFixed(2)),
      top_category_id: topCategoryId,
      top_category_name: categoryNameById(seedProfile, topCategoryId),
      top_merchant_id: topMerchantId,
      top_merchant_name: merchantNameById(topMerchantId),
      active_warranty_count: activeWarranties,
      favorite_store_ids: seedProfile.favorites || [],
      preferred_city: seedProfile.city,
    },
    dayjs().subtract(2, "day"),
    dayjs().subtract(2, "day")
  );
}

function buildRecommendedStores(seedProfile) {
  const picks = [];

  for (const [storeId, store] of Object.entries(STORES)) {
    let score = 0;

    if ((seedProfile.favorites || []).includes(storeId)) score += 5;

    for (const bundle of seedProfile.bundles) {
      const categoryName = lower(categoryNameById(seedProfile, bundle.categoryId));
      if (
        store.categories.some(
          (category) =>
            categoryName.includes(category) ||
            category.includes(categoryName.split(" ")[0])
        )
      ) {
        score += 2;
      }
    }

    if (store.city === seedProfile.city || store.city === "Online") score += 1;
    if (store.verified) score += 2;
    score += Math.round(store.avg_rating);

    picks.push({
      store_id: storeId,
      name: store.name,
      score,
      reason: (seedProfile.favorites || []).includes(storeId)
        ? "Already in your saved stores"
        : "Strong match for your shopping activity and review quality",
      avg_rating: store.avg_rating,
      review_count: store.review_count,
      categories: store.categories,
    });
  }

  return picks.sort((a, b) => b.score - a.score).slice(0, 4);
}

function buildHomeCache(seedProfile) {
  const totalThisMonth = seedProfile.bundles
    .filter((bundle) => monthKey(bundle.purchaseDate) === monthKey(dayjs()))
    .reduce((sum, bundle) => sum + bundle.amount, 0);

  const profile = buildUserProfile(seedProfile);
  const attentionItems = buildAttentionItems(seedProfile);

  return withAudit(
    {
      month_key: monthKey(dayjs()),
      summary: {
        total_spend_this_month: Number(totalThisMonth.toFixed(2)),
        total_purchases: seedProfile.bundles.length,
        top_category_name: profile.top_category_name,
        top_merchant_name: profile.top_merchant_name,
        active_warranty_count: profile.active_warranty_count,
        open_attention_count: attentionItems.length,
      },
      recommended_stores: buildRecommendedStores(seedProfile),
      quick_actions: [
        "add_receipt",
        "add_warranty",
        "ask_ai",
        "review_attention",
        "search_vault",
      ],
      generated_at: dayjs().toISOString(),
      version: 1,
    },
    dayjs().subtract(1, "day"),
    dayjs().subtract(1, "day")
  );
}

function buildReportSummary(seedProfile) {
  const currentMonth = monthKey(dayjs());
  const byCategory = {};
  const byMerchant = {};
  let total = 0;
  let expiringWarrantyCount = 0;

  for (const bundle of seedProfile.bundles) {
    if (monthKey(bundle.purchaseDate) === currentMonth) {
      byCategory[bundle.categoryId] = (byCategory[bundle.categoryId] || 0) + bundle.amount;
      byMerchant[bundle.merchantId] = (byMerchant[bundle.merchantId] || 0) + bundle.amount;
      total += bundle.amount;
    }

    if (
      bundle.warranty &&
      dayjs(bundle.warranty.endDate).isAfter(dayjs()) &&
      dayjs(bundle.warranty.endDate).diff(dayjs(), "day") <= 30
    ) {
      expiringWarrantyCount += 1;
    }
  }

  const topCategoryId =
    Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  return withAudit(
    {
      month_key: currentMonth,
      total_spend: Number(total.toFixed(2)),
      by_category: byCategory,
      by_merchant: byMerchant,
      protected_value: seedProfile.bundles
        .filter((bundle) => !!bundle.warranty)
        .reduce((sum, bundle) => sum + bundle.amount, 0),
      recovered_value: 0,
      expiring_warranty_count: expiringWarrantyCount,
      generated_by: "seed",
      executive_summary:
        total > 0
          ? `This month is led by ${categoryNameById(seedProfile, topCategoryId)}, with active follow-up opportunities in your vault.`
          : "No current-month spend was seeded for this profile.",
    },
    dayjs().subtract(1, "day"),
    dayjs().subtract(1, "day")
  );
}

function buildAiSeed(seedProfile) {
  const topBundle = seedProfile.bundles[0];
  const conversationId = `conv_${seedProfile.key}_home_1`;

  const conversation = withAudit(
    {
      conversation_id: conversationId,
      title: "Organize my recent purchases",
      status: "active",
      screen_context: "home",
      linked_entity: {
        type: "purchase_hub",
        id: topBundle.hubId,
      },
      rolling_summary:
        "The user asked for help organizing recent purchases, reviewing warranty exposure, and improving store recommendations.",
      last_message_preview:
        "I found your highest-priority next steps and recommended stores based on your activity.",
    },
    dayjs().subtract(2, "day"),
    dayjs().subtract(2, "day")
  );

  const messages = {
    msg_1: withAudit(
      {
        message_id: "msg_1",
        role: "user",
        text: "Help me organize my recent purchases and tell me what needs attention first.",
        attachments: [],
        message_status: "complete",
      },
      dayjs().subtract(2, "day"),
      dayjs().subtract(2, "day")
    ),
    msg_2: withAudit(
      {
        message_id: "msg_2",
        role: "assistant",
        text:
          "I reviewed your recent activity and found a few important next steps. One item has a near-term deadline, one higher-value purchase may need a warranty record, and your strongest store matches are based on your recent category activity and saved stores.",
        message_status: "complete",
        tool_usage: {
          internal_context: true,
          web_search: false,
          file_analysis: false,
        },
        structured: {
          reply:
            "I reviewed your recent activity and found the most important next steps for you.",
          sections: [
            {
              title: "Needs attention",
              items: [
                "Review items with a near return deadline first",
                "Check higher-value purchases that still have no warranty linked",
                "Keep your saved stores aligned with your active categories",
              ],
            },
          ],
          cards: [
            {
              kind: "purchase",
              ref_id: topBundle.hubId,
              title: topBundle.title,
              subtitle: `${topBundle.amount} ${topBundle.currency}`,
              description: "This purchase is a strong candidate for follow-up.",
              badge: "Priority",
              cta_label: "Open purchase",
            },
          ],
          suggestions: [
            "Show my most important warranties",
            "Recommend better stores for my activity",
            "Create a new custom category for me",
          ],
        },
      },
      dayjs().subtract(2, "day").add(1, "minute"),
      dayjs().subtract(2, "day").add(1, "minute")
    ),
  };

  const actionProposal = withAudit(
    {
      proposal_id: `proposal_${seedProfile.key}_1`,
      conversation_id: conversationId,
      status: "pending",
      type: "review_and_link",
      title: "Review missing warranty and deadline-sensitive purchases",
      reason:
        "The assistant identified purchases that would benefit from stronger organization or a linked warranty record.",
      confidence: "high",
      actions: [
        {
          type: "open_purchase_hub",
          target_id: topBundle.hubId,
        },
        {
          type: "open_attention_center",
        },
      ],
    },
    dayjs().subtract(2, "day").add(2, "minute"),
    dayjs().subtract(2, "day").add(2, "minute")
  );

  return {
    conversationId,
    conversation,
    messages,
    actionProposal,
  };
}

function buildAiContextCache(seedProfile) {
  const profile = buildUserProfile(seedProfile);
  const attentionItems = buildAttentionItems(seedProfile);

  return withAudit(
    {
      preferred_city: seedProfile.city,
      favorite_store_ids: seedProfile.favorites || [],
      top_category_name: profile.top_category_name,
      top_merchant_name: profile.top_merchant_name,
      unresolved_attention_ids: attentionItems.map((item) => item.attention_id),
      active_warranty_count: profile.active_warranty_count,
      generated_at: dayjs().toISOString(),
    },
    dayjs().subtract(1, "day"),
    dayjs().subtract(1, "day")
  );
}

async function buildExportRecord({ uid, bundle, exportFile }) {
  const buffer = b64ToBuffer(SAMPLE_PDF_BASE64);
  const uploaded = await uploadSeedFile({
    bucket: SUPABASE_BUCKET_EXPORTS,
    objectPath: `${uid}/exports/${exportFile.filename}`,
    buffer,
    contentType: "application/pdf",
  });

  return [
    exportFile.exportId,
    withAudit(
      {
        export_id: exportFile.exportId,
        purchase_hub_id: bundle.hubId,
        kind: exportFile.kind,
        status: "ready",
        storage: uploaded,
        file: {
          filename: exportFile.filename,
          content_type: "application/pdf",
          size_bytes: buffer.length,
        },
        generated_at: dayjs().toISOString(),
        requested_by: uid,
        expires_at: null,
      },
      dayjs().subtract(2, "day"),
      dayjs().subtract(1, "day")
    ),
  ];
}

async function seedGlobalData() {
  const updates = {};

  setUpdate(
    updates,
    "app_config",
    withAudit(
      {
        app_name: "VaultHive",
        seed_version: SEED_VERSION,
        architecture: {
          auth_provider: "firebase_auth",
          data_provider: "firebase_rtdb",
          storage_provider: "supabase_storage",
          ai_orchestration: "supabase_edge_functions",
          currency_provider: "currencylayer",
        },
        design: {
          theme_name: "cream_gold_brown_premium",
          brand_tokens_ref: "design_tokens/default",
        },
      },
      dayjs().subtract(150, "day"),
      dayjs().subtract(1, "day")
    )
  );

  setUpdate(updates, "feature_flags", withAudit(FEATURE_FLAGS, dayjs().subtract(150, "day"), dayjs().subtract(1, "day")));
  setUpdate(updates, "design_tokens/default", withAudit(BRAND_TOKENS, dayjs().subtract(150, "day"), dayjs().subtract(1, "day")));

  const systemCategoryMap = {};
  SYSTEM_CATEGORIES.forEach((category) => {
    systemCategoryMap[category.category_id] = withAudit(category, dayjs().subtract(150, "day"), dayjs().subtract(1, "day"));
  });
  setUpdate(updates, "system_categories/purchases", systemCategoryMap);

  const systemTagMap = {};
  SYSTEM_TAGS.forEach((tag) => {
    systemTagMap[tag.tag_id] = withAudit(tag, dayjs().subtract(150, "day"), dayjs().subtract(1, "day"));
  });
  setUpdate(updates, "system_tags", systemTagMap);

  const merchantMap = {};
  const merchantAliasMap = {};

  Object.entries(MERCHANTS).forEach(([merchantId, merchant]) => {
    merchantMap[merchantId] = withAudit(
      {
        merchant_id: merchantId,
        name: merchant.name,
        name_lower: lower(merchant.name),
        city: merchant.city,
        categories: merchant.categories,
      },
      dayjs().subtract(150, "day"),
      dayjs().subtract(1, "day")
    );

    merchant.aliases.forEach((alias) => {
      merchantAliasMap[firebaseKey(alias)] = merchantId;
    });
  });

  setUpdate(updates, "merchants", merchantMap);
  setUpdate(updates, "merchant_aliases", merchantAliasMap);

  const storeMap = {};
  const storeStatsMap = {};
  const storesByCity = {};
  const storesByCategory = {};

  Object.entries(STORES).forEach(([storeId, store]) => {
    storeMap[storeId] = withAudit(
      {
        store_id: storeId,
        name: store.name,
        name_lower: lower(store.name),
        url: store.url,
        city: store.city,
        verified: !!store.verified,
        categories: store.categories,
      },
      dayjs().subtract(150, "day"),
      dayjs().subtract(1, "day")
    );

    storeStatsMap[storeId] = withAudit(
      {
        avg_rating: store.avg_rating,
        review_count: store.review_count,
        review_summary: store.review_summary,
        review_themes: store.review_themes,
      },
      dayjs().subtract(150, "day"),
      dayjs().subtract(1, "day")
    );

    const cityKey = firebaseKey(store.city || "unknown");
    storesByCity[cityKey] = storesByCity[cityKey] || {};
    storesByCity[cityKey][storeId] = true;

    (store.categories || []).forEach((category) => {
      const categoryKey = firebaseKey(category);
      storesByCategory[categoryKey] = storesByCategory[categoryKey] || {};
      storesByCategory[categoryKey][storeId] = true;
    });
  });

  setUpdate(updates, "stores", storeMap);
  setUpdate(updates, "store_review_stats", storeStatsMap);
  setUpdate(updates, "stores_by_city", storesByCity);
  setUpdate(updates, "stores_by_category", storesByCategory);

  await db.ref().update(updates);
}

async function seedSingleUser(seedProfile) {
  const updates = {};
  const { uid, userData } = await ensureUserRecord(seedProfile);

  setUpdate(updates, `users/${uid}`, userData);

  setUpdate(
    updates,
    `user_settings/${uid}`,
    withAudit(
      {
        theme: "light",
        language: "en",
        base_currency: seedProfile.baseCurrency || "SAR",
        push_enabled: true,
        weekly_summary_enabled: true,
        attention_center_enabled: true,
        ai_enabled: true,
        ai_web_search_enabled: true,
        design_theme: "cream_gold_brown_premium",
      },
      dayjs().subtract(90, "day"),
      dayjs().subtract(1, "day")
    )
  );

  setUpdate(updates, `user_categories/${uid}/purchases`, buildUserCategories(seedProfile));
  setUpdate(updates, `user_tags/${uid}`, buildUserTags());

  for (const favoriteStoreId of seedProfile.favorites || []) {
    setUpdate(
      updates,
      `user_favorites/${uid}/stores/${favoriteStoreId}`,
      withAudit(
        {
          store_id: favoriteStoreId,
          saved: true,
        },
        dayjs().subtract(20, "day"),
        dayjs().subtract(20, "day")
      )
    );
  }

  for (const review of seedProfile.storeReviews || []) {
    setUpdate(
      updates,
      `store_reviews/${review.storeId}/${review.reviewId}`,
      withAudit(
        {
          review_id: review.reviewId,
          uid,
          rating: review.rating,
          comment: review.comment,
          source: "first_party",
        },
        dayjs().subtract(12, "day"),
        dayjs().subtract(12, "day")
      )
    );
  }

  for (const bundle of seedProfile.bundles) {
    const receiptAttachmentIds = [];
    const warrantyAttachmentIds = [];

    if (bundle.receiptAttachment) {
      const [attachmentId, attachmentData] = await buildAttachmentRecord({
        uid,
        attachment: bundle.receiptAttachment,
        linkedType: "receipt",
        linkedId: bundle.receiptId,
        folder: "receipts",
        bucket: SUPABASE_BUCKET_ATTACHMENTS,
      });

      receiptAttachmentIds.push(attachmentId);
      setUpdate(updates, `attachments/${uid}/${attachmentId}`, attachmentData);
    }

    if (bundle.warranty?.attachment) {
      const [attachmentId, attachmentData] = await buildAttachmentRecord({
        uid,
        attachment: bundle.warranty.attachment,
        linkedType: "warranty",
        linkedId: bundle.warranty.warrantyId,
        folder: "warranties",
        bucket: SUPABASE_BUCKET_ATTACHMENTS,
      });

      warrantyAttachmentIds.push(attachmentId);
      setUpdate(updates, `attachments/${uid}/${attachmentId}`, attachmentData);
    }

    setUpdate(
      updates,
      `purchase_hubs/${uid}/${bundle.hubId}`,
      buildPurchaseHubRecord({
        seedProfile,
        bundle,
      })
    );

    setUpdate(
      updates,
      `receipts/${uid}/${bundle.receiptId}`,
      buildReceiptRecord({
        seedProfile,
        bundle,
        attachmentIds: receiptAttachmentIds,
      })
    );

    if (bundle.warranty) {
      setUpdate(
        updates,
        `warranties/${uid}/${bundle.warranty.warrantyId}`,
        buildWarrantyRecord({
          bundle,
          attachmentIds: warrantyAttachmentIds,
        })
      );
    }

    buildRemindersForBundle(bundle).forEach(([reminderId, reminderData]) => {
      setUpdate(updates, `reminders/${uid}/${reminderId}`, reminderData);
    });

    (bundle.serviceEntries || []).forEach((entry) => {
      setUpdate(
        updates,
        `service_history/${uid}/${entry.entryId}`,
        withAudit(
          {
            service_id: entry.entryId,
            purchase_hub_id: bundle.hubId,
            receipt_id: bundle.receiptId,
            warranty_id: bundle.warranty?.warrantyId || null,
            type: entry.type,
            title: entry.title,
            service_date: entry.serviceDate,
            note: entry.note,
          },
          dayjs(entry.serviceDate),
          dayjs(entry.serviceDate)
        )
      );
    });

    (bundle.claims || []).forEach((claim) => {
      setUpdate(
        updates,
        `claims/${uid}/${claim.claimId}`,
        withAudit(
          {
            claim_id: claim.claimId,
            purchase_hub_id: bundle.hubId,
            warranty_id: bundle.warranty?.warrantyId || null,
            kind: claim.kind,
            status: claim.status,
            created_date: claim.createdDate,
            note: claim.note,
          },
          dayjs(claim.createdDate),
          dayjs(claim.createdDate)
        )
      );
    });

    for (const exportFile of bundle.exportFiles || []) {
      const [exportId, exportData] = await buildExportRecord({
        uid,
        bundle,
        exportFile,
      });
      setUpdate(updates, `generated_exports/${uid}/${exportId}`, exportData);
    }
  }

  const attentionItems = buildAttentionItems(seedProfile);
  attentionItems.forEach((item, index) => {
    setUpdate(
      updates,
      `attention_items/${uid}/${item.attention_id}`,
      withAudit(
        {
          ...item,
          sort_order: index + 1,
        },
        dayjs().subtract(1, "day"),
        dayjs().subtract(1, "day")
      )
    );
  });

  setUpdate(updates, `category_learning/${uid}`, buildCategoryLearning(seedProfile));
  setUpdate(updates, `user_profiles/${uid}/shopping_model`, buildUserProfile(seedProfile));
  setUpdate(updates, `home_cache/${uid}`, buildHomeCache(seedProfile));
  setUpdate(updates, `report_summaries/${uid}/${monthKey(dayjs())}`, buildReportSummary(seedProfile));
  setUpdate(updates, `ai_context_cache/${uid}`, buildAiContextCache(seedProfile));

  const aiSeed = buildAiSeed(seedProfile);
  setUpdate(updates, `ai_conversations/${uid}/${aiSeed.conversationId}`, aiSeed.conversation);

  Object.entries(aiSeed.messages).forEach(([messageId, messageData]) => {
    setUpdate(updates, `ai_messages/${uid}/${aiSeed.conversationId}/${messageId}`, messageData);
  });

  setUpdate(
    updates,
    `ai_action_proposals/${uid}/${aiSeed.conversationId}/${aiSeed.actionProposal.proposal_id}`,
    aiSeed.actionProposal
  );

  setUpdate(
    updates,
    `activity_events/${uid}/event_seed_open_home`,
    withAudit(
      {
        type: "screen_view",
        screen: "home",
        source: "seed",
      },
      dayjs().subtract(1, "day"),
      dayjs().subtract(1, "day")
    )
  );

  setUpdate(
    updates,
    `activity_events/${uid}/event_seed_use_ai`,
    withAudit(
      {
        type: "ai_message",
        screen: "ai_assistant",
        source: "seed",
      },
      dayjs().subtract(1, "day"),
      dayjs().subtract(1, "day")
    )
  );

  await db.ref().update(updates);

  return {
    uid,
    email: seedProfile.email,
    name: seedProfile.displayName,
  };
}

async function markSeedRun(userSummaries) {
  await db.ref(`seed_runs/${SEED_VERSION}`).set(
    withAudit(
      {
        version: SEED_VERSION,
        users: userSummaries,
        used_auth_users: SEED_CREATE_AUTH_USERS,
        used_supabase: true,
        currencies_seeded: false,
      },
      new Date(),
      new Date()
    )
  );
}

async function runSeed() {
  console.log(`Starting ${SEED_VERSION}...`);
  console.log(`Firebase Auth user creation: ${SEED_CREATE_AUTH_USERS ? "ON" : "OFF"}`);
  console.log("Supabase configured: YES");

  await seedGlobalData();

  const userSummaries = [];
  for (const seedProfile of DEMO_USERS) {
    const result = await seedSingleUser(seedProfile);
    userSummaries.push(result);
  }

  await markSeedRun(userSummaries);

  console.log("Seed completed successfully.");
  console.table(
    userSummaries.map((user) => ({
      name: user.name,
      email: user.email,
      uid: user.uid,
    }))
  );
}

runSeed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  });