import { ref, onValue } from "firebase/database";
import { database } from "../../config/firebase";
import { upsertServiceRecordServer, upsertClaimServer } from "../localRepo";

const now = () => Date.now();

export function registerListeners(userUid, unsubs) {
  // ── Service history ────────────────────────────────────────────────────────
  unsubs.push(onValue(ref(database, `service_history/${userUid}`), async (snap) => {
    const v = snap.val() || {};
    for (const [service_id, data] of Object.entries(v)) {
      if (!data) continue;
      await upsertServiceRecordServer(userUid, {
        service_id,
        hub_id: data.purchase_hub_id || data.hub_id || "",
        receipt_id: data.receipt_id || null,
        warranty_id: data.warranty_id || null,
        title: data.title || null,
        type: data.type || null,
        service_date: data.service_date || null,
        note: data.note || null,
        created_at_ms: Number(data.created_at_ms || now()),
        updated_at_ms: Number(data.updated_at_ms || now()),
      });
    }
  }));

  // ── Claims ─────────────────────────────────────────────────────────────────
  unsubs.push(onValue(ref(database, `claims/${userUid}`), async (snap) => {
    const v = snap.val() || {};
    for (const [claim_id, data] of Object.entries(v)) {
      if (!data) continue;
      await upsertClaimServer(userUid, {
        claim_id,
        hub_id: data.purchase_hub_id || data.hub_id || "",
        warranty_id: data.warranty_id || null,
        kind: data.kind || null,
        status: data.status || "draft",
        note: data.note || null,
        created_date: data.created_date || null,
        created_at_ms: Number(data.created_at_ms || now()),
        updated_at_ms: Number(data.updated_at_ms || now()),
      });
    }
  }));
}
