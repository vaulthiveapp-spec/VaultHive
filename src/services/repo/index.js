// ---------------------------------------------------------------------------
// repo/index.js — single re-export barrel for the entire local data layer.
//
// Every function that was previously in localRepo.js is exported from here.
// localRepo.js re-exports from this file, so all existing imports of the form:
//
//   import { listReceipts, getWarranty } from "../services/localRepo"
//
// continue to work without any changes to callers.
//
// New code should import directly from the domain module:
//
//   import { listHubs } from "../services/repo/repoHubs"
// ---------------------------------------------------------------------------

// ── Identity & settings
export {
  upsertUser,
  getUser,
  upsertUserSettings,
  getUserSettings,
  getBaseCurrency,
  replaceUserCategories,
  listUserCategories,
  replaceUserTags,
  listUserTags,
  upsertCategoryDefault,
  upsertTagDefault,
  upsertRequirementCategory,
  listRequirementCategories,
  upsertCurrency,
} from "./repoUser";

// ── Receipts, line items, attachments
export {
  listReceipts,
  listReceiptIds,
  getReceipt,
  upsertReceipt,
  upsertReceiptServer,
  softDeleteReceipt,
  markReceiptSynced,
  listAvailableMonths,
  computeMonthlyReport,
  computeFullReport,
  replaceReceiptItems,
  replaceReceiptTags,
  linkReceiptAttachments,
  upsertAttachment,
  listPendingAttachments,
} from "./repoReceipts";

// ── Warranties
export {
  listWarranties,
  listWarrantyIds,
  getWarranty,
  upsertWarranty,
  upsertWarrantyServer,
  linkWarrantyAttachments,
  softDeleteWarranty,
  markWarrantySynced,
} from "./repoWarranties";

// ── Purchase hubs (v3)
export {
  upsertHub,
  upsertHubServer,
  getHub,
  getHubDetail,
  listHubs,
  listHubsFiltered,
  listHubsByStatus,
  listPendingHubs,
  softDeleteHub,
  markHubSynced,
  reconcileHubs,
} from "./repoHubs";

// ── Merchants (v3) + legacy vendors
export {
  upsertMerchant,
  getMerchant,
  listMerchants,
  upsertMerchantAlias,
  resolveMerchantByName,
  upsertVendorServer,
  listVendors,
} from "./repoMerchants";

// ── Reminders & notifications
export {
  listUpcomingReminders,
  upsertReminderServer,
  upsertReminder,
  softDeleteReminder,
  markReminderSynced,
  listNotifications,
  countUnreadNotifications,
  upsertNotificationServer,
  markNotificationRead,
  markNotificationSynced,
} from "./repoReminders";

// ── Attention items (v3)
export {
  upsertAttentionItem,
  listAttentionItems,
  countOpenAttentionItems,
  dismissAttentionItem,
  reconcileAttentionItems,
} from "./repoAttention";

// ── Service history & claims (v3)
export {
  upsertServiceRecord,
  upsertServiceRecordServer,
  listServiceHistory,
  softDeleteServiceRecord,
  markServiceRecordSynced,
  upsertClaim,
  upsertClaimServer,
  listClaims,
  softDeleteClaim,
  markClaimSynced,
} from "./repoWork";

// ── AI conversations & messages (v3)
export {
  upsertConversation,
  getConversation,
  listConversations,
  archiveConversation,
  updateConversationPreview,
  upsertMessage,
  listMessages,
  getLastMessages,
} from "./repoAI";

// ── Generated exports (v3)
export {
  upsertExport,
  listExports,
  getExport,
  listExportsByHub,
} from "./repoExports";

// ── Local cache (v3)
export {
  cacheKey,
  setCacheEntry,
  getCacheEntry,
  deleteCacheEntry,
  clearUserCache,
  setHomeCache,
  getHomeCache,
  setReportSummary,
  getReportSummary,
  setAIContextCache,
  getAIContextCache,
} from "./repoCache";

// ── Stores, reviews, favorites
export {
  upsertStoreServer,
  replaceStoresByCategory,
  listStores,
  listStoresScored,
  listCities,
  getStoreDetails,
  upsertStoreReviewServer,
  upsertStoreReviewStatsServer,
  getStoreReviewStats,
  replaceUserFavoriteStores,
  setFavoriteStore,
  listFavoriteStores,
} from "./repoStores";

// ── Sync outbox
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
} from "./repoSync";
