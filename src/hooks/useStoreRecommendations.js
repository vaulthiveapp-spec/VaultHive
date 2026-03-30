/**
 * useStoreRecommendations
 *
 * Central hook for the Stores section.
 *
 * Scoring model (applied in repoStores.listStoresScored):
 *   +5  store is in user favorites
 *   +4  store matches a top spend category
 *   +3  verified store
 *   +2  matches active category filter
 *   +1–3 bonus for avg_rating > 4.0
 *
 * Context is built from the ai_context_cache (30-min TTL) so the
 * recommendation reasons stay coherent with what the AI assistant shows.
 *
 * Exposes three named sections for the UI:
 *   forYou       — top-scored stores personalised to this user
 *   favorites    — user's saved stores
 *   byCategory   — all stores filtered to the active category tab
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  listStoresScored,
  listFavoriteStores,
  setFavoriteStore,
  listCities,
} from "../services/repo/repoStores";
import { getAIContextCache } from "../services/repo/repoCache";
import { toggleFavoriteStoreOffline } from "../services/offlineActions";

const CACHE_MS = 60 * 1000; // 1-min local cache so tab switches don't re-query

export function useStoreRecommendations() {
  const { user } = useAuth();
  const uid = user?.uid;

  // ── State ─────────────────────────────────────────────────────────────────
  const [forYou,      setForYou]      = useState([]);
  const [favorites,   setFavorites]   = useState([]);
  const [byCategory,  setByCategory]  = useState([]);
  const [cities,      setCities]      = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);

  // Filter state
  const [categoryFilter, setCategoryFilter] = useState(null);   // null = all
  const [cityFilter,     setCityFilter]     = useState(null);
  const [query,          setQuery]          = useState("");

  const mountedRef   = useRef(true);
  const lastLoadRef  = useRef(0);
  const contextRef   = useRef(null);

  // ── Pull user context (top spend categories + favorite IDs) ──────────────

  const loadContext = useCallback(async () => {
    if (!uid) return { topCategories: [], favoriteIds: [] };
    try {
      const cached = await getAIContextCache(uid);
      if (cached) {
        const topCategories = cached.spending_summary?.top_categories || [];
        const favoriteIds   = (cached.favorite_stores || []).map((s) => String(s.store_id));
        contextRef.current  = { topCategories, favoriteIds };
        return contextRef.current;
      }
    } catch {}
    return contextRef.current || { topCategories: [], favoriteIds: [] };
  }, [uid]);

  // ── Main load ────────────────────────────────────────────────────────────

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!uid) { setLoading(false); return; }

    const now = Date.now();
    // Only apply the 1-min cache on the unfiltered "All" view.
    // Any active filter (category, city, text search) must always query SQLite fresh.
    const isFiltered = !!categoryFilter || !!cityFilter || !!query;
    if (!silent && !isFiltered && now - lastLoadRef.current < CACHE_MS && forYou.length > 0) return;
    lastLoadRef.current = now;

    if (!silent) setLoading(true);

    try {
      const ctx = await loadContext();

      // Parallel: for-you scored list + favorites + cities
      const [scored, favs, cityList] = await Promise.all([
        listStoresScored(uid, {
          topCategories:  ctx.topCategories,
          favoriteIds:    ctx.favoriteIds,
          categoryFilter: categoryFilter || null,
          cityFilter:     cityFilter     || null,
          query:          query          || "",
          limit: 200,
        }),
        listFavoriteStores(uid, 60),
        listCities(),
      ]);

      if (!mountedRef.current) return;

      // For-you: top 8 by score excluding pure search/filter results
      const forYouRows = !categoryFilter && !cityFilter && !query
        ? scored.slice(0, 8)
        : scored;

      // By-category: full filtered result
      const byCatRows = scored;

      // Merge is_favorite flag from fresh favorites query into forYou rows
      const favIdSet = new Set((favs || []).map((f) => String(f.store_id)));
      const merged   = forYouRows.map((s) => ({
        ...s,
        is_favorite: favIdSet.has(String(s.store_id)),
      }));
      const favsMerged = (favs || []).map((s) => ({
        ...s,
        is_favorite: true,
        score: (s.score || 0) + 5,
        recommendation_reason: "In your saved stores",
      }));

      setForYou(merged);
      setFavorites(favsMerged);
      setByCategory(byCatRows.map((s) => ({ ...s, is_favorite: favIdSet.has(String(s.store_id)) })));
      setCities(cityList || []);
    } catch {
      // Non-fatal — show empty state
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [uid, categoryFilter, cityFilter, query, loadContext, forYou.length]);

  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => { mountedRef.current = false; };
  }, [load]);

  // ── Refresh (pull-to-refresh) ────────────────────────────────────────────

  const refresh = useCallback(async () => {
    setRefreshing(true);
    lastLoadRef.current = 0; // force reload
    await load({ silent: true });
  }, [load]);

  // ── Toggle favorite (optimistic) ─────────────────────────────────────────

  const toggleFavorite = useCallback(async (store) => {
    if (!uid) return;
    const storeId = String(store.store_id);
    const nextOn  = !store.is_favorite;

    // Optimistic update across all sections
    const patch = (rows) =>
      rows.map((s) => String(s.store_id) === storeId ? { ...s, is_favorite: nextOn } : s);

    setForYou(patch);
    setByCategory(patch);

    if (nextOn) {
      setFavorites((prev) => {
        const already = prev.some((s) => String(s.store_id) === storeId);
        if (already) return patch(prev);
        return [{ ...store, is_favorite: true, recommendation_reason: "In your saved stores" }, ...prev];
      });
    } else {
      setFavorites((prev) => prev.filter((s) => String(s.store_id) !== storeId));
    }

    try {
      await toggleFavoriteStoreOffline(uid, storeId, nextOn);
    } catch {
      // Revert on failure
      const revert = (rows) =>
        rows.map((s) => String(s.store_id) === storeId ? { ...s, is_favorite: !nextOn } : s);
      setForYou(revert);
      setByCategory(revert);
      if (nextOn) setFavorites((prev) => prev.filter((s) => String(s.store_id) !== storeId));
      else {
        setFavorites((prev) => {
          const already = prev.some((s) => String(s.store_id) === storeId);
          if (already) return prev;
          return [{ ...store, is_favorite: false }, ...prev];
        });
      }
    }
  }, [uid]);

  // ── Clear filters ────────────────────────────────────────────────────────

  const clearFilters = useCallback(() => {
    setCategoryFilter(null);
    setCityFilter(null);
    setQuery("");
  }, []);

  return {
    // Data
    forYou,
    favorites,
    byCategory,
    cities,

    // UI state
    loading,
    refreshing,

    // Filters
    categoryFilter,
    cityFilter,
    query,
    setCategoryFilter,
    setCityFilter,
    setQuery,
    clearFilters,

    // Actions
    toggleFavorite,
    refresh,
    reload: load,
  };
}

export default useStoreRecommendations;
