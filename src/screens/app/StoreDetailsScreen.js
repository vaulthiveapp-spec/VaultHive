/**
 * StoreDetailsScreen — Phase 10
 *
 * Premium store detail view.
 *
 * Sections:
 *   Hero image + name + verified badge
 *   Quick stats bar (rating · review count · city)
 *   AI Review Summary (review_summary from Firebase)
 *   Star breakdown bar chart
 *   Categories chips
 *   Community reviews (up to 20)
 *   Sticky CTA: Visit website / Write review / Favorite
 */

import React, { useCallback, useMemo, useState } from "react";
import {
  Image,
  Linking,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";

import { useAuth } from "../../context/AuthContext";
import { useAlert } from "../../components/AlertProvider";
import { getStoreDetails } from "../../services/repo/repoStores";
import { toggleFavoriteStoreOffline } from "../../services/offlineActions";
import { getStoreCoverSource } from "../../utils/storeCovers";
import { scale, getFontSize, getSpacing, verticalScale } from "../../utils/responsive";
import { VaultColors, VaultShadows, VaultSpacing } from "../../styles/DesignSystem";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function starBreakdown(reviews = []) {
  const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  for (const r of reviews) {
    const v = Math.round(Math.max(1, Math.min(5, Number(r.rating || 0))));
    counts[v] = (counts[v] || 0) + 1;
  }
  return counts;
}

function parseCategories(store) {
  const obj = store?.categories || {};
  if (typeof obj === "object" && !Array.isArray(obj)) return Object.keys(obj).filter((k) => !!obj[k]);
  if (Array.isArray(obj)) return obj.filter(Boolean);
  return [];
}

function formatDate(ts) {
  if (!ts) return "";
  try {
    const d = new Date(typeof ts === "number" ? ts : Number(ts));
    return d.toLocaleDateString("en-SA", { month: "short", day: "numeric", year: "numeric" });
  } catch { return ""; }
}

const AVATAR_COLORS = ["#C9973A", "#5B3B1F", "#18A957", "#2E6BD8", "#D64545", "#8A5509"];
function avatarColor(uid = "") {
  const n = String(uid).split("").reduce((s, c) => s + c.charCodeAt(0), 0);
  return AVATAR_COLORS[n % AVATAR_COLORS.length];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const StatPill = ({ icon, value, label }) => (
  <View style={styles.statPill}>
    <Ionicons name={icon} size={scale(14)} color={VaultColors.brandGold} />
    <Text style={styles.statValue}>{value}</Text>
    {!!label ? <Text style={styles.statLabel}>{label}</Text> : null}
  </View>
);

const StarBar = ({ star, count, total }) => {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <View style={styles.starBarRow}>
      <Text style={styles.starBarNum}>{star}</Text>
      <Ionicons name="star" size={scale(10)} color={VaultColors.warning} />
      <View style={styles.starBarTrack}>
        <View style={[styles.starBarFill, { width: `${pct}%` }]} />
      </View>
      <Text style={styles.starBarCount}>{count}</Text>
    </View>
  );
};

const ReviewCard = ({ item }) => {
  const author = String(item?.uid || "vh").slice(-4).toUpperCase();
  const color  = avatarColor(item?.uid || "");
  const rating = Number(item?.rating || 0);
  const stars  = "★".repeat(Math.round(rating)) + "☆".repeat(5 - Math.round(rating));

  return (
    <View style={styles.reviewCard}>
      <View style={styles.reviewTopRow}>
        <View style={[styles.reviewAvatar, { backgroundColor: color }]}>
          <Text style={styles.reviewAvatarText}>{author}</Text>
        </View>
        <View style={styles.reviewMeta}>
          <Text style={styles.reviewAuthor}>VaultHive member</Text>
          <Text style={styles.reviewDate}>{formatDate(item?.created_at)}</Text>
        </View>
        <View style={styles.reviewStarRow}>
          <Text style={styles.reviewStars}>{stars}</Text>
          <Text style={styles.reviewRatingNum}>{rating.toFixed(1)}</Text>
        </View>
      </View>
      {!!item?.comment ? (
        <Text style={styles.reviewComment}>{item.comment}</Text>
      ) : null}
    </View>
  );
};

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function StoreDetailsScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const alert   = useAlert();
  const uid     = user?.uid;
  const storeId = route?.params?.storeId;

  const [data,      setData]      = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [isFav,     setIsFav]     = useState(false);
  const [toggling,  setToggling]  = useState(false);

  const load = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const next = await getStoreDetails(storeId, uid);
      if (next) {
        setData(next);
        setIsFav(!!next.is_favorite);
      }
    } catch {
      alert?.error?.("Error", "Could not load store.");
    } finally {
      setLoading(false);
    }
  }, [storeId, uid, alert]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleToggleFav = useCallback(async () => {
    if (!uid || toggling) return;
    setToggling(true);
    const nextOn = !isFav;
    setIsFav(nextOn);
    try {
      await toggleFavoriteStoreOffline(uid, storeId, nextOn);
    } catch {
      setIsFav(!nextOn);
      alert?.error?.("Error", "Could not update favorite.");
    } finally {
      setToggling(false);
    }
  }, [uid, storeId, isFav, toggling, alert]);

  const handleVisit = useCallback(async () => {
    const url = data?.store?.url;
    if (!url) return;
    try {
      const ok = await Linking.canOpenURL(url);
      if (ok) Linking.openURL(url);
    } catch {}
  }, [data?.store?.url]);

  const handleReview = useCallback(() => {
    navigation.navigate("AddReview", { storeId });
  }, [navigation, storeId]);

  const store    = data?.store    || {};
  const stats    = data?.stats    || {};
  const reviews  = data?.reviews  || [];
  const cover    = getStoreCoverSource(store);
  const cats     = parseCategories(store);
  const rating   = Number(stats.avg_rating || 0);
  const revCount = Number(stats.review_count || stats.count || 0);
  const breakdown= useMemo(() => starBreakdown(reviews), [reviews]);
  const totalBD  = reviews.length;
  const hasUrl   = !!store?.url;
  const hasSummary = !!stats.review_summary;

  if (loading) {
    return (
      <SafeAreaView style={styles.root} edges={["bottom"]}>
        <View style={styles.loadingState}>
          <Text style={styles.loadingText}>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={["bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor="#3D2208" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: getSpacing(100) }}
      >
        {/* ── Hero ──────────────────────────────────────────────────── */}
        <View style={styles.hero}>
          <Image source={cover} style={styles.heroImage} resizeMode="cover" />
          <LinearGradient
            colors={["rgba(20,8,0,0.15)", "rgba(20,8,0,0.72)"]}
            style={StyleSheet.absoluteFill}
          />

          {/* Back + favorite */}
          <View style={[styles.heroNav, { paddingTop: insets.top + getSpacing(10) }]}>
            <TouchableOpacity style={styles.heroBtn} onPress={() => navigation.goBack()} activeOpacity={0.85}>
              <Ionicons name="chevron-back" size={scale(22)} color="#FEF7E6" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.heroBtn} onPress={handleToggleFav} activeOpacity={0.85}>
              <Ionicons
                name={isFav ? "heart" : "heart-outline"}
                size={scale(20)}
                color={isFav ? "#FF6B6B" : "#FEF7E6"}
              />
            </TouchableOpacity>
          </View>

          {/* Name + verified */}
          <View style={styles.heroBottom}>
            <View style={styles.heroNameRow}>
              <Text style={styles.heroName}>{store?.name || "Store"}</Text>
              {store?.verified ? (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark-circle" size={scale(13)} color="#4ADE80" />
                  <Text style={styles.verifiedText}>Verified</Text>
                </View>
              ) : null}
            </View>
            {!!store?.city ? (
              <View style={styles.heroCityRow}>
                <Ionicons name="location-outline" size={scale(12)} color="rgba(255,255,255,0.75)" />
                <Text style={styles.heroCity}>{store.city}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* ── Stats bar ─────────────────────────────────────────────── */}
        <View style={styles.statsBar}>
          {rating > 0 ? (
            <StatPill icon="star" value={rating.toFixed(1)} label="rating" />
          ) : null}
          {revCount > 0 ? (
            <StatPill icon="people-outline" value={String(revCount)} label="reviews" />
          ) : null}
          {cats.length > 0 ? (
            <StatPill icon="pricetag-outline" value={cats[0]} />
          ) : null}
        </View>

        <View style={styles.body}>
          {/* ── AI Review Summary ────────────────────────────────────── */}
          {hasSummary ? (
            <View style={styles.summaryCard}>
              <View style={styles.summaryHeader}>
                <Ionicons name="sparkles-outline" size={scale(14)} color={VaultColors.brandGoldDark} />
                <Text style={styles.summaryLabel}>Community summary</Text>
              </View>
              <Text style={styles.summaryText}>{stats.review_summary}</Text>
            </View>
          ) : null}

          {/* ── Star breakdown ───────────────────────────────────────── */}
          {totalBD > 0 ? (
            <View style={styles.card}>
              <View style={styles.breakdownLayout}>
                {/* Big score */}
                <View style={styles.breakdownScore}>
                  <Text style={styles.bigRating}>{rating.toFixed(1)}</Text>
                  <Text style={styles.bigStars}>
                    {"★".repeat(Math.round(rating))}{"☆".repeat(5 - Math.round(rating))}
                  </Text>
                  <Text style={styles.bigReviewCount}>{revCount} reviews</Text>
                </View>
                {/* Bars */}
                <View style={styles.breakdownBars}>
                  {[5, 4, 3, 2, 1].map((n) => (
                    <StarBar key={n} star={n} count={breakdown[n] || 0} total={totalBD} />
                  ))}
                </View>
              </View>
            </View>
          ) : null}

          {/* ── Categories ──────────────────────────────────────────── */}
          {cats.length > 0 ? (
            <View style={styles.catsRow}>
              {cats.map((c) => (
                <View key={c} style={styles.catChip}>
                  <Text style={styles.catChipText}>{c.replace(/_/g, " ")}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* ── Community Reviews ────────────────────────────────────── */}
          {reviews.length > 0 ? (
            <>
              <Text style={styles.reviewsHeading}>Reviews</Text>
              {reviews.slice(0, 20).map((r) => (
                <ReviewCard key={r.review_id || String(Math.random())} item={r} />
              ))}
            </>
          ) : (
            <View style={styles.noReviews}>
              <Ionicons name="chatbubble-outline" size={scale(22)} color={VaultColors.textMuted} />
              <Text style={styles.noReviewsText}>No reviews yet. Be the first!</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── Sticky CTA bar ────────────────────────────────────────────── */}
      <View style={[styles.ctaBar, { paddingBottom: Math.max(insets.bottom + 8, 16) }]}>
        {hasUrl ? (
          <TouchableOpacity style={styles.ctaVisit} onPress={handleVisit} activeOpacity={0.87}>
            <Ionicons name="globe-outline" size={scale(16)} color="#FEF7E6" />
            <Text style={styles.ctaVisitText}>Visit website</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          style={[styles.ctaReview, !hasUrl && styles.ctaReviewFull]}
          onPress={handleReview}
          activeOpacity={0.87}
        >
          <Ionicons name="create-outline" size={scale(16)} color={VaultColors.brandGoldDark} />
          <Text style={styles.ctaReviewText}>Write a review</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: VaultColors.appBackground },

  loadingState: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText:  { color: VaultColors.textMuted, fontSize: getFontSize(14), fontWeight: "600" },

  // Hero
  hero: { height: verticalScale(280), position: "relative" },
  heroImage: { width: "100%", height: "100%" },
  heroNav: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: getSpacing(16),
    flexDirection: "row",
    justifyContent: "space-between",
  },
  heroBtn: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    backgroundColor: "rgba(0,0,0,0.32)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroBottom: {
    position: "absolute",
    bottom: getSpacing(18),
    left: getSpacing(18),
    right: getSpacing(18),
  },
  heroNameRow: { flexDirection: "row", alignItems: "center", gap: getSpacing(8) },
  heroName: {
    flex: 1,
    fontSize: getFontSize(26),
    fontWeight: "900",
    color: "#FEF7E6",
    letterSpacing: -0.5,
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: getSpacing(3),
    backgroundColor: "rgba(0,0,0,0.35)",
    paddingHorizontal: getSpacing(8),
    paddingVertical: getSpacing(4),
    borderRadius: scale(10),
  },
  verifiedText:  { fontSize: getFontSize(10), fontWeight: "700", color: "#4ADE80" },
  heroCityRow:   { flexDirection: "row", alignItems: "center", gap: getSpacing(4), marginTop: getSpacing(4) },
  heroCity:      { fontSize: getFontSize(12), fontWeight: "600", color: "rgba(255,255,255,0.75)" },

  // Stats bar
  statsBar: {
    flexDirection: "row",
    paddingHorizontal: VaultSpacing.screenPadding,
    paddingVertical: getSpacing(12),
    gap: getSpacing(10),
    borderBottomWidth: 1,
    borderBottomColor: VaultColors.divider,
    backgroundColor: VaultColors.appBackground,
  },
  statPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: getSpacing(4),
    backgroundColor: VaultColors.brandGoldSoft,
    paddingHorizontal: getSpacing(10),
    paddingVertical: getSpacing(5),
    borderRadius: scale(12),
    borderWidth: 1,
    borderColor: VaultColors.border,
  },
  statValue:  { fontSize: getFontSize(12), fontWeight: "800", color: VaultColors.textPrimary },
  statLabel:  { fontSize: getFontSize(11), fontWeight: "600", color: VaultColors.textMuted },

  // Body
  body: { paddingHorizontal: VaultSpacing.screenPadding, paddingTop: getSpacing(16) },
  card: {
    backgroundColor: "#fff",
    borderRadius: scale(18),
    borderWidth: 1,
    borderColor: VaultColors.border,
    padding: getSpacing(16),
    marginBottom: getSpacing(14),
    ...Platform.select({
      ios: { shadowColor: "#8A5509", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
      android: { elevation: 2 },
    }),
  },

  // Summary
  summaryCard: {
    backgroundColor: VaultColors.brandGoldSoft,
    borderRadius: scale(18),
    borderWidth: 1,
    borderColor: VaultColors.border,
    padding: getSpacing(16),
    marginBottom: getSpacing(14),
  },
  summaryHeader: { flexDirection: "row", alignItems: "center", gap: getSpacing(6), marginBottom: getSpacing(8) },
  summaryLabel:  { fontSize: getFontSize(11), fontWeight: "700", color: VaultColors.brandGoldDark, textTransform: "uppercase", letterSpacing: 0.8 },
  summaryText:   { fontSize: getFontSize(14), fontWeight: "500", color: VaultColors.textPrimary, lineHeight: 21 },

  // Star breakdown
  breakdownLayout: { flexDirection: "row", alignItems: "center", gap: getSpacing(16) },
  breakdownScore:  { alignItems: "center", minWidth: scale(56) },
  bigRating:       { fontSize: getFontSize(36), fontWeight: "900", color: VaultColors.textPrimary, letterSpacing: -1 },
  bigStars:        { fontSize: getFontSize(14), color: VaultColors.warning, marginTop: getSpacing(2) },
  bigReviewCount:  { fontSize: getFontSize(10), fontWeight: "600", color: VaultColors.textMuted, marginTop: getSpacing(4) },
  breakdownBars:   { flex: 1, gap: getSpacing(5) },
  starBarRow:      { flexDirection: "row", alignItems: "center", gap: getSpacing(5) },
  starBarNum:      { fontSize: getFontSize(11), fontWeight: "700", color: VaultColors.textSecondary, width: scale(10), textAlign: "right" },
  starBarTrack:    { flex: 1, height: scale(5), backgroundColor: VaultColors.brandGoldSoft, borderRadius: scale(3), overflow: "hidden" },
  starBarFill:     { height: "100%", backgroundColor: VaultColors.warning, borderRadius: scale(3) },
  starBarCount:    { fontSize: getFontSize(10), fontWeight: "600", color: VaultColors.textMuted, width: scale(22), textAlign: "right" },

  // Categories
  catsRow:    { flexDirection: "row", flexWrap: "wrap", gap: getSpacing(8), marginBottom: getSpacing(18) },
  catChip:    { paddingHorizontal: getSpacing(12), paddingVertical: getSpacing(6), borderRadius: scale(12), backgroundColor: "#fff", borderWidth: 1, borderColor: VaultColors.border },
  catChipText:{ fontSize: getFontSize(12), fontWeight: "700", color: VaultColors.textSecondary, textTransform: "capitalize" },

  // Reviews
  reviewsHeading: {
    fontSize: getFontSize(18),
    fontWeight: "900",
    color: VaultColors.textPrimary,
    marginBottom: getSpacing(12),
    letterSpacing: -0.3,
  },
  reviewCard: {
    backgroundColor: "#fff",
    borderRadius: scale(16),
    borderWidth: 1,
    borderColor: VaultColors.border,
    padding: getSpacing(14),
    marginBottom: getSpacing(10),
  },
  reviewTopRow:    { flexDirection: "row", alignItems: "flex-start", gap: getSpacing(10), marginBottom: getSpacing(8) },
  reviewAvatar:    { width: scale(36), height: scale(36), borderRadius: scale(18), alignItems: "center", justifyContent: "center", flexShrink: 0 },
  reviewAvatarText:{ fontSize: getFontSize(11), fontWeight: "900", color: "#fff" },
  reviewMeta:      { flex: 1 },
  reviewAuthor:    { fontSize: getFontSize(13), fontWeight: "700", color: VaultColors.textPrimary },
  reviewDate:      { fontSize: getFontSize(11), fontWeight: "600", color: VaultColors.textMuted, marginTop: getSpacing(1) },
  reviewStarRow:   { alignItems: "flex-end", gap: getSpacing(2) },
  reviewStars:     { fontSize: getFontSize(12), color: VaultColors.warning },
  reviewRatingNum: { fontSize: getFontSize(11), fontWeight: "700", color: VaultColors.textSecondary },
  reviewComment:   { fontSize: getFontSize(13), fontWeight: "500", color: VaultColors.textSecondary, lineHeight: 20 },
  noReviews:       { alignItems: "center", gap: getSpacing(8), paddingVertical: getSpacing(24) },
  noReviewsText:   { fontSize: getFontSize(13), fontWeight: "600", color: VaultColors.textMuted },

  // CTA bar
  ctaBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    gap: getSpacing(10),
    paddingHorizontal: VaultSpacing.screenPadding,
    paddingTop: getSpacing(12),
    backgroundColor: VaultColors.appBackground,
    borderTopWidth: 1,
    borderTopColor: VaultColors.border,
  },
  ctaVisit: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: getSpacing(7),
    height: scale(48),
    borderRadius: scale(14),
    backgroundColor: VaultColors.brown,
  },
  ctaVisitText:   { fontSize: getFontSize(14), fontWeight: "700", color: "#FEF7E6" },
  ctaReview: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: getSpacing(7),
    height: scale(48),
    borderRadius: scale(14),
    backgroundColor: VaultColors.brandGoldSoft,
    borderWidth: 1,
    borderColor: VaultColors.border,
  },
  ctaReviewFull:  { flex: 2 },
  ctaReviewText:  { fontSize: getFontSize(14), fontWeight: "700", color: VaultColors.brandGoldDark },
});
