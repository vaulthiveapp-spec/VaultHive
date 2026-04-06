/**
 * firebaseSync — public API for the sync engine.
 *
 * Orchestrates all domain-specific sync modules. Each module exports
 * registerListeners(userUid, unsubs) and pushes its Firebase onValue
 * unsubscribe functions into the shared `unsubs` array so teardown is
 * always complete.
 *
 * Public surface (unchanged from v2):
 *   startSyncListener(userUid)
 *   stopSyncListener()
 *   syncPendingAttachments()
 */

import {
  uidActive, firebaseUnsubs,
  setUidActive, stopFirebaseListeners, teardown,
  startNetListener, runSyncCycle, syncPendingAttachments as _syncAttachments,
} from "./sync/syncCore";

import { registerListeners as registerUser }       from "./sync/syncUser";
import { registerListeners as registerReceipts }   from "./sync/syncReceipts";
import { registerListeners as registerWarranties } from "./sync/syncWarranties";
import { registerListeners as registerHubs }       from "./sync/syncHubs";
import { registerListeners as registerMerchants }  from "./sync/syncMerchants";
import { registerListeners as registerReminders }  from "./sync/syncReminders";
import { registerListeners as registerAttention }  from "./sync/syncAttention";
import { registerListeners as registerWork }       from "./sync/syncWork";
import { registerListeners as registerStores }     from "./sync/syncStores";
import { registerListeners as registerCache }      from "./sync/syncCache";
import { registerListeners as registerAI }         from "./sync/syncAI";

// ---------------------------------------------------------------------------

function startFirebaseListeners(userUid) {
  stopFirebaseListeners();

  // Each module pushes its unsubscribers into the shared firebaseUnsubs array
  const unsubs = firebaseUnsubs;

  registerUser(userUid, unsubs);
  registerReceipts(userUid, unsubs);
  registerWarranties(userUid, unsubs);
  registerHubs(userUid, unsubs);
  registerMerchants(userUid, unsubs);
  registerReminders(userUid, unsubs);
  registerAttention(userUid, unsubs);
  registerWork(userUid, unsubs);
  registerStores(userUid, unsubs);
  registerCache(userUid, unsubs);
  registerAI(userUid, unsubs);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function startSyncListener(userUid) {
  if (!userUid) return;
  setUidActive(String(userUid));
  startFirebaseListeners(String(userUid));
  startNetListener();
  runSyncCycle().catch(() => {});
}

export function stopSyncListener() {
  teardown();
}

export async function syncPendingAttachments() {
  return _syncAttachments();
}

// Re-export for any direct callers in the codebase
export { runSyncCycle };

// Phase 4: expose pending count for UI badges / useSyncStatus hook
export { countPendingJobs } from "./queueService";