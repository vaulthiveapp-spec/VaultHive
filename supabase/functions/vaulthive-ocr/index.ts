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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function textOf(v: unknown): string {
  if (typeof v === "string") return v;
  if (v && typeof v === "object") {
    const obj = v as Record<string, unknown>;
    if (typeof obj.value   === "string") return obj.value;
    if (typeof obj.text    === "string") return obj.text;
    if (typeof obj.content === "string") return obj.content;
  }
  return "";
}

function guessMimeTypeFromName(name: string): string {
  const lower = String(name || "").toLowerCase();
  if (lower.endsWith(".pdf"))                     return "application/pdf";
  if (lower.endsWith(".png"))                     return "image/png";
  if (lower.endsWith(".webp"))                    return "image/webp";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  return "application/octet-stream";
}

// ─── BUG-FIX 8: correct output extraction for /v1/responses ──────────────────
// The Responses API does NOT return a top-level `output_text` field.
// Text lives at: response.output[0].content[0].text
// The old code checked `data?.output_text` (always undefined) then looped output[]
// which worked by accident. Now the primary path is explicit and correct.
function extractResponsesText(data: any): string {
  // Primary path: output[].content[].text
  if (Array.isArray(data?.output)) {
    const parts: string[] = [];
    for (const item of data.output) {
      if (item?.type === "message" && Array.isArray(item?.content)) {
        for (const part of item.content) {
          const t = textOf(part?.text).trim();
          if (t) parts.push(t);
        }
      }
    }
    if (parts.length) return parts.join("\n").trim();
  }
  // Fallback: SDK convenience alias (not present in raw REST responses)
  const alias = String(data?.output_text || "").trim();
  if (alias) return alias;

  return "";
}

// ─── Remote file fetcher ──────────────────────────────────────────────────────

async function fetchRemoteAsDataUrl(fileUrl: string, fallbackMimeType: string) {
  const response = await fetch(fileUrl);
  if (!response.ok) {
    throw new Error(`Could not fetch remote file (${response.status}): ${fileUrl}`);
  }

  const contentType = (response.headers.get("content-type") || fallbackMimeType || "application/octet-stream")
    .split(";")[0]
    .trim();

  const bytes  = new Uint8Array(await response.arrayBuffer());
  let binary   = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const base64 = btoa(binary);

  return {
    mimeType: contentType || "application/octet-stream",
    dataUrl:  `data:${contentType};base64,${base64}`,
  };
}

// ─── Input resolution ─────────────────────────────────────────────────────────
// Accepts three input shapes:
//   imageDataUrl  — "data:image/jpeg;base64,..."  (client-side prepared image)
//   fileData      — "data:<mime>;base64,..."       (any file, client-side)
//   fileUrl       — "https://..."                  (remote URL, e.g. Supabase Storage)

async function resolveInputPayload(body: any): Promise<{
  kind: "image" | "file";
  mimeType: string;
  dataUrl: string;
  filename: string;
}> {
  const imageDataUrl    = String(body?.imageDataUrl || "").trim();
  const fileData        = String(body?.fileData     || "").trim();
  const fileUrl         = String(body?.fileUrl      || "").trim();
  const filename        = String(body?.filename     || "document").trim() || "document";
  const fallbackMime    = String(body?.mimeType     || guessMimeTypeFromName(filename)).trim()
    || "application/octet-stream";

  if (imageDataUrl.startsWith("data:image/")) {
    return {
      kind:     "image",
      mimeType: imageDataUrl.slice(5, imageDataUrl.indexOf(";")) || "image/jpeg",
      dataUrl:  imageDataUrl,
      filename,
    };
  }

  if (fileData.startsWith("data:")) {
    const mimeMatch = fileData.match(/^data:([^;]+);base64,/i);
    const mimeType  = mimeMatch?.[1] || fallbackMime;
    return {
      kind:     mimeType.startsWith("image/") ? "image" : "file",
      mimeType,
      dataUrl:  fileData,
      filename,
    };
  }

  if (fileUrl) {
    const fetched = await fetchRemoteAsDataUrl(fileUrl, fallbackMime);
    return {
      kind:     fetched.mimeType.startsWith("image/") ? "image" : "file",
      mimeType: fetched.mimeType,
      dataUrl:  fetched.dataUrl,
      filename,
    };
  }

  throw new Error("One of imageDataUrl, fileData, or fileUrl is required");
}

// ─── Entry point ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST")    return json({ error: "Method not allowed" }, 405);

  try {
    const body         = await req.json().catch(() => null);
    const languageHint = Array.isArray(body?.languageHint)
      ? (body.languageHint as unknown[]).map((x) => String(x))
      : [];

    const OPENAI_API_KEY = (Deno.env.get("OPENAI_API_KEY") || "").trim();
    if (!OPENAI_API_KEY) {
      return json({ error: "Server is missing OPENAI_API_KEY" }, 500);
    }

    const payload = await resolveInputPayload(body || {});

    // ── Build prompt ─────────────────────────────────────────────────────────
    const promptParts = [
      "You are an OCR engine for receipts, invoices, warranty cards, and scanned documents.",
      "Extract ALL readable text from the provided file exactly as it appears.",
      "Preserve the original line breaks and reading order.",
      "Do NOT summarize, translate, or interpret the content.",
      "Return plain text only — no markdown, no JSON, no commentary.",
    ];
    if (languageHint.length) {
      promptParts.push(`Likely document language(s): ${languageHint.join(", ")}.`);
    }
    const prompt = promptParts.join("\n");

    // ── Build input content ──────────────────────────────────────────────────
    const content: Array<Record<string, unknown>> = [
      { type: "input_text", text: prompt },
    ];

    if (payload.kind === "image") {
      content.push({
        type:      "input_image",
        image_url: payload.dataUrl,
        detail:    "high",
      });
    } else {
      content.push({
        type:      "input_file",
        filename:  payload.filename || "document",
        file_data: payload.dataUrl,
      });
    }

    // ── Call OpenAI Responses API ────────────────────────────────────────────
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization:  `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        store: false,
        input: [
          { role: "user", content },
        ],
      }),
    });

    const raw = await response.text();
    let data: any = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch { data = { _raw: raw }; }

    if (!response.ok) {
      const errMsg = textOf(data?.error?.message || data?.message) || `OpenAI request failed (${response.status})`;
      console.error("vaulthive-ocr OpenAI error:", errMsg);
      return json({ error: "OpenAI request failed", status: response.status, message: errMsg }, 500);
    }

    // BUG-FIX 8: use the correct extractor
    const text = extractResponsesText(data);

    if (!text) {
      return json({
        error:    "No text could be extracted from the document.",
        hint:     "The file may be blank, corrupted, or a scanned image with insufficient contrast.",
        provider: "openai",
      }, 422);
    }

    return json({ text, provider: "openai", mimeType: payload.mimeType });

  } catch (e) {
    const msg = String((e as Error)?.message || "Unexpected server error");
    console.error("vaulthive-ocr error:", msg);
    return json({ error: msg }, 500);
  }
});
