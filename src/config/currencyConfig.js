/**
 * currencyConfig
 *
 * Architecture notes:
 *   - BASE_URL uses HTTP because the free Currencylayer plan doesn't support HTTPS.
 *   - iOS App Transport Security blocks HTTP by default. The ATS exception for
 *     api.currencylayer.com is declared in app.json under
 *     expo.ios.infoPlist.NSAppTransportSecurity.NSExceptionDomains.
 *   - Android already allows cleartext traffic via the expo-build-properties plugin.
 *   - When upgrading to a paid Currencylayer plan, change BASE_URL to
 *     https://api.currencylayer.com/live and remove the ATS exception.
 */

export const CURRENCY_CONFIG = {
  API_KEY:        process.env.EXPO_PUBLIC_CURRENCYLAYER_KEY || "",
  BASE_URL:       "http://api.currencylayer.com/live",
  CACHE_DURATION: 30 * 60 * 1000,        // 30 min — fresh enough for display
  STALE_DURATION: 24 * 60 * 60 * 1000,   // 24 h  — show stale rather than nothing

  SUPPORTED_CURRENCIES: ["AED", "SAR", "KWD", "QAR", "OMR", "BHD", "USD", "EUR", "GBP"],

  // Free plan base is USD; all quotes are USDXXX
  BASE_CURRENCY: "USD",

  // App default when no user preference is set
  DEFAULT_CURRENCY: "SAR",
};

export function getCurrencySymbols() {
  return {
    AED: "AED", SAR: "SAR", KWD: "KWD", QAR: "QAR",
    OMR: "OMR", BHD: "BHD", USD: "$", EUR: "€", GBP: "£",
  };
}

export function getCurrencyNames() {
  return {
    AED: "UAE Dirham",    SAR: "Saudi Riyal",   KWD: "Kuwaiti Dinar",
    QAR: "Qatari Riyal", OMR: "Omani Rial",    BHD: "Bahraini Dinar",
    USD: "US Dollar",    EUR: "Euro",           GBP: "British Pound",
  };
}

export function getCurrencyFlags() {
  return {
    AED: "🇦🇪", SAR: "🇸🇦", KWD: "🇰🇼", QAR: "🇶🇦",
    OMR: "🇴🇲", BHD: "🇧🇭", USD: "🇺🇸", EUR: "🇪🇺", GBP: "🇬🇧",
  };
}

export function validateApiKey(apiKey) {
  if (!apiKey) return { valid: false, message: "Set EXPO_PUBLIC_CURRENCYLAYER_KEY in your .env" };
  if (apiKey.length < 24) return { valid: false, message: "API key looks too short" };
  return { valid: true };
}

export function validateCurrency(code) {
  return CURRENCY_CONFIG.SUPPORTED_CURRENCIES.includes((code || "").toUpperCase());
}

export default CURRENCY_CONFIG;
