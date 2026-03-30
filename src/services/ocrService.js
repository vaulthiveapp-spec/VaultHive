/**
 * ocrService.js
 *
 * Thin compatibility shim — all logic lives in ocrPipeline.js.
 *
 * Direct callers of runOcrFromUri() continue to work unchanged.
 * New code should import from ocrPipeline directly to access
 * full pipeline results (suggestions, merchant, confidence, etc.).
 */
export { runOcrFromUri, runOcrPipeline, normalizeOcrText, isWeakConfidence, confidenceLabel } from "./ocrPipeline";
