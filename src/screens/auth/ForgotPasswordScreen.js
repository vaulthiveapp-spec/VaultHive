import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Keyboard,
  Image,
  ScrollView,
  KeyboardAvoidingView,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { ref, get } from "firebase/database";

import { TopWave, BottomWave } from "../../components/Waves";
import Button from "../../components/Button";
import Input from "../../components/Input";

import { validateEmail, validateRequired, validateName } from "../../utils/validation";
import { scale, getFontSize, getSpacing } from "../../utils/responsive";

import { useAlert } from "../../components/AlertProvider";
import { database } from "../../config/firebase";
import authService from "../../services/authService";
import {
  VaultColors,
  VaultRadius,
  VaultShadows,
  VaultSpacing,
} from "../../styles/DesignSystem";
import logo from "../../../assets/logo.png";

const WAVE_H = scale(130);
const FORM_MAX_W = scale(380);
const FORM_WIDTH_PERCENT = "86%";

const ForgotPasswordScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const alert = useAlert();

  const [identifier, setIdentifier] = useState("");
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", () => {
      setIsKeyboardVisible(true);
    });

    const hideSub = Keyboard.addListener("keyboardDidHide", () => {
      setIsKeyboardVisible(false);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const usernameKey = (name = "") =>
    String(name)
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "")
      .replace(/[.#$\[\]]/g, "_");

  const usernameLegacyKey = (name = "") =>
    String(name).toLowerCase().trim().replace(/[.#$\[\]]/g, "_");

  const resolveEmailFromIdentifier = useCallback(async (raw) => {
    const trimmed = String(raw || "").trim();

    if (!trimmed) {
      return { ok: false, error: "Username or email is required" };
    }

    if (trimmed.includes("@")) {
      const emailErr = validateEmail(trimmed);
      if (emailErr) return { ok: false, error: emailErr };
      return { ok: true, email: trimmed.toLowerCase().trim() };
    }

    const nameErr = validateName(trimmed);
    if (nameErr) return { ok: false, error: nameErr };

    const key = usernameKey(trimmed);
    let unameSnap = await get(ref(database, `usernames/${key}`));

    if (!unameSnap.exists()) {
      const legacyKey = usernameLegacyKey(trimmed);
      if (legacyKey && legacyKey !== key) {
        unameSnap = await get(ref(database, `usernames/${legacyKey}`));
      }
    }

    if (!unameSnap.exists()) {
      return { ok: false, error: "No email found for this username" };
    }

    const mapVal = unameSnap.val();
    const uid = typeof mapVal === "string" ? mapVal : mapVal?.uid;
    const directEmail = typeof mapVal === "object" ? mapVal?.email : null;

    let email = directEmail || null;

    if (!email && uid) {
      const snap = await get(ref(database, `users/${uid}/email`));
      email = snap.exists() ? snap.val() : null;
    }

    if (!email) {
      return { ok: false, error: "No email found for this username" };
    }

    const emailErr2 = validateEmail(email);
    if (emailErr2) {
      return { ok: false, error: "Linked email looks invalid. Please use your email." };
    }

    return { ok: true, email: String(email).toLowerCase().trim() };
  }, []);

  const handleInputChange = (value) => {
    setIdentifier(value);

    if (errors.identifier) {
      setErrors((prev) => ({ ...prev, identifier: null }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    const id = (identifier || "").trim();

    const idError = id.includes("@")
      ? validateEmail(id)
      : validateRequired(id, "Username") || validateName(id);

    if (idError) newErrors.identifier = idError;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleBackToLogin = () => {
    if (navigation.canGoBack?.()) {
      navigation.goBack();
    } else {
      navigation.navigate("Login");
    }
  };

  const handleSendReset = async () => {
    if (!validateForm()) return;

    setLoading(true);

    try {
      const resolved = await resolveEmailFromIdentifier(identifier);

      if (!resolved.ok) {
        alert.error("Reset Failed", resolved.error || "Please check your input.");
        return;
      }

      const res = await authService.resetPassword(resolved.email);

      if (!res?.success) {
        alert.error(res.title || "Reset Failed", res.error || "Could not send reset email.");
        return;
      }

      alert.success(
        "Reset Email Sent",
        "If an account exists for this email, a password reset link has been sent.\n\nPlease check your inbox (and spam folder).",
        {
          actions: [{ text: "Back to Login", onPress: () => handleBackToLogin() }],
        }
      );
    } catch (error) {
      let message = "Could not send reset email. Please try again.";

      if (error?.code === "auth/invalid-email") {
        message = "The email address looks invalid.";
      }

      if (error?.code === "auth/too-many-requests") {
        message = "Too many attempts. Please try again later.";
      }

      if (error?.code === "auth/network-request-failed") {
        message = "Network error. Please check your connection.";
      }

      alert.error("Reset Failed", message);
    } finally {
      setLoading(false);
    }
  };

  const scrollBottomPadding = isKeyboardVisible
    ? Math.max(insets.bottom, getSpacing(16))
    : WAVE_H + Math.max(insets.bottom, getSpacing(18));

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <StatusBar style="light" backgroundColor={VaultColors.appBackground} />

      <View style={styles.topWaveWrap}>
        <TopWave height={WAVE_H} />
      </View>

      {!isKeyboardVisible && (
        <View style={styles.bottomWaveHolder} pointerEvents="none">
          <BottomWave height={WAVE_H} />
        </View>
      )}

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollBottomPadding }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          showsVerticalScrollIndicator={false}
          bounces={false}
          overScrollMode="never"
          contentInsetAdjustmentBehavior="never"
        >
          <View style={styles.contentWrap}>
            <View style={styles.brandWrap}>
              <Image source={logo} style={styles.logo} resizeMode="contain" />
              <View style={styles.brand3d}>
                <Text style={styles.brandShadow}>VaultHive</Text>
                <Text style={styles.brandText}>VaultHive</Text>
              </View>
            </View>

            <View style={styles.bodyWrap}>
              <View style={styles.hero}>
                <Text style={styles.title}>Forgot Password</Text>
                <Text style={styles.subtitle}>
                  Enter your username or email and we&apos;ll send you a reset link.
                </Text>
              </View>

              <View style={styles.form}>
                <Input
                  placeholder="username or email"
                  leftIcon="user"
                  value={identifier}
                  onChangeText={handleInputChange}
                  keyboardType="default"
                  autoCapitalize="none"
                  error={errors.identifier}
                  style={styles.inputTight}
                />

                <Button
                  title="Send Reset Link"
                  onPress={handleSendReset}
                  variant="primary"
                  loading={loading}
                  style={styles.resetButton}
                />

                <TouchableOpacity
                  onPress={handleBackToLogin}
                  activeOpacity={0.85}
                  style={styles.backRow}
                >
                  <Text style={styles.backText}>
                    Remember your password? <Text style={styles.backLink}>Log In</Text>
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },

  container: {
    flex: 1,
    backgroundColor: VaultColors.appBackground,
    position: "relative",
  },

  topWaveWrap: {
    backgroundColor: VaultColors.brandGoldSoft,
  },

  bottomWaveHolder: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },

  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: VaultSpacing.screenPadding,
    paddingTop: getSpacing(4),
  },

  contentWrap: {
    width: "100%",
    alignItems: "center",
  },

  brandWrap: {
    alignItems: "center",
    marginTop: getSpacing(0),
    marginBottom: getSpacing(14),
  },

  logo: {
    width: scale(70),
    height: scale(70),
    marginBottom: getSpacing(4),
  },

  brand3d: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },

  brandShadow: {
    position: "absolute",
    transform: [{ translateX: 2 }, { translateY: 2 }],
    fontSize: getFontSize(32),
    fontFamily: "Poppins",
    fontWeight: "900",
    color: VaultColors.brandGoldLight,
    opacity: 0.55,
  },

  brandText: {
    fontSize: getFontSize(32),
    fontFamily: "Poppins",
    fontWeight: "900",
    color: VaultColors.textPrimary,
    textShadowColor: "rgba(0,0,0,0.12)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },

  bodyWrap: {
    width: FORM_WIDTH_PERCENT,
    maxWidth: FORM_MAX_W,
  },

  hero: {
    alignItems: "flex-start",
    marginBottom: getSpacing(4),
    width: "100%",
  },

  title: {
    marginTop: getSpacing(30),
    fontSize: getFontSize(26),
    color: VaultColors.textPrimary,
    fontFamily: "Poppins",
    fontWeight: "900",
  },

  subtitle: {
    marginTop: getSpacing(8),
    fontSize: getFontSize(11),
    color: VaultColors.textMuted,
    fontFamily: "Poppins",
    fontWeight: "700",
    lineHeight: getFontSize(20),
    width: "100%",
  },

  form: {
    marginTop: getSpacing(10),
    width: "100%",
  },

  inputTight: {
    marginVertical: getSpacing(6),
    width: "100%",
  },

  resetButton: {
    marginTop: getSpacing(15),
    alignSelf: "center",
    width: "60%",
    borderRadius: VaultRadius.lg,
    ...VaultShadows.sm,
  },

  backRow: {
    alignSelf: "center",
    marginTop: getSpacing(14),
    paddingVertical: getSpacing(6),
  },

  backText: {
    fontSize: getFontSize(12),
    color: VaultColors.textMuted,
    fontFamily: "Poppins",
    fontWeight: "700",
  },

  backLink: {
    fontSize: getFontSize(12),
    color: VaultColors.textSecondary,
    fontFamily: "Poppins",
    fontWeight: "900",
    textDecorationLine: "underline",
  },
});

export default ForgotPasswordScreen;