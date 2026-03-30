// ---------------------------------------------------------------------------
// queueService.js — compatibility shim
//
// All sync-queue logic lives in src/services/repo/repoSync.js.
// This file re-exports the full surface so existing imports:
//
//   import { enqueueUpdates } from "./queueService"
//
// continue to work without modification.
// ---------------------------------------------------------------------------
export {
  enqueueUpdates,
  getPendingQueue,
  markQueueDone,
  markQueueFailed,
  clearDoneQueue,
  clearStaleQueue,
  getQueueStats,
  countPendingJobs,
  resetNetworkFailedJobs,
} from "./repo/repoSync";
