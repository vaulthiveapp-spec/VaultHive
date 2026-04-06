

import * as ImageManipulator from "expo-image-manipulator";
import { supabase, isSupabaseConfigured } from "../config/supabase";
import { getDb } from "../db/db";

// ─── Constants ────────────────────────────────────────────────────────────────

const RESIZE_WIDTH = 1600;
const COMPRESS     = 0.8;
const CONF_HIGH   = "high";
const CONF_MEDIUM = "medium";
const CONF_LOW    = "low";

const CATEGORY_KEYWORDS = {
  1:  ["grocery","groceries","supermarket","tamimi","panda","lulu","carrefour","danube","hypermarket","بقالة","سوبرماركت","مخبز","bakery","produce"],
  2:  ["electronic","laptop","phone","mobile","tablet","computer","camera","samsung","apple","jarir","extra","iphone","ipad","airpods","printer","device","tech","gadget"],
  3:  ["fashion","cloth","apparel","shoes","zara","h&m","nike","adidas","gucci","dress","shirt","pants","مودة","ملابس","أحذية"],
  4:  ["pharmacy","drug","medicine","health","clinic","hospital","vitamin","صيدلية","دواء"],
  5:  ["home","furniture","decor","ikea","kitchen","bed","sofa","curtain","مفروشات","ديكور"],
  6:  ["subscription","netflix","spotify","amazon prime","icloud","google","مشترك"],
  7:  ["shopping","mall","store","retail","متجر"],
};

// Currency symbols / codes that appear in OCR text
const CURRENCY_PATTERNS = [
  { code: "SAR", patterns: [/ريال/,/ر\.س/,/sar/i,/sr\b/i] },
  { code: "AED", patterns: [/درهم/,/aed/i,/dhs?\b/i] },
  { code: "USD", patterns: [/\$/,/usd/i,/dollar/i] },
  { code: "EUR", patterns: [/€/,/eur/i] },
  { code: "GBP", patterns: [/£/,/gbp/i] },
  { code: "KWD", patterns: [/kwd/i,/دينار كويتي/] },
  { code: "QAR", patterns: [/qar/i,/ريال قطري/] },
  { code: "BHD", patterns: [/bhd/i,/دينار بحريني/] },
  { code: "OMR", patterns: [/omr/i,/ريال عماني/] },
];

// ─── Text normalisation (shared) ─────────────────────────────────────────────

const ARABIC_DIGITS = {
  "٠":"0","١":"1","٢":"2","٣":"3","٤":"4",
  "٥":"5","٦":"6","٧":"7","٨":"8","٩":"9",
  "۰":"0","۱":"1","۲":"2","۳":"3","۴":"4",
  "۵":"5","۶":"6","۷":"7","۸":"8","۹":"9",
};

function normalizeDigits(s) {
  return String(s || "").replace(/[٠-٩۰-۹]/g, (d) => ARABIC_DIGITS[d] || d);
}

export function normalizeOcrText(raw) {
  return normalizeDigits(String(raw || ""))
    .replace(/[\u200E\u200F\u00AD]/g, "")
    .replace(/[|]/g, "I")
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .replace(/[،٬]/g, ",")
    .replace(/[•·]/g, "-")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .split("\n").map((l) => l.trim()).join("\n")
    .trim();
}

// ─── Image preparation ────────────────────────────────────────────────────────

async function prepareImage(uri) {
  const processed = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: RESIZE_WIDTH } }],
    { compress: COMPRESS, format: ImageManipulator.SaveFormat.JPEG, base64: true }
  );
  if (!processed?.base64) throw new Error("Image preprocessing failed");
  return {
    imageDataUrl: `data:image/jpeg;base64,${processed.base64}`,
    processedUri: processed.uri || uri,
  };
}

// ─── Transport ────────────────────────────────────────────────────────────────

async function invokeOcrFunction(body) {
  const { data, error } = await supabase.functions.invoke("vaulthive-ocr", { body });
  if (error) throw new Error(error.message || "OCR function error");
  return data;
}

// ─── Date parsing (shared by receipt + warranty) ──────────────────────────────

function toIsoDate(raw) {
  const s = normalizeDigits(String(raw || "")).replace(/\./g, "/");
  const m = s.match(/(\d{1,4})[\/\-](\d{1,2})[\/\-](\d{1,4})/);
  if (!m) return null;
  let a = Number(m[1]), b = Number(m[2]), c = Number(m[3]);
  if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(c)) return null;
  let year, month, day;
  if (String(m[1]).length === 4) { year = a; month = b; day = c; }
  else if (String(m[3]).length === 4) { year = c; month = b; day = a; }
  else { year = c < 70 ? 2000 + c : 1900 + c; month = b; day = a; }
  if (year < 2000 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
}

// ─── Receipt field extractors ─────────────────────────────────────────────────

const VENDOR_BLACKLIST = /(receipt|invoice|tax|vat|total|subtotal|cash|card|change|date|time|qty|amount|merchant copy|customer copy|terminal|trx|transaction|phone|tel|mobile|www\.|http|iban|branch|store no|pos|ref no|auth)/i;

function extractVendor(lines) {
  for (const line of lines.slice(0, 8)) {
    if (!line || line.length < 3) continue;
    if (VENDOR_BLACKLIST.test(line)) continue;
    if ((line.match(/\d/g) || []).length > Math.max(4, Math.floor(line.length / 2))) continue;
    if (!/[A-Za-z\u0600-\u06FF]/.test(line)) continue;
    return { value: line.slice(0, 80), confidence: CONF_MEDIUM };
  }
  const fallback = lines.find(Boolean);
  return fallback ? { value: fallback.slice(0, 80), confidence: CONF_LOW } : null;
}

function extractDate(text) {
  const matches = text.match(/\b\d{1,4}[\/\-]\d{1,2}[\/\-]\d{1,4}\b/g) || [];
  for (const m of matches) {
    const iso = toIsoDate(m);
    if (iso) return { value: iso, confidence: CONF_HIGH };
  }
  return null;
}

function extractAmount(lines, text) {
  const TOTAL_RX = /(grand\s*total|total\s*due|total|amount\s*due|net\s*amount|balance\s*due|المجموع|الاجمالي|إجمالي|المبلغ\s*الإجمالي|المستحق)/i;

  for (const line of lines) {
    if (!TOTAL_RX.test(line)) continue;
    const clean = normalizeDigits(line)
      .replace(/(sar|aed|usd|ريال|ر\.س|رس|vat|tax)/gi, " ")
      .replace(/[^\d.,-]/g, " ").trim();
    const nums = (clean.match(/-?\d[\d,]*(?:\.\d{1,2})?/g) || [])
      .map((x) => Number(x.replace(/,/g, "")))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (nums.length) return { value: Number(nums[nums.length - 1].toFixed(2)), confidence: CONF_HIGH };
  }

  // Fallback: largest plausible number in text
  const all = (text.match(/\d[\d,]*(?:\.\d{1,2})?/g) || [])
    .map((x) => Number(x.replace(/,/g, "")))
    .filter((n) => Number.isFinite(n) && n >= 0.5 && n <= 1_000_000);
  if (!all.length) return null;
  return { value: Number(Math.max(...all).toFixed(2)), confidence: CONF_LOW };
}

function extractCurrency(text) {
  const lower = text.toLowerCase();
  for (const { code, patterns } of CURRENCY_PATTERNS) {
    if (patterns.some((p) => p.test(lower))) {
      return { value: code, confidence: CONF_MEDIUM };
    }
  }
  return { value: "SAR", confidence: CONF_LOW }; // GCC default
}

// ─── Warranty field extractors ────────────────────────────────────────────────

const PRODUCT_BLACKLIST = /(warranty|invoice|receipt|tax|vat|terms|conditions|purchase date|start date|end date|expiry|expires|serial|s\/n|imei)/i;

function extractProduct(lines) {
  for (const line of lines.slice(0, 16)) {
    if (!line || line.length < 4) continue;
    if (PRODUCT_BLACKLIST.test(line)) continue;
    if (!/[A-Za-z\u0600-\u06FF]/.test(line)) continue;
    if ((line.match(/\d/g) || []).length > Math.max(6, Math.floor(line.length / 2))) continue;
    return { value: line.slice(0, 90), confidence: CONF_MEDIUM };
  }
  return null;
}

function extractSerial(text) {
  const m = text.match(/(?:serial(?:\s*number)?|s\/n|sn|imei)\s*[:#-]?\s*([A-Z0-9\-]{6,})/i);
  return m ? { value: m[1], confidence: CONF_HIGH } : null;
}

function extractWarrantyDates(lines, text) {
  const allDates = [];
  for (const line of lines) {
    for (const raw of (line.match(/\b\d{1,4}[\/\-]\d{1,2}[\/\-]\d{1,4}\b/g) || [])) {
      const iso = toIsoDate(raw);
      if (!iso) continue;
      const t = new Date(`${iso}T00:00:00`).getTime();
      if (!Number.isNaN(t)) allDates.push({ iso, t, line });
    }
  }
  allDates.sort((a, b) => a.t - b.t);

  const START_RX = /(start|purchase|issue|invoice|from|effective|تاريخ الشراء|بداية)/i;
  const END_RX   = /(end|expiry|expire|valid until|until|to|coverage end|انتهاء|تنتهي|صالح حتى)/i;

  const startMatch = allDates.find((d) => START_RX.test(d.line));
  const endMatch   = allDates.find((d) => END_RX.test(d.line));

  const startVal = startMatch?.iso || allDates[0]?.iso || null;
  const endVal   = endMatch?.iso   || (allDates.length > 1 ? allDates[allDates.length - 1]?.iso : null);

  return {
    warranty_start: startVal ? { value: startVal, confidence: startMatch ? CONF_HIGH : CONF_MEDIUM } : null,
    warranty_end:   endVal   ? { value: endVal,   confidence: endMatch   ? CONF_HIGH : CONF_LOW    } : null,
  };
}

// ─── Merchant normalisation ───────────────────────────────────────────────────

/**
 * Attempt to resolve a raw vendor string to a canonical merchant.
 * 1. Exact name match in merchants table
 * 2. Alias table lookup
 * 3. Prefix/substring fuzzy match (top hit by name_lower LIKE)
 *
 * Returns { merchant_id, name, verified, categories_json } or null.
 */
async function normalizeMerchant(rawName) {
  if (!rawName) return null;
  try {
    const db    = await getDb();
    const lower = String(rawName).toLowerCase().trim();

    // 1. Exact match
    const exact = await db.getFirstAsync(
      `SELECT * FROM merchants WHERE name_lower=?`, [lower]
    );
    if (exact) return exact;

    // 2. Alias table
    const alias = await db.getFirstAsync(
      `SELECT m.* FROM merchants m
       INNER JOIN merchant_aliases a ON a.merchant_id=m.merchant_id
       WHERE a.alias_lower=?`, [lower]
    );
    if (alias) return alias;

    // 3. Fuzzy prefix (first word of vendor name)
    const firstWord = lower.split(/\s+/)[0];
    if (firstWord && firstWord.length >= 3) {
      const fuzzy = await db.getFirstAsync(
        `SELECT * FROM merchants WHERE name_lower LIKE ? ORDER BY verified DESC, name_lower ASC LIMIT 1`,
        [`${firstWord}%`]
      );
      if (fuzzy) return fuzzy;
    }

    return null;
  } catch {
    return null;
  }
}

// ─── Category suggestion ──────────────────────────────────────────────────────

/**
 * Suggest a category_id for a receipt using four signal sources, each
 * weighed in priority order:
 *
 *  Priority 1 – Merchant history
 *    The most frequent category_id this user has used with this vendor_name_lower.
 *    Strong signal: the user taught us their preference explicitly.
 *
 *  Priority 2 – Merchant categories_json
 *    If the merchant row has a categories_json field, pick the first category
 *    whose key can be mapped to a user_category id.
 *
 *  Priority 3 – Keyword rules
 *    Scan the raw OCR text + vendor name against CATEGORY_KEYWORDS.
 *    Score each category by number of matching keywords.
 *
 *  Priority 4 – Default fallback
 *    category_id 7 = "shopping" (always present in category_defaults seed).
 *
 * Returns { category_id, confidence, reason }
 */
async function suggestCategory(userUid, vendorNameRaw, ocrText, merchantRow, userCategories) {
  const lower = String(vendorNameRaw || "").toLowerCase();
  const fullText = `${lower} ${String(ocrText || "").toLowerCase()}`;

  try {
    const db = await getDb();

    // P1 — user receipt history for this vendor
    if (lower.length >= 2) {
      const hist = await db.getFirstAsync(
        `SELECT category_id, COUNT(*) AS cnt
         FROM receipts
         WHERE user_uid=? AND vendor_name_lower LIKE ? AND is_deleted=0 AND category_id IS NOT NULL
         GROUP BY category_id ORDER BY cnt DESC LIMIT 1`,
        [String(userUid), `%${lower.slice(0, 20)}%`]
      );
      if (hist?.category_id) {
        return { category_id: Number(hist.category_id), confidence: CONF_HIGH, reason: "merchant_history" };
      }
    }

    // P2 — merchant categories_json field
    if (merchantRow?.categories_json) {
      try {
        const cats = JSON.parse(merchantRow.categories_json);
        const catKeys = Object.keys(cats || {});
        // Map merchant category keys to user category names (simple substring match)
        if (catKeys.length && Array.isArray(userCategories)) {
          for (const uc of userCategories) {
            const ucLower = String(uc.name || "").toLowerCase();
            if (catKeys.some((k) => ucLower.includes(k.toLowerCase()) || k.toLowerCase().includes(ucLower))) {
              return { category_id: Number(uc.category_id), confidence: CONF_MEDIUM, reason: "merchant_categories" };
            }
          }
        }
      } catch {}
    }

    // P3 — keyword scoring across all categories
    let bestId = null, bestScore = 0;
    for (const [catIdStr, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      const score = keywords.filter((kw) => fullText.includes(kw)).length;
      if (score > bestScore) { bestScore = score; bestId = Number(catIdStr); }
    }
    if (bestId && bestScore > 0) {
      return { category_id: bestId, confidence: bestScore >= 2 ? CONF_MEDIUM : CONF_LOW, reason: "keyword_match" };
    }
  } catch {}

  // P4 — safe default
  return { category_id: 7, confidence: CONF_LOW, reason: "default" };
}

// ─── Pipeline status helpers ──────────────────────────────────────────────────

function makeResult(overrides) {
  return {
    status:      "failed",
    raw_text:    "",
    parsed:      null,
    suggestions: null,
    merchant:    null,
    error:       null,
    provider:    "none",
    retryable:   false,
    ...overrides,
  };
}

// ─── Main pipeline ────────────────────────────────────────────────────────────

/**
 * @param {{ uri?, fileUrl?, mimeType?, filename? } | string} input
 * @param {{ mode?: 'receipt'|'warranty', userUid?: string, userCategories?: object[] }} options
 * @returns {Promise<OcrPipelineResult>}
 */
export async function runOcrPipeline(input, options = {}) {
  const { mode = "receipt", userUid = null, userCategories = [] } = options;

  if (!isSupabaseConfigured() || !supabase) {
    return makeResult({ status: "not_configured", error: "Supabase is not configured. OCR is unavailable.", retryable: false });
  }

  // ── Normalise input ────────────────────────────────────────────────────────
  let uri = null, fileUrl = null, mimeType = null, filename = null;
  if (typeof input === "string") {
    uri = input;
  } else if (input && typeof input === "object") {
    uri      = input.uri      || null;
    fileUrl  = input.fileUrl  || null;
    mimeType = input.mimeType || null;
    filename = input.filename || null;
  }

  const effectiveSource = uri || fileUrl;
  if (!effectiveSource) {
    return makeResult({ error: "No image URI or URL provided.", retryable: false });
  }

  const mt     = String(mimeType || "").toLowerCase();
  const fn     = String(filename || "").toLowerCase();
  const isPdf  = mt.includes("pdf") || fn.endsWith(".pdf");
  const isImg  = !isPdf && (mt.startsWith("image/") || /\.(jpg|jpeg|png|webp)$/i.test(effectiveSource));

  // ── Build Edge Function request body ──────────────────────────────────────
  let body;
  try {
    if (uri && isImg) {
      const prep = await prepareImage(uri);
      body = { imageDataUrl: prep.imageDataUrl, languageHint: ["ar", "en"] };
    } else if (uri && isPdf) {
      // Attempt to base64 the PDF; fall back to fileUrl forwarding
      const prep = await prepareImage(uri).catch(() => null);
      body = prep
        ? { imageDataUrl: prep.imageDataUrl, mimeType: "application/pdf", filename: filename || "document.pdf", languageHint: ["ar", "en"] }
        : { fileUrl: fileUrl || uri, mimeType: mimeType || "application/pdf", filename: filename || "document.pdf", languageHint: ["ar", "en"] };
    } else {
      // Remote URL (already on Supabase Storage)
      body = { fileUrl: fileUrl || uri, mimeType: mimeType || "application/octet-stream", filename: filename || "document", languageHint: ["ar", "en"] };
    }
  } catch (e) {
    return makeResult({ error: "Failed to prepare image for upload.", retryable: true, details: String(e?.message || e) });
  }

  // ── Invoke Edge Function ───────────────────────────────────────────────────
  let rawText;
  let provider = "server-ocr";
  try {
    const data = await invokeOcrFunction(body);

    // Backend orchestration hook: if server returns structured fields directly,
    // use them without client-side parsing (future opt-in via data.structured?.fields).
    // For now this path is always null; kept for forward compat.
    if (data?.structured?.fields) {
      return await enrichStructuredResult(data, userUid, userCategories, mode);
    }

    rawText  = normalizeOcrText(data?.text || "");
    provider = data?.provider || "server-ocr";

    if (!rawText) {
      const errMsg = data?.error || "No readable text found. Try a clearer image with stronger lighting.";
      return makeResult({ status: "failed", error: errMsg, provider, retryable: true });
    }
  } catch (e) {
    return makeResult({ status: "failed", error: "OCR service is temporarily unavailable.", retryable: true, details: String(e?.message || e) });
  }

  // ── Client-side field extraction ───────────────────────────────────────────
  const lines = rawText.split(/\n+/).map((l) => l.trim()).filter(Boolean);

  let parsed     = null;
  let suggestions = {};
  let merchant   = null;

  if (mode === "receipt") {
    const vendor    = extractVendor(lines);
    const date      = extractDate(rawText);
    const amount    = extractAmount(lines, rawText);
    const currency  = extractCurrency(rawText);

    // Merchant normalisation
    merchant = vendor?.value ? await normalizeMerchant(vendor.value) : null;

    // Resolve display name: prefer canonical merchant name over raw OCR guess
    const resolvedVendorName = merchant?.name || vendor?.value || null;
    const vendorConf = merchant?.verified ? CONF_HIGH : (vendor?.confidence || CONF_LOW);

    // Category suggestion
    const catSuggestion = userUid
      ? await suggestCategory(userUid, resolvedVendorName || "", rawText, merchant, userCategories)
      : { category_id: 7, confidence: CONF_LOW, reason: "no_user" };

    parsed = {
      vendor_guess:        resolvedVendorName,
      purchase_date_guess: date?.value || null,
      total_guess:         amount?.value || null,
      currency_guess:      currency?.value || null,
      raw_text:            rawText,
    };

    suggestions = {
      vendor_name:   { value: resolvedVendorName,   confidence: vendorConf },
      purchase_date: { value: date?.value   || null, confidence: date?.confidence    || CONF_LOW },
      total_amount:  { value: amount?.value || null, confidence: amount?.confidence  || CONF_LOW },
      currency_code: { value: currency?.value || "SAR", confidence: currency?.confidence || CONF_LOW },
      category_id:   catSuggestion,
    };
  } else if (mode === "warranty") {
    const product = extractProduct(lines);
    const serial  = extractSerial(rawText);
    const dates   = extractWarrantyDates(lines, rawText);

    parsed = {
      product_guess:          product?.value    || null,
      serial_guess:           serial?.value     || null,
      warranty_start_guess:   dates.warranty_start?.value || null,
      warranty_end_guess:     dates.warranty_end?.value   || null,
      raw_text:               rawText,
    };

    suggestions = {
      product_name:    product,
      serial_number:   serial,
      warranty_start:  dates.warranty_start,
      warranty_end:    dates.warranty_end,
    };
  }

  // ── Determine overall status ───────────────────────────────────────────────
  const hasMeaningfulData = mode === "receipt"
    ? !!(suggestions.vendor_name?.value || suggestions.total_amount?.value)
    : !!(suggestions.product_name?.value || suggestions.warranty_end?.value);

  const status = hasMeaningfulData ? "success" : "partial";

  return makeResult({
    status,
    raw_text:    rawText,
    parsed,
    suggestions,
    merchant:    merchant ? { merchant_id: merchant.merchant_id, name: merchant.name, verified: !!merchant.verified } : null,
    error:       null,
    provider,
    retryable:   false,
  });
}

// ─── Future: backend-structured result enrichment ─────────────────────────────
// Called when the Edge Function returns data.structured.fields (not yet deployed).

async function enrichStructuredResult(data, userUid, userCategories, mode) {
  const fields  = data.structured.fields || {};
  const rawText = normalizeOcrText(data?.text || "");

  const vendor  = fields.vendor_name   ? { value: fields.vendor_name,   confidence: CONF_HIGH } : null;
  const date    = fields.purchase_date ? { value: fields.purchase_date,  confidence: CONF_HIGH } : null;
  const amount  = fields.total_amount  ? { value: fields.total_amount,   confidence: CONF_HIGH } : null;
  const curr    = fields.currency_code ? { value: fields.currency_code,  confidence: CONF_HIGH } : null;

  const merchant = vendor?.value ? await normalizeMerchant(vendor.value) : null;
  const catSuggestion = userUid
    ? await suggestCategory(userUid, merchant?.name || vendor?.value || "", rawText, merchant, userCategories)
    : { category_id: 7, confidence: CONF_LOW, reason: "no_user" };

  return makeResult({
    status:      "success",
    raw_text:    rawText,
    parsed:      { ...fields, raw_text: rawText },
    suggestions: { vendor_name: vendor, purchase_date: date, total_amount: amount, currency_code: curr, category_id: catSuggestion },
    merchant:    merchant ? { merchant_id: merchant.merchant_id, name: merchant.name, verified: !!merchant.verified } : null,
    provider:    data?.provider || "server-ocr",
    retryable:   false,
  });
}

// ─── Confidence helpers (used by UI) ─────────────────────────────────────────

/** Returns true if the suggestion is weak enough that the UI should flag it */
export function isWeakConfidence(suggestion) {
  return !suggestion?.value || suggestion?.confidence === CONF_LOW;
}

/** Human-readable confidence label */
export function confidenceLabel(conf) {
  if (conf === CONF_HIGH)   return "Confirmed";
  if (conf === CONF_MEDIUM) return "Likely";
  return "Needs review";
}

// Re-export the legacy function name so old callers continue to work
export { runOcrPipeline as runOcrFromUri };
