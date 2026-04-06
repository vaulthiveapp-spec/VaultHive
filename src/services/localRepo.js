// ---------------------------------------------------------------------------
// localRepo.js — compatibility shim
//
// All logic has moved to src/services/repo/*.js
// This file re-exports the entire public surface so every existing import:
//
//   import { listReceipts } from "../services/localRepo"
//
// continues to resolve without modification.
//
// New code should import from the domain module directly, e.g.:
//   import { listHubs } from "./repo/repoHubs"
// ---------------------------------------------------------------------------
export * from "./repo/index";
