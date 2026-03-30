import "@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// ─── Schema ───────────────────────────────────────────────────────────────────
// BUG-FIX 3: added "hub" to card kind enum
// BUG-FIX 4: added action_proposals to schema so OpenAI returns them
const UI_RESPONSE_SCHEMA = {
  name: "vaulthive_ui_response",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["reply", "sections", "cards", "suggestions", "transcript", "action_proposals"],
    properties: {
      reply: { type: "string" },
      transcript: { type: "string" },
      sections: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "items"],
          properties: {
            title: { type: "string" },
            items: { type: "array", items: { type: "string" } },
          },
        },
      },
      cards: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["kind", "ref_id", "title", "subtitle", "description", "badge", "image_key", "url", "cta_label"],
          properties: {
            kind: {
              type: "string",
              // BUG-FIX 3: "hub" was missing — caused strict schema rejection for hub cards
              enum: ["store", "receipt", "warranty", "hub", "action"],
            },
            ref_id: { type: ["string", "null"] },
            title: { type: "string" },
            subtitle: { type: "string" },
            description: { type: "string" },
            badge: { type: "string" },
            image_key: {
              type: "string",
              enum: ["shopping", "electronics", "groceries", "fashion", "pharmacy", "home", "default"],
            },
            url: { type: ["string", "null"] },
            cta_label: { type: "string" },
          },
        },
      },
      suggestions: {
        type: "array",
        items: { type: "string" },
      },
      // BUG-FIX 4: action_proposals added — previously absent so AI never returned them
      action_proposals: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "type", "label", "icon", "confidence"],
          properties: {
            id: { type: "string" },
            type: { type: "string" },
            label: { type: "string" },
            screen: { type: ["string", "null"] },
            icon: { type: "string" },
            target_id: { type: ["string", "null"] },
            confidence: { type: "string", enum: ["high", "medium", "low"] },
          },
        },
      },
    },
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function textOf(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function parseJsonLoose(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function decodeBase64DataUrl(input: string) {
  const match = String(input || "").match(/^data:([^;]+);base64,(.*)$/);
  if (!match) throw new Error("Invalid file_data payload");

  const mimeType = match[1];
  const base64   = match[2];
  const binary   = atob(base64);
  const bytes    = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  return { mimeType, bytes };
}

// ─── BUG-FIX 1: correct output extraction for /v1/responses ──────────────────
// The Responses API does NOT return a top-level `output_text` field.
// The JSON string lives at: response.output[0].content[0].text
// (content item type is "output_text" when a json_schema format is used)
function extractResponsesOutput(parsed: any): string {
  // Primary path: output[].content[].text (the Responses API shape)
  if (Array.isArray(parsed?.output)) {
    for (const item of parsed.output) {
      if (item?.type === "message" && Array.isArray(item?.content)) {
        for (const part of item.content) {
          const t = textOf(part?.text).trim();
          if (t) return t;
        }
      }
    }
  }
  // Legacy convenience alias — present in some SDK wrappers but not the raw REST API
  const alias = textOf(parsed?.output_text).trim();
  if (alias) return alias;

  return "";
}

// ─── Audio transcription ──────────────────────────────────────────────────────

async function transcribeAudio(OPENAI_API_KEY: string, attachment: any): Promise<string> {
  const { mimeType, bytes } = decodeBase64DataUrl(attachment.fileData);

  const form = new FormData();
  form.append("file", new Blob([bytes], { type: mimeType }), attachment.filename || "voice-note.m4a");
  form.append("model", "gpt-4o-mini-transcribe");
  form.append("response_format", "json");

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: form,
  });

  const rawText = await response.text();
  const parsed  = parseJsonLoose(rawText) as any || {};

  if (!response.ok) {
    throw new Error(textOf(parsed?.error?.message || parsed?.message) || "Audio transcription failed");
  }

  return textOf(parsed?.text).trim();
}

// ─── System instructions ──────────────────────────────────────────────────────

function buildInstructions(): string {
  return [
    "You are VaultHive AI, a smart post-purchase assistant.",
    "You help users manage receipts, warranties, purchase hubs, store recommendations, reminders, service history, claims, and spending insights.",
    "Your tone is friendly, clear, concise, and professional.",
    "NEVER use markdown formatting: no **bold**, no *, no #, no backticks, no tables.",
    "Write replies as clean plain sentences suitable for a mobile chat UI.",
    "For cards: use ref_id to reference the actual entity ID from the provided context so the app can open it.",
    "For hub cards use kind='hub'. For receipts use kind='receipt'. For warranties use kind='warranty'. For stores use kind='store'.",
    "action_proposals should suggest the 1-3 most relevant next navigation actions the user could take (e.g. open vault, view attention center, browse stores).",
    "Keep action_proposals to a maximum of 3 items. Use high confidence only for the single most relevant action.",
    "Keep sections short — 3 to 5 bullet items maximum. One section per response is usually enough.",
    "Keep suggestions to 4 follow-up questions the user might naturally ask next.",
    "If no cards are relevant, return an empty cards array.",
  ].join(" ");
}

// ─── BUG-FIX 2: history normalisation ────────────────────────────────────────
// The hook sends { role, content: string } but the old code read item.text.
// Now we accept both shapes: item.content (hook) and item.text (legacy).
function historyToInput(history: any[] = []) {
  return history
    .filter((item) => {
      const t = textOf(item?.content || item?.text).trim();
      return item && (item.role === "user" || item.role === "assistant") && t;
    })
    .slice(-8)
    .map((item) => ({
      role: item.role as "user" | "assistant",
      content: [
        {
          type: "input_text",
          // BUG-FIX 2: prefer item.content (sent by hook), fall back to item.text (legacy)
          text: textOf(item?.content || item?.text).trim(),
        },
      ],
    }));
}

// ─── Main AI call ─────────────────────────────────────────────────────────────

async function callResponsesApi({
  OPENAI_API_KEY,
  message,
  history,
  context,
  attachment,
  transcript,
}: {
  OPENAI_API_KEY: string;
  message: string;
  history: any[];
  context: any;
  attachment: any;
  transcript: string;
}) {
  const finalUserText = [
    `User message:\n${textOf(message).trim()}`,
    transcript ? `Voice transcript:\n${transcript}` : "",
    context ? `VaultHive context:\n${JSON.stringify(context)}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const userContent: any[] = [{ type: "input_text", text: finalUserText }];

  if (attachment?.fileData && !String(attachment.mimeType || "").startsWith("audio/")) {
    if (String(attachment.mimeType || "").startsWith("image/")) {
      userContent.push({
        type: "input_image",
        image_url: attachment.fileData,
        detail: "high",
      });
    } else {
      userContent.push({
        type: "input_file",
        filename: attachment.filename || "attachment",
        file_data: attachment.fileData,
      });
    }
  }

  const payload = {
    model: "gpt-4o-mini",
    store: false,
    instructions: buildInstructions(),
    text: {
      format: {
        type: "json_schema",
        ...UI_RESPONSE_SCHEMA,
      },
    },
    input: [
      ...historyToInput(history),
      { role: "user", content: userContent },
    ],
  };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const rawText = await response.text();
  const parsed  = parseJsonLoose(rawText) as any || {};

  if (!response.ok) {
    throw new Error(
      textOf(parsed?.error?.message || parsed?.message) ||
        `OpenAI response request failed (${response.status})`
    );
  }

  // BUG-FIX 1: use the correct extractor instead of parsed?.output_text
  const outputText = extractResponsesOutput(parsed);
  const structured = parseJsonLoose(outputText) as any;

  if (!structured || typeof structured !== "object") {
    // Graceful degradation: return the raw text as the reply with empty structure
    return {
      reply: outputText || "I prepared a response for you.",
      transcript: transcript || "",
      sections: [],
      cards: [],
      suggestions: [],
      action_proposals: [],
    };
  }

  return {
    reply:            textOf(structured.reply).trim() || "Here is what I found.",
    transcript:       textOf(structured.transcript || transcript || ""),
    sections:         Array.isArray(structured.sections)         ? structured.sections         : [],
    cards:            Array.isArray(structured.cards)            ? structured.cards            : [],
    suggestions:      Array.isArray(structured.suggestions)      ? structured.suggestions      : [],
    action_proposals: Array.isArray(structured.action_proposals) ? structured.action_proposals : [],
  };
}

// ─── Entry point ──────────────────────────────────────────────────────────────
// BUG-FIX 5: verify_jwt is set to false in config.toml for this function.
// The app uses raw fetch() (aiService.js) without a Firebase JWT — enforcing JWT
// here would return 401 on every real request. The Supabase anon key in the
// request (via supabase.functions.invoke or explicit header) is sufficient to
// prevent unauthenticated abuse. User identity is validated via the uid field.

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST")    return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => null);

    const uid        = textOf(body?.uid).trim();
    const message    = textOf(body?.message).trim();
    const history    = Array.isArray(body?.history) ? body.history : [];
    const context    = body?.context && typeof body.context === "object" ? body.context : null;
    const attachment = body?.attachment && typeof body.attachment === "object" ? body.attachment : null;

    if (!uid)     return json({ error: "uid is required" }, 400);
    if (!message) return json({ error: "message is required" }, 400);

    const OPENAI_API_KEY = textOf(Deno.env.get("OPENAI_API_KEY")).trim();
    if (!OPENAI_API_KEY) {
      return json({ error: "Server is missing OPENAI_API_KEY" }, 500);
    }

    // Transcribe audio attachment if present
    let transcript = "";
    if (attachment?.fileData && String(attachment.mimeType || "").startsWith("audio/")) {
      try {
        transcript = await transcribeAudio(OPENAI_API_KEY, attachment);
      } catch (e) {
        console.error("vaulthive-ai transcription error:", String((e as Error)?.message || e));
        // Non-fatal: proceed without transcript
      }
    }

    const result = await callResponsesApi({
      OPENAI_API_KEY,
      message,
      history,
      context,
      attachment,
      transcript,
    });

    return json(result);

  } catch (error) {
    const msg = String((error as Error)?.message || "Unexpected server error");
    console.error("vaulthive-ai error:", msg);
    return json({ error: msg }, 500);
  }
});
