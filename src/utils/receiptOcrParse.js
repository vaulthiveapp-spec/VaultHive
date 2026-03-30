const ARABIC_DIGITS = {
  "٠": "0",
  "١": "1",
  "٢": "2",
  "٣": "3",
  "٤": "4",
  "٥": "5",
  "٦": "6",
  "٧": "7",
  "٨": "8",
  "٩": "9",
  "۰": "0",
  "۱": "1",
  "۲": "2",
  "۳": "3",
  "۴": "4",
  "۵": "5",
  "۶": "6",
  "۷": "7",
  "۸": "8",
  "۹": "9",
};

function normalizeDigits(value) {
  return String(value || "").replace(/[٠-٩۰-۹]/g, (digit) => ARABIC_DIGITS[digit] || digit);
}

function normalizeLine(value) {
  return normalizeDigits(value)
    .replace(/\u200f|\u200e/g, "")
    .replace(/[،٬]/g, ",")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeBlock(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((line) => normalizeLine(line))
    .join("\n")
    .trim();
}

function toIsoDate(raw) {
  const value = normalizeLine(raw).replace(/\./g, "/");
  const match = value.match(/(\d{1,4})[\/\-](\d{1,2})[\/\-](\d{1,4})/);
  if (!match) return null;

  let a = Number(match[1]);
  let b = Number(match[2]);
  let c = Number(match[3]);

  if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(c)) return null;

  let year;
  let month;
  let day;

  if (String(match[1]).length === 4) {
    year = a;
    month = b;
    day = c;
  } else if (String(match[3]).length === 4) {
    year = c;
    month = b;
    day = a;
  } else {
    year = c < 70 ? 2000 + c : 1900 + c;
    month = b;
    day = a;
  }

  if (year < 2000 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseAmount(value) {
  const cleaned = normalizeLine(value)
    .replace(/(sar|aed|usd|ريال|ر\.س|رس|vat|tax)/gi, " ")
    .replace(/[^\d.,-]/g, " ")
    .trim();

  const matches = cleaned.match(/-?\d[\d,]*(?:\.\d{1,2})?/g) || [];
  const parsed = matches
    .map((item) => Number(item.replace(/,/g, "")))
    .filter((num) => Number.isFinite(num) && num >= 0);

  return parsed.length ? parsed[parsed.length - 1] : null;
}

function pickVendor(lines) {
  const blacklist = /(receipt|invoice|tax|vat|total|subtotal|cash|card|change|date|time|qty|amount|merchant copy|customer copy|terminal|trx|transaction|phone|tel|mobile|www\.|http|iban|branch|store no|pos|ref no|auth)/i;

  for (const line of lines.slice(0, 8)) {
    if (!line || line.length < 3) continue;
    if (blacklist.test(line)) continue;
    if ((line.match(/\d/g) || []).length > Math.max(4, Math.floor(line.length / 2))) continue;
    if (!/[A-Za-z\u0600-\u06FF]/.test(line)) continue;
    return line.slice(0, 80);
  }

  return lines.find(Boolean) || null;
}

function pickDate(text) {
  const matches = text.match(/\b\d{1,4}[\/\-]\d{1,2}[\/\-]\d{1,4}\b/g) || [];
  for (const match of matches) {
    const iso = toIsoDate(match);
    if (iso) return iso;
  }
  return null;
}

function pickTotal(lines, text) {
  const totalRegex = /(grand\s*total|total\s*due|total|amount\s*due|net\s*amount|balance\s*due|المجموع|الاجمالي|إجمالي|المبلغ\s*الإجمالي|المستحق)/i;
  const keywordCandidates = lines
    .filter((line) => totalRegex.test(line))
    .map((line) => parseAmount(line))
    .filter((num) => Number.isFinite(num));

  if (keywordCandidates.length) {
    return Number(keywordCandidates[keywordCandidates.length - 1].toFixed(2));
  }

  const allAmounts = (text.match(/\d[\d,]*(?:\.\d{1,2})?/g) || [])
    .map((item) => Number(item.replace(/,/g, "")))
    .filter((num) => Number.isFinite(num) && num >= 0.5 && num <= 1000000);

  if (!allAmounts.length) return null;
  return Number(Math.max(...allAmounts).toFixed(2));
}

export function parseReceiptText(rawText) {
  const raw = normalizeBlock(rawText);
  const lines = raw
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  return {
    vendor_guess: pickVendor(lines),
    purchase_date_guess: pickDate(raw),
    total_guess: pickTotal(lines, raw),
    raw_text: raw,
  };
}