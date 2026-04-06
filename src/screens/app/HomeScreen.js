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
import { SafeAreaView } from "react-native-safe-area-context";
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

const STATUS_CONFIG = {
  under_warranty:  { bg: "#E8F8EE", border: "#A8DFC0", text: "#18A957", icon: "shield-checkmark-outline" },
  active:          { bg: "#E8F8EE", border: "#A8DFC0", text: "#18A957", icon: "checkmark-circle-outline" },
  returnable:      { bg: "#FFF6E3", border: "#F5D89A", text: "#E0A100", icon: "time-outline" },
  return_risk:     { bg: "#FDECEC", border: "#F5BABA", text: "#D64545", icon: "alert-circle-outline" },
  out_of_warranty: { bg: "#FFFDF8", border: "#F6D586", text: "#DFA94D", icon: "shield-outline" },
  expired:         { bg: "#FDECEC", border: "#F5BABA", text: "#D64545", icon: "close-circle-outline" },
};

const SEVERITY_CONFIG = {
  high:   { bg: "#FDECEC", border: "#F5BABA", iconColor: "#D64545", icon: "alert-circle-outline"       },
  medium: { bg: "#FFF6E3", border: "#F5D89A", iconColor: "#E0A100", icon: "warning-outline"            },
  low:    { bg: "#FFFDF8", border: "#F6D586", iconColor: "#DFA94D", icon: "information-circle-outline" },
};

const QUICK_ACTIONS = [
  { id: "receipt",  label: "Add Receipt", icon: "scan-outline",             screen: "AddReceipt"  },
  { id: "warranty", label: "Warranty",    icon: "shield-checkmark-outline", screen: "AddWarranty" },
  { id: "vault",    label: "Vault",       icon: "cube-outline",             screen: "Vault"       },
  { id: "ai",       label: "Ask AI",      icon: "sparkles-outline",         screen: "AIAssistant" },
  { id: "stores",   label: "Stores",      icon: "storefront-outline",       screen: "Stores"      },
];

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
      year: "numeric",
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
  const anim = useRef(new Animated.Value(0.35)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.35, duration: 750, useNativeDriver: true }),
      ])
    ).start();
  }, [anim]);
  return (
    <Animated.View
      style={[
        { width, height, borderRadius: radius || scale(12), backgroundColor: VaultColors.border, opacity: anim },
        style,
      ]}
    />
  );
}

function HomeSkeleton() {
  return (
    <View style={sk.wrap}>
      <SkeletonBox width="55%" height={scale(16)} radius={scale(8)} style={sk.mb6} />
      <SkeletonBox width="75%" height={scale(34)} radius={scale(10)} style={sk.mb20} />
      <SkeletonBox width="100%" height={scale(50)} radius={scale(30)} style={sk.mb20} />
      <SkeletonBox width="100%" height={scale(130)} radius={scale(26)} style={sk.mb18} />
      <View style={sk.row}>
        {[0, 1, 2, 3].map((i) => (
          <SkeletonBox key={i} width={scale(58)} height={scale(58)} radius={scale(20)} />
        ))}
      </View>
      <SkeletonBox width="40%" height={scale(14)} style={sk.mt22} />
      <SkeletonBox width="100%" height={scale(70)} radius={scale(18)} style={sk.mt12} />
      <SkeletonBox width="100%" height={scale(70)} radius={scale(18)} style={sk.mt10} />
    </View>
  );
}

const sk = StyleSheet.create({
  wrap: { paddingHorizontal: VaultSpacing.screenPadding, paddingTop: scale(8) },
  row:  { flexDirection: "row", justifyContent: "space-between", marginTop: scale(14) },
  mb6:  { marginBottom: scale(6) },
  mb18: { marginBottom: scale(18) },
  mb20: { marginBottom: scale(20) },
  mt10: { marginTop: scale(10) },
  mt12: { marginTop: scale(12) },
  mt22: { marginTop: scale(22) },
});

// ── Section header ────────────────────────────────────────────────────────────

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

// ── Search bar ────────────────────────────────────────────────────────────────

function SearchBar({ navigation }) {
  return (
    <TouchableOpacity
      style={styles.searchBar}
      activeOpacity={0.88}
      onPress={() => navigation.navigate("Vault")}
    >
      <Ionicons name="search-outline" size={scale(17)} color={VaultColors.textMuted} />
      <Text style={styles.searchPlaceholder}>Search Receipts, Warranties…</Text>
      <View style={styles.searchFilterBtn}>
        <Ionicons name="options-outline" size={scale(16)} color={VaultColors.brandGoldDark} />
      </View>
    </TouchableOpacity>
  );
}

// ── Quick Insights card ───────────────────────────────────────────────────────

function QuickInsightsCard({ summary, onPress }) {
  const { fmt } = useCurrency();
  const totalValue    = fmt(summary.totalSpendThisMonth, summary.currency);
  const expiringCount = summary.activeWarrantyCount || 0;
  const attentionCount = summary.openAttentionCount || 0;
  const progressFill  = expiringCount > 0
    ? Math.min(expiringCount / Math.max(expiringCount + 3, 8), 1)
    : 0.18;

  return (
    <TouchableOpacity style={styles.insightsCard} activeOpacity={0.93} onPress={onPress}>
      <View style={styles.insightsDecorCircle1} />
      <View style={styles.insightsDecorCircle2} />

      <View style={styles.insightsTop}>
        <View>
          <Text style={styles.insightsLabel}>Quick Insights</Text>
          <Text style={styles.insightsTitle}>Active Warranties</Text>
        </View>
        <View style={styles.insightsBadge}>
          <Ionicons name="shield-checkmark-outline" size={scale(15)} color="#FEF7E6" />
        </View>
      </View>

      <View style={styles.insightsStatRow}>
        <View>
          <Text style={styles.insightsStatNum}>{expiringCount}</Text>
          <Text style={styles.insightsStatLabel}>Items Expiring Soon</Text>
        </View>
        <View style={styles.insightsDivider} />
        <View>
          <Text style={styles.insightsStatNum}>{totalValue}</Text>
          <Text style={styles.insightsStatLabel}>Total Value</Text>
        </View>
        {attentionCount > 0 && (
          <>
            <View style={styles.insightsDivider} />
            <View>
              <Text style={[styles.insightsStatNum, { color: "#FFD166" }]}>{attentionCount}</Text>
              <Text style={styles.insightsStatLabel}>Attention</Text>
            </View>
          </>
        )}
      </View>

      <View style={styles.insightsProgressTrack}>
        <View style={[styles.insightsProgressFill, { width: `${Math.round(progressFill * 100)}%` }]} />
      </View>
      <Text style={styles.insightsMonthLabel}>{shortMonth(summary.monthKey)}</Text>
    </TouchableOpacity>
  );
}

// ── Quick actions ─────────────────────────────────────────────────────────────

function QuickActionsRow({ navigation }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickScroll}>
      {QUICK_ACTIONS.map((a) => (
        <TouchableOpacity
          key={a.id}
          style={styles.quickChip}
          activeOpacity={0.86}
          onPress={() => navigation.navigate(a.screen)}
        >
          <View style={styles.quickChipIcon}>
            <Ionicons name={a.icon} size={scale(20)} color={VaultColors.buttonTextOnGold} />
          </View>
          <Text style={styles.quickChipLabel}>{a.label}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

// ── Featured Stores ───────────────────────────────────────────────────────────

function FeaturedStores({ stores, onStorePress }) {
  if (!stores || !stores.length) return null;
  return (
    <View>
      <SectionHeader title="Featured Stores" action="Browse all" onAction={() => onStorePress(null)} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.featuredStoresScroll}
      >
        {stores.map((store) => {
          const storeObj = {
            categories_json: store.categories?.length
              ? JSON.stringify(Object.fromEntries(store.categories.map((c) => [c, true])))
              : null,
          };
          const cover = getStoreCoverSource(storeObj);
          return (
            <TouchableOpacity
              key={store.store_id}
              style={styles.featuredStoreItem}
              activeOpacity={0.85}
              onPress={() => onStorePress(store)}
            >
              <View style={styles.featuredStoreCircle}>
                <Image source={cover} style={styles.featuredStoreImg} resizeMode="cover" />
              </View>
              <Text style={styles.featuredStoreName} numberOfLines={2}>{store.name}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ── Expiring Soon ─────────────────────────────────────────────────────────────

function ExpiringSoon({ hubs, reminders, onHubPress, onPress }) {
  const items = [];

  hubs.forEach((hub) => {
    const days = daysUntil(hub.return_deadline);
    if (hub.return_deadline && days !== null && days <= 60) {
      items.push({
        id: hub.hub_id,
        kind: "receipt",
        title: hub.title || hub.merchant_name || "Purchase",
        subtitle: hub.merchant_name,
        date: hub.return_deadline,
        amount: hub.total_amount,
        currency: hub.currency_code,
        days,
        hub,
      });
    }
  });

  reminders.forEach((r) => {
    const days = daysUntil(r.due_date);
    if (days !== null && days <= 60) {
      items.push({
        id: r.reminder_id,
        kind: "warranty",
        title: r.target_label || (r.type === "warranty_expiry" ? "Warranty" : "Return"),
        subtitle: r.type === "warranty_expiry" ? "Warranty expiry" : "Return deadline",
        date: r.due_date,
        amount: null,
        days,
        reminder: r,
      });
    }
  });

  items.sort((a, b) => (a.days ?? 999) - (b.days ?? 999));
  if (!items.length) return null;

  return (
    <View>
      <SectionHeader title="Expiring Soon" action="View all" onAction={onPress} />
      {items.slice(0, 5).map((item) => (
        <ExpiryRow
          key={item.id}
          item={item}
          onPress={() => (item.hub ? onHubPress(item.hub) : onPress())}
        />
      ))}
    </View>
  );
}

function ExpiryRow({ item, onPress }) {
  const { fmt } = useCurrency();
  const isWarranty = item.kind === "warranty";
  const isOverdue  = item.days < 0;
  const isUrgent   = !isOverdue && item.days <= 7;

  const iconName   = isWarranty ? "shield-checkmark-outline" : "receipt-outline";
  const iconColor  = isOverdue ? VaultColors.error : isUrgent ? VaultColors.warning : VaultColors.brandGoldDark;
  const iconBg     = isOverdue ? "#FDECEC" : isUrgent ? "#FFF6E3" : VaultColors.brandGoldSoft + "55";

  const countdownLabel =
    isOverdue   ? Math.abs(item.days) + "d overdue"
    : item.days === 0 ? "Today"
    : item.days === 1 ? "Tomorrow"
    : item.days + " days";

  const countdownColor  = isOverdue ? VaultColors.error : isUrgent ? VaultColors.warning : VaultColors.textMuted;
  const countdownBg     = isOverdue ? "#FDECEC" : isUrgent ? "#FFF6E3" : VaultColors.appBackground;
  const countdownBorder = isOverdue ? "#F5BABA" : isUrgent ? "#F5D89A" : VaultColors.border;

  return (
    <TouchableOpacity style={styles.expiryRow} activeOpacity={0.88} onPress={onPress}>
      <View style={[styles.expiryIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={iconName} size={scale(18)} color={iconColor} />
      </View>
      <View style={styles.expiryBody}>
        <Text style={styles.expiryTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.expiryMeta} numberOfLines={1}>
          {item.subtitle ? item.subtitle + " · " : ""}{shortDate(item.date)}
        </Text>
      </View>
      <View style={styles.expiryRight}>
        {item.amount != null ? (
          <Text style={styles.expiryAmount}>{fmt(item.amount, item.currency || "SAR")}</Text>
        ) : null}
        <View style={[styles.expiryCountdown, { backgroundColor: countdownBg, borderColor: countdownBorder }]}>
          <Text style={[styles.expiryCountdownText, { color: countdownColor }]}>{countdownLabel}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Attention strip ───────────────────────────────────────────────────────────

function AttentionStrip({ items, onItemPress, onSeeAll }) {
  if (!items.length) return null;
  return (
    <View>
      <SectionHeader
        title="Needs Attention"
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
                <Ionicons name={cfg.icon} size={scale(17)} color={cfg.iconColor} />
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

// ── Recent purchases ──────────────────────────────────────────────────────────

function RecentPurchases({ hubs, onViewVault, onAddPress, onHubPress }) {
  if (!hubs.length) {
    return (
      <View>
        <SectionHeader title="Recent Purchases" />
        <View style={styles.emptyCard}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="bag-outline" size={scale(28)} color={VaultColors.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>No purchases yet</Text>
          <Text style={styles.emptyText}>
            Add your first receipt to start building your purchase history.
          </Text>
          <TouchableOpacity style={styles.emptyBtn} activeOpacity={0.9} onPress={onAddPress}>
            <Text style={styles.emptyBtnText}>Add Receipt</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
  return (
    <View>
      <SectionHeader title="Recent Purchases" action="View vault" onAction={onViewVault} />
      {hubs.map((hub) => (
        <HubCard
          key={hub.hub_id}
          hub={hub}
          onPress={() => {
            if (typeof onHubPress === "function") onHubPress(hub);
            else if (typeof onViewVault === "function") onViewVault();
          }}
        />
      ))}
    </View>
  );
}

function HubCard({ hub, onPress }) {
  const { fmt } = useCurrency();
  const st = hubStatusCfg(hub.status);
  const amount = fmt(hub.total_amount, hub.currency_code || "SAR");
  const returnDays = daysUntil(hub.return_deadline);
  const showReturn = hub.return_deadline && returnDays !== null && returnDays >= 0 && returnDays <= 14;

  return (
    <TouchableOpacity style={styles.hubCard} activeOpacity={0.9} onPress={onPress}>
      <View style={[styles.hubStrip, { backgroundColor: st.text }]} />
      <View style={[styles.hubIconWrap, { backgroundColor: st.bg }]}>
        <Ionicons name={st.icon} size={scale(17)} color={st.text} />
      </View>
      <View style={styles.hubBody}>
        <View style={styles.hubTopRow}>
          <Text style={styles.hubTitle} numberOfLines={1}>{hub.title}</Text>
          <Text style={styles.hubAmount}>{amount}</Text>
        </View>
        <View style={styles.hubMetaRow}>
          <Text style={styles.hubMerchant} numberOfLines={1}>{hub.merchant_name || "—"}</Text>
          <View style={styles.hubDotSep} />
          <Text style={styles.hubDate}>{shortDate(hub.purchase_date)}</Text>
        </View>
        <View style={styles.hubChipRow}>
          <View style={[styles.hubStatusChip, { backgroundColor: st.bg, borderColor: st.border }]}>
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
              <Text style={[styles.hubStatusText, { color: "#E0A100" }]}>
                {returnDays === 0 ? "Return today" : returnDays + "d to return"}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
      <Ionicons
        name="chevron-forward"
        size={scale(14)}
        color={VaultColors.textMuted}
        style={{ marginRight: scale(12) }}
      />
    </TouchableOpacity>
  );
}

// ── Sticky reminder strip ─────────────────────────────────────────────────────

function StickyReminderStrip({ reminders, onPress }) {
  const urgents = (reminders || [])
    .filter((r) => {
      const d = daysUntil(r.due_date);
      return d !== null && d >= 0 && d <= 30;
    })
    .slice(0, 2);

  if (!urgents.length) return null;

  return (
    <View style={styles.stickyStrip}>
      {urgents.map((r) => {
        const days = daysUntil(r.due_date);
        const isWarranty = r.type === "warranty_expiry";
        const label =
          days === 0 ? "Expires Today"
          : days === 1 ? "Expires Tomorrow"
          : `Expiring in ${days} Days`;
        return (
          <TouchableOpacity
            key={r.reminder_id}
            style={styles.stickyPill}
            activeOpacity={0.88}
            onPress={onPress}
          >
            <View style={styles.stickyIconWrap}>
              <Ionicons
                name={isWarranty ? "shield-outline" : "receipt-outline"}
                size={scale(14)}
                color={VaultColors.brandGoldDark}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.stickyTitle} numberOfLines={1}>
                {r.target_label || (isWarranty ? "Warranty" : "Receipt")}
              </Text>
              <Text style={styles.stickyLabel}>{label}</Text>
            </View>
            <Ionicons name="chevron-forward" size={scale(13)} color={VaultColors.textMuted} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ── Offline / Error ───────────────────────────────────────────────────────────

function OfflineBanner({ onRetry }) {
  return (
    <TouchableOpacity style={styles.offlineBanner} activeOpacity={0.9} onPress={onRetry}>
      <Ionicons name="cloud-offline-outline" size={scale(15)} color="#92400E" />
      <Text style={styles.offlineBannerText}>Offline — showing saved data</Text>
      <Text style={styles.offlineRetryText}>Tap to retry</Text>
    </TouchableOpacity>
  );
}

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
        <Text style={styles.retryBtnText}>  Retry</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function HomeScreen({ navigation }) {
  const { user } = useAuth();

  const [status, setStatus]       = useState("loading");
  const [isOffline, setIsOffline] = useState(false);
  const [data, setData]           = useState(null);

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
  const hasReminders = data?.reminders?.length > 0;

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerIconBtn}
          activeOpacity={0.88}
          onPress={() => navigation.openDrawer()}
        >
          <Ionicons name="menu-outline" size={scale(22)} color={VaultColors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            activeOpacity={0.88}
            onPress={() => nav("Reminders")}
          >
            <Ionicons name="notifications-outline" size={scale(20)} color={VaultColors.textPrimary} />
            {data?.summary?.openAttentionCount > 0 ? (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>
                  {data.summary.openAttentionCount > 9 ? "9+" : data.summary.openAttentionCount}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerIconBtn}
            activeOpacity={0.88}
            onPress={() => nav("AIAssistant")}
          >
            <Ionicons name="sparkles-outline" size={scale(20)} color={VaultColors.textPrimary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.avatarBtn} activeOpacity={0.88} onPress={() => nav("Profile")}>
            <Text style={styles.avatarBtnText}>{initial}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {isOffline ? <OfflineBanner onRetry={() => load(false)} /> : null}

      {status === "loading" && !data ? (
        <ScrollView showsVerticalScrollIndicator={false}>
          <HomeSkeleton />
        </ScrollView>
      ) : status === "error" ? (
        <ErrorState onRetry={() => load(false)} />
      ) : data ? (
        <>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: hasReminders ? scale(110) : scale(40) },
            ]}
          >
            {/* Greeting */}
            <View style={styles.greetingBlock}>
              <Text style={styles.greetingLine}>{greeting()},</Text>
              <Text style={styles.greetingName}>Hello, {shortName}.</Text>
            </View>

            {/* Search bar */}
            <SearchBar navigation={navigation} />

            {/* Quick Insights card */}
            <QuickInsightsCard summary={data.summary} onPress={() => nav("Reports")} />

            {/* Featured Stores */}
            {data.recommendedStores?.length > 0 && (
              <View style={styles.section}>
                <FeaturedStores
                  stores={data.recommendedStores}
                  onStorePress={(store) =>
                    store ? nav("StoreDetails", { storeId: store.store_id }) : nav("Stores")
                  }
                />
              </View>
            )}

            {/* Expiring Soon */}
            <View style={styles.section}>
              <ExpiringSoon
                hubs={data.recentHubs}
                reminders={data.reminders}
                onHubPress={(hub) => nav("HubDetail", { hubId: hub.hub_id })}
                onPress={() => nav("Reminders")}
              />
            </View>

            {/* Attention */}
            {data.attentionItems?.length > 0 && (
              <View style={styles.section}>
                <AttentionStrip
                  items={data.attentionItems}
                  onItemPress={() => nav("AttentionCenter")}
                  onSeeAll={() => nav("AttentionCenter")}
                />
              </View>
            )}

            {/* Recent Purchases */}
            <View style={styles.section}>
              <RecentPurchases
                hubs={data.recentHubs}
                onViewVault={() => nav("Vault")}
                onAddPress={() => nav("AddReceipt")}
                onHubPress={(hub) => nav("HubDetail", { hubId: hub.hub_id })}
              />
            </View>

            {data.fromCache && data.cacheAgeMs !== null ? (
              <View style={styles.cacheHint}>
                <Ionicons name="time-outline" size={scale(11)} color={VaultColors.textMuted} />
                <Text style={styles.cacheHintText}>
                  {"Updated " + Math.round(data.cacheAgeMs / 60000) + " min ago"}
                </Text>
              </View>
            ) : null}
          </ScrollView>

          {/* Sticky reminder strip */}
          <StickyReminderStrip
            reminders={data.reminders || []}
            onPress={() => nav("Reminders")}
          />

          {/* Floating AI button */}
          <TouchableOpacity
            style={styles.floatingAIBtn}
            activeOpacity={0.85}
            onPress={() => nav("AIAssistant")}
          >
            <Ionicons name="sparkles" size={scale(20)} color="#FEF7E6" />
          </TouchableOpacity>
        </>
      ) : null}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 0, backgroundColor: VaultColors.appBackground },

  header: {
    paddingHorizontal: VaultSpacing.screenPadding,
    paddingTop: scale(6),
    paddingBottom: scale(10),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
    ...VaultShadows.sm,
  },
  headerRight: { flexDirection: "row", alignItems: "center", gap: scale(10) },
  notifBadge: {
    position: "absolute",
    top: scale(6),
    right: scale(6),
    minWidth: scale(15),
    height: scale(15),
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
    ...VaultShadows.sm,
  },
  avatarBtnText: {
    color: "#FFFFFF",
    fontSize: getFontSize(16),
    fontFamily: "Poppins",
    fontWeight: "900",
  },

  scrollContent: {
    paddingHorizontal: VaultSpacing.screenPadding,
    paddingTop: scale(0),
  },
  section: { marginTop: scale(24) },

  greetingBlock: { marginBottom: scale(18), marginTop: scale(0) },
  greetingLine: {
    fontSize: getFontSize(12),
    color: VaultColors.textMuted,
    fontFamily: "Poppins",
    fontWeight: "600",
  },
  greetingName: {
    fontSize: getFontSize(28),
    color: VaultColors.textPrimary,
    fontFamily: "Poppins",
    fontWeight: "900",
    letterSpacing: -0.5,
    marginTop: scale(2),
  },
  greetingSubtitle: {
    fontSize: getFontSize(12),
    color: VaultColors.textMuted,
    fontFamily: "Poppins",
    fontWeight: "600",
    marginTop: scale(3),
  },

  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: VaultColors.surfaceAlt,
    borderRadius: VaultRadius.full,
    borderWidth: 1,
    borderColor: VaultColors.border,
    paddingHorizontal: scale(16),
    paddingVertical: scale(13),
    gap: scale(10),
    marginBottom: scale(20),
    ...VaultShadows.sm,
  },
  searchPlaceholder: {
    flex: 1,
    fontSize: getFontSize(13),
    color: VaultColors.textMuted,
    fontFamily: "Poppins",
    fontWeight: "600",
  },
  searchFilterBtn: {
    width: scale(32),
    height: scale(32),
    borderRadius: scale(10),
    backgroundColor: VaultColors.brandGoldSoft + "80",
    borderWidth: 1,
    borderColor: VaultColors.border,
    alignItems: "center",
    justifyContent: "center",
  },

  // Insights card
  insightsCard: {
    backgroundColor: VaultColors.brandGoldDark,
    borderRadius: scale(26),
    padding: scale(22),
    overflow: "hidden",
    ...VaultShadows.lg,
  },
  insightsDecorCircle1: {
    position: "absolute",
    width: scale(180),
    height: scale(180),
    borderRadius: scale(90),
    backgroundColor: "rgba(255,255,255,0.06)",
    top: scale(-55),
    right: scale(-35),
  },
  insightsDecorCircle2: {
    position: "absolute",
    width: scale(110),
    height: scale(110),
    borderRadius: scale(55),
    backgroundColor: "rgba(255,255,255,0.04)",
    bottom: scale(-25),
    left: scale(10),
  },
  insightsTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: scale(20),
  },
  insightsLabel: {
    fontSize: getFontSize(10),
    color: "rgba(254,247,230,0.6)",
    fontFamily: "Poppins",
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: scale(3),
  },
  insightsTitle: {
    fontSize: getFontSize(20),
    color: "#FFFFFF",
    fontFamily: "Poppins",
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  insightsBadge: {
    width: scale(42),
    height: scale(42),
    borderRadius: scale(14),
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  insightsStatRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(16),
    marginBottom: scale(20),
  },
  insightsStatNum: {
    fontSize: getFontSize(22),
    color: "#FFFFFF",
    fontFamily: "Poppins",
    fontWeight: "900",
    letterSpacing: -0.4,
  },
  insightsStatLabel: {
    fontSize: getFontSize(10),
    color: "rgba(254,247,230,0.62)",
    fontFamily: "Poppins",
    fontWeight: "600",
    marginTop: scale(2),
  },
  insightsDivider: {
    width: 1,
    height: scale(38),
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  insightsProgressTrack: {
    height: scale(5),
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: VaultRadius.full,
    overflow: "hidden",
    marginBottom: scale(8),
  },
  insightsProgressFill: {
    height: "100%",
    backgroundColor: "#FFD166",
    borderRadius: VaultRadius.full,
  },
  insightsMonthLabel: {
    fontSize: getFontSize(10),
    color: "rgba(254,247,230,0.52)",
    fontFamily: "Poppins",
    fontWeight: "700",
  },

  // Quick actions
  quickScroll: { gap: scale(10), paddingRight: scale(4) },
  quickChip: {
    alignItems: "center",
    gap: scale(8),
    backgroundColor: VaultColors.surfaceAlt,
    borderRadius: scale(20),
    borderWidth: 1,
    borderColor: VaultColors.border,
    paddingVertical: scale(14),
    paddingHorizontal: scale(12),
    minWidth: scale(78),
    ...VaultShadows.sm,
  },
  quickChipIcon: {
    width: scale(48),
    height: scale(48),
    borderRadius: scale(16),
    backgroundColor: VaultColors.brandGoldDark,
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

  // Section header
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: scale(14),
  },
  sectionTitle: {
    fontSize: getFontSize(16),
    color: VaultColors.textPrimary,
    fontFamily: "Poppins",
    fontWeight: "900",
    letterSpacing: -0.2,
  },
  sectionAction: {
    fontSize: getFontSize(12),
    color: VaultColors.brandGoldDark,
    fontFamily: "Poppins",
    fontWeight: "800",
  },

  // Featured stores
  featuredStoresScroll: { gap: scale(18), paddingRight: scale(4) },
  featuredStoreItem: { alignItems: "center", width: scale(70), gap: scale(8) },
  featuredStoreCircle: {
    width: scale(64),
    height: scale(64),
    borderRadius: scale(32),
    backgroundColor: VaultColors.surfaceAlt,
    borderWidth: 2,
    borderColor: VaultColors.border,
    overflow: "hidden",
    ...VaultShadows.md,
  },
  featuredStoreImg: { width: "100%", height: "100%" },
  featuredStoreName: {
    fontSize: getFontSize(10),
    color: VaultColors.textPrimary,
    fontFamily: "Poppins",
    fontWeight: "700",
    textAlign: "center",
    lineHeight: getFontSize(14),
  },

  // Expiring soon rows
  expiryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(12),
    backgroundColor: VaultColors.surfaceAlt,
    borderRadius: scale(18),
    borderWidth: 1,
    borderColor: VaultColors.border,
    padding: scale(14),
    marginBottom: scale(10),
    ...Platform.select({ android: { elevation: 3 }, ios: VaultShadows.sm }),
  },
  expiryIcon: {
    width: scale(44),
    height: scale(44),
    borderRadius: scale(14),
    alignItems: "center",
    justifyContent: "center",
  },
  expiryBody: { flex: 1, gap: scale(3) },
  expiryTitle: {
    fontSize: getFontSize(13),
    color: VaultColors.textPrimary,
    fontFamily: "Poppins",
    fontWeight: "800",
  },
  expiryMeta: {
    fontSize: getFontSize(11),
    color: VaultColors.textMuted,
    fontFamily: "Poppins",
    fontWeight: "600",
  },
  expiryRight: { alignItems: "flex-end", gap: scale(5) },
  expiryAmount: {
    fontSize: getFontSize(13),
    color: VaultColors.textSecondary,
    fontFamily: "Poppins",
    fontWeight: "900",
  },
  expiryCountdown: {
    borderRadius: VaultRadius.full,
    borderWidth: 1,
    paddingHorizontal: scale(9),
    paddingVertical: scale(4),
  },
  expiryCountdownText: {
    fontSize: getFontSize(10),
    fontFamily: "Poppins",
    fontWeight: "800",
  },

  // Attention
  attentionScroll: { gap: scale(12), paddingRight: scale(4) },
  attentionCard: {
    width: scale(196),
    borderRadius: scale(20),
    borderWidth: 1,
    padding: scale(14),
    gap: scale(6),
    ...VaultShadows.sm,
  },
  attentionIconWrap: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(12),
    backgroundColor: "rgba(255,255,255,0.55)",
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
    marginTop: scale(2),
  },

  // Hub cards
  hubCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: VaultColors.surfaceAlt,
    borderRadius: scale(20),
    borderWidth: 1,
    borderColor: VaultColors.border,
    marginBottom: scale(10),
    overflow: "hidden",
    ...Platform.select({ android: { elevation: 3 }, ios: VaultShadows.sm }),
  },
  hubStrip: { width: scale(4), alignSelf: "stretch", opacity: 0.75 },
  hubIconWrap: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(13),
    alignItems: "center",
    justifyContent: "center",
    marginLeft: scale(10),
  },
  hubBody: { flex: 1, padding: scale(12), gap: scale(4) },
  hubTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: scale(8),
  },
  hubTitle: {
    flex: 1,
    fontSize: getFontSize(13),
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
  hubMetaRow: { flexDirection: "row", alignItems: "center", gap: scale(6) },
  hubMerchant: {
    fontSize: getFontSize(11),
    color: VaultColors.textMuted,
    fontFamily: "Poppins",
    fontWeight: "700",
    maxWidth: scale(100),
  },
  hubDotSep: {
    width: scale(3),
    height: scale(3),
    borderRadius: scale(2),
    backgroundColor: VaultColors.textMuted,
  },
  hubDate: {
    fontSize: getFontSize(11),
    color: VaultColors.textMuted,
    fontFamily: "Poppins",
    fontWeight: "600",
  },
  hubChipRow: { flexDirection: "row", flexWrap: "wrap", gap: scale(5), marginTop: scale(4) },
  hubStatusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(4),
    borderRadius: VaultRadius.full,
    borderWidth: 1,
    paddingHorizontal: scale(8),
    paddingVertical: scale(3),
  },
  hubStatusText: {
    fontSize: getFontSize(9.5),
    fontFamily: "Poppins",
    fontWeight: "800",
    textTransform: "capitalize",
  },
  hubCatChip: {
    borderRadius: VaultRadius.full,
    backgroundColor: VaultColors.brandGoldSoft + "70",
    borderWidth: 1,
    borderColor: VaultColors.border,
    paddingHorizontal: scale(8),
    paddingVertical: scale(3),
  },
  hubCatText: {
    fontSize: getFontSize(9.5),
    color: VaultColors.textPrimary,
    fontFamily: "Poppins",
    fontWeight: "700",
  },

  // Empty
  emptyCard: {
    backgroundColor: VaultColors.surfaceAlt,
    borderRadius: scale(22),
    borderWidth: 1,
    borderColor: VaultColors.border,
    alignItems: "center",
    padding: scale(28),
    ...VaultShadows.sm,
  },
  emptyIconWrap: {
    width: scale(60),
    height: scale(60),
    borderRadius: scale(20),
    backgroundColor: VaultColors.brandGoldSoft + "50",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: scale(12),
  },
  emptyTitle: {
    fontSize: getFontSize(15),
    color: VaultColors.textPrimary,
    fontFamily: "Poppins",
    fontWeight: "900",
    marginBottom: scale(6),
  },
  emptyText: {
    fontSize: getFontSize(11),
    color: VaultColors.textMuted,
    fontFamily: "Poppins",
    fontWeight: "600",
    textAlign: "center",
    lineHeight: getFontSize(17),
    marginBottom: scale(18),
  },
  emptyBtn: {
    backgroundColor: VaultColors.brandGoldDark,
    borderRadius: VaultRadius.full,
    paddingVertical: scale(12),
    paddingHorizontal: scale(24),
    ...VaultShadows.sm,
  },
  emptyBtnText: {
    color: VaultColors.buttonTextOnGold,
    fontSize: getFontSize(12),
    fontFamily: "Poppins",
    fontWeight: "900",
  },

  // Sticky strip
  stickyStrip: {
    position: "absolute",
    bottom: scale(10),
    left: VaultSpacing.screenPadding,
    right: VaultSpacing.screenPadding,
    flexDirection: "row",
    gap: scale(10),
  },
  stickyPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: scale(8),
    backgroundColor: VaultColors.surfaceAlt,
    borderRadius: scale(16),
    borderWidth: 1.5,
    borderColor: VaultColors.border,
    paddingHorizontal: scale(12),
    paddingVertical: scale(10),
    ...VaultShadows.md,
  },
  stickyIconWrap: {
    width: scale(30),
    height: scale(30),
    borderRadius: scale(10),
    backgroundColor: VaultColors.brandGoldSoft + "60",
    alignItems: "center",
    justifyContent: "center",
  },
  stickyTitle: {
    fontSize: getFontSize(10.5),
    color: VaultColors.textPrimary,
    fontFamily: "Poppins",
    fontWeight: "800",
    lineHeight: getFontSize(14),
  },
  stickyLabel: {
    fontSize: getFontSize(9.5),
    color: VaultColors.brandGoldDark,
    fontFamily: "Poppins",
    fontWeight: "700",
  },

  // Floating AI button
  floatingAIBtn: {
    position: "absolute",
    bottom: scale(70),
    right: VaultSpacing.screenPadding,
    width: scale(56),
    height: scale(56),
    borderRadius: scale(28),
    backgroundColor: VaultColors.brandGoldDark,
    alignItems: "center",
    justifyContent: "center",
    ...VaultShadows.lg,
  },

  // Offline / Error
  offlineBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(8),
    backgroundColor: "#FEF3C7",
    borderBottomWidth: 1,
    borderBottomColor: "#F5D89A",
    paddingHorizontal: VaultSpacing.screenPadding,
    paddingVertical: scale(10),
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
    marginBottom: scale(16),
  },
  errorTitle: {
    fontSize: getFontSize(18),
    color: VaultColors.textPrimary,
    fontFamily: "Poppins",
    fontWeight: "900",
    textAlign: "center",
    marginBottom: scale(8),
  },
  errorText: {
    fontSize: getFontSize(12),
    color: VaultColors.textMuted,
    fontFamily: "Poppins",
    fontWeight: "600",
    textAlign: "center",
    lineHeight: getFontSize(19),
    marginBottom: scale(24),
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: VaultColors.brandGoldDark,
    borderRadius: VaultRadius.full,
    paddingVertical: scale(13),
    paddingHorizontal: scale(28),
    ...VaultShadows.md,
  },
  retryBtnText: {
    color: VaultColors.buttonTextOnGold,
    fontSize: getFontSize(14),
    fontFamily: "Poppins",
    fontWeight: "900",
  },

  cacheHint: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: scale(5),
    paddingVertical: scale(10),
    marginTop: scale(8),
  },
  cacheHintText: {
    fontSize: getFontSize(10),
    color: VaultColors.textMuted,
    fontFamily: "Poppins",
    fontWeight: "600",
  },
});