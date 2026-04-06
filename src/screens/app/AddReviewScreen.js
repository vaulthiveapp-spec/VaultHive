import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, Platform, ScrollView } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "react-native-vector-icons/Ionicons";

import Input from "../../components/Input";
import Button from "../../components/Button";
import { useAuth } from "../../context/AuthContext";
import { useAlert } from "../../components/AlertProvider";
import { addStoreReviewOffline } from "../../services/offlineActions";
import { scale, getFontSize, getSpacing, verticalScale } from "../../utils/responsive";
import { VaultColors, VaultRadius, VaultShadows, VaultSpacing } from "../../styles/DesignSystem";

export default function AddReviewScreen({ navigation, route }) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const alert = useAlert();
  const uid = user?.uid;

  const storeId = route?.params?.storeId;

  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);

  const canSubmit = useMemo(() => {
    return !!uid && !!storeId && rating >= 1 && rating <= 5 && String(comment).trim().length >= 2;
  }, [uid, storeId, rating, comment]);

  const submit = async () => {
    if (!uid || !storeId) return;
    if (!canSubmit) return alert?.warning?.("Missing", "Please add a rating and a short comment.");

    setLoading(true);
    try {
      await addStoreReviewOffline(uid, storeId, { rating, comment });
      alert?.success?.("Thanks!", "Your review was submitted.");
      navigation.goBack();
    } catch (e) {
      alert?.error?.("Error", e?.message || "Failed to submit review.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor={VaultColors.appBackground} />

      <LinearGradient
        colors={[VaultColors.brown, "#7A4F2C"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.header, { paddingTop: insets.top }]}
      >
        <TouchableOpacity style={styles.headerBtn} activeOpacity={0.85} onPress={() => navigation.goBack()}>
          <Ionicons name="chevron-back" size={scale(24)} color="#FEF7E6" />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Write a review</Text>
        </View>

        <View style={styles.headerBtn} />
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <Text style={styles.label}>Rating</Text>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((i) => (
              <TouchableOpacity key={i} activeOpacity={0.85} onPress={() => setRating(i)}>
                <Ionicons
                  name={i <= rating ? "star" : "star-outline"}
                  size={scale(28)}
                  color={VaultColors.brandGoldDark}
                />
              </TouchableOpacity>
            ))}
          </View>

          <Input
            label="Comment"
            placeholder="Share your experience…"
            value={comment}
            onChangeText={setComment}
            multiline
            numberOfLines={4}
            maxLength={240}
          />

          <Text style={styles.hint}>{String(comment).trim().length}/240</Text>
        </View>

        <Button
          title={loading ? "Submitting…" : "Submit"}
          onPress={submit}
          loading={loading}
          disabled={loading || !canSubmit}
          size="login"
          style={styles.submitButton}
          textStyle={styles.submitButtonText}
        />

        <View style={{ height: verticalScale(40) }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: VaultColors.appBackground },

  header: {
    paddingHorizontal: VaultSpacing.screenPadding,
    paddingBottom: scale(14),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: VaultColors.brown,
  },
  headerBtn: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(14),
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(254,247,230,0.12)",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: getFontSize(18),
    fontWeight: "900",
    color: "#FEF7E6",
  },
  backBtn: {
    width: scale(40),
    height: scale(40),
    borderRadius: VaultRadius.lg,
    backgroundColor: VaultColors.surfaceAlt,
    borderWidth: 1,
    borderColor: VaultColors.border,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({ android: { elevation: 1 }, ios: VaultShadows.sm }),
  },
  title: { color: VaultColors.textPrimary, fontSize: getFontSize(18), fontWeight: "900" },

  content: {
    paddingHorizontal: VaultSpacing.screenPadding,
    paddingBottom: verticalScale(20),
    paddingTop: scale(20),
    maxWidth: scale(560),
    width: "100%",
    alignSelf: "center",
  },

  card: {
    backgroundColor: VaultColors.surface,
    borderRadius: VaultRadius.lg,
    borderWidth: 1,
    borderColor: VaultColors.border,
    padding: scale(14),
    marginBottom: scale(14),
    ...Platform.select({ android: { elevation: 2 }, ios: VaultShadows.sm }),
  },
  label: { color: VaultColors.textPrimary, fontWeight: "900", fontSize: getFontSize(14) },
  submitButton: {
    width: "100%",
    marginTop: scale(20),
    alignSelf: "stretch",
    borderRadius: scale(16),
  },
  submitButtonText: {
    textAlign: "center",
    fontSize: getFontSize(14),
  },
  starsRow: { flexDirection: "row", gap: scale(6), marginTop: scale(10) },
  hint: { marginTop: scale(8), color: VaultColors.textMuted, fontWeight: "800", fontSize: getFontSize(12), textAlign: "right" },
});
