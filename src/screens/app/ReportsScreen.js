/**
 * ReportsScreen — Phase 11
 *
 * Premium financial dashboard. Sections:
 *
 *   ┌─ Hero card ──────────────────────────────────────────────────────┐
 *   │  Month  ·  Total spend  ·  vs previous month trend arrow          │
 *   │  Executive summary (Firebase server-generated text)               │
 *   └──────────────────────────────────────────────────────────────────┘
 *   ┌─ Protection row ─────────────────────────────────────────────────┐
 *   │  Protected value  |  Recovered value  |  Expiring warranties      │
 *   └──────────────────────────────────────────────────────────────────┘
 *   ┌─ Spend trend sparkline ──────────────────────────────────────────┐
 *   │  6-month bar chart (pure SVG, no external library)                │
 *   └──────────────────────────────────────────────────────────────────┘
 *   ┌─ Category breakdown ─────────────────────────────────────────────┐
 *   │  Progress bars with converted amounts                             │
 *   └──────────────────────────────────────────────────────────────────┘
 *   ┌─ Merchant breakdown ─────────────────────────────────────────────┐
 *   │  Vendor + hub-level merchant breakdown side by side               │
 *   └──────────────────────────────────────────────────────────────────┘
 *   Month picker chip rail
 */

import React, { useMemo } from "react";
import {
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "react-native-vector-icons/Ionicons";
import Svg, { Rect, Text as SvgText, Line } from "react-native-svg";

import useReports from "../../hooks/useReports";
import { useCurrency } from "../../hooks/useCurrency";
import { scale, getFontSize, getSpacing } from "../../utils/responsive";
import { VaultColors, VaultRadius, VaultShadows, VaultSpacing } from "../../styles/DesignSystem";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pct(total, part) {
  if (!total || !part) return 0;
  return Math.min(100, Math.round((Number(part) / Number(total)) * 100));
}

function shortMonth(monthKey) {
  if (!monthKey) return "";
  try {
    const [y, m] = String(monthKey).split("-");
    const d = new Date(Number(y), Number(m) - 1, 1);
    return d.toLocaleDateString("en-SA", { month: "short" });
  } catch { return String(monthKey).slice(5); }
}

function longMonth(monthKey) {
  if (!monthKey) return "—";
  try {
    const [y, m] = String(monthKey).split("-");
    const d = new Date(Number(y), Number(m) - 1, 1);
    return d.toLocaleDateString("en-SA", { month: "long", year: "numeric" });
  } catch { return String(monthKey); }
}

// ─── Trend Sparkline (pure SVG — no external chart library) ──────────────────

const CHART_W = 280;
const CHART_H = 72;
const BAR_GAP = 6;

function TrendSparkline({ trend, baseCurrency, fmt }) {
  if (!trend || trend.length < 2) return null;

  const maxVal = Math.max(...trend.map((t) => t.total_spend), 1);
  const count  = trend.length;
  const barW   = Math.floor((CHART_W - BAR_GAP * (count - 1)) / count);

  return (
    <Svg width={CHART_W} height={CHART_H + 20} viewBox={`0 0 ${CHART_W} ${CHART_H + 20}`}>
      {/* Baseline */}
      <Line
        x1={0} y1={CHART_H} x2={CHART_W} y2={CHART_H}
        stroke={VaultColors.border} strokeWidth={1}
      />
      {trend.map((item, i) => {
        const barH  = Math.max(4, Math.round((item.total_spend / maxVal) * (CHART_H - 8)));
        const x     = i * (barW + BAR_GAP);
        const y     = CHART_H - barH;
        const isLast = i === trend.length - 1;
        return (
          <React.Fragment key={item.month}>
            <Rect
              x={x} y={y} width={barW} height={barH}
              rx={3}
              fill={isLast ? VaultColors.brandGoldDark : VaultColors.brandGoldSoft}
            />
            <SvgText
              x={x + barW / 2} y={CHART_H + 14}
              textAnchor="middle"
              fontSize={9}
              fill={VaultColors.textMuted}
              fontWeight="600"
            >
              {shortMonth(item.month)}
            </SvgText>
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const Card = ({ children, style }) => (
  <View style={[styles.card, style]}>{children}</View>
);

const SectionLabel = ({ text }) => (
  <Text style={styles.sectionLabel}>{text}</Text>
);

const ProtectionTile = ({ icon, label, value, color, note }) => (
  <View style={[styles.protTile, { borderColor: color + "44" }]}>
    <View style={[styles.protIcon, { backgroundColor: color + "18" }]}>
      <Ionicons name={icon} size={scale(16)} color={color} />
    </View>
    <Text style={[styles.protValue, { color }]} numberOfLines={1}>{value}</Text>
    <Text style={styles.protLabel}>{label}</Text>
    {!!note ? <Text style={styles.protNote}>{note}</Text> : null}
  </View>
);

const BreakdownRow = ({ title, amount, percent, color = VaultColors.brandGoldDark }) => (
  <View style={styles.bRow}>
    <View style={styles.bRowTop}>
      <Text style={styles.bRowTitle} numberOfLines={1}>{title}</Text>
      <Text style={styles.bRowAmount}>{amount}</Text>
    </View>
    <View style={styles.bTrack}>
      <View style={[styles.bFill, { width: `${Math.max(4, percent)}%`, backgroundColor: color }]} />
    </View>
    <Text style={styles.bPct}>{percent}%</Text>
  </View>
);

const InsightRow = ({ icon, text, tone }) => {
  const bgColor   = tone === "good" ? "#EEF9F2" : tone === "warn" ? "#FFF6E8" : VaultColors.appBackground;
  const bdColor   = tone === "good" ? "#BEE6CB" : tone === "warn" ? "#F6D8A2" : VaultColors.border;
  const iconColor = tone === "good" ? VaultColors.success : tone === "warn" ? VaultColors.warning : VaultColors.brandGoldDark;
  const txtColor  = tone === "good" ? "#1A6E3C"  : tone === "warn" ? "#7A4A00" : VaultColors.textPrimary;
  return (
    <View style={[styles.insightRow, { backgroundColor: bgColor, borderColor: bdColor }]}>
      <Ionicons name={icon} size={scale(14)} color={iconColor} />
      <Text style={[styles.insightText, { color: txtColor }]}>{text}</Text>
    </View>
  );
};

const MonthChip = ({ label, active, onPress }) => (
  <TouchableOpacity
    style={[styles.monthChip, active && styles.monthChipActive]}
    activeOpacity={0.85}
    onPress={onPress}
  >
    <Text style={[styles.monthChipText, active && styles.monthChipTextActive]}>
      {label}
    </Text>
  </TouchableOpacity>
);

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function ReportsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { fmt } = useCurrency();

  const {
    months, selectedMonth, report, prevReport,
    catMap, loading, refreshing,
    selectMonth, refresh, baseCurrency,
  } = useReports();

  // ── Derived values ──────────────────────────────────────────────────────
  const total       = Number(report?.total_spend       || 0);
  const prevTotal   = Number(prevReport?.total_spend   || 0);
  const delta       = total - prevTotal;
  const deltaPct    = prevTotal > 0 ? (delta / prevTotal) * 100 : 0;
  const receipts    = Number(report?.receipt_count     || 0);
  const avgSpend    = receipts > 0 ? total / receipts : 0;
  const protected_  = Number(report?.protected_value   || 0);
  const recovered_  = Number(report?.recovered_value   || 0);
  const expiring    = Number(report?.expiring_warranty_count || 0);
  const summary     = report?.executive_summary        || null;

  const topCats = useMemo(() => {
    return (report?.by_category || []).slice(0, 6).map((x) => ({
      id: String(x.category_id || "0"),
      name: catMap[String(x.category_id)] || `Category ${x.category_id}`,
      total: Number(x.total || 0),
      percent: pct(total, x.total),
    }));
  }, [report?.by_category, catMap, total]);

  const topMerchants = useMemo(() => {
    // Prefer hub-level merchant breakdown; fall back to receipt vendor breakdown
    const source = report?.by_merchant?.length
      ? report.by_merchant.map((x) => ({ name: x.merchant, total: x.total }))
      : (report?.by_vendor || []).map((x) => ({ name: x.vendor, total: x.total }));
    return source.slice(0, 6).map((x) => ({
      ...x,
      percent: pct(total, x.total),
    }));
  }, [report?.by_merchant, report?.by_vendor, total]);

  const insights = useMemo(() => {
    if (!selectedMonth || !report) return [];
    const rows = [];
    if (receipts > 0)
      rows.push({ icon: "receipt-outline", text: `${receipts} receipt${receipts !== 1 ? "s" : ""} recorded for ${longMonth(selectedMonth)}.`, tone: "default" });
    if (topCats[0])
      rows.push({ icon: "pricetag-outline", text: `${topCats[0].name} is your biggest spend category.`, tone: "default" });
    if (topMerchants[0])
      rows.push({ icon: "storefront-outline", text: `${topMerchants[0].name} is your top store by spend.`, tone: "default" });
    if (prevTotal > 0 && delta < 0)
      rows.push({ icon: "trending-down-outline", text: `Spending is down ${Math.abs(deltaPct).toFixed(0)}% from the previous month.`, tone: "good" });
    if (prevTotal > 0 && delta > 0)
      rows.push({ icon: "trending-up-outline", text: `Spending is up ${Math.abs(deltaPct).toFixed(0)}% from the previous month.`, tone: "warn" });
    if (expiring > 0)
      rows.push({ icon: "shield-outline", text: `${expiring} warranty${expiring !== 1 ? "ies" : ""} expiring within 90 days.`, tone: "warn" });
    return rows.slice(0, 5);
  }, [selectedMonth, report, receipts, topCats, topMerchants, prevTotal, delta, deltaPct, expiring]);

  const isEmpty = !months.length && !loading;

  return (
    <SafeAreaView style={styles.root} edges={["bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor={VaultColors.appBackground} />

      {/* ── Header ──────────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.85}>
          <Ionicons name="chevron-back" size={scale(20)} color={VaultColors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Reports</Text>
          <Text style={styles.headerSub}>Financial overview · {baseCurrency}</Text>
        </View>
        <View style={{ width: scale(42) }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: scale(40) }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={VaultColors.brandGold}
            colors={[VaultColors.brandGold]}
          />
        }
      >
        {/* ── Month picker ────────────────────────────────────────── */}
        {months.length > 0 ? (
          <View style={styles.monthPickerWrap}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.monthRow}>
              {months.slice(0, 24).map((m) => (
                <MonthChip key={m} label={m} active={m === selectedMonth} onPress={() => selectMonth(m)} />
              ))}
            </ScrollView>
          </View>
        ) : null}

        {isEmpty ? (
          /* ── Empty state ────────────────────────────────────────── */
          <View style={styles.emptyBox}>
            <View style={styles.emptyIcon}>
              <Ionicons name="bar-chart-outline" size={scale(32)} color={VaultColors.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>No report data yet</Text>
            <Text style={styles.emptyText}>
              Save your first receipts and purchase hubs to unlock monthly reports, protection metrics, and spending insights.
            </Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.navigate("AddReceipt")} activeOpacity={0.87}>
              <Text style={styles.emptyBtnText}>Add first receipt</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* ── Hero card ──────────────────────────────────────── */}
            <Card style={styles.heroCard}>
              <View style={styles.heroTop}>
                <View>
                  <Text style={styles.heroEyebrow}>Total spending</Text>
                  <Text style={styles.heroMonth}>{longMonth(selectedMonth)}</Text>
                </View>
                <View style={styles.heroIconWrap}>
                  <Ionicons name="bar-chart-outline" size={scale(20)} color="#FEF7E6" />
                </View>
              </View>

              <Text style={styles.heroTotal}>{fmt(total, baseCurrency)}</Text>

              {/* Delta badge */}
              {prevTotal > 0 ? (
                <View style={[styles.deltaBadge, delta < 0 ? styles.deltaBadgeGood : styles.deltaBadgeWarn]}>
                  <Ionicons
                    name={delta < 0 ? "trending-down" : "trending-up"}
                    size={scale(12)}
                    color={delta < 0 ? VaultColors.success : VaultColors.warning}
                  />
                  <Text style={[styles.deltaText, delta < 0 ? styles.deltaTextGood : styles.deltaTextWarn]}>
                    {delta >= 0 ? "+" : ""}{deltaPct.toFixed(0)}% vs {longMonth(prevReport?.period)}
                  </Text>
                </View>
              ) : null}

              {/* Executive summary */}
              {summary ? (
                <View style={styles.summaryWrap}>
                  <Ionicons name="sparkles-outline" size={scale(12)} color={VaultColors.brandGoldDark} />
                  <Text style={styles.summaryText}>{summary}</Text>
                </View>
              ) : null}

              {/* KPI row */}
              <View style={styles.kpiRow}>
                <View style={styles.kpiItem}>
                  <Text style={styles.kpiVal}>{receipts}</Text>
                  <Text style={styles.kpiLbl}>Receipts</Text>
                </View>
                <View style={styles.kpiDivider} />
                <View style={styles.kpiItem}>
                  <Text style={styles.kpiVal}>{fmt(avgSpend, baseCurrency)}</Text>
                  <Text style={styles.kpiLbl}>Avg / receipt</Text>
                </View>
                <View style={styles.kpiDivider} />
                <View style={styles.kpiItem}>
                  <Text style={styles.kpiVal}>{Number(report?.hub_count || 0)}</Text>
                  <Text style={styles.kpiLbl}>Hubs</Text>
                </View>
              </View>
            </Card>

            {/* ── Protection row ─────────────────────────────────── */}
            <View style={styles.protRow}>
              <ProtectionTile
                icon="shield-checkmark-outline"
                label="Protected"
                value={fmt(protected_, baseCurrency)}
                color={VaultColors.success}
                note="Active + under warranty"
              />
              <ProtectionTile
                icon="refresh-outline"
                label="Recovered"
                value={fmt(recovered_, baseCurrency)}
                color={VaultColors.info}
                note="Returned purchases"
              />
              <ProtectionTile
                icon="alarm-outline"
                label="Expiring"
                value={String(expiring)}
                color={expiring > 0 ? VaultColors.warning : VaultColors.textMuted}
                note="Warranties in 90d"
              />
            </View>

            {/* ── Spend trend sparkline ──────────────────────────── */}
            {report?.trend?.length >= 2 ? (
              <Card>
                <SectionLabel text="Spend trend" />
                <View style={styles.sparklineWrap}>
                  <TrendSparkline trend={report.trend} baseCurrency={baseCurrency} fmt={fmt} />
                  <Text style={styles.sparklineNote}>
                    Last {report.trend.length} months · {baseCurrency}
                  </Text>
                </View>
              </Card>
            ) : null}

            {/* ── Insights ──────────────────────────────────────── */}
            {insights.length > 0 ? (
              <Card>
                <SectionLabel text="Smart insights" />
                <View style={styles.insightsList}>
                  {insights.map((item, i) => (
                    <InsightRow key={i} icon={item.icon} text={item.text} tone={item.tone} />
                  ))}
                </View>
              </Card>
            ) : null}

            {/* ── Category breakdown ─────────────────────────────── */}
            {topCats.length > 0 ? (
              <Card>
                <SectionLabel text="Category breakdown" />
                <View style={styles.breakdownList}>
                  {topCats.map((row, i) => (
                    <BreakdownRow
                      key={row.id}
                      title={row.name}
                      amount={fmt(row.total, baseCurrency)}
                      percent={row.percent}
                      color={i === 0 ? VaultColors.brandGoldDark : VaultColors.brandGold}
                    />
                  ))}
                </View>
              </Card>
            ) : null}

            {/* ── Merchant breakdown ─────────────────────────────── */}
            {topMerchants.length > 0 ? (
              <Card>
                <SectionLabel text="Store breakdown" />
                <View style={styles.breakdownList}>
                  {topMerchants.map((row, i) => (
                    <BreakdownRow
                      key={row.name}
                      title={row.name}
                      amount={fmt(row.total, baseCurrency)}
                      percent={row.percent}
                      color={i === 0 ? VaultColors.brown : VaultColors.textSecondary}
                    />
                  ))}
                </View>
              </Card>
            ) : null}

            {/* ── Tip card ───────────────────────────────────────── */}
            <View style={styles.tipCard}>
              <Ionicons name="bulb-outline" size={scale(16)} color={VaultColors.brandGoldDark} />
              <Text style={styles.tipText}>
                Keep receipt currency codes accurate to see precise conversions. Totals are shown in {baseCurrency} using rates captured at the time of each purchase.
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: VaultColors.appBackground },
  content: { paddingHorizontal: VaultSpacing.screenPadding, paddingTop: scale(8) },

  // Header
  header: {
    paddingHorizontal: VaultSpacing.screenPadding,
    paddingBottom: scale(12),
    flexDirection: "row",
    alignItems: "center",
    gap: scale(8),
  },
  backBtn: {
    width: scale(42), height: scale(42),
    borderRadius: scale(14),
    backgroundColor: "#fff",
    borderWidth: 1, borderColor: VaultColors.border,
    alignItems: "center", justifyContent: "center",
    ...Platform.select({ ios: VaultShadows.sm, android: { elevation: 1 } }),
  },
  headerCenter: { flex: 1 },
  headerTitle: {
    fontSize: getFontSize(20), fontWeight: "900",
    color: VaultColors.textPrimary, letterSpacing: -0.4,
  },
  headerSub: {
    fontSize: getFontSize(11), fontWeight: "600",
    color: VaultColors.textMuted, marginTop: scale(1),
  },

  // Month picker
  monthPickerWrap: { marginBottom: scale(14) },
  monthRow: { gap: scale(8), paddingRight: scale(4) },
  monthChip: {
    paddingVertical: scale(7), paddingHorizontal: scale(14),
    borderRadius: VaultRadius.full, borderWidth: 1.5, borderColor: VaultColors.border,
    backgroundColor: "#fff",
  },
  monthChipActive:     { backgroundColor: VaultColors.brown, borderColor: VaultColors.brown },
  monthChipText:       { fontSize: getFontSize(12), fontWeight: "800", color: VaultColors.textSecondary },
  monthChipTextActive: { color: "#FEF7E6" },

  // Card
  card: {
    backgroundColor: "#fff",
    borderRadius: scale(22),
    borderWidth: 1, borderColor: VaultColors.border,
    padding: scale(16),
    marginBottom: scale(14),
    ...Platform.select({ ios: VaultShadows.sm, android: { elevation: 2 } }),
  },
  sectionLabel: {
    fontSize: getFontSize(11), fontWeight: "800",
    color: VaultColors.textMuted,
    textTransform: "uppercase", letterSpacing: 0.9,
    marginBottom: scale(12),
  },

  // Hero card
  heroCard: {
    backgroundColor: VaultColors.brown,
    borderColor: VaultColors.brown,
    marginBottom: scale(12),
  },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  heroEyebrow: {
    fontSize: getFontSize(10), fontWeight: "800",
    color: "rgba(254,247,230,0.7)", textTransform: "uppercase", letterSpacing: 1,
  },
  heroMonth: { marginTop: scale(4), fontSize: getFontSize(16), fontWeight: "800", color: "#FEF7E6" },
  heroIconWrap: {
    width: scale(42), height: scale(42), borderRadius: scale(14),
    backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center",
  },
  heroTotal: {
    marginTop: scale(16), fontSize: getFontSize(34), fontWeight: "900",
    color: "#FEF7E6", letterSpacing: -1,
  },
  deltaBadge: {
    flexDirection: "row", alignItems: "center", gap: scale(5),
    alignSelf: "flex-start", marginTop: scale(6),
    paddingHorizontal: scale(10), paddingVertical: scale(4),
    borderRadius: scale(12),
  },
  deltaBadgeGood: { backgroundColor: "rgba(24,169,87,0.15)" },
  deltaBadgeWarn: { backgroundColor: "rgba(224,161,0,0.15)" },
  deltaText:     { fontSize: getFontSize(11), fontWeight: "700" },
  deltaTextGood: { color: "#4ADE80" },
  deltaTextWarn: { color: "#FBB040" },
  summaryWrap: {
    flexDirection: "row", alignItems: "flex-start",
    gap: scale(6), marginTop: scale(12),
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: scale(12), padding: scale(10),
  },
  summaryText: {
    flex: 1, fontSize: getFontSize(12), fontWeight: "500",
    color: "rgba(254,247,230,0.9)", lineHeight: 18,
  },
  kpiRow: {
    flexDirection: "row", alignItems: "center",
    marginTop: scale(14), paddingTop: scale(14),
    borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.12)",
  },
  kpiItem:    { flex: 1, alignItems: "center" },
  kpiDivider: { width: 1, height: scale(30), backgroundColor: "rgba(255,255,255,0.18)" },
  kpiVal: {
    fontSize: getFontSize(15), fontWeight: "900",
    color: "#FEF7E6", letterSpacing: -0.3,
  },
  kpiLbl: {
    marginTop: scale(3), fontSize: getFontSize(10), fontWeight: "600",
    color: "rgba(254,247,230,0.65)",
  },

  // Protection row
  protRow: {
    flexDirection: "row", gap: scale(10),
    marginBottom: scale(14),
  },
  protTile: {
    flex: 1, backgroundColor: "#fff",
    borderRadius: scale(18), borderWidth: 1.5,
    padding: scale(12),
    ...Platform.select({ ios: VaultShadows.sm, android: { elevation: 1 } }),
  },
  protIcon: {
    width: scale(32), height: scale(32), borderRadius: scale(10),
    alignItems: "center", justifyContent: "center", marginBottom: scale(8),
  },
  protValue: { fontSize: getFontSize(14), fontWeight: "900", letterSpacing: -0.3 },
  protLabel: {
    marginTop: scale(2), fontSize: getFontSize(10), fontWeight: "700",
    color: VaultColors.textSecondary,
  },
  protNote: {
    marginTop: scale(2), fontSize: getFontSize(9), fontWeight: "600",
    color: VaultColors.textMuted,
  },

  // Sparkline
  sparklineWrap:  { alignItems: "center", paddingTop: scale(4) },
  sparklineNote:  {
    marginTop: scale(8), fontSize: getFontSize(10), fontWeight: "600",
    color: VaultColors.textMuted, textAlign: "center",
  },

  // Insights
  insightsList: { gap: scale(8) },
  insightRow: {
    flexDirection: "row", alignItems: "flex-start",
    gap: scale(8), padding: scale(10),
    borderRadius: scale(14), borderWidth: 1,
  },
  insightText: { flex: 1, fontSize: getFontSize(12), fontWeight: "600", lineHeight: 18 },

  // Breakdowns
  breakdownList: { gap: scale(10) },
  bRow:          {},
  bRowTop:       { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: scale(8) },
  bRowTitle:     { flex: 1, fontSize: getFontSize(13), fontWeight: "700", color: VaultColors.textPrimary },
  bRowAmount:    { fontSize: getFontSize(12), fontWeight: "800", color: VaultColors.textSecondary },
  bTrack: {
    marginTop: scale(6), height: scale(7),
    backgroundColor: VaultColors.brandGoldSoft,
    borderRadius: scale(4), overflow: "hidden",
  },
  bFill: { height: "100%", borderRadius: scale(4) },
  bPct:  { marginTop: scale(3), fontSize: getFontSize(10), fontWeight: "600", color: VaultColors.textMuted },

  // Tip
  tipCard: {
    flexDirection: "row", gap: scale(10),
    backgroundColor: VaultColors.brandGoldSoft,
    borderRadius: scale(18), borderWidth: 1, borderColor: VaultColors.border,
    padding: scale(14), marginTop: scale(2),
  },
  tipText: {
    flex: 1, fontSize: getFontSize(12), fontWeight: "500",
    color: VaultColors.textSecondary, lineHeight: 18,
  },

  // Empty
  emptyBox: {
    marginTop: scale(24), alignItems: "center",
    backgroundColor: "#fff", borderRadius: scale(24),
    borderWidth: 1, borderColor: VaultColors.border,
    paddingVertical: scale(36), paddingHorizontal: scale(24),
  },
  emptyIcon: {
    width: scale(72), height: scale(72), borderRadius: scale(24),
    backgroundColor: VaultColors.brandGoldSoft,
    alignItems: "center", justifyContent: "center", marginBottom: scale(14),
  },
  emptyTitle: {
    fontSize: getFontSize(18), fontWeight: "900",
    color: VaultColors.textPrimary, marginBottom: scale(8),
  },
  emptyText: {
    fontSize: getFontSize(12), fontWeight: "500",
    color: VaultColors.textMuted, textAlign: "center",
    lineHeight: 20, marginBottom: scale(20),
  },
  emptyBtn: {
    backgroundColor: VaultColors.brown, borderRadius: VaultRadius.full,
    paddingVertical: scale(11), paddingHorizontal: scale(22),
  },
  emptyBtnText: { color: "#FEF7E6", fontSize: getFontSize(13), fontWeight: "800" },
});
