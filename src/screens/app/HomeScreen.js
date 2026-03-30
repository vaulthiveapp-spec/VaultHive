import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Image,
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
import NetInfo from "@react-native-community/netinfo";
import Ionicons from "react-native-vector-icons/Ionicons";

import { useAuth } from "../../context/AuthContext";
import { useAlert } from "../../components/AlertProvider";
import { loadHomeData } from "../../services/homeService";
import { useCurrency } from "../../hooks/useCurrency";
import { getStoreCoverSource } from "../../utils/storeCovers";
import { scale, getFontSize, getSpacing } from "../../utils/responsive";
import {
  VaultColors,
  VaultRadius,
  VaultShadows,
  VaultSpacing,
} from "../../styles/DesignSystem";

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  under_warranty:  { bg: "#E8F8EE", border: "#A8DFC0", text: "#18A957",      icon: "shield-checkmark-outline" },
  active:          { bg: "#E8F8EE", border: "#A8DFC0", text: "#18A957",      icon: "checkmark-circle-outline" },
  returnable:      { bg: "#FFF6E3", border: "#F5D89A", text: "#E0A100",      icon: "time-outline" },
  return_risk:     { bg: "#FDECEC", border: "#F5BABA", text: "#D64545",      icon: "alert-circle-outline" },
  out_of_warranty: { bg: "#FFFFFF", border: "#F6D586", text: "#DFA94D",      icon: "shield-outline" },
  expired:         { bg: "#FDECEC", border: "#F5BABA", text: "#D64545",      icon: "close-circle-outline" },
};

const SEVERITY_CONFIG = {
  high:   { bg: "#FDECEC", border: "#F5BABA", iconColor: "#D64545", icon: "alert-circle-outline"       },
  medium: { bg: "#FFF6E3", border: "#F5D89A", iconColor: "#E0A100", icon: "warning-outline"            },
  low:    { bg: "#FFFFFF", border: "#F6D586", iconColor: "#DFA94D", icon: "information-circle-outline" },
};

const QUICK_ACTIONS = [
  { id: "receipt",  label: "Add receipt",  icon: "scan-outline",             screen: "AddReceipt"   },
  { id: "warranty", label: "Add warranty", icon: "shield-checkmark-outline", screen: "AddWarranty"  },
  { id: "vault",    label: "Open vault",   icon: "cube-outline",             screen: "Vault"        },
  { id: "ai",       label: "Ask AI",       icon: "sparkles-outline",         screen: "AIAssistant"  },
  { id: "stores",   label: "Stores",       icon: "storefront-outline",       screen: "Stores"       },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  try {
    const d = new Date(String(dateStr).slice(0, 10) + "T00:00:00");
    return Math.ceil((d.getTime() - Date.now()) / 86400000);
  } catch { return null; }
}

function shortDate(dateStr) {
  if (!dateStr) return "—";
  try {
    return new Date(String(dateStr).slice(0, 10) + "T00:00:00").toLocaleDateString("en-SA", {
      month: "short",
      day: "numeric",
    });
  } catch { return String(dateStr).slice(0, 10); }
}

function shortMonth(monthKey) {
  if (!monthKey) return "";
  try {
    const [y, m] = String(monthKey).split("-");
    return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-SA", {
      month: "long",
      year: "numeric",
    });
  } catch { return monthKey; }
}

function hubStatusCfg(status) {
  return STATUS_CONFIG[String(status || "active")] || STATUS_CONFIG.active;
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonBox({ width, height, radius, style }) {
  const anim = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, [anim]);
  return (
    <Animated.View
      style={[
        { width, height, borderRadius: radius || scale(10), backgroundColor: VaultColors.border, opacity: anim },
        style,
      ]}
    />
  );
}

function HomeSkeleton() {
  return (
    <View style={sk.wrap}>
      <SkeletonBox width="68%" height={scale(30)} style={sk.mb6} />
      <SkeletonBox width="44%" height={scale(14)} style={sk.mb20} />
      <SkeletonBox width="100%" height={scale(140)} radius={scale(26)} style={sk.mb18} />
      <View style={sk.row}>
        <SkeletonBox width="47%" height={scale(76)} radius={scale(18)} />
        <SkeletonBox width="47%" height={scale(76)} radius={scale(18)} />
      </View>
      <SkeletonBox width="38%" height={scale(14)} style={sk.mt22} />
      <SkeletonBox width="100%" height={scale(68)} radius={scale(18)} style={sk.mt12} />
      <SkeletonBox width="100%" height={scale(68)} radius={scale(18)} style={sk.mt10} />
    </View>
  );
}

const sk = StyleSheet.create({
  wrap: { paddingHorizontal: VaultSpacing.screenPadding, paddingTop: getSpacing(8) },
  row: { flexDirection: "row", justifyContent: "space-between" },
  mb6: { marginBottom: getSpacing(6) },
  mb18: { marginBottom: getSpacing(18) },
  mb20: { marginBottom: getSpacing(20) },
  mt10: { marginTop: getSpacing(10) },
  mt12: { marginTop: getSpacing(12) },
  mt22: { marginTop: getSpacing(22) },
});

// ── Shared section header ─────────────────────────────────────────────────────

const SectionHeader = ({ title, action, onAction }) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {action ? (
      <TouchableOpacity activeOpacity={0.82} onPress={onAction}>
        <Text style={styles.sectionAction}>{action}</Text>
      </TouchableOpacity>
    ) : null}
  </View>
);

// ── Summary hero ──────────────────────────────────────────────────────────────

function SummaryHero({ summary, onPress }) {
  const { fmt } = useCurrency();
  const spend = fmt(summary.totalSpendThisMonth, summary.currency);
  return (
    <TouchableOpacity style={styles.heroCard} activeOpacity={0.95} onPress={onPress}>
      <View style={styles.heroTop}>
        <View style={styles.heroBadge}>
          <Ionicons name="sparkles-outline" size={scale(13)} color="#FEF7E6" />
          <Text style={styles.heroBadgeText}>VaultHive</Text>
        </View>
        <View style={styles.heroMonthPill}>
          <Text style={styles.heroMonthText}>{shortMonth(summary.monthKey)}</Text>
        </View>
      </View>

      <Text style={styles.heroSpend}>{spend}</Text>
      <Text style={styles.heroSpendLabel}>Total spend this month</Text>

      <View style={styles.heroTileRow}>
        <HeroTile value={String(summary.totalPurchases)} label="Purchases" icon="bag-outline" />
        <View style={styles.heroTileDivider} />
        <HeroTile value={String(summary.activeWarrantyCount)} label="Warranties" icon="shield-checkmark-outline" />
        <View style={styles.heroTileDivider} />
        <HeroTile
          value={String(summary.openAttentionCount)}
          label="Attention"
          icon="flash-outline"
          alert={summary.openAttentionCount > 0}
        />
        {summary.topMerchantName ? (
          <>
            <View style={styles.heroTileDivider} />
            <HeroTile
              value={summary.topMerchantName.split(" ")[0]}
              label="Top store"
              icon="storefront-outline"
              small
            />
          </>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

function HeroTile({ value, label, icon, alert = false, small = false }) {
  return (
    <View style={styles.heroTile}>
      <Ionicons name={icon} size={scale(13)} color={alert ? "#FFD166" : "rgba(254,247,230,0.66)"} />
      <Text
        style={[
          styles.heroTileValue,
          small && styles.heroTileValueSmall,
          alert && styles.heroTileValueAlert,
        ]}
        numberOfLines={1}
      >
        {value}
      </Text>
      <Text style={styles.heroTileLabel}>{label}</Text>
    </View>
  );
}

// ── Attention strip ───────────────────────────────────────────────────────────

function AttentionStrip({ items, onItemPress, onSeeAll }) {
  if (!items.length) return null;
  return (
    <View>
      <SectionHeader
        title="Needs attention"
        action={items.length > 2 ? "See all" : null}
        onAction={onSeeAll}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.attentionScroll}>
        {items.slice(0, 3).map((item) => {
          const cfg = SEVERITY_CONFIG[item.severity] || SEVERITY_CONFIG.low;
          return (
            <TouchableOpacity
              key={item.attention_id}
              style={[styles.attentionCard, { backgroundColor: cfg.bg, borderColor: cfg.border }]}
              activeOpacity={0.88}
              onPress={() => onItemPress(item)}
            >
              <View style={[styles.attentionIconWrap, { borderColor: cfg.border }]}>
                <Ionicons name={cfg.icon} size={scale(18)} color={cfg.iconColor} />
              </View>
              <Text style={styles.attentionTitle} numberOfLines={2}>{item.title}</Text>
              <Text style={styles.attentionDesc} numberOfLines={2}>{item.description}</Text>
              {item.due_date ? (
                <Text style={[styles.attentionDueText, { color: cfg.iconColor }]}>
                  {"Due " + shortDate(item.due_date)}
                </Text>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ── Quick actions ─────────────────────────────────────────────────────────────

function QuickActionsRow({ navigation }) {
  return (
    <View>
      <SectionHeader title="Quick actions" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickScroll}>
        {QUICK_ACTIONS.map((a) => (
          <TouchableOpacity key={a.id} style={styles.quickChip} activeOpacity={0.86} onPress={() => navigation.navigate(a.screen)}>
            <View style={styles.quickChipIcon}>
              <Ionicons name={a.icon} size={scale(18)} color={VaultColors.brandGoldDark} />
            </View>
            <Text style={styles.quickChipLabel}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

// ── Recent purchases ──────────────────────────────────────────────────────────

function RecentPurchases({ hubs, onViewVault, onAddPress }) {
  if (!hubs.length) {
    return (
      <View>
        <SectionHeader title="Recent purchases" />
        <View style={styles.emptyCard}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="bag-outline" size={scale(28)} color={VaultColors.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>No purchases yet</Text>
          <Text style={styles.emptyText}>
            Add your first receipt to start building your purchase history.
          </Text>
          <TouchableOpacity style={styles.emptyBtn} activeOpacity={0.9} onPress={onAddPress}>
            <Text style={styles.emptyBtnText}>Add receipt</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
  return (
    <View>
      <SectionHeader title="Recent purchases" action="View vault" onAction={onViewVault} />
      {hubs.map((hub) => (
        <HubCard key={hub.hub_id} hub={hub} onPress={onViewVault} />
      ))}
    </View>
  );
}

function HubCard({ hub, onPress }) {
  const { fmt } = useCurrency();
  const st = hubStatusCfg(hub.status);
  // fmt converts hub.total_amount from hub.currency_code → user's baseCurrency.
  const amount = fmt(hub.total_amount, hub.currency_code || "SAR");
  const returnDays = daysUntil(hub.return_deadline);
  const showReturn = hub.return_deadline && returnDays !== null && returnDays >= 0 && returnDays <= 14;

  return (
    <TouchableOpacity style={styles.hubCard} activeOpacity={0.9} onPress={onPress}>
      <View style={[styles.hubStrip, { backgroundColor: st.text }]} />
      <View style={styles.hubBody}>
        <View style={styles.hubTopRow}>
          <Text style={styles.hubTitle} numberOfLines={1}>{hub.title}</Text>
          <Text style={styles.hubAmount}>{amount}</Text>
        </View>
        <View style={styles.hubMetaRow}>
          <Text style={styles.hubMerchant} numberOfLines={1}>{hub.merchant_name || "—"}</Text>
          <Text style={styles.hubDot}>·</Text>
          <Text style={styles.hubDate}>{shortDate(hub.purchase_date)}</Text>
        </View>
        <View style={styles.hubChipRow}>
          <View style={[styles.hubStatusChip, { backgroundColor: st.bg, borderColor: st.border }]}>
            <Ionicons name={st.icon} size={scale(11)} color={st.text} />
            <Text style={[styles.hubStatusText, { color: st.text }]}>
              {hub.status.replace(/_/g, " ")}
            </Text>
          </View>
          {hub.category_name_snapshot ? (
            <View style={styles.hubCatChip}>
              <Text style={styles.hubCatText}>{hub.category_name_snapshot}</Text>
            </View>
          ) : null}
          {showReturn ? (
            <View style={[styles.hubStatusChip, { backgroundColor: "#FFF6E3", borderColor: "#F5D89A" }]}>
              <Ionicons name="time-outline" size={scale(11)} color="#E0A100" />
              <Text style={[styles.hubStatusText, { color: "#E0A100" }]}>
                {returnDays === 0 ? "Return today" : returnDays + "d to return"}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
      <View style={styles.hubChevron}>
        <Ionicons name="chevron-forward" size={scale(15)} color={VaultColors.textMuted} />
      </View>
    </TouchableOpacity>
  );
}

// ── Upcoming reminders ────────────────────────────────────────────────────────

function UpcomingReminders({ reminders, onPress }) {
  if (!reminders.length) return null;
  return (
    <View>
      <SectionHeader title="Upcoming reminders" action="All reminders" onAction={onPress} />
      {reminders.map((r) => {
        const days = daysUntil(r.due_date);
        const isOverdue = days !== null && days < 0;
        const isUrgent  = days !== null && days >= 0 && days <= 5;
        const isWarranty = r.type === "warranty_expiry";
        const label =
          isOverdue ? Math.abs(days) + "d overdue"
          : days === 0 ? "Due today"
          : days === 1 ? "Tomorrow"
          : days !== null ? days + " days"
          : "—";
        const accentColor = isOverdue ? VaultColors.error : isUrgent ? VaultColors.warning : VaultColors.textSecondary;

        return (
          <TouchableOpacity key={r.reminder_id} style={styles.reminderRow} activeOpacity={0.88} onPress={onPress}>
            <View style={[styles.reminderIconWrap, isUrgent && styles.reminderIconUrgent, isOverdue && styles.reminderIconOverdue]}>
              <Ionicons
                name={isWarranty ? "shield-checkmark-outline" : "time-outline"}
                size={scale(16)}
                color={isOverdue ? VaultColors.error : isUrgent ? VaultColors.warning : VaultColors.textPrimary}
              />
            </View>
            <View style={styles.reminderBody}>
              <Text style={styles.reminderType}>{isWarranty ? "Warranty expiry" : "Return deadline"}</Text>
              <Text style={styles.reminderDate}>{shortDate(r.due_date)}</Text>
            </View>
            <View style={[styles.reminderCountdown, isUrgent && styles.reminderCountdownUrgent, isOverdue && styles.reminderCountdownOverdue]}>
              <Text style={[styles.reminderCountdownText, { color: accentColor }]}>{label}</Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ── Recommended stores ────────────────────────────────────────────────────────

function RecommendedStores({ stores, onStorePress }) {
  if (!stores.length) return null;
  return (
    <View>
      <SectionHeader title="Recommended stores" action="Browse all" onAction={() => onStorePress(null)} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storesScroll}>
        {stores.map((store) => {
          const storeObj = {
            categories_json: store.categories.length
              ? JSON.stringify(Object.fromEntries(store.categories.map((c) => [c, true])))
              : null,
          };
          const cover = getStoreCoverSource(storeObj);
          const rating = Number(store.avg_rating || 0);
          return (
            <TouchableOpacity key={store.store_id} style={styles.storeCard} activeOpacity={0.9} onPress={() => onStorePress(store)}>
              <Image source={cover} style={styles.storeCover} resizeMode="cover" />
              <View style={styles.storeCardBody}>
                <Text style={styles.storeName} numberOfLines={1}>{store.name}</Text>
                {rating > 0 ? (
                  <View style={styles.storeRatingRow}>
                    <Ionicons name="star" size={scale(11)} color={VaultColors.warning} />
                    <Text style={styles.storeRatingText}>{rating.toFixed(1)}</Text>
                    {store.review_count > 0 ? (
                      <Text style={styles.storeReviewCount}>{"(" + store.review_count + ")"}</Text>
                    ) : null}
                  </View>
                ) : null}
                {store.reason ? (
                  <Text style={styles.storeReason} numberOfLines={2}>{store.reason}</Text>
                ) : null}
                {store.categories.length > 0 ? (
                  <View style={styles.storeCatPill}>
                    <Text style={styles.storeCatText} numberOfLines={1}>
                      {store.categories[0].replace(/_/g, " ")}
                    </Text>
                  </View>
                ) : null}
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ── Offline banner ────────────────────────────────────────────────────────────

function OfflineBanner({ onRetry }) {
  return (
    <TouchableOpacity style={styles.offlineBanner} activeOpacity={0.9} onPress={onRetry}>
      <Ionicons name="cloud-offline-outline" size={scale(15)} color="#92400E" />
      <Text style={styles.offlineBannerText}>Offline — showing saved data</Text>
      <Text style={styles.offlineRetryText}>Tap to retry</Text>
    </TouchableOpacity>
  );
}

// ── Error / retry ─────────────────────────────────────────────────────────────

function ErrorState({ onRetry }) {
  return (
    <View style={styles.errorWrap}>
      <View style={styles.errorIconWrap}>
        <Ionicons name="alert-circle-outline" size={scale(36)} color={VaultColors.error} />
      </View>
      <Text style={styles.errorTitle}>Could not load your dashboard</Text>
      <Text style={styles.errorText}>Check your connection and try again.</Text>
      <TouchableOpacity style={styles.retryBtn} activeOpacity={0.9} onPress={onRetry}>
        <Ionicons name="refresh-outline" size={scale(15)} color={VaultColors.buttonTextOnGold} />
        <Text style={styles.retryBtnText}>Retry</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const [status, setStatus]     = useState("loading");
  const [isOffline, setIsOffline] = useState(false);
  const [data, setData]          = useState(null);

  const load = useCallback(async (quiet = false) => {
    if (!user?.uid) return;
    if (!quiet) setStatus("loading");
    try {
      const homeData = await loadHomeData(user.uid);
      setData(homeData);
      setStatus("ready");
    } catch {
      if (!data) setStatus("error");
    }
  }, [user?.uid]);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      const online = !!state.isConnected;
      setIsOffline(!online);
      if (online && status === "error") load(true);
    });
    return () => unsub();
  }, [load, status]);

  useFocusEffect(useCallback(() => { load(false); }, [load]));

  const nav = (screen, params) => navigation.navigate(screen, params);

  const displayName = user?.name || user?.username || "there";
  const shortName   = String(displayName).split(" ")[0];
  const initial     = shortName.charAt(0).toUpperCase() || "V";

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <StatusBar barStyle="dark-content" backgroundColor={VaultColors.appBackground} />

      {/* ── Fixed header ── */}
      <View style={[styles.header, { paddingTop: insets.top + getSpacing(6) }]}>
        <TouchableOpacity style={styles.headerIconBtn} activeOpacity={0.88} onPress={() => navigation.openDrawer()}>
          <Ionicons name="menu-outline" size={scale(22)} color={VaultColors.brandGoldDark} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerGreeting}>{greeting()}</Text>
          <Text style={styles.headerName} numberOfLines={1}>{shortName}</Text>
        </View>

        <TouchableOpacity style={styles.headerIconBtn} activeOpacity={0.88} onPress={() => nav("Reminders")}>
          <Ionicons name="notifications-outline" size={scale(20)} color={VaultColors.brandGoldDark} />
          {data?.summary?.openAttentionCount > 0 ? (
            <View style={styles.notifBadge}>
              <Text style={styles.notifBadgeText}>
                {data.summary.openAttentionCount > 9 ? "9+" : data.summary.openAttentionCount}
              </Text>
            </View>
          ) : null}
        </TouchableOpacity>

        <TouchableOpacity style={styles.avatarBtn} activeOpacity={0.88} onPress={() => nav("Profile")}>
          <Text style={styles.avatarBtnText}>{initial}</Text>
        </TouchableOpacity>
      </View>

      {/* ── Offline banner ── */}
      {isOffline ? <OfflineBanner onRetry={() => load(false)} /> : null}

      {/* ── Body states ── */}
      {status === "loading" && !data ? (
        <ScrollView showsVerticalScrollIndicator={false}><HomeSkeleton /></ScrollView>
      ) : status === "error" ? (
        <ErrorState onRetry={() => load(false)} />
      ) : data ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

          <SummaryHero summary={data.summary} onPress={() => nav("Reports")} />

          <AttentionStrip
            items={data.attentionItems}
            onItemPress={() => navigation.navigate("AttentionCenter")}
            onSeeAll={() => navigation.navigate("AttentionCenter")}
          />

          <QuickActionsRow navigation={navigation} />

          <RecentPurchases
            hubs={data.recentHubs}
            onViewVault={() => nav("Vault")}
            onAddPress={() => nav("AddReceipt")}
          />

          <UpcomingReminders reminders={data.reminders} onPress={() => nav("Reminders")} />

          <RecommendedStores
            stores={data.recommendedStores}
            onStorePress={(store) =>
              store ? nav("StoreDetails", { storeId: store.store_id }) : nav("Stores")
            }
          />

          {data.fromCache && data.cacheAgeMs !== null ? (
            <View style={styles.cacheHint}>
              <Ionicons name="time-outline" size={scale(12)} color={VaultColors.textMuted} />
              <Text style={styles.cacheHintText}>
                {"Summary updated " + Math.round(data.cacheAgeMs / 60000) + " min ago"}
              </Text>
            </View>
          ) : null}

          <View style={{ height: getSpacing(24) }} />
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: VaultColors.appBackground },

  header: {
    paddingHorizontal: VaultSpacing.screenPadding,
    paddingBottom: getSpacing(10),
    flexDirection: "row",
    alignItems: "center",
    gap: getSpacing(10),
  },
  headerIconBtn: {
    width: scale(42),
    height: scale(42),
    borderRadius: VaultRadius.lg,
    backgroundColor: VaultColors.surfaceAlt,
    borderWidth: 1,
    borderColor: VaultColors.border,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  headerCenter: { flex: 1 },
  headerGreeting: {
    fontSize: getFontSize(11),
    color: VaultColors.textMuted,
    fontFamily: "Poppins",
    fontWeight: "600",
  },
  headerName: {
    fontSize: getFontSize(22),
    color: VaultColors.textPrimary,
    fontFamily: "Poppins",
    fontWeight: "900",
    marginTop: getSpacing(1),
  },
  notifBadge: {
    position: "absolute",
    top: scale(5),
    right: scale(5),
    minWidth: scale(16),
    height: scale(16),
    borderRadius: scale(8),
    backgroundColor: VaultColors.error,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: scale(3),
    borderWidth: 1.5,
    borderColor: VaultColors.surfaceAlt,
  },
  notifBadgeText: {
    color: "#FFFFFF",
    fontSize: getFontSize(7),
    fontFamily: "Poppins",
    fontWeight: "900",
  },
  avatarBtn: {
    width: scale(42),
    height: scale(42),
    borderRadius: scale(21),
    backgroundColor: VaultColors.brandGoldDark,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarBtnText: {
    color: "#FFFFFF",
    fontSize: getFontSize(16),
    fontFamily: "Poppins",
    fontWeight: "900",
  },

  offlineBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: getSpacing(8),
    backgroundColor: "#FEF3C7",
    borderBottomWidth: 1,
    borderBottomColor: "#F5D89A",
    paddingHorizontal: VaultSpacing.screenPadding,
    paddingVertical: getSpacing(10),
  },
  offlineBannerText: {
    flex: 1,
    fontSize: getFontSize(11),
    color: "#92400E",
    fontFamily: "Poppins",
    fontWeight: "700",
  },
  offlineRetryText: {
    fontSize: getFontSize(11),
    color: "#92400E",
    fontFamily: "Poppins",
    fontWeight: "900",
    textDecorationLine: "underline",
  },

  errorWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: VaultSpacing.screenPadding,
  },
  errorIconWrap: {
    width: scale(72),
    height: scale(72),
    borderRadius: scale(24),
    backgroundColor: VaultColors.errorSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: getSpacing(16),
  },
  errorTitle: {
    fontSize: getFontSize(18),
    color: VaultColors.textPrimary,
    fontFamily: "Poppins",
    fontWeight: "900",
    textAlign: "center",
    marginBottom: getSpacing(8),
  },
  errorText: {
    fontSize: getFontSize(12),
    color: VaultColors.textMuted,
    fontFamily: "Poppins",
    fontWeight: "600",
    textAlign: "center",
    lineHeight: getFontSize(19),
    marginBottom: getSpacing(24),
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: getSpacing(8),
    backgroundColor: VaultColors.brandGoldDark,
    borderRadius: VaultRadius.full,
    paddingVertical: getSpacing(13),
    paddingHorizontal: getSpacing(28),
    ...VaultShadows.sm,
  },
  retryBtnText: {
    color: VaultColors.buttonTextOnGold,
    fontSize: getFontSize(14),
    fontFamily: "Poppins",
    fontWeight: "900",
  },

  scrollContent: {
    paddingHorizontal: VaultSpacing.screenPadding,
    paddingTop: getSpacing(4),
    paddingBottom: getSpacing(24),
    gap: getSpacing(22),
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: getSpacing(12),
  },
  sectionTitle: {
    fontSize: getFontSize(16),
    color: VaultColors.textPrimary,
    fontFamily: "Poppins",
    fontWeight: "900",
  },
  sectionAction: {
    fontSize: getFontSize(12),
    color: VaultColors.brandGoldDark,
    fontFamily: "Poppins",
    fontWeight: "800",
  },

  heroCard: {
    backgroundColor: VaultColors.brandGoldDark,
    borderRadius: scale(28),
    padding: getSpacing(20),
    ...VaultShadows.lg,
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: getSpacing(16),
  },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: getSpacing(5),
    backgroundColor: "rgba(255,255,255,0.14)",
    borderRadius: VaultRadius.full,
    paddingHorizontal: getSpacing(10),
    paddingVertical: getSpacing(6),
  },
  heroBadgeText: {
    color: "#FEF7E6",
    fontSize: getFontSize(11),
    fontFamily: "Poppins",
    fontWeight: "800",
  },
  heroMonthPill: {
    backgroundColor: "rgba(255,255,255,0.10)",
    borderRadius: VaultRadius.full,
    paddingHorizontal: getSpacing(10),
    paddingVertical: getSpacing(5),
  },
  heroMonthText: {
    color: "rgba(254,247,230,0.82)",
    fontSize: getFontSize(10),
    fontFamily: "Poppins",
    fontWeight: "700",
  },
  heroSpend: {
    color: "#FFFFFF",
    fontSize: getFontSize(34),
    fontFamily: "Poppins",
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  heroSpendLabel: {
    color: "rgba(254,247,230,0.68)",
    fontSize: getFontSize(11),
    fontFamily: "Poppins",
    fontWeight: "600",
    marginBottom: getSpacing(16),
  },
  heroTileRow: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.14)",
    paddingTop: getSpacing(14),
  },
  heroTile: { flex: 1, alignItems: "center", gap: getSpacing(3) },
  heroTileValue: {
    color: "#FFFFFF",
    fontSize: getFontSize(16),
    fontFamily: "Poppins",
    fontWeight: "900",
    marginTop: getSpacing(3),
  },
  heroTileValueSmall: { fontSize: getFontSize(12) },
  heroTileValueAlert: { color: "#FFD166" },
  heroTileLabel: {
    color: "rgba(254,247,230,0.58)",
    fontSize: getFontSize(9.5),
    fontFamily: "Poppins",
    fontWeight: "700",
  },
  heroTileDivider: {
    width: 1,
    height: scale(36),
    backgroundColor: "rgba(255,255,255,0.16)",
  },

  attentionScroll: { gap: getSpacing(12), paddingRight: getSpacing(2) },
  attentionCard: {
    width: scale(200),
    borderRadius: scale(20),
    borderWidth: 1,
    padding: getSpacing(14),
    gap: getSpacing(6),
  },
  attentionIconWrap: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(12),
    backgroundColor: "rgba(255,255,255,0.54)",
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  attentionTitle: {
    fontSize: getFontSize(12),
    color: VaultColors.textPrimary,
    fontFamily: "Poppins",
    fontWeight: "900",
    lineHeight: getFontSize(17),
  },
  attentionDesc: {
    fontSize: getFontSize(10.5),
    color: VaultColors.textMuted,
    fontFamily: "Poppins",
    fontWeight: "600",
    lineHeight: getFontSize(15),
  },
  attentionDueText: {
    fontSize: getFontSize(10),
    fontFamily: "Poppins",
    fontWeight: "800",
    marginTop: getSpacing(4),
  },

  quickScroll: { gap: getSpacing(10), paddingRight: getSpacing(2) },
  quickChip: {
    alignItems: "center",
    gap: getSpacing(8),
    backgroundColor: VaultColors.surfaceAlt,
    borderRadius: scale(18),
    borderWidth: 1,
    borderColor: VaultColors.border,
    paddingVertical: getSpacing(12),
    paddingHorizontal: getSpacing(14),
    minWidth: scale(80),
    ...VaultShadows.sm,
  },
  quickChipIcon: {
    width: scale(44),
    height: scale(44),
    borderRadius: scale(14),
    backgroundColor: VaultColors.brandGoldSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  quickChipLabel: {
    fontSize: getFontSize(10),
    color: VaultColors.textPrimary,
    fontFamily: "Poppins",
    fontWeight: "800",
    textAlign: "center",
  },

  hubCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: VaultColors.surfaceAlt,
    borderRadius: scale(20),
    borderWidth: 1,
    borderColor: VaultColors.border,
    marginBottom: getSpacing(10),
    overflow: "hidden",
    ...Platform.select({ android: { elevation: 2 }, ios: VaultShadows.sm }),
  },
  hubStrip: { width: scale(4), alignSelf: "stretch", opacity: 0.7 },
  hubBody: { flex: 1, padding: getSpacing(12), gap: getSpacing(4) },
  hubChevron: { paddingRight: getSpacing(12) },
  hubTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: getSpacing(8),
  },
  hubTitle: {
    flex: 1,
    fontSize: getFontSize(14),
    color: VaultColors.textPrimary,
    fontFamily: "Poppins",
    fontWeight: "900",
  },
  hubAmount: {
    fontSize: getFontSize(13),
    color: VaultColors.textSecondary,
    fontFamily: "Poppins",
    fontWeight: "900",
  },
  hubMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: getSpacing(6),
  },
  hubMerchant: {
    fontSize: getFontSize(11),
    color: VaultColors.textMuted,
    fontFamily: "Poppins",
    fontWeight: "700",
    maxWidth: scale(120),
  },
  hubDot: { fontSize: getFontSize(11), color: VaultColors.textMuted },
  hubDate: {
    fontSize: getFontSize(11),
    color: VaultColors.textMuted,
    fontFamily: "Poppins",
    fontWeight: "600",
  },
  hubChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: getSpacing(6),
    marginTop: getSpacing(4),
  },
  hubStatusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(4),
    borderRadius: VaultRadius.full,
    borderWidth: 1,
    paddingHorizontal: getSpacing(8),
    paddingVertical: getSpacing(4),
  },
  hubStatusText: {
    fontSize: getFontSize(9.5),
    fontFamily: "Poppins",
    fontWeight: "800",
    textTransform: "capitalize",
  },
  hubCatChip: {
    borderRadius: VaultRadius.full,
    backgroundColor: VaultColors.brandGoldSoft,
    borderWidth: 1,
    borderColor: VaultColors.border,
    paddingHorizontal: getSpacing(8),
    paddingVertical: getSpacing(4),
  },
  hubCatText: {
    fontSize: getFontSize(9.5),
    color: VaultColors.textPrimary,
    fontFamily: "Poppins",
    fontWeight: "700",
  },

  emptyCard: {
    backgroundColor: VaultColors.surfaceAlt,
    borderRadius: scale(22),
    borderWidth: 1,
    borderColor: VaultColors.border,
    alignItems: "center",
    padding: getSpacing(24),
    ...VaultShadows.sm,
  },
  emptyIconWrap: {
    width: scale(60),
    height: scale(60),
    borderRadius: scale(20),
    backgroundColor: VaultColors.brandGoldSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: getSpacing(10),
  },
  emptyTitle: {
    fontSize: getFontSize(15),
    color: VaultColors.textPrimary,
    fontFamily: "Poppins",
    fontWeight: "900",
    marginBottom: getSpacing(6),
  },
  emptyText: {
    fontSize: getFontSize(11),
    color: VaultColors.textMuted,
    fontFamily: "Poppins",
    fontWeight: "600",
    textAlign: "center",
    lineHeight: getFontSize(17),
    marginBottom: getSpacing(16),
  },
  emptyBtn: {
    backgroundColor: VaultColors.brandGoldDark,
    borderRadius: VaultRadius.full,
    paddingVertical: getSpacing(11),
    paddingHorizontal: getSpacing(22),
  },
  emptyBtnText: {
    color: VaultColors.buttonTextOnGold,
    fontSize: getFontSize(12),
    fontFamily: "Poppins",
    fontWeight: "900",
  },

  reminderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: getSpacing(12),
    backgroundColor: VaultColors.surfaceAlt,
    borderRadius: scale(16),
    borderWidth: 1,
    borderColor: VaultColors.border,
    padding: getSpacing(12),
    marginBottom: getSpacing(8),
    ...Platform.select({ android: { elevation: 1 }, ios: VaultShadows.sm }),
  },
  reminderIconWrap: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(14),
    backgroundColor: VaultColors.brandGoldSoft,
    borderWidth: 1,
    borderColor: VaultColors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  reminderIconUrgent:  { backgroundColor: "#FFF6E3", borderColor: "#F5D89A" },
  reminderIconOverdue: { backgroundColor: "#FDECEC", borderColor: "#F5BABA" },
  reminderBody: { flex: 1 },
  reminderType: {
    fontSize: getFontSize(12),
    color: VaultColors.textPrimary,
    fontFamily: "Poppins",
    fontWeight: "800",
  },
  reminderDate: {
    fontSize: getFontSize(10.5),
    color: VaultColors.textMuted,
    fontFamily: "Poppins",
    fontWeight: "600",
    marginTop: getSpacing(2),
  },
  reminderCountdown: {
    borderRadius: VaultRadius.full,
    backgroundColor: VaultColors.brandGoldSoft,
    borderWidth: 1,
    borderColor: VaultColors.border,
    paddingHorizontal: getSpacing(10),
    paddingVertical: getSpacing(5),
  },
  reminderCountdownUrgent:  { backgroundColor: "#FFF6E3", borderColor: "#F5D89A" },
  reminderCountdownOverdue: { backgroundColor: "#FDECEC", borderColor: "#F5BABA" },
  reminderCountdownText: {
    fontSize: getFontSize(10),
    fontFamily: "Poppins",
    fontWeight: "900",
  },

  storesScroll: { gap: getSpacing(12), paddingRight: getSpacing(2) },
  storeCard: {
    width: scale(180),
    backgroundColor: VaultColors.surfaceAlt,
    borderRadius: scale(22),
    borderWidth: 1,
    borderColor: VaultColors.border,
    overflow: "hidden",
    ...VaultShadows.sm,
  },
  storeCover: { width: "100%", height: scale(100) },
  storeCardBody: { padding: getSpacing(12), gap: getSpacing(4) },
  storeName: {
    fontSize: getFontSize(13),
    color: VaultColors.textPrimary,
    fontFamily: "Poppins",
    fontWeight: "900",
  },
  storeRatingRow: { flexDirection: "row", alignItems: "center", gap: getSpacing(4) },
  storeRatingText: {
    fontSize: getFontSize(11),
    color: VaultColors.textPrimary,
    fontFamily: "Poppins",
    fontWeight: "800",
  },
  storeReviewCount: {
    fontSize: getFontSize(10),
    color: VaultColors.textMuted,
    fontFamily: "Poppins",
    fontWeight: "600",
  },
  storeReason: {
    fontSize: getFontSize(10),
    color: VaultColors.textMuted,
    fontFamily: "Poppins",
    fontWeight: "600",
    lineHeight: getFontSize(14),
  },
  storeCatPill: {
    alignSelf: "flex-start",
    backgroundColor: VaultColors.brandGoldSoft,
    borderRadius: VaultRadius.full,
    paddingHorizontal: getSpacing(8),
    paddingVertical: getSpacing(4),
    marginTop: getSpacing(4),
  },
  storeCatText: {
    fontSize: getFontSize(9.5),
    color: VaultColors.textPrimary,
    fontFamily: "Poppins",
    fontWeight: "700",
    textTransform: "capitalize",
  },

  cacheHint: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: getSpacing(5),
    paddingVertical: getSpacing(8),
  },
  cacheHintText: {
    fontSize: getFontSize(10),
    color: VaultColors.textMuted,
    fontFamily: "Poppins",
    fontWeight: "600",
  },
});
