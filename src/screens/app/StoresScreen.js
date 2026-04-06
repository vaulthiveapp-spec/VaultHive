/**
 * StoresScreen — Phase 10
 *
 * Recommendation-first store discovery.
 *
 * Layout:
 *   Header (search + city pill)
 *   Category tab rail
 *   ─── When no filter active ───
 *   "For You" horizontal cards (top-scored)
 *   "Saved Stores" horizontal cards (favorites)
 *   "All Stores" vertical list
 *   ─── When filter active ───
 *   Filtered vertical list with match badges
 */

import React, { useCallback, useMemo } from "react";
import {
  Animated,
  FlatList,
  Image,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";

import useStoreRecommendations from "../../hooks/useStoreRecommendations";
import { getStoreCoverSource, getStoreCategoryLabel } from "../../utils/storeCovers";
import Input from "../../components/Input";
import { VaultColors, VaultRadius, VaultShadows, VaultSpacing } from "../../styles/DesignSystem";
// Bring in responsive helpers for scaling dimensions and fonts. Without
// these imports, the `scale` and `getFontSize` functions used throughout
// this screen would be undefined, causing runtime errors.
import { scale, getFontSize } from "../../utils/responsive";

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORY_TABS = [
  { key: null,          label: "All",         icon: "grid-outline" },
  { key: "electronics", label: "Electronics", icon: "phone-portrait-outline" },
  { key: "fashion",     label: "Fashion",     icon: "shirt-outline" },
  { key: "groceries",   label: "Groceries",   icon: "basket-outline" },
  { key: "home",        label: "Home",        icon: "home-outline" },
  { key: "pharmacy",    label: "Pharmacy",    icon: "medkit-outline" },
  { key: "office",      label: "Office",      icon: "briefcase-outline" },
  { key: "books",       label: "Books",       icon: "book-outline" },
  { key: "baby",        label: "Baby",        icon: "happy-outline" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ratingStars(rating) {
  const r = Math.round(Math.max(0, Math.min(5, Number(rating || 0))));
  return "★".repeat(r) + "☆".repeat(5 - r);
}

// ─── Featured / For-You card (horizontal scroll) ─────────────────────────────

const FeaturedCard = ({ item, onPress, onToggleFavorite }) => {
  const cover  = getStoreCoverSource(item);
  const rating = Number(item?.avg_rating || 0);

  return (
    <TouchableOpacity
      style={styles.featuredCard}
      activeOpacity={0.88}
      onPress={onPress}
    >
      <View style={styles.featuredImageWrap}>
        <Image source={cover} style={styles.featuredImage} resizeMode="cover" />
        <LinearGradient
          colors={["transparent", "rgba(30,14,2,0.72)"]}
          style={styles.featuredGradient}
        />

        {/* Heart */}
        <TouchableOpacity
          style={styles.featuredHeart}
          activeOpacity={0.85}
          onPress={onToggleFavorite}
        >
          <Ionicons
            name={item?.is_favorite ? "heart" : "heart-outline"}
            size={scale(16)}
            color={item?.is_favorite ? "#E55A5A" : "#FEF7E6"}
          />
        </TouchableOpacity>

        {/* Bottom name row */}
        <View style={styles.featuredBottom}>
          <Text style={styles.featuredName} numberOfLines={1}>{item?.name}</Text>
          {rating > 0 ? (
            <View style={styles.featuredRating}>
              <Ionicons name="star" size={scale(10)} color="#F6D586" />
              <Text style={styles.featuredRatingText}>{rating.toFixed(1)}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Reason chip */}
      {!!item?.recommendation_reason ? (
        <View style={styles.featuredReason}>
          <Ionicons name="sparkles-outline" size={scale(11)} color={VaultColors.brandGoldDark} />
          <Text style={styles.featuredReasonText} numberOfLines={1}>
            {item.recommendation_reason}
          </Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
};

// ─── Compact favorite card (horizontal scroll) ───────────────────────────────

const FavCard = ({ item, onPress, onToggleFavorite }) => {
  const cover  = getStoreCoverSource(item);
  const rating = Number(item?.avg_rating || 0);

  return (
    <TouchableOpacity style={styles.favCard} activeOpacity={0.88} onPress={onPress}>
      <View style={styles.favImageWrap}>
        <Image source={cover} style={styles.favImage} resizeMode="cover" />
        <TouchableOpacity
          style={styles.favHeart}
          activeOpacity={0.85}
          onPress={onToggleFavorite}
        >
          <Ionicons name="heart" size={scale(14)} color="#E55A5A" />
        </TouchableOpacity>
      </View>
      <Text style={styles.favName} numberOfLines={1}>{item?.name}</Text>
      {rating > 0 ? (
        <Text style={styles.favRating}>{"★".repeat(Math.round(rating))} {rating.toFixed(1)}</Text>
      ) : null}
    </TouchableOpacity>
  );
};

// ─── Vertical list card ───────────────────────────────────────────────────────

const StoreRow = ({ item, onPress, onToggleFavorite }) => {
  const cover    = getStoreCoverSource(item);
  const catLabel = getStoreCategoryLabel(item);
  const rating   = Number(item?.avg_rating || 0);
  const reviews  = Number(item?.review_count || item?.count || 0);

  return (
    <TouchableOpacity style={styles.storeRow} activeOpacity={0.87} onPress={onPress}>
      <View style={styles.storeRowThumb}>
        <Image source={cover} style={styles.storeRowImage} resizeMode="cover" />
        {Number(item?.verified || 0) ? (
          <View style={styles.verifiedDot}>
            <Ionicons name="checkmark" size={scale(8)} color="#fff" />
          </View>
        ) : null}
      </View>

      <View style={styles.storeRowBody}>
        <View style={styles.storeRowTitleRow}>
          <Text style={styles.storeRowName} numberOfLines={1}>{item?.name}</Text>
          <TouchableOpacity onPress={onToggleFavorite} activeOpacity={0.8} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons
              name={item?.is_favorite ? "heart" : "heart-outline"}
              size={scale(16)}
              color={item?.is_favorite ? "#E55A5A" : VaultColors.textMuted}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.storeRowMeta}>
          {!!catLabel ? <Text style={styles.storeRowCat}>{catLabel}</Text> : null}
          {!!item?.city ? (
            <>
              <Text style={styles.storeRowDot}>·</Text>
              <Text style={styles.storeRowCity}>{item.city}</Text>
            </>
          ) : null}
        </View>

        {!!item?.recommendation_reason ? (
          <View style={styles.storeRowReason}>
            <Ionicons name="sparkles-outline" size={scale(10)} color={VaultColors.brandGold} />
            <Text style={styles.storeRowReasonText} numberOfLines={1}>
              {item.recommendation_reason}
            </Text>
          </View>
        ) : null}

        <View style={styles.storeRowBottomRow}>
          {rating > 0 ? (
            <View style={styles.storeRowRatingPill}>
              <Ionicons name="star" size={scale(10)} color={VaultColors.warning} />
              <Text style={styles.storeRowRatingText}>{rating.toFixed(1)}</Text>
              {reviews > 0 ? <Text style={styles.storeRowReviewCount}>({reviews})</Text> : null}
            </View>
          ) : null}
        </View>
      </View>

      <Ionicons name="chevron-forward" size={scale(15)} color={VaultColors.textMuted} />
    </TouchableOpacity>
  );
};

// ─── Section header ───────────────────────────────────────────────────────────

const SectionHeader = ({ title, subtitle, onSeeAll }) => (
  <View style={styles.sectionHeader}>
    <View style={{ flex: 1 }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {!!subtitle ? <Text style={styles.sectionSub}>{subtitle}</Text> : null}
    </View>
    {onSeeAll ? (
      <TouchableOpacity onPress={onSeeAll} activeOpacity={0.8}>
        <Text style={styles.seeAll}>See all</Text>
      </TouchableOpacity>
    ) : null}
  </View>
);

// ─── Empty state ──────────────────────────────────────────────────────────────

const Empty = ({ message }) => (
  <View style={styles.empty}>
    <Ionicons name="storefront-outline" size={scale(28)} color={VaultColors.textMuted} />
    <Text style={styles.emptyText}>{message || "No stores found"}</Text>
  </View>
);

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function StoresScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const {
    forYou, favorites, byCategory,
    loading, refreshing,
    categoryFilter, query,
    setCategoryFilter, setQuery,
    toggleFavorite, refresh, reload,
  } = useStoreRecommendations();

  const isFiltered = !!categoryFilter || !!query;

  // Reload when navigating back to the screen (e.g. after toggling a favorite
  // on StoreDetailsScreen or returning from another tab).
  useFocusEffect(useCallback(() => { reload({ silent: true }); }, [reload]));

  const navigate = (storeId) => navigation.navigate("StoreDetails", { storeId });

  // ─── Render helpers ─────────────────────────────────────────────────────

  const renderFeatured = useCallback(({ item }) => (
    <FeaturedCard
      item={item}
      onPress={() => navigate(item.store_id)}
      onToggleFavorite={() => toggleFavorite(item)}
    />
  ), [toggleFavorite]);

  const renderFav = useCallback(({ item }) => (
    <FavCard
      item={item}
      onPress={() => navigate(item.store_id)}
      onToggleFavorite={() => toggleFavorite(item)}
    />
  ), [toggleFavorite]);

  const renderRow = useCallback(({ item }) => (
    <StoreRow
      item={item}
      onPress={() => navigate(item.store_id)}
      onToggleFavorite={() => toggleFavorite(item)}
    />
  ), [toggleFavorite]);

  // ─── Main list sections ──────────────────────────────────────────────────

  const ListHeader = useMemo(() => (
    <View>
      {/* Category tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsScroll}
        contentContainerStyle={styles.tabsContent}
      >
        {CATEGORY_TABS.map((tab) => {
          const active = tab.key === null ? !categoryFilter : categoryFilter === tab.key;
          return (
            <TouchableOpacity
              key={String(tab.key ?? "all")}
              style={[styles.catTab, active && styles.catTabActive]}
              activeOpacity={0.82}
              onPress={() => setCategoryFilter(tab.key)}
            >
              <Ionicons
                name={tab.icon}
                size={scale(15)}
                color={active ? "#FEF7E6" : VaultColors.brandGoldDark}
              />
              <Text style={[styles.catTabLabel, active && styles.catTabLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* For You section — only when no filter */}
      {!isFiltered && forYou.length > 0 ? (
        <>
          <SectionHeader
            title="For You"
            subtitle="Personalised to your spending patterns"
          />
          <FlatList
            data={forYou}
            keyExtractor={(item) => String(item.store_id)}
            renderItem={renderFeatured}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
          />
        </>
      ) : null}

      {/* Saved stores section — only when no filter and has favorites */}
      {!isFiltered && favorites.length > 0 ? (
        <>
          <SectionHeader
            title="Saved Stores"
            subtitle={`${favorites.length} store${favorites.length !== 1 ? "s" : ""} saved`}
          />
          <FlatList
            data={favorites}
            keyExtractor={(item) => String(item.store_id)}
            renderItem={renderFav}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
          />
        </>
      ) : null}

      {/* Section header for main list */}
      <SectionHeader
        title={isFiltered ? (categoryFilter
          ? `${CATEGORY_TABS.find((t) => t.key === categoryFilter)?.label || categoryFilter} Stores`
          : "Search Results")
          : "All Stores"}
        subtitle={isFiltered ? `${byCategory.length} result${byCategory.length !== 1 ? "s" : ""}` : null}
      />
    </View>
  ), [isFiltered, forYou, favorites, byCategory.length, categoryFilter, renderFeatured, renderFav, setCategoryFilter]);

  const listData = isFiltered ? byCategory : byCategory;

  return (
    <SafeAreaView style={styles.root} edges={["bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor={VaultColors.appBackground} />

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>Stores</Text>
            <Text style={styles.headerSub}>Discover · Save · Shop smarter</Text>
          </View>
          <TouchableOpacity
            style={styles.aiBtn}
            activeOpacity={0.85}
            onPress={() => navigation.navigate("AIAssistant")}
          >
            <Ionicons name="sparkles-outline" size={scale(18)} color={VaultColors.brandGoldDark} />
          </TouchableOpacity>
        </View>

        {/* Search bar */}
        <Input
          placeholder="Search stores…"
          leftIcon="search"
          value={query}
          onChangeText={setQuery}
          style={styles.searchWrap}
          inputStyle={styles.searchInput}
          suffix={!!query ? (
            <TouchableOpacity onPress={() => setQuery("")} activeOpacity={0.8}>
              <Ionicons name="close-circle" size={scale(17)} color={VaultColors.textMuted} />
            </TouchableOpacity>
          ) : null}
        />
      </View>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <FlatList
        data={listData}
        keyExtractor={(item) => String(item.store_id)}
        renderItem={renderRow}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={
          loading ? null : (
            <Empty message={
              isFiltered
                ? "No stores match this filter."
                : "No stores available yet. Check back after sync."
            } />
          )
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: scale(32) },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={VaultColors.brandGold}
            colors={[VaultColors.brandGold]}
          />
        }
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:  { flex: 1, backgroundColor: VaultColors.appBackground },

  // Header
  header: {
    paddingHorizontal: VaultSpacing.screenPadding,
    paddingBottom: scale(12),
    backgroundColor: VaultColors.appBackground,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: scale(14),
  },
  headerTitle: {
    fontSize: getFontSize(28),
    fontWeight: "900",
    color: VaultColors.textPrimary,
    letterSpacing: -0.6,
  },
  headerSub: {
    fontSize: getFontSize(12),
    fontWeight: "600",
    color: VaultColors.textMuted,
    marginTop: scale(2),
  },
  aiBtn: {
    width: scale(42),
    height: scale(42),
    borderRadius: scale(14),
    backgroundColor: VaultColors.brandGoldSoft,
    borderWidth: 1,
    borderColor: VaultColors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  searchWrap: { marginTop: scale(8) },
  searchInput: { fontSize: getFontSize(14), fontWeight: "600" },

  // Category tabs
  tabsScroll:   { marginBottom: scale(4) },
  tabsContent:  { paddingHorizontal: VaultSpacing.screenPadding, paddingVertical: scale(10), gap: scale(8) },
  catTab: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(5),
    paddingHorizontal: scale(12),
    paddingVertical: scale(7),
    borderRadius: scale(20),
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: VaultColors.border,
  },
  catTabActive: {
    backgroundColor: VaultColors.brown,
    borderColor: VaultColors.brown,
  },
  catTabLabel: {
    fontSize: getFontSize(12),
    fontWeight: "700",
    color: VaultColors.textSecondary,
  },
  catTabLabelActive: {
    color: "#FEF7E6",
  },

  // Section headers
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: VaultSpacing.screenPadding,
    marginTop: scale(18),
    marginBottom: scale(12),
  },
  sectionTitle: {
    fontSize: getFontSize(18),
    fontWeight: "900",
    color: VaultColors.textPrimary,
    letterSpacing: -0.3,
  },
  sectionSub: {
    fontSize: getFontSize(11),
    fontWeight: "600",
    color: VaultColors.textMuted,
    marginTop: scale(2),
  },
  seeAll: {
    fontSize: getFontSize(12),
    fontWeight: "700",
    color: VaultColors.brandGoldDark,
  },

  // Featured card
  horizontalList:  { paddingHorizontal: VaultSpacing.screenPadding, gap: scale(12) },
  featuredCard: {
    width: scale(180),
  },
  featuredImageWrap: {
    height: scale(160),
    borderRadius: scale(20),
    overflow: "hidden",
    marginBottom: scale(8),
  },
  featuredImage:    { width: "100%", height: "100%" },
  featuredGradient: { ...StyleSheet.absoluteFillObject },
  featuredHeart: {
    position: "absolute",
    top: scale(10),
    right: scale(10),
    width: scale(30),
    height: scale(30),
    borderRadius: scale(15),
    backgroundColor: "rgba(0,0,0,0.28)",
    alignItems: "center",
    justifyContent: "center",
  },
  featuredBottom: {
    position: "absolute",
    bottom: scale(10),
    left: scale(10),
    right: scale(10),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  featuredName: {
    flex: 1,
    fontSize: getFontSize(14),
    fontWeight: "800",
    color: "#FEF7E6",
    letterSpacing: -0.2,
  },
  featuredRating: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(3),
    backgroundColor: "rgba(0,0,0,0.35)",
    paddingHorizontal: scale(6),
    paddingVertical: scale(3),
    borderRadius: scale(10),
  },
  featuredRatingText: {
    fontSize: getFontSize(10),
    fontWeight: "800",
    color: "#F6D586",
  },
  featuredReason: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(4),
  },
  featuredReasonText: {
    flex: 1,
    fontSize: getFontSize(11),
    fontWeight: "600",
    color: VaultColors.textSecondary,
  },

  // Favorite card
  favCard: {
    width: scale(110),
  },
  favImageWrap: {
    height: scale(110),
    borderRadius: scale(16),
    overflow: "hidden",
    marginBottom: scale(6),
    borderWidth: 1,
    borderColor: VaultColors.border,
  },
  favImage: { width: "100%", height: "100%" },
  favHeart: {
    position: "absolute",
    top: scale(6),
    right: scale(6),
    width: scale(24),
    height: scale(24),
    borderRadius: scale(12),
    backgroundColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  favName: {
    fontSize: getFontSize(12),
    fontWeight: "800",
    color: VaultColors.textPrimary,
    textAlign: "center",
  },
  favRating: {
    fontSize: getFontSize(10),
    fontWeight: "600",
    color: VaultColors.warning,
    textAlign: "center",
    marginTop: scale(2),
  },

  // Vertical store row
  listContent:  { paddingBottom: scale(20) },
  separator:    { height: 1, marginHorizontal: VaultSpacing.screenPadding, backgroundColor: VaultColors.divider },
  storeRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: VaultSpacing.screenPadding,
    paddingVertical: scale(12),
    gap: scale(12),
  },
  storeRowThumb: {
    width: scale(58),
    height: scale(58),
    borderRadius: scale(14),
    overflow: "hidden",
    borderWidth: 1,
    borderColor: VaultColors.border,
    flexShrink: 0,
  },
  storeRowImage: { width: "100%", height: "100%" },
  verifiedDot: {
    position: "absolute",
    bottom: scale(3),
    right: scale(3),
    width: scale(14),
    height: scale(14),
    borderRadius: scale(7),
    backgroundColor: VaultColors.success,
    alignItems: "center",
    justifyContent: "center",
  },
  storeRowBody:     { flex: 1, minWidth: 0 },
  storeRowTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: scale(6) },
  storeRowName: {
    flex: 1,
    fontSize: getFontSize(15),
    fontWeight: "800",
    color: VaultColors.textPrimary,
    letterSpacing: -0.2,
  },
  storeRowMeta:   { flexDirection: "row", alignItems: "center", marginTop: scale(2), gap: scale(4) },
  storeRowCat:    { fontSize: getFontSize(11), fontWeight: "600", color: VaultColors.textMuted, textTransform: "capitalize" },
  storeRowDot:    { fontSize: getFontSize(11), color: VaultColors.textMuted },
  storeRowCity:   { fontSize: getFontSize(11), fontWeight: "600", color: VaultColors.textMuted },
  storeRowReason: { flexDirection: "row", alignItems: "center", gap: scale(4), marginTop: scale(3) },
  storeRowReasonText: { flex: 1, fontSize: getFontSize(11), fontWeight: "600", color: VaultColors.brandGold },
  storeRowBottomRow:  { flexDirection: "row", alignItems: "center", marginTop: scale(4) },
  storeRowRatingPill: { flexDirection: "row", alignItems: "center", gap: scale(3) },
  storeRowRatingText: { fontSize: getFontSize(11), fontWeight: "700", color: VaultColors.textSecondary },
  storeRowReviewCount:{ fontSize: getFontSize(10), fontWeight: "600", color: VaultColors.textMuted },

  // Empty
  empty:     { marginTop: scale(40), alignItems: "center", gap: scale(8) },
  emptyText: { fontSize: getFontSize(13), fontWeight: "700", color: VaultColors.textMuted, textAlign: "center", paddingHorizontal: scale(24) },
});
