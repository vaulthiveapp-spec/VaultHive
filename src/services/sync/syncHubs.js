import { ref, onValue } from "firebase/database";
import { database } from "../../config/firebase";
import { upsertHubServer, reconcileHubs } from "../localRepo";

const now = () => Date.now();

export function registerListeners(userUid, unsubs) {
  unsubs.push(onValue(ref(database, `purchase_hubs/${userUid}`), async (snap) => {
    const v = snap.val() || {};
    const keepIds = [];

    for (const [hub_id, data] of Object.entries(v)) {
      if (!data) continue;
      keepIds.push(hub_id);
      await upsertHubServer(userUid, {
        hub_id,
        title: data.title || "",
        merchant_id: data.merchant_id || null,
        merchant_name: data.merchant_name || null,
        store_id: data.store_id || null,
        receipt_id: data.receipt_id || null,
        warranty_id: data.warranty_id || null,
        serial_number: data.serial_number || null,
        purchase_date: data.purchase_date || null,
        return_deadline: data.return_deadline || null,
        total_amount: Number(data.total_amount || 0),
        currency_code: data.currency_code || "SAR",
        fx_snapshot_rate: data.fx_snapshot_rate != null ? Number(data.fx_snapshot_rate) : null,
        fx_snapshot_base: data.fx_snapshot_base || null,
        category_id: data.category_id || null,
        category_name_snapshot: data.category_name_snapshot || null,
        status: data.status || "active",
        note: data.note || null,
        service_history_count: Number(data.service_history_count || 0),
        claim_history_count: Number(data.claim_history_count || 0),
        created_at_ms: Number(data.created_at_ms || data.created_at || now()),
        updated_at_ms: Number(data.updated_at_ms || data.updated_at || now()),
      });
    }

    // Soft-delete any local hub not returned by this snapshot
    await reconcileHubs(userUid, keepIds);
  }));
}
