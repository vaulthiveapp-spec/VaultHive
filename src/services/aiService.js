/**
 * aiService
 *
 * Network layer for AI chat. Responsibilities:
 *   1. Accept pre-built context (from aiContextBuilder) + message + history
 *   2. Serialize and send to the vaulthive-ai Supabase Edge Function
 *   3. Normalize the response into a canonical shape
 *   4. Generate action proposals from context when the server does not return them
 *   5. Fall back to a rich local response when the endpoint is not configured
 *      or the network request fails
 *
 * Canonical response shape:
 * {
 *   reply:            string
 *   sections:         { title: string, items: string[] }[]
 *   cards:            AICard[]
 *   suggestions:      string[]
 *   action_proposals: ActionProposal[]
 *   transcript:       string
 * }
 */

import * as FileSystem from "expo-file-system";
import { attachStoreCandidates, CATEGORY_BY_ID } from "./aiContextBuilder";

const endpoint    = process.env.EXPO_PUBLIC_AI_ENDPOINT;
// BUG-FIX 5+6: Supabase Edge Functions require the anon key in the
// Authorization header (as "Bearer <anon_key>") even when verify_jwt=false.
// Without this header the Supabase gateway returns 401 before the function runs.
const SUPABASE_ANON_KEY = String(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "").trim();

const MAX_FILE_SIZE_BYTES = 12 * 1024 * 1024;

export function isConfigured() {
  return !!endpoint && /^https?:\/\//i.test(String(endpoint).trim());
}

// ─── Text utilities ───────────────────────────────────────────────────────────

function clean(value) {
  return String(value || "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/[*_`#>]+/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function titleCase(value) {
  return String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function parsePossibleJson(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

// ─── Attachment builder ───────────────────────────────────────────────────────

async function buildAttachmentPayload(attachment) {
  if (!attachment?.uri) return null;
  const size = Number(attachment.size || 0);
  if (size > MAX_FILE_SIZE_BYTES) {
    throw new Error("The selected file is too large. Keep attachments under 12 MB.");
  }
  const mimeType = String(attachment.mimeType || "application/octet-stream");
  const base64 = await FileSystem.readAsStringAsync(attachment.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return {
    filename: attachment.name || "attachment",
    mimeType,
    size,
    durationMs: Number(attachment.durationMs || 0),
    fileData: `data:${mimeType};base64,${base64}`,
  };
}

// ─── Card mappers ─────────────────────────────────────────────────────────────

function mapReceiptCard(r) {
  return {
    kind: "receipt",
    ref_id: String(r.receipt_id || ""),
    title: r.vendor_name || "Receipt",
    subtitle: [r.purchase_date, r.total_amount != null && r.currency_code ? `${Number(r.total_amount).toLocaleString()} ${r.currency_code}` : null].filter(Boolean).join("  ·  "),
    description: clean(r.note || `Saved in ${titleCase(r.category || "shopping")}.`),
    badge: "Receipt",
    image_key: r.category || "shopping",
    url: null,
    cta_label: "Open receipt",
  };
}

function mapWarrantyCard(w) {
  return {
    kind: "warranty",
    ref_id: String(w.warranty_id || ""),
    title: w.product_name || "Warranty",
    subtitle: w.warranty_end ? `Ends ${w.warranty_end}` : (w.serial_number || ""),
    description: clean(w.terms_note || "Review coverage and linked purchase details."),
    badge: "Warranty",
    image_key: "shopping",
    url: null,
    cta_label: "Open warranty",
  };
}

function mapHubCard(h) {
  return {
    kind: "hub",
    ref_id: String(h.hub_id || ""),
    title: h.title || h.merchant_name || "Purchase",
    subtitle: [h.purchase_date, h.status ? titleCase(h.status) : null].filter(Boolean).join("  ·  "),
    description: clean(h.category_name || h.category_name_snapshot || ""),
    badge: titleCase(h.status || "Active"),
    image_key: "shopping",
    url: null,
    cta_label: "Open hub",
  };
}

function mapStoreCard(s) {
  return {
    kind: "store",
    ref_id: String(s.store_id || ""),
    title: clean(s.name || "Store"),
    subtitle: [s.city, s.verified ? "Verified" : null].filter(Boolean).join("  ·  "),
    description: clean(s.reason || "Good match for your shopping history."),
    badge: safeArray(s.categories)[0] ? titleCase(safeArray(s.categories)[0]) : "Store",
    image_key: safeArray(s.categories)[0] || "shopping",
    url: s.url || null,
    cta_label: s.url ? "Visit website" : "Open store",
  };
}

// ─── Action proposals ─────────────────────────────────────────────────────────

function generateActionProposals(response, context) {
  const proposals = [];
  const cards = safeArray(response.cards);

  if ((context?.attention_items?.length || 0) > 0) {
    proposals.push({ id: "open_attention", type: "open_attention_center", label: "View attention center", screen: "AttentionCenter", icon: "flash-outline", confidence: "high" });
  }
  if ((context?.expiring_warranties?.length || 0) > 0 && proposals.length === 0) {
    proposals.push({ id: "check_warranties", type: "open_vault", label: "Check expiring warranties", screen: "Vault", icon: "shield-checkmark-outline", confidence: "high" });
  }
  if (cards.some((c) => c.kind === "hub") || (context?.recent_hubs?.length || 0) > 0) {
    if (!proposals.some((p) => p.screen === "Vault")) {
      proposals.push({ id: "open_vault", type: "open_vault", label: "Browse purchase vault", screen: "Vault", icon: "cube-outline", confidence: "medium" });
    }
  }
  if (cards.some((c) => c.kind === "store") || (context?.store_candidates?.length || 0) > 0) {
    proposals.push({ id: "open_stores", type: "open_stores", label: "Browse stores", screen: "Stores", icon: "storefront-outline", confidence: "medium" });
  }

  return proposals.slice(0, 2);
}

// ─── Response normalizers ─────────────────────────────────────────────────────

const ALLOWED_KINDS = new Set(["store", "receipt", "warranty", "hub", "action"]);

function normalizeSections(sections) {
  return safeArray(sections).map((s) => ({ title: clean(s?.title || ""), items: safeArray(s?.items).map(clean).filter(Boolean) })).filter((s) => s.title || s.items.length > 0);
}

function normalizeCards(cards, context) {
  return safeArray(cards)
    .map((c) => ({
      kind: ALLOWED_KINDS.has(c?.kind) ? c.kind : "action",
      ref_id: c?.ref_id ? String(c.ref_id) : null,
      title: clean(c?.title || ""),
      subtitle: clean(c?.subtitle || ""),
      description: clean(c?.description || ""),
      badge: clean(c?.badge || ""),
      image_key: c?.image_key || "shopping",
      url: c?.url || null,
      cta_label: clean(c?.cta_label || "Open"),
    }))
    .filter((c) => c.title)
    .slice(0, 6)
    .map((c) => {
      if (c.kind !== "store" || !c.ref_id) return c;
      const match = safeArray(context?.store_candidates).find((s) => String(s.store_id) === String(c.ref_id));
      return match ? { ...c, url: c.url || match.url || null } : c;
    });
}

function normalizeProposals(proposals) {
  return safeArray(proposals)
    .map((p) => ({
      id: p?.id || String(Math.random().toString(16).slice(2)),
      type: String(p?.type || ""),
      label: clean(p?.label || p?.type || ""),
      screen: p?.screen || null,
      icon: p?.icon || "flash-outline",
      target_id: p?.target_id || null,
      confidence: p?.confidence || "medium",
    }))
    .filter((p) => p.label)
    .slice(0, 3);
}

function normalizeRemoteResponse(data, context) {
  const parsed = typeof data?.json === "object" && data?.json ? data.json : parsePossibleJson(data?.text || "");
  const payload = (parsed && typeof parsed === "object") ? parsed : (data || {});

  const response = {
    reply: clean(payload?.reply || payload?.text || "I prepared a response for you."),
    sections: normalizeSections(payload?.sections || []),
    cards: normalizeCards(payload?.cards || [], context),
    suggestions: safeArray(payload?.suggestions).map(clean).filter(Boolean).slice(0, 5),
    transcript: clean(payload?.transcript || ""),
  };

  const serverProposals = normalizeProposals(payload?.action_proposals || []);
  response.action_proposals = serverProposals.length > 0 ? serverProposals : generateActionProposals(response, context);
  return response;
}

// ─── Local fallback ───────────────────────────────────────────────────────────

function inferIntent(message) {
  const lower = String(message || "").toLowerCase();
  if (["store", "buy", "shop", "where", "recommend", "compare"].some((x) => lower.includes(x))) return "stores";
  if (["warranty", "expiry", "expir", "coverage", "guarantee"].some((x) => lower.includes(x))) return "warranties";
  if (["remind", "deadline", "due", "return"].some((x) => lower.includes(x))) return "reminders";
  if (["receipt", "invoice", "spent", "purchase", "hub"].some((x) => lower.includes(x))) return "receipts";
  return "general";
}

function buildLocalFallback({ message, attachment, context }) {
  const intent = inferIntent(message);
  const ctx = context || {};
  const hasAttachment = !!attachment;

  const recentHubCards = safeArray(ctx.recent_hubs).slice(0, 3).map(mapHubCard);
  const receiptCards = safeArray(ctx.recent_receipts).slice(0, 2).map(mapReceiptCard);
  const warrantyCards = safeArray(ctx.recent_warranties).slice(0, 2).map(mapWarrantyCard);
  const expiringCards = safeArray(ctx.expiring_warranties).slice(0, 3).map(mapWarrantyCard);
  const storeCards = safeArray(ctx.store_candidates).slice(0, 4).map(mapStoreCard);
  const attentionCount = safeArray(ctx.attention_items).length;
  const reminderCount = safeArray(ctx.upcoming_reminders).length;

  let response;

  if (intent === "stores") {
    response = {
      reply: "Here are the best store matches based on your shopping history and preferences.",
      sections: [{ title: "How I ranked these", items: ["Your saved favorite stores rank highest", "Stores matching your top category score higher", hasAttachment ? "I also considered the file you attached" : "Verified stores get a reliability boost"].filter(Boolean) }],
      cards: storeCards.length > 0 ? storeCards : receiptCards,
      suggestions: ["Show only verified stores", "Compare two stores side by side", "Find stores for electronics", "What's good for groceries?"],
    };
  } else if (intent === "warranties") {
    response = {
      reply: expiringCards.length > 0
        ? `You have ${expiringCards.length} ${expiringCards.length === 1 ? "warranty" : "warranties"} expiring within 90 days. Here's what to review first.`
        : "Your warranties look healthy. Here's a quick overview.",
      sections: [{ title: "Recommended next steps", items: ["Review expiring warranties and set reminders before the end date", "Link warranties to purchase hubs for easy claims", "Check if any active warranties have open claims"] }],
      cards: expiringCards.length > 0 ? expiringCards : warrantyCards,
      suggestions: ["Show all warranties", "Create expiry reminders", "What expires this month?", "Help me file a claim"],
    };
  } else if (intent === "reminders") {
    response = {
      reply: reminderCount > 0 ? `You have ${reminderCount} upcoming reminders in the next 60 days.` : "No urgent reminders coming up. You're all clear.",
      sections: [{ title: "Stay on top of deadlines", items: ["Return windows close fast — set reminders 2–3 days before", "Warranty expiry reminders give you time to act", "Link reminders to purchase hubs for context"] }],
      cards: recentHubCards.slice(0, 2),
      suggestions: ["Show all reminders", "What's due this week?", "Create a new reminder", "Which purchases can still be returned?"],
    };
  } else if (intent === "receipts") {
    response = {
      reply: hasAttachment ? "I can help you process this file. Here's your recent purchase activity." : `You have ${safeArray(ctx.recent_receipts).length} receipts saved. Here's a quick overview.`,
      sections: [{
        title: "Your purchase snapshot",
        items: [
          ctx.spending_summary?.top_vendor ? `Most frequent store: ${ctx.spending_summary.top_vendor}` : "Keep vendor names consistent for better insights",
          ctx.spending_summary?.top_categories?.[0] ? `Top category: ${titleCase(ctx.spending_summary.top_categories[0])}` : "Tag purchases by category to track spending",
          attentionCount > 0 ? `${attentionCount} item${attentionCount > 1 ? "s" : ""} need${attentionCount === 1 ? "s" : ""} your attention` : "No urgent items flagged",
        ].filter(Boolean),
      }],
      cards: [...recentHubCards.slice(0, 2), ...receiptCards.slice(0, 1)],
      suggestions: ["Show recent receipts", "What's in my purchase vault?", "Organize by category", "Find a specific purchase"],
    };
  } else {
    response = {
      reply: "I'm ready to help you manage your purchases, warranties, receipts, and reminders. Here's where things stand.",
      sections: [{
        title: "Your vault at a glance",
        items: [
          safeArray(ctx.recent_hubs).length > 0 ? `${safeArray(ctx.recent_hubs).length} purchase${safeArray(ctx.recent_hubs).length > 1 ? "s" : ""} in your vault` : "Your vault is empty — add your first purchase",
          expiringCards.length > 0 ? `${expiringCards.length} warranty expiring soon` : "No warranties expiring in the next 90 days",
          attentionCount > 0 ? `${attentionCount} item${attentionCount > 1 ? "s" : ""} need your attention` : "No urgent items",
          reminderCount > 0 ? `${reminderCount} upcoming reminder${reminderCount > 1 ? "s" : ""}` : "No reminders due soon",
        ].filter(Boolean),
      }],
      cards: [...recentHubCards.slice(0, 2), ...expiringCards.slice(0, 1)],
      suggestions: ["What needs attention?", "Show expiring warranties", "Find a store", "Help me add a purchase"],
    };
  }

  return { ...response, action_proposals: generateActionProposals(response, ctx), transcript: "" };
}

// ─── Request body ─────────────────────────────────────────────────────────────

function buildRequestBody({ uid, message, history, context, attachment }) {
  return {
    uid,
    message,
    history: safeArray(history).slice(-10),
    context: {
      spending_summary:    context?.spending_summary    || {},
      recent_hubs:         safeArray(context?.recent_hubs).slice(0, 10),
      recent_receipts:     safeArray(context?.recent_receipts).slice(0, 8),
      recent_warranties:   safeArray(context?.recent_warranties).slice(0, 8),
      expiring_warranties: safeArray(context?.expiring_warranties).slice(0, 5),
      upcoming_reminders:  safeArray(context?.upcoming_reminders).slice(0, 8),
      attention_items:     safeArray(context?.attention_items).slice(0, 6),
      service_history:     safeArray(context?.service_history).slice(0, 5),
      claims:              safeArray(context?.claims).slice(0, 5),
      favorite_stores:     safeArray(context?.favorite_stores).slice(0, 6),
      store_candidates:    safeArray(context?.store_candidates).slice(0, 6),
    },
    attachment,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

async function chat({ uid, message, history = [], context = null, attachment = null }) {
  if (context) {
    await attachStoreCandidates(context, uid, message).catch(() => {});
  }

  const preparedAttachment = attachment ? await buildAttachmentPayload(attachment) : null;

  if (!isConfigured()) {
    return buildLocalFallback({ message, attachment: preparedAttachment, context });
  }

  try {
    // BUG-FIX 5+6: include Authorization header so the Supabase gateway accepts the request
    const headers = { "Content-Type": "application/json" };
    if (SUPABASE_ANON_KEY) headers["Authorization"] = `Bearer ${SUPABASE_ANON_KEY}`;

    const res = await fetch(String(endpoint), {
      method: "POST",
      headers,
      body: JSON.stringify(buildRequestBody({ uid, message, history, context, attachment: preparedAttachment })),
    });

    const rawText = await res.text();
    let json = {};
    try { json = rawText ? JSON.parse(rawText) : {}; } catch { json = { text: rawText }; }
    if (!res.ok) throw new Error(json?.error || json?.message || `AI request failed (${res.status})`);
    return normalizeRemoteResponse(json, context);
  } catch {
    return buildLocalFallback({ message, attachment: preparedAttachment, context });
  }
}

export default { isConfigured, chat };
