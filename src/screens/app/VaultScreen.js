/**
 * VaultScreen — Phase 6
 * Hub-centric list: search, status filters, sort, summary stats.
 * Each hub card navigates to HubDetailScreen.
 */
import React, { useCallback, useMemo, useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  StatusBar, Platform, TextInput, ScrollView, RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import Ionicons from "react-native-vector-icons/Ionicons";

import { useAuth } from "../../context/AuthContext";
import { useAlert } from "../../components/AlertProvider";
import Input from "../../components/Input";
import { VaultColors, VaultRadius, VaultShadows, VaultSpacing } from "../../styles/DesignSystem";
// Import scale helpers for responsive sizes. Without this import the
// scale and getFontSize functions would be undefined, causing runtime errors.
import { scale, getFontSize, verticalScale } from "../../utils/responsive";
import { listHubsFiltered } from "../../services/repo/repoHubs";
import { useCurrency } from "../../hooks/useCurrency";

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_FILTERS = [
  { key: "all",             label: "All"         },
  { key: "active",          label: "Active"      },
  { key: "under_warranty",  label: "Warranty"    },
  { key: "returnable",      label: "Returnable"  },
  { key: "out_of_warranty", label: "No warranty" },
  { key: "expired",         label: "Expired"     },
];

const SORT_OPTIONS = [
  { key: "date_desc",   label: "Newest first"  },
  { key: "date_asc",    label: "Oldest first"  },
  { key: "amount_desc", label: "Highest amount"},
  { key: "amount_asc",  label: "Lowest amount" },
  { key: "title_asc",   label: "Name A–Z"      },
];

const STATUS_STYLE = {
  active:          { bg: "#E8F8EE", border: "#A8DFC0", text: "#18A957", icon: "checkmark-circle-outline" },
  under_warranty:  { bg: "#EEF4FF", border: "#B0C8F0", text: "#2E6BD8", icon: "shield-checkmark-outline" },
  returnable:      { bg: "#FFF6E3", border: "#F5D89A", text: "#E0A100", icon: "time-outline"             },
  return_risk:     { bg: "#FDECEC", border: "#F5BABA", text: "#D64545", icon: "alert-circle-outline"     },
  out_of_warranty: { bg: "#F5F5F5", border: "#DCDCDC", text: "#888",    icon: "shield-outline"           },
  expired:         { bg: "#FDECEC", border: "#F5BABA", text: "#D64545", icon: "close-circle-outline"     },
};

function hubStatusStyle(s) {
  return STATUS_STYLE[s] || { bg: VaultColors.brandGoldSoft, border: VaultColors.border, text: VaultColors.textPrimary, icon: "cube-outline" };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function humanDate(value) {
  if (!value) return null;
  try {
    const raw = String(value);
    const d = raw.includes("T") ? new Date(raw) : new Date(`${raw}T00:00:00`);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString("en-SA", { month: "short", day: "numeric", year: "numeric" });
  } catch { return null; }
}

function daysUntil(value) {
  if (!value) return null;
  try {
    const d = new Date(String(value).includes("T") ? value : `${value}T00:00:00`);
    return Math.ceil((d.getTime() - Date.now()) / 86400000);
  } catch { return null; }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const FilterChip = ({ label, active, onPress }) => (
  <TouchableOpacity
    style={[styles.filterChip, active && styles.filterChipActive]}
    activeOpacity={0.82}
    onPress={onPress}
  >
    <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
  </TouchableOpacity>
);

function SortButton({ current, onSelect }) {
  const [open, setOpen] = useState(false);
  const label = SORT_OPTIONS.find((s) => s.key === current)?.label || "Sort";
  return (
    <View style={styles.sortWrap}>
      <TouchableOpacity style={styles.sortBtn} activeOpacity={0.82} onPress={() => setOpen((v) => !v)}>
        <Ionicons name="swap-vertical-outline" size={scale(14)} color={VaultColors.textPrimary} />
        <Text style={styles.sortBtnText} numberOfLines={1}>{label}</Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={scale(12)} color={VaultColors.textMuted} />
      </TouchableOpacity>
      {open ? (
        <View style={styles.sortDropdown}>
          {SORT_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={[styles.sortItem, opt.key === current && styles.sortItemActive]}
              activeOpacity={0.8}
              onPress={() => { onSelect(opt.key); setOpen(false); }}
            >
              <Text style={[styles.sortItemText, opt.key === current && styles.sortItemTextActive]}>{opt.label}</Text>
              {opt.key === current && <Ionicons name="checkmark" size={scale(14)} color={VaultColors.brandGoldDark} />}
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function HubCard({ hub, onPress, fmt }) {
  const st          = hubStatusStyle(hub.status);
  const amount      = fmt(hub.total_amount, hub.currency_code || "SAR");
  const dateStr     = humanDate(hub.purchase_date);
  const returnDays  = daysUntil(hub.return_deadline);
  const hasPending  = hub.sync_status === "pending";
  const showReturn  = hub.return_deadline && returnDays !== null && returnDays <= 14;

  return (
    <TouchableOpacity style={styles.hubCard} activeOpacity={0.88} onPress={onPress}>
      <View style={[styles.hubStrip, { backgroundColor: st.text }]} />
      <View style={styles.hubInner}>
        <View style={styles.hubTopRow}>
          <View style={[styles.hubIconWrap, { backgroundColor: st.bg }]}>
            <Ionicons name={st.icon} size={scale(18)} color={st.text} />
          </View>
          <View style={styles.hubTitleBlock}>
            <Text style={styles.hubTitle} numberOfLines={1}>{hub.title || "Purchase"}</Text>
            {hub.merchant_name ? (
              <Text style={styles.hubMerchant} numberOfLines={1}>{hub.merchant_name}</Text>
            ) : null}
          </View>
          <View style={styles.hubAmountCol}>
            <Text style={styles.hubAmount}>{amount}</Text>
            {hasPending ? (
              <Ionicons name="cloud-upload-outline" size={scale(11)} color={VaultColors.warning} />
            ) : null}
          </View>
        </View>

        <View style={styles.hubMetaRow}>
          {dateStr ? (
            <View style={styles.hubMetaChip}>
              <Ionicons name="calendar-outline" size={scale(11)} color={VaultColors.textMuted} />
              <Text style={styles.hubMetaText}>{dateStr}</Text>
            </View>
          ) : null}
          {hub.category_name_snapshot ? (
            <View style={styles.hubMetaChip}>
              <Ionicons name="pricetag-outline" size={scale(11)} color={VaultColors.textMuted} />
              <Text style={styles.hubMetaText}>{hub.category_name_snapshot}</Text>
            </View>
          ) : null}
          {hub.receipt_id ? (
            <View style={styles.hubMetaChip}>
              <Ionicons name="receipt-outline" size={scale(11)} color={VaultColors.textMuted} />
              <Text style={styles.hubMetaText}>Receipt</Text>
            </View>
          ) : null}
          {hub.warranty_id ? (
            <View style={styles.hubMetaChip}>
              <Ionicons name="shield-checkmark-outline" size={scale(11)} color={VaultColors.textMuted} />
              <Text style={styles.hubMetaText}>Warranty</Text>
            </View>
          ) : null}
          {Number(hub.service_history_count) > 0 ? (
            <View style={styles.hubMetaChip}>
              <Ionicons name="construct-outline" size={scale(11)} color={VaultColors.textMuted} />
              <Text style={styles.hubMetaText}>{hub.service_history_count} service</Text>
            </View>
          ) : null}
        </View>

        {showReturn ? (
          <View style={styles.hubAlertRow}>
            <View style={[styles.alertBadge, returnDays <= 0 ? styles.alertBadgeDanger : styles.alertBadgeWarn]}>
              <Ionicons name="time-outline" size={scale(11)} color={returnDays <= 0 ? VaultColors.error : VaultColors.warning} />
              <Text style={[styles.alertBadgeText, returnDays <= 0 ? styles.alertTextDanger : styles.alertTextWarn]}>
                {returnDays <= 0 ? "Return window closed" : `${returnDays}d to return`}
              </Text>
            </View>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

function EmptyState({ filter, onAdd }) {
  return (
    <View style={styles.emptyBox}>
      <View style={styles.emptyIconWrap}>
        <Ionicons name="cube-outline" size={scale(36)} color={VaultColors.textSecondary} />
      </View>
      <Text style={styles.emptyTitle}>{filter !== "all" ? "No matching purchases" : "Your vault is empty"}</Text>
      <Text style={styles.emptyText}>
        {filter !== "all"
          ? "Try a different filter or search term."
          : "Add your first receipt to start building your purchase history."}
      </Text>
      {filter === "all" ? (
        <TouchableOpacity style={styles.emptyBtn} activeOpacity={0.9} onPress={onAdd}>
          <Text style={styles.emptyBtnText}>Add receipt</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function VaultScreen({ navigation }) {
  const { user } = useAuth();
  const alert    = useAlert();
  const uid      = user?.uid;
  const { fmt, baseCurrency, sumToBase } = useCurrency();

  const [hubs,      setHubs]      = useState([]);
  const [q,         setQ]         = useState("");
  const [status,    setStatus]    = useState("all");
  const [sort,      setSort]      = useState("date_desc");
  const [loading,   setLoading]   = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    try {
      const rows = await listHubsFiltered(uid, { q: q.trim(), status, sort, limit: 300 });
      setHubs(rows || []);
    } catch {
      alert?.error?.("Error", "Failed to load vault.");
    } finally {
      setLoading(false);
    }
  }, [uid, q, status, sort, alert]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const totalValue    = useMemo(() => sumToBase(hubs), [hubs, sumToBase]);
  const warrantyCount = useMemo(() => hubs.filter((h) => h.warranty_id).length, [hubs]);
  const urgentCount   = useMemo(() => hubs.filter((h) => {
    const d = daysUntil(h.return_deadline);
    return d !== null && d >= 0 && d <= 7;
  }).length, [hubs]);

  const ListHeader = (
    <>
      <View style={[styles.pageHeader, { paddingTop: 0 }]}>
        <View>
          <Text style={styles.pageTitle}>Vault</Text>
          <Text style={styles.pageSub}>Your purchases, all in one place.</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} activeOpacity={0.9} onPress={() => navigation.navigate("AddItem")}>
          <Ionicons name="add" size={scale(22)} color={VaultColors.buttonTextOnGold} />
        </TouchableOpacity>
      </View>

      <View style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <View>
            <Text style={styles.heroEyebrow}>Total tracked value</Text>
            <Text style={styles.heroValue}>{fmt(totalValue, baseCurrency)}</Text>
          </View>
          <View style={styles.heroIconWrap}>
            <Ionicons name="cube-outline" size={scale(22)} color={VaultColors.buttonTextOnGold} />
          </View>
        </View>
        <View style={styles.statRow}>
          <View style={styles.statCell}>
            <Text style={styles.statNum}>{hubs.length}</Text>
            <Text style={styles.statLabel}>Purchases</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCell}>
            <Text style={styles.statNum}>{warrantyCount}</Text>
            <Text style={styles.statLabel}>With warranty</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCell}>
            <Text style={[styles.statNum, urgentCount > 0 && { color: VaultColors.error }]}>{urgentCount}</Text>
            <Text style={styles.statLabel}>Urgent</Text>
          </View>
        </View>
      </View>

      <View style={styles.quickRow}>
        <TouchableOpacity style={[styles.quickCard, styles.quickCardPrimary]} activeOpacity={0.9} onPress={() => navigation.navigate("AddReceipt")}>
          <Ionicons name="scan-outline" size={scale(16)} color={VaultColors.buttonTextOnGold} />
          <Text style={styles.quickLabelPrimary}>Add receipt</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickCard} activeOpacity={0.9} onPress={() => navigation.navigate("AddWarranty")}>
          <Ionicons name="shield-half-outline" size={scale(16)} color={VaultColors.textPrimary} />
          <Text style={styles.quickLabel}>Add warranty</Text>
        </TouchableOpacity>
      </View>

      <Input
        placeholder="Search purchases, merchants, categories…"
        leftIcon="search"
        value={q}
        onChangeText={setQ}
        style={styles.searchInputWrap}
        inputStyle={styles.searchInput}
        suffix={q.length > 0 ? (
          <TouchableOpacity onPress={() => setQ("")} activeOpacity={0.8}>
            <Ionicons name="close-circle" size={scale(17)} color={VaultColors.textMuted} />
          </TouchableOpacity>
        ) : null}
      />

      <View style={styles.controlsRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {STATUS_FILTERS.map((f) => (
            <FilterChip key={f.key} label={f.label} active={status === f.key} onPress={() => setStatus(f.key)} />
          ))}
        </ScrollView>
        <SortButton current={sort} onSelect={setSort} />
      </View>

      <View style={styles.listMeta}>
        <Text style={styles.listMetaText}>{hubs.length} purchase{hubs.length !== 1 ? "s" : ""}</Text>
      </View>
    </>
  );

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor={VaultColors.appBackground} />

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
            onPress={() => navigation.navigate("AIAssistant")}
          >
            <Ionicons name="sparkles-outline" size={scale(20)} color={VaultColors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={hubs}
        keyExtractor={(item) => String(item.hub_id)}
        contentContainerStyle={[styles.listContent, { paddingBottom: verticalScale(32) }]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={ListHeader}
        renderItem={({ item }) => (
          <HubCard
            hub={item}
            fmt={fmt}
            onPress={() => navigation.navigate("HubDetail", { hubId: item.hub_id })}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: scale(10) }} />}
        ListEmptyComponent={
          !loading ? <EmptyState filter={status} onAdd={() => navigation.navigate("AddReceipt")} /> : null
        }
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
  container: { flex: 1, backgroundColor: VaultColors.appBackground },

  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: VaultSpacing.screenPadding, paddingTop: scale(6), paddingBottom: scale(10) },
  headerIconBtn: { width: scale(40), height: scale(40), borderRadius: scale(14), alignItems: "center", justifyContent: "center", backgroundColor: VaultColors.surfaceAlt, borderWidth: 1, borderColor: VaultColors.border, ...Platform.select({ android: { elevation: 1 }, ios: VaultShadows.sm }) },
  headerRight: { flexDirection: "row", gap: scale(8) },

  listContent: { paddingHorizontal: VaultSpacing.screenPadding, paddingTop: scale(4) },

  pageHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: scale(14) },
  pageTitle: { fontSize: getFontSize(26), color: VaultColors.textPrimary, fontFamily: "Poppins", fontWeight: "900" },
  pageSub: { marginTop: scale(3), fontSize: getFontSize(12), color: VaultColors.textMuted, fontFamily: "Poppins", fontWeight: "600" },
  addBtn: { width: scale(46), height: scale(46), borderRadius: scale(23), backgroundColor: VaultColors.brandGoldDark, alignItems: "center", justifyContent: "center", ...Platform.select({ android: { elevation: 4 }, ios: VaultShadows.md }) },

  heroCard: { backgroundColor: VaultColors.surfaceAlt, borderRadius: scale(24), borderWidth: 1.5, borderColor: VaultColors.border, padding: scale(16), ...Platform.select({ android: { elevation: 2 }, ios: VaultShadows.sm }) },
  heroTopRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: scale(14) },
  heroEyebrow: { fontSize: getFontSize(11), color: VaultColors.textSecondary, fontFamily: "Poppins", fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: scale(4) },
  heroValue: { fontSize: getFontSize(26), color: VaultColors.textPrimary, fontFamily: "Poppins", fontWeight: "900" },
  heroIconWrap: { width: scale(48), height: scale(48), borderRadius: scale(16), backgroundColor: VaultColors.brandGoldDark, alignItems: "center", justifyContent: "center" },

  statRow: { flexDirection: "row", alignItems: "center", paddingTop: scale(12), borderTopWidth: 1, borderTopColor: VaultColors.border },
  statCell: { flex: 1, alignItems: "center" },
  statNum: { fontSize: getFontSize(18), color: VaultColors.textPrimary, fontFamily: "Poppins", fontWeight: "900" },
  statLabel: { fontSize: getFontSize(10), color: VaultColors.textMuted, fontFamily: "Poppins", fontWeight: "700", marginTop: 2 },
  statDivider: { width: 1, height: scale(34), backgroundColor: VaultColors.border },

  quickRow: { flexDirection: "row", gap: scale(10), marginTop: scale(12) },
  quickCard: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: scale(7), paddingVertical: scale(12), borderRadius: scale(18), borderWidth: 1.5, borderColor: VaultColors.border, backgroundColor: VaultColors.surfaceAlt },
  quickCardPrimary: { backgroundColor: VaultColors.brandGoldDark, borderColor: VaultColors.brandGoldDark },
  quickLabel: { fontSize: getFontSize(12), color: VaultColors.textPrimary, fontFamily: "Poppins", fontWeight: "800" },
  quickLabelPrimary: { fontSize: getFontSize(12), color: VaultColors.buttonTextOnGold, fontFamily: "Poppins", fontWeight: "800" },

  searchInputWrap: { marginTop: scale(14) },
  searchInput: { fontSize: getFontSize(13), fontWeight: "600" },

  controlsRow: { marginTop: scale(12), flexDirection: "row", alignItems: "center", gap: scale(8) },
  filterRow: { gap: scale(8), paddingRight: scale(4) },
  filterChip: { paddingVertical: scale(7), paddingHorizontal: scale(14), borderRadius: VaultRadius.full, borderWidth: 1.5, borderColor: VaultColors.border, backgroundColor: VaultColors.surfaceAlt },
  filterChipActive: { backgroundColor: VaultColors.brandGoldDark, borderColor: VaultColors.brandGoldDark },
  filterChipText: { fontSize: getFontSize(12), color: VaultColors.textPrimary, fontFamily: "Poppins", fontWeight: "800" },
  filterChipTextActive: { color: VaultColors.buttonTextOnGold },

  sortWrap: { position: "relative" },
  sortBtn: { flexDirection: "row", alignItems: "center", gap: scale(5), paddingVertical: scale(7), paddingHorizontal: scale(12), borderRadius: VaultRadius.full, borderWidth: 1.5, borderColor: VaultColors.border, backgroundColor: VaultColors.surfaceAlt },
  sortBtnText: { fontSize: getFontSize(11), color: VaultColors.textPrimary, fontFamily: "Poppins", fontWeight: "800", maxWidth: scale(80) },
  sortDropdown: { position: "absolute", top: scale(38), right: 0, backgroundColor: VaultColors.surfaceAlt, borderRadius: scale(16), borderWidth: 1.5, borderColor: VaultColors.border, width: scale(170), zIndex: 100, ...Platform.select({ android: { elevation: 8 }, ios: VaultShadows.md }) },
  sortItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: scale(11), paddingHorizontal: scale(14), borderBottomWidth: 1, borderBottomColor: VaultColors.border },
  sortItemActive: { backgroundColor: VaultColors.brandGoldSoft },
  sortItemText: { fontSize: getFontSize(12), color: VaultColors.textPrimary, fontFamily: "Poppins", fontWeight: "700" },
  sortItemTextActive: { color: VaultColors.brandGoldDark, fontWeight: "900" },

  listMeta: { marginTop: scale(14), marginBottom: scale(8) },
  listMetaText: { fontSize: getFontSize(11), color: VaultColors.textMuted, fontFamily: "Poppins", fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },

  hubCard: { flexDirection: "row", backgroundColor: VaultColors.surfaceAlt, borderRadius: scale(22), borderWidth: 1.5, borderColor: VaultColors.border, overflow: "hidden", ...Platform.select({ android: { elevation: 1 }, ios: VaultShadows.sm }) },
  hubStrip: { width: scale(4) },
  hubInner: { flex: 1, padding: scale(12) },
  hubTopRow: { flexDirection: "row", alignItems: "flex-start", gap: scale(10) },
  hubIconWrap: { width: scale(38), height: scale(38), borderRadius: scale(13), alignItems: "center", justifyContent: "center" },
  hubTitleBlock: { flex: 1 },
  hubTitle: { fontSize: getFontSize(14), color: VaultColors.textPrimary, fontFamily: "Poppins", fontWeight: "900" },
  hubMerchant: { marginTop: 2, fontSize: getFontSize(11), color: VaultColors.textMuted, fontFamily: "Poppins", fontWeight: "600" },
  hubAmountCol: { alignItems: "flex-end", gap: scale(3) },
  hubAmount: { fontSize: getFontSize(13), color: VaultColors.textSecondary, fontFamily: "Poppins", fontWeight: "900" },

  hubMetaRow: { flexDirection: "row", flexWrap: "wrap", gap: scale(6), marginTop: scale(10) },
  hubMetaChip: { flexDirection: "row", alignItems: "center", gap: scale(4), paddingVertical: scale(4), paddingHorizontal: scale(9), borderRadius: VaultRadius.full, backgroundColor: VaultColors.appBackground, borderWidth: 1, borderColor: VaultColors.border },
  hubMetaText: { fontSize: getFontSize(10), color: VaultColors.textMuted, fontFamily: "Poppins", fontWeight: "700" },

  hubAlertRow: { flexDirection: "row", flexWrap: "wrap", gap: scale(6), marginTop: scale(8) },
  alertBadge: { flexDirection: "row", alignItems: "center", gap: scale(4), paddingVertical: scale(4), paddingHorizontal: scale(9), borderRadius: VaultRadius.full, borderWidth: 1 },
  alertBadgeWarn: { flexDirection: "row", alignItems: "center", gap: scale(4), paddingVertical: scale(4), paddingHorizontal: scale(9), borderRadius: VaultRadius.full, borderWidth: 1, backgroundColor: VaultColors.warningSoft, borderColor: VaultColors.warning },
  alertBadgeDanger: { backgroundColor: VaultColors.errorSoft, borderColor: VaultColors.error },
  alertBadgeText: { fontSize: getFontSize(10), fontFamily: "Poppins", fontWeight: "800" },
  alertTextWarn: { fontSize: getFontSize(10), fontFamily: "Poppins", fontWeight: "800", color: VaultColors.warning },
  alertTextDanger: { fontSize: getFontSize(10), fontFamily: "Poppins", fontWeight: "800", color: VaultColors.error },

  emptyBox: { marginTop: scale(12), alignItems: "center", backgroundColor: VaultColors.surfaceAlt, borderRadius: scale(24), borderWidth: 1.5, borderColor: VaultColors.border, paddingVertical: scale(28), paddingHorizontal: scale(22) },
  emptyIconWrap: { width: scale(72), height: scale(72), borderRadius: scale(24), backgroundColor: VaultColors.brandGoldSoft, alignItems: "center", justifyContent: "center" },
  emptyTitle: { marginTop: scale(14), fontSize: getFontSize(17), color: VaultColors.textPrimary, fontFamily: "Poppins", fontWeight: "900" },
  emptyText: { marginTop: scale(8), fontSize: getFontSize(12), lineHeight: getFontSize(20), color: VaultColors.textMuted, fontFamily: "Poppins", fontWeight: "600", textAlign: "center" },
  emptyBtn: { marginTop: scale(16), backgroundColor: VaultColors.brandGoldDark, borderRadius: VaultRadius.full, paddingVertical: scale(11), paddingHorizontal: scale(20) },
  emptyBtnText: { color: VaultColors.buttonTextOnGold, fontSize: getFontSize(12), fontFamily: "Poppins", fontWeight: "900" },
});
