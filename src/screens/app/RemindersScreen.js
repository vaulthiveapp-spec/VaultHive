import React, { useCallback, useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, Platform, ScrollView } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import Ionicons from "react-native-vector-icons/Ionicons";

import { useAuth } from "../../context/AuthContext";
import { useAlert } from "../../components/AlertProvider";
import { scale, getFontSize, getSpacing, verticalScale } from "../../utils/responsive";
import { VaultColors, VaultRadius, VaultShadows, VaultSpacing } from "../../styles/DesignSystem";
import { listUpcomingReminders, listNotifications, markNotificationRead } from "../../services/localRepo";
import { markNotificationReadOffline } from "../../services/offlineActions";

const daysUntil = (dateStr) => {
  if (!dateStr) return null;
  const d = new Date(String(dateStr) + "T00:00:00");
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - Date.now()) / 86400000);
};

const reminderMeta = (item) => {
  const isWarranty = item?.type === "warranty_expiry";
  return {
    isWarranty,
    icon: isWarranty ? "shield-checkmark-outline" : "time-outline",
    label: isWarranty ? "Warranty expiry" : "Return deadline",
  };
};

const toneFromDays = (d) => {
  if (d == null) return { bg: VaultColors.surfaceAlt, border: VaultColors.border, text: VaultColors.textMuted, icon: VaultColors.textPrimary };
  if (d < 0) return { bg: "#FFF0F0", border: "#F5BABA", text: VaultColors.error, icon: VaultColors.error };
  if (d <= 7) return { bg: "#FFF6E3", border: VaultColors.brandGoldLight, text: VaultColors.brandGoldDark, icon: VaultColors.brandGoldDark };
  return { bg: VaultColors.brandGoldSoft, border: VaultColors.border, text: VaultColors.textPrimary, icon: VaultColors.textPrimary };
};

const SummaryStat = ({ icon, value, label, accent }) => (
  <View style={[styles.summaryStat, accent && styles.summaryStatAccent]}>
    <View style={[styles.summaryStatIcon, accent && styles.summaryStatIconAccent]}>
      <Ionicons name={icon} size={scale(16)} color={accent ? VaultColors.buttonTextOnGold : VaultColors.textPrimary} />
    </View>
    <Text style={[styles.summaryStatValue, accent && styles.summaryStatValueAccent]}>{value}</Text>
    <Text style={[styles.summaryStatLabel, accent && styles.summaryStatLabelAccent]}>{label}</Text>
  </View>
);

const ReminderCard = ({ item, onPress }) => {
  const d = daysUntil(item?.due_date);
  const tone = toneFromDays(d);
  const meta = reminderMeta(item);
  const label = d == null ? "Planned" : d < 0 ? `${Math.abs(d)} day${Math.abs(d) === 1 ? "" : "s"} overdue` : d === 0 ? "Due today" : `${d} day${d === 1 ? "" : "s"} left`;

  return (
    <TouchableOpacity style={styles.reminderCard} activeOpacity={0.9} onPress={onPress}>
      <View style={[styles.reminderCardTop, { backgroundColor: tone.bg, borderColor: tone.border }]}>
        <View style={[styles.reminderIconWrap, { backgroundColor: tone.bg, borderColor: tone.border }]}> 
          <Ionicons name={meta.icon} size={scale(18)} color={tone.icon} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.reminderTitle}>{meta.label}</Text>
          <Text style={styles.reminderSubtitle} numberOfLines={1}>{item?.due_date ? `Due ${item.due_date}` : "Due date not set"}</Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: tone.bg, borderColor: tone.border }]}>
          <Text style={[styles.statusPillText, { color: tone.text }]}>{label}</Text>
        </View>
      </View>

      <View style={styles.reminderCardBottom}>
        <Text style={styles.reminderDetail} numberOfLines={1}>
          {item?.target_type === "receipt" ? "Opens saved receipt details" : item?.target_type === "warranty" ? "Opens linked warranty details" : "Saved reminder in your vault"}
        </Text>
        <Ionicons name="chevron-forward" size={scale(16)} color={VaultColors.textMuted} />
      </View>
    </TouchableOpacity>
  );
};

const NotificationCard = ({ item, onPress }) => {
  const isUnread = (item?.status || "Unread") === "Unread";
  return (
    <TouchableOpacity style={[styles.notificationCard, isUnread && styles.notificationCardUnread]} activeOpacity={0.9} onPress={onPress}>
      <View style={[styles.notificationIcon, isUnread && styles.notificationIconUnread]}>
        <Ionicons name={isUnread ? "sparkles-outline" : "notifications-outline"} size={scale(16)} color={isUnread ? VaultColors.brandGoldDark : VaultColors.textMuted} />
      </View>

      <View style={{ flex: 1 }}>
        <View style={styles.notificationTitleRow}>
          <Text style={[styles.notificationTitle, isUnread && styles.notificationTitleUnread]} numberOfLines={1}>
            {item?.title || "Notification"}
          </Text>
          {isUnread ? <View style={styles.unreadDot} /> : null}
        </View>
        <Text style={styles.notificationMessage} numberOfLines={2}>{item?.message || ""}</Text>
      </View>

      <Ionicons name="chevron-forward" size={scale(15)} color={VaultColors.textMuted} />
    </TouchableOpacity>
  );
};

const SectionHeader = ({ title, subtitle, count, actionText, onAction }) => (
  <View style={styles.sectionHeader}>
    <View style={{ flex: 1 }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
    </View>
    {typeof count === "number" ? (
      <View style={styles.countBadge}><Text style={styles.countBadgeText}>{count}</Text></View>
    ) : null}
    {actionText ? (
      <TouchableOpacity activeOpacity={0.85} onPress={onAction}>
        <Text style={styles.sectionAction}>{actionText}</Text>
      </TouchableOpacity>
    ) : null}
  </View>
);

export default function RemindersScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const alert = useAlert();
  const uid = user?.uid;

  const [reminders, setReminders] = useState([]);
  const [notifications, setNotifications] = useState([]);

  const load = useCallback(async () => {
    if (!uid) return;
    try {
      const [r, n] = await Promise.all([listUpcomingReminders(uid, 60, 50), listNotifications(uid, 60)]);
      setReminders(r || []);
      setNotifications(n || []);
    } catch {
      alert?.error?.("Error", "Failed to load reminders.");
    }
  }, [uid, alert]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const unreadCount = useMemo(
    () => (notifications || []).filter((x) => (x.status || "Unread") === "Unread").length,
    [notifications]
  );

  const urgentCount = useMemo(
    () => (reminders || []).filter((x) => {
      const d = daysUntil(x?.due_date);
      return d != null && d <= 7;
    }).length,
    [reminders]
  );

  const overdueCount = useMemo(
    () => (reminders || []).filter((x) => {
      const d = daysUntil(x?.due_date);
      return d != null && d < 0;
    }).length,
    [reminders]
  );

  const openTarget = (n) => {
    if (!n?.target_type) return;
    if (n.target_type === "receipt") navigation.navigate("ReceiptDetails", { receiptId: n.target_id });
    if (n.target_type === "warranty") navigation.navigate("WarrantyDetails", { warrantyId: n.target_id });
  };

  const onPressNotification = async (n) => {
    if (!uid) return;
    try {
      if ((n.status || "Unread") === "Unread") {
        await markNotificationRead(uid, n.notification_id);
        await markNotificationReadOffline(uid, n.notification_id);
      }
    } catch {}
    openTarget(n);
    load();
  };

  const openReminder = (r) => {
    if (r?.target_type === "receipt") navigation.navigate("ReceiptDetails", { receiptId: r.target_id });
    if (r?.target_type === "warranty") navigation.navigate("WarrantyDetails", { warrantyId: r.target_id });
  };

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor={VaultColors.appBackground} />

      <View style={[styles.header, { paddingTop: insets.top }]}> 
        <View>
          <Text style={styles.headerEyebrow}>Smart reminders</Text>
          <Text style={styles.headerTitle}>Stay ahead of returns and warranties</Text>
        </View>
        <TouchableOpacity style={styles.headerIconBtn} activeOpacity={0.88} onPress={() => navigation.navigate("Settings")}> 
          <Ionicons name="options-outline" size={scale(18)} color={VaultColors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle}>{unreadCount > 0 ? `${unreadCount} unread update${unreadCount === 1 ? "" : "s"}` : "Everything is organized"}</Text>
              <Text style={styles.heroSubtitle}>
                VaultHive keeps your important deadlines friendly, visible, and easy to act on.
              </Text>
            </View>
            <View style={styles.heroIconWrap}>
              <Ionicons name="notifications" size={scale(22)} color={VaultColors.buttonTextOnGold} />
            </View>
          </View>

          <View style={styles.summaryRow}>
            <SummaryStat icon="alarm-outline" value={String(reminders.length)} label="Upcoming" accent />
            <SummaryStat icon="flash-outline" value={String(urgentCount)} label="Urgent" />
            <SummaryStat icon="warning-outline" value={String(overdueCount)} label="Overdue" />
          </View>

          <View style={styles.heroActionsRow}>
            <TouchableOpacity style={[styles.heroAction, styles.heroActionPrimary]} activeOpacity={0.9} onPress={() => navigation.navigate("AddReceipt")}>
              <Ionicons name="add-circle-outline" size={scale(16)} color={VaultColors.buttonTextOnGold} />
              <Text style={styles.heroActionPrimaryText}>Add receipt</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.heroAction} activeOpacity={0.9} onPress={() => navigation.navigate("AddWarranty")}>
              <Ionicons name="shield-checkmark-outline" size={scale(16)} color={VaultColors.textPrimary} />
              <Text style={styles.heroActionText}>Add warranty</Text>
            </TouchableOpacity>
          </View>
        </View>

        <SectionHeader
          title="Upcoming reminders"
          subtitle="The deadlines that matter most right now."
          count={reminders.length}
        />

        {reminders.length ? (
          reminders.map((r) => (
            <ReminderCard key={r.reminder_id} item={r} onPress={() => openReminder(r)} />
          ))
        ) : (
          <View style={styles.emptyCard}>
            <Ionicons name="checkmark-circle-outline" size={scale(34)} color={VaultColors.brandGoldLight} />
            <Text style={styles.emptyTitle}>All clear</Text>
            <Text style={styles.emptyText}>You have no active reminder in the next 60 days.</Text>
          </View>
        )}

        <SectionHeader
          title="Notifications"
          subtitle="Recent activity and smart alerts from your vault."
          count={notifications.length}
        />

        {notifications.length ? (
          notifications.map((n) => (
            <NotificationCard key={n.notification_id} item={n} onPress={() => onPressNotification(n)} />
          ))
        ) : (
          <View style={styles.emptyCard}>
            <Ionicons name="mail-open-outline" size={scale(34)} color={VaultColors.brandGoldLight} />
            <Text style={styles.emptyTitle}>No notifications yet</Text>
            <Text style={styles.emptyText}>New reminder activity will appear here in a clear and friendly way.</Text>
          </View>
        )}

        <View style={{ height: verticalScale(20) }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: VaultColors.appBackground },

  header: {
    paddingHorizontal: VaultSpacing.screenPadding,
    paddingBottom: scale(12),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerEyebrow: {
    fontSize: getFontSize(11),
    color: VaultColors.textSecondary,
    fontFamily: "Poppins",
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  headerTitle: {
    marginTop: scale(4),
    fontSize: getFontSize(22),
    color: VaultColors.textPrimary,
    fontFamily: "Poppins",
    fontWeight: "900",
    maxWidth: scale(260),
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
    ...Platform.select({ android: { elevation: 2 }, ios: VaultShadows.sm }),
  },

  content: {
    paddingHorizontal: VaultSpacing.screenPadding,
    paddingBottom: verticalScale(20),
  },

  heroCard: {
    backgroundColor: VaultColors.surfaceAlt,
    borderRadius: scale(28),
    borderWidth: 1,
    borderColor: VaultColors.brandGoldLight,
    padding: scale(16),
    ...Platform.select({ android: { elevation: 3 }, ios: VaultShadows.md }),
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: scale(12),
  },
  heroTitle: {
    fontSize: getFontSize(18),
    color: VaultColors.textPrimary,
    fontFamily: "Poppins",
    fontWeight: "900",
  },
  heroSubtitle: {
    marginTop: scale(6),
    fontSize: getFontSize(12),
    lineHeight: getFontSize(18),
    color: VaultColors.textSecondary,
    fontFamily: "Poppins",
    fontWeight: "600",
  },
  heroIconWrap: {
    width: scale(50),
    height: scale(50),
    borderRadius: scale(18),
    backgroundColor: VaultColors.buttonPrimary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: VaultColors.brandGoldDark,
  },
  summaryRow: {
    flexDirection: "row",
    gap: scale(10),
    marginTop: scale(16),
  },
  summaryStat: {
    flex: 1,
    minHeight: scale(102),
    backgroundColor: VaultColors.appBackground,
    borderRadius: scale(20),
    borderWidth: 1,
    borderColor: VaultColors.border,
    padding: scale(12),
  },
  summaryStatAccent: {
    backgroundColor: VaultColors.brandGoldDark,
    borderColor: VaultColors.brandGoldDark,
  },
  summaryStatIcon: {
    width: scale(34),
    height: scale(34),
    borderRadius: scale(12),
    backgroundColor: VaultColors.brandGoldSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryStatIconAccent: {
    backgroundColor: "rgba(254,247,230,0.18)",
  },
  summaryStatValue: {
    marginTop: scale(12),
    fontSize: getFontSize(22),
    color: VaultColors.textPrimary,
    fontFamily: "Poppins",
    fontWeight: "900",
  },
  summaryStatValueAccent: { color: VaultColors.buttonTextOnGold },
  summaryStatLabel: {
    marginTop: scale(4),
    fontSize: getFontSize(11),
    color: VaultColors.textMuted,
    fontFamily: "Poppins",
    fontWeight: "700",
  },
  summaryStatLabelAccent: { color: "rgba(254,247,230,0.84)" },
  heroActionsRow: {
    flexDirection: "row",
    gap: scale(10),
    marginTop: scale(16),
  },
  heroAction: {
    flex: 1,
    minHeight: scale(46),
    borderRadius: VaultRadius.lg,
    backgroundColor: VaultColors.appBackground,
    borderWidth: 1,
    borderColor: VaultColors.border,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: scale(8),
  },
  heroActionPrimary: {
    backgroundColor: VaultColors.buttonPrimary,
    borderColor: VaultColors.brandGoldDark,
  },
  heroActionText: {
    color: VaultColors.textPrimary,
    fontSize: getFontSize(12),
    fontFamily: "Poppins",
    fontWeight: "900",
  },
  heroActionPrimaryText: {
    color: VaultColors.buttonTextOnGold,
    fontSize: getFontSize(12),
    fontFamily: "Poppins",
    fontWeight: "900",
  },

  sectionHeader: {
    marginTop: scale(18),
    marginBottom: scale(10),
    flexDirection: "row",
    alignItems: "center",
    gap: scale(10),
  },
  sectionTitle: {
    fontSize: getFontSize(16),
    color: VaultColors.textPrimary,
    fontFamily: "Poppins",
    fontWeight: "900",
  },
  sectionSubtitle: {
    marginTop: 2,
    fontSize: getFontSize(11),
    color: VaultColors.textMuted,
    fontFamily: "Poppins",
    fontWeight: "600",
  },
  countBadge: {
    minWidth: scale(28),
    height: scale(28),
    borderRadius: scale(14),
    backgroundColor: VaultColors.brandGoldSoft,
    borderWidth: 1,
    borderColor: VaultColors.border,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: scale(6),
  },
  countBadgeText: {
    fontSize: getFontSize(11),
    color: VaultColors.textPrimary,
    fontFamily: "Poppins",
    fontWeight: "900",
  },
  sectionAction: {
    fontSize: getFontSize(12),
    color: VaultColors.textSecondary,
    fontFamily: "Poppins",
    fontWeight: "900",
    textDecorationLine: "underline",
  },

  reminderCard: {
    backgroundColor: VaultColors.surfaceAlt,
    borderRadius: scale(22),
    borderWidth: 1,
    borderColor: VaultColors.border,
    padding: scale(12),
    marginBottom: scale(10),
    ...Platform.select({ android: { elevation: 2 }, ios: VaultShadows.sm }),
  },
  reminderCardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(10),
    borderWidth: 1,
    borderRadius: scale(18),
    padding: scale(10),
  },
  reminderIconWrap: {
    width: scale(42),
    height: scale(42),
    borderRadius: scale(14),
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  reminderTitle: {
    fontSize: getFontSize(13),
    color: VaultColors.textPrimary,
    fontFamily: "Poppins",
    fontWeight: "900",
  },
  reminderSubtitle: {
    marginTop: 2,
    fontSize: getFontSize(11),
    color: VaultColors.textMuted,
    fontFamily: "Poppins",
    fontWeight: "600",
  },
  statusPill: {
    borderRadius: VaultRadius.full,
    paddingHorizontal: scale(10),
    paddingVertical: scale(6),
    borderWidth: 1,
  },
  statusPillText: {
    fontSize: getFontSize(10),
    fontFamily: "Poppins",
    fontWeight: "900",
  },
  reminderCardBottom: {
    marginTop: scale(10),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: scale(10),
  },
  reminderDetail: {
    flex: 1,
    fontSize: getFontSize(11),
    color: VaultColors.textSecondary,
    fontFamily: "Poppins",
    fontWeight: "600",
  },

  notificationCard: {
    backgroundColor: VaultColors.surfaceAlt,
    borderRadius: scale(20),
    borderWidth: 1,
    borderColor: VaultColors.border,
    padding: scale(12),
    marginBottom: scale(10),
    flexDirection: "row",
    alignItems: "center",
    gap: scale(10),
    ...Platform.select({ android: { elevation: 2 }, ios: VaultShadows.sm }),
  },
  notificationCardUnread: {
    borderColor: VaultColors.brandGoldLight,
    backgroundColor: "#FFFDF6",
  },
  notificationIcon: {
    width: scale(38),
    height: scale(38),
    borderRadius: scale(14),
    backgroundColor: VaultColors.appBackground,
    borderWidth: 1,
    borderColor: VaultColors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  notificationIconUnread: {
    backgroundColor: VaultColors.brandGoldSoft,
    borderColor: VaultColors.brandGoldLight,
  },
  notificationTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: scale(6),
  },
  notificationTitle: {
    flex: 1,
    fontSize: getFontSize(13),
    color: VaultColors.textSecondary,
    fontFamily: "Poppins",
    fontWeight: "800",
  },
  notificationTitleUnread: { color: VaultColors.textPrimary },
  notificationMessage: {
    marginTop: 3,
    fontSize: getFontSize(11),
    color: VaultColors.textMuted,
    fontFamily: "Poppins",
    fontWeight: "600",
  },
  unreadDot: {
    width: scale(7),
    height: scale(7),
    borderRadius: scale(3.5),
    backgroundColor: VaultColors.brandGold,
  },

  emptyCard: {
    backgroundColor: VaultColors.surfaceAlt,
    borderRadius: scale(22),
    borderWidth: 1,
    borderColor: VaultColors.border,
    paddingVertical: scale(26),
    paddingHorizontal: scale(18),
    alignItems: "center",
    gap: scale(6),
  },
  emptyTitle: {
    fontSize: getFontSize(15),
    color: VaultColors.textPrimary,
    fontFamily: "Poppins",
    fontWeight: "900",
  },
  emptyText: {
    fontSize: getFontSize(12),
    color: VaultColors.textMuted,
    fontFamily: "Poppins",
    fontWeight: "600",
    textAlign: "center",
    lineHeight: getFontSize(18),
  },
});
