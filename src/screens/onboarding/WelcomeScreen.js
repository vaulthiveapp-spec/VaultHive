import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  Platform,
} from "react-native";

import { TopWave } from "../../components/Waves";
import { scale, getFontSize, getSpacing, verticalScale } from "../../utils/responsive";
import { VaultColors, VaultRadius, VaultSpacing, VaultShadows } from "../../styles/DesignSystem";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");
const LOGO = require("../../../assets/splash.png");

const SHEET_RADIUS = scale(34);

export default function WelcomeScreen({ navigation }) {
  const logoSize = Math.min(scale(210), SCREEN_W * 0.62, SCREEN_H * 0.23);

  return (
    <View style={styles.container}>
      <View style={styles.topArea}>
        <TopWave />

        <View style={styles.hero}>
          <View style={styles.logoWrap}>
            <Image
              source={LOGO}
              style={{ width: logoSize, height: logoSize }}
              resizeMode="contain"
            />
          </View>
        </View>
      </View>

      <View style={styles.sheet}>
        <Text style={styles.title}>Welcome!</Text>

        <Text style={styles.subtitle}>
          Keep your receipts and warranties organized, and get smart reminders before deadlines.
        </Text>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.btn, styles.btnPrimary]}
            activeOpacity={0.88}
            onPress={() => navigation.navigate("Login")}
          >
            <Text style={styles.btnPrimaryText}>Login</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, styles.btnOutline]}
            activeOpacity={0.88}
            onPress={() => navigation.navigate("Register")}
          >
            <Text style={styles.btnOutlineText}>Create account</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => navigation.navigate("ForgotPassword")}
          style={styles.forgotWrap}
        >
          <Text style={styles.forgot}>Forgot password?</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: VaultColors.appBackground,
  },

  topArea: {
    flex: 1,
    backgroundColor: VaultColors.appBackground,
    paddingBottom: verticalScale(12),
  },

  hero: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: VaultSpacing.screenPadding,
    paddingTop: verticalScale(8),
    paddingBottom: verticalScale(8),
    marginTop: -verticalScale(80),
  },

  logoWrap: {
    backgroundColor: VaultColors.surfaceAlt,
    borderRadius: VaultRadius.xl,
    padding: scale(10),
    borderWidth: 1,
    borderColor: VaultColors.divider,
    ...(Platform.OS === "ios" ? VaultShadows.sm : {}),
  },

  sheet: {
    backgroundColor: VaultColors.sheetcolor,
    borderTopLeftRadius: SHEET_RADIUS,
    borderTopRightRadius: SHEET_RADIUS,
    paddingHorizontal: VaultSpacing.screenPadding,
    paddingTop: getSpacing(22),
    paddingBottom: getSpacing(22),
    minHeight: SCREEN_H * 0.33,
  },

  title: {
    fontSize: getFontSize(28),
    fontWeight: "900",
    color: VaultColors.textPrimary,
    fontFamily: "Poppins",
    textAlign: "center",
  },

  subtitle: {
    marginTop: getSpacing(8),
    fontSize: getFontSize(14),
    lineHeight: getFontSize(21),
    color: VaultColors.textSecondary,
    fontFamily: "Poppins",
    fontWeight: "600",
    textAlign: "center",
    opacity: 0.92,
  },

  actionsRow: {
    flexDirection: "row",
    gap: getSpacing(12),
    marginTop: getSpacing(18),
  },

  btn: {
    flex: 1,
    minHeight: scale(52),
    borderRadius: VaultRadius.lg,
    alignItems: "center",
    justifyContent: "center",
  },

  btnPrimary: {
    backgroundColor: VaultColors.buttonPrimary,
    borderWidth: 1,
    borderColor: VaultColors.brandGoldDark,
    ...(Platform.OS === "ios" ? VaultShadows.sm : {}),
  },

  btnPrimaryText: {
    color: VaultColors.buttonTextOnGold,
    fontSize: getFontSize(14),
    fontWeight: "900",
    fontFamily: "Poppins",
  },

  btnOutline: {
    backgroundColor: VaultColors.buttonOutline,
    borderWidth: 1,
    borderColor: VaultColors.buttonOutlineBorder,
  },

  btnOutlineText: {
    color: VaultColors.textSecondary,
    fontSize: getFontSize(14),
    fontWeight: "900",
    fontFamily: "Poppins",
  },

  forgotWrap: {
    marginTop: getSpacing(12),
    paddingVertical: getSpacing(6),
  },

  forgot: {
    textAlign: "center",
    color: VaultColors.textSecondary,
    fontSize: getFontSize(13),
    fontWeight: "800",
    textDecorationLine: "underline",
    fontFamily: "Poppins",
  },
});