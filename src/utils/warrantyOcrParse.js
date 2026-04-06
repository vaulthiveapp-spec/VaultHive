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

function normalize(text) {
  return normalizeDigits(text)
    .replace(/[\u200E\u200F]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeBlock(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => normalize(line))
    .join("\n")
    .trim();
}

function toIsoFromAny(dateStr) {
  const s = normalize(dateStr).replace(/\./g, "/");
  const m = s.match(/(\d{1,4})[\/-](\d{1,2})[\/-](\d{1,4})/);
  if (!m) return null;

  let a = Number(m[1]);
  let b = Number(m[2]);
  let c = Number(m[3]);
  if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(c)) return null;

  let year;
  let month;
  let day;

  if (String(m[1]).length === 4) {
    year = a;
    month = b;
    day = c;
  } else if (String(m[3]).length === 4) {
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

function pickProduct(lines) {
  const blacklist = /(warranty|invoice|receipt|tax|vat|terms|conditions|purchase date|start date|end date|expiry|expires|serial|s\/n|imei)/i;
  for (const line of lines.slice(0, 16)) {
    if (!line || line.length < 4) continue;
    if (blacklist.test(line)) continue;
    if (!/[A-Za-z\u0600-\u06FF]/.test(line)) continue;
    if ((line.match(/\d/g) || []).length > Math.max(6, Math.floor(line.length / 2))) continue;
    return line.slice(0, 90);
  }
  return null;
}

function pickSerial(text) {
  const match = text.match(/(?:serial(?:\s*number)?|s\/n|sn|imei)\s*[:#-]?\s*([A-Z0-9-]{6,})/i);
  return match?.[1] || null;
}

function collectDates(lines) {
  const found = [];

  for (const line of lines) {
    const matches = line.match(/\b\d{1,4}[\/-]\d{1,2}[\/-]\d{1,4}\b/g) || [];
    for (const match of matches) {
      const iso = toIsoFromAny(match);
      if (!iso) continue;
      const dt = new Date(`${iso}T00:00:00`);
      if (Number.isNaN(dt.getTime())) continue;
      found.push({
        iso,
        t: dt.getTime(),
        line,
      });
    }
  }

  return found;
}

export function parseWarrantyText(rawText) {
  const raw = normalizeBlock(rawText);
  const lines = raw
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const found = collectDates(lines).sort((a, b) => a.t - b.t);

  const labeledStart = found.find((item) => /(start|purchase|issue|invoice|from|effective|تاريخ الشراء|بداية)/i.test(item.line));
  const labeledEnd = found.find((item) => /(end|expiry|expire|valid until|until|to|coverage end|انتهاء|تنتهي|صالح حتى)/i.test(item.line));

  const warranty_start_guess = labeledStart?.iso || found[0]?.iso || null;
  const warranty_end_guess = labeledEnd?.iso || (found.length > 1 ? found[found.length - 1]?.iso : null) || null;

  return {
    raw_text: raw,
    product_guess: pickProduct(lines),
    serial_guess: pickSerial(raw),
    warranty_start_guess,
    warranty_end_guess,
  };
}