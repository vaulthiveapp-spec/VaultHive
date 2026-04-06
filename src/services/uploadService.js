import * as FileSystem from "expo-file-system";
import * as ImageManipulator from "expo-image-manipulator";
import NetInfo from "@react-native-community/netinfo";
import { decode as atob } from "base-64";

import { supabase, isSupabaseConfigured, SUPABASE_BUCKET_ATTACHMENTS, SUPABASE_BUCKET_AVATARS } from "../config/supabase";

const toSafeFileName = (name) =>
  String(name || "file")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9._-]/g, "");

const guessContentType = (uri, provided) => {
  const p = String(provided || "").toLowerCase();
  if (p) return p;
  const u = String(uri || "").toLowerCase();
  if (u.endsWith(".pdf")) return "application/pdf";
  if (u.endsWith(".png")) return "image/png";
  if (u.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
};

async function readAsBytes(uri) {
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function uriToUploadBody(uri, contentType) {
  try {
    const r = await fetch(uri);
    const b = await r.blob();
    if (b) return b;
  } catch {}

  const bytes = await readAsBytes(uri);
  try {
    return new Blob([bytes], { type: contentType });
  } catch {
    return bytes;
  }
}

async function preprocessImageIfNeeded(uri, contentType, maxWidth = 1600) {
  if (!String(contentType || "").startsWith("image/")) return { uri, didProcess: false, contentType };
  try {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: maxWidth } }],
      { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
    );
    return { uri: result.uri, didProcess: true, contentType: "image/jpeg" };
  } catch {
    return { uri, didProcess: false, contentType };
  }
}

export async function uploadPublicObject({ bucket, path, uri, contentType, upsert = false }) {
  if (!isSupabaseConfigured() || !supabase) throw new Error("Supabase is not configured");

  const guessed = guessContentType(uri, contentType);
  const { uri: finalUri, contentType: finalContentType } = await preprocessImageIfNeeded(uri, guessed);
  const body = await uriToUploadBody(finalUri, finalContentType);

  const { error } = await supabase.storage.from(bucket).upload(path, body, {
    contentType: finalContentType,
    upsert,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  const publicUrl = data?.publicUrl || null;
  if (!publicUrl) throw new Error("Failed to get public URL");

  return { public_url: publicUrl, content_type: finalContentType };
}

export async function deletePublicObject({ bucket, path }) {
  if (!isSupabaseConfigured() || !supabase) throw new Error("Supabase is not configured");
  const { error } = await supabase.storage.from(bucket).remove([path]);
  if (error) throw error;
  return { success: true };
}

export async function uploadAttachmentIfOnline(att) {
  if (!att?.local_uri) return null;
  if (!isSupabaseConfigured() || !supabase) return null;

  const net = await NetInfo.fetch();
  if (!net?.isConnected) return null;

  const bucket = att.bucket || SUPABASE_BUCKET_ATTACHMENTS;
  const path = att.path;
  if (!path) return null;

  const { public_url, content_type } = await uploadPublicObject({
    bucket,
    path,
    uri: att.local_uri,
    contentType: att.content_type,
    upsert: false,
  });

  return { bucket, path, public_url, content_type };
}

export function buildAttachmentPath({ userUid, linkedType, linkedId, attachmentId, filename }) {
  const safeName = toSafeFileName(filename || "attachment");
  const base = linkedType === "warranty" ? "warranties" : "receipts";
  return `${userUid}/${base}/${linkedId}/${attachmentId}_${safeName}`;
}

export function getBuckets() {
  return { attachments: SUPABASE_BUCKET_ATTACHMENTS, avatars: SUPABASE_BUCKET_AVATARS };
}

export async function uploadAvatarPublic({ userUid, uri, contentType }) {
  if (!isSupabaseConfigured() || !supabase) throw new Error("Supabase is not configured");

  const bucket = SUPABASE_BUCKET_AVATARS;
  const path = `${userUid}/avatar.jpg`;
  const { public_url } = await uploadPublicObject({ bucket, path, uri, contentType, upsert: true });
  return { bucket, path, public_url };
}

export async function deleteAvatarPublic({ userUid }) {
  if (!userUid) throw new Error("Missing user uid");
  const bucket = SUPABASE_BUCKET_AVATARS;
  const path = `${userUid}/avatar.jpg`;
  await deletePublicObject({ bucket, path });
  return { bucket, path, success: true };
}
