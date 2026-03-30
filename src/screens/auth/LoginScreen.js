import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Keyboard,
  ScrollView,
  KeyboardAvoidingView,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import * as Facebook from "expo-auth-session/providers/facebook";
import { makeRedirectUri } from "expo-auth-session";
import {
  GoogleAuthProvider,
  FacebookAuthProvider,
  OAuthProvider,
  signInWithCredential,
} from "firebase/auth";
import { ref, get } from "firebase/database";

import { TopWave, BottomWave } from "../../components/Waves";
import Button from "../../components/Button";
import Input from "../../components/Input";
import GoogleIcon from "../../components/GoogleIcon";
import FacebookIcon from "../../components/FacebookIcon";
import AppleIcon from "../../components/AppleIcon";
import {
  validateEmail,
  validateRequired,
  validateName,
} from "../../utils/validation";

import {
  VaultColors,
  VaultRadius,
  VaultSpacing,
  VaultShadows,
} from "../../styles/DesignSystem";
import { scale, getSpacing, getFontSize } from "../../utils/responsive";

import databaseService from "../../services/databaseService";
import { useAlert } from "../../components/AlertProvider";
import { auth, database } from "../../config/firebase";
import { useAuth } from "../../context/AuthContext";

WebBrowser.maybeCompleteAuthSession();

const WAVE_H = scale(130);
const FORM_MAX_W = scale(320);
const FORM_WIDTH_PERCENT = "86%";

const makeNonce = (len = 32) => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < len; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
};

const LoginScreen = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const alert = useAlert();
  const { login } = useAuth();

  const [formData, setFormData] = useState({
    identifier: "",
    password: "",
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  const [gRequest, gResponse, gPromptAsync] = Google.useAuthRequest({
    expoClientId: process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    redirectUri: makeRedirectUri({ scheme: "vaulthive" }),
    scopes: ["profile", "email"],
  });

  const [fRequest, fResponse, fPromptAsync] = Facebook.useAuthRequest({
    clientId: process.env.EXPO_PUBLIC_FACEBOOK_APP_ID,
    redirectUri: makeRedirectUri({ scheme: "vaulthive" }),
  });

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

  useEffect(() => {
    let mounted = true;

    (async () => {
      if (Platform.OS !== "ios") {
        if (mounted) setAppleAvailable(false);
        return;
      }

      try {
        const AppleAuthentication = await import("expo-apple-authentication");
        const ok = await AppleAuthentication.isAvailableAsync();
        if (mounted) setAppleAvailable(!!ok);
      } catch {
        if (mounted) setAppleAvailable(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const p = route?.params?.prefill;
    if (!p) return;

    const email = typeof p === "string" ? p : p?.email;
    const password = typeof p === "object" ? p?.password : "";

    if (email || password) {
      setFormData({
        identifier: email || "",
        password: password || "",
      });
      setErrors({});
    }
  }, [route?.params?.prefill]);

  const usernameKey = (name = "") =>
    String(name)
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "")
      .replace(/[.#$\[\]]/g, "_");

  const resolveEmailFromIdentifier = async (identifier) => {
    const trimmed = (identifier || "").trim();

    if (!trimmed) {
      return { ok: false, error: "Username or email is required" };
    }

    if (trimmed.includes("@")) {
      const emailErr = validateEmail(trimmed);
      if (emailErr) return { ok: false, error: emailErr };
      return { ok: true, email: trimmed };
    }

    const nameErr = validateName(trimmed);
    if (nameErr) return { ok: false, error: nameErr };

    const key = usernameKey(trimmed);
    const unameSnap = await get(ref(database, `usernames/${key}`));

    if (!unameSnap.exists()) {
      return { ok: false, error: "No account found with this username" };
    }

    const mapVal = unameSnap.val();
    const uid = typeof mapVal === "string" ? mapVal : mapVal?.uid;
    const directEmail = typeof mapVal === "object" ? mapVal?.email : null;

    const email = directEmail
      ? directEmail
      : uid
      ? (await get(ref(database, `users/${uid}/email`))).val()
      : null;

    if (!email) {
      return { ok: false, error: "No email found for this username" };
    }

    const emailErr2 = validateEmail(email);
    if (emailErr2) {
      return {
        ok: false,
        error: "Linked email looks invalid. Please use your email.",
      };
    }

    return { ok: true, email };
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    const id = (formData.identifier || "").trim();
    const pw = formData.password || "";

    const idError = id.includes("@")
      ? validateEmail(id)
      : validateRequired(id, "Username");

    if (idError) newErrors.identifier = idError;

    const passwordError = validateRequired(pw, "Password");
    if (passwordError) newErrors.password = passwordError;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const ensureSocialProfile = async (user, fallbackName = "", fallbackEmail = "") => {
    const profile = await databaseService.getUserProfile(user.uid);

    if (!profile?.success) {
      await databaseService.createUserProfile(user.uid, {
        uid: user.uid,
        userName: user.displayName || fallbackName || "",
        email: user.email || fallbackEmail || "",
      });
    }

    await databaseService.updateUserProfile(user.uid, {
      lastLogin: Date.now(),
    });
  };

  const handleLogin = async () => {
    if (!validateForm()) return;

    setLoading(true);

    try {
      const resolved = await resolveEmailFromIdentifier(formData.identifier);

      if (!resolved.ok) {
        alert.error("Login Failed", resolved.error || "Please check your credentials.");
        return;
      }

      const result = await login(resolved.email, formData.password);

      if (!result?.success) {
        alert.error("Login Failed", result?.error || "Invalid credentials.");
        return;
      }

      try {
        await databaseService.updateUserProfile(result.user.uid, {
          lastLogin: Date.now(),
        });
      } catch {}
    } catch {
      alert.error("Error", "An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleAppleLogin = async () => {
    if (socialLoading) return;

    if (!appleAvailable) {
      alert.error("Apple Sign-in", "Apple Sign-in is not available on this device.");
      return;
    }

    try {
      setSocialLoading(true);

      const AppleAuthentication = await import("expo-apple-authentication");
      const Crypto = await import("expo-crypto");

      const rawNonce = makeNonce(32);
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        rawNonce
      );

      const appleCredential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });

      const idToken = appleCredential?.identityToken;
      if (!idToken) throw new Error("Missing Apple identityToken");

      const provider = new OAuthProvider("apple.com");
      const cred = provider.credential({ idToken, rawNonce });

      const result = await signInWithCredential(auth, cred);

      const nameFromApple =
        appleCredential?.fullName?.givenName || appleCredential?.fullName?.familyName
          ? `${appleCredential?.fullName?.givenName || ""} ${
              appleCredential?.fullName?.familyName || ""
            }`.trim()
          : "";

      await ensureSocialProfile(
        result.user,
        nameFromApple,
        result.user.email || appleCredential?.email || ""
      );
    } catch (err) {
      const msg =
        err?.code === "ERR_REQUEST_CANCELED"
          ? "Sign-in canceled."
          : err?.message || "Please try again.";

      alert.error("Apple Sign-in Failed", msg);
    } finally {
      setSocialLoading(false);
    }
  };

  const handleSocialLogin = async (type) => {
    try {
      if (socialLoading) return;

      if (type === "Google") {
        await gPromptAsync();
        return;
      }

      if (type === "Facebook") {
        await fPromptAsync();
        return;
      }

      if (type === "Apple") {
        await handleAppleLogin();
      }
    } catch (e) {
      alert.error(`${type} Sign-in`, e?.message || "Something went wrong.");
    }
  };

  useEffect(() => {
    const runGoogle = async () => {
      if (gResponse?.type !== "success") return;

      try {
        setSocialLoading(true);

        const idToken = gResponse?.authentication?.idToken;
        if (!idToken) throw new Error("Missing Google idToken");

        const cred = GoogleAuthProvider.credential(idToken);
        const result = await signInWithCredential(auth, cred);

        await ensureSocialProfile(result.user, result.user.displayName || "", result.user.email || "");
      } catch (err) {
        alert.error("Google Sign-in Failed", err?.message || "Please try again.");
      } finally {
        setSocialLoading(false);
      }
    };

    runGoogle();
  }, [gResponse]);

  useEffect(() => {
    const runFacebook = async () => {
      if (fResponse?.type !== "success") return;

      try {
        setSocialLoading(true);

        const accessToken = fResponse?.authentication?.accessToken;
        if (!accessToken) throw new Error("Missing Facebook accessToken");

        const cred = FacebookAuthProvider.credential(accessToken);
        const result = await signInWithCredential(auth, cred);

        await ensureSocialProfile(result.user, result.user.displayName || "", result.user.email || "");
      } catch (err) {
        alert.error("Facebook Sign-in Failed", err?.message || "Please try again.");
      } finally {
        setSocialLoading(false);
      }
    };

    runFacebook();
  }, [fResponse]);

  const handleSignUp = () => navigation.navigate("Register");
  const handleForgotPassword = () => navigation.navigate("ForgotPassword");

  const appleDisabled = socialLoading || !appleAvailable;

  const scrollBottomPadding = isKeyboardVisible
    ? Math.max(insets.bottom, getSpacing(16))
    : WAVE_H + Math.max(insets.bottom, getSpacing(18));

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <StatusBar style="dark" backgroundColor={VaultColors.appBackground} />

      <View style={styles.topWaveWrap}>
        <TopWave />
      </View>

      {!isKeyboardVisible && (
        <View style={styles.bottomWaveHolder} pointerEvents="none">
          <BottomWave />
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
              <View style={styles.brand3d}>
                <Text style={styles.brandShadow}>VaultHive</Text>
                <Text style={styles.brandText}>VaultHive</Text>
              </View>
            </View>

            <View style={styles.bodyWrap}>
              <View style={styles.hero}>
                <Text style={styles.title}>Login</Text>
              </View>

              <View style={styles.form}>
                <Input
                  placeholder="username or email"
                  leftIcon="user"
                  value={formData.identifier}
                  onChangeText={(v) => handleInputChange("identifier", v)}
                  keyboardType="default"
                  autoCapitalize="none"
                  error={errors.identifier}
                  style={styles.inputSpaced}
                />

                <Input
                  placeholder="your password"
                  leftIcon="lock"
                  value={formData.password}
                  onChangeText={(v) => handleInputChange("password", v)}
                  secureTextEntry
                  showPasswordToggle
                  autoCapitalize="none"
                  autoCorrect={false}
                  error={errors.password}
                  style={styles.inputSpaced}
                />

                <Button
                  title="Login"
                  onPress={handleLogin}
                  variant="primary"
                  loading={loading}
                  style={styles.loginButton}
                />

                <TouchableOpacity
                  onPress={handleForgotPassword}
                  activeOpacity={0.85}
                  style={styles.forgotCenterWrap}
                >
                  <Text style={styles.forgotText}>Forgot password?</Text>
                </TouchableOpacity>

                <View style={styles.socialRow}>
                <TouchableOpacity
                  style={styles.socialBtn}
                  onPress={() => handleSocialLogin("Apple")}
                  disabled={appleDisabled}
                  activeOpacity={0.85}
                >
                  <AppleIcon width={34} height={33} color="#000000" />
                </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.socialBtn,
                      (socialLoading || !gRequest) && styles.socialBtnDisabled,
                    ]}
                    onPress={() => handleSocialLogin("Google")}
                    disabled={socialLoading || !gRequest}
                    activeOpacity={0.85}
                  >
                    <GoogleIcon width={34} height={33} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.socialBtn,
                      (socialLoading || !fRequest) && styles.socialBtnDisabled,
                    ]}
                    onPress={() => handleSocialLogin("Facebook")}
                    disabled={socialLoading || !fRequest}
                    activeOpacity={0.85}
                  >
                    <FacebookIcon width={34} height={33} />
                  </TouchableOpacity>
                </View>

                <View style={styles.signupRow}>
                  <Text style={styles.signupText}>Don&apos;t have an account? </Text>
                  <TouchableOpacity onPress={handleSignUp} activeOpacity={0.8}>
                    <Text style={styles.signupLink}>Create one</Text>
                  </TouchableOpacity>
                </View>
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
    paddingTop: getSpacing(6),
  },

  contentWrap: {
    width: "100%",
    alignItems: "center",
  },

  brandWrap: {
    alignItems: "center",
    marginTop: getSpacing(4),
    marginBottom: getSpacing(30),
  },

  brand3d: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },

  brandShadow: {
    position: "absolute",
    transform: [{ translateX: 2 }, { translateY: 2 }],
    fontSize: getFontSize(34),
    fontFamily: "Poppins",
    fontWeight: "900",
    color: VaultColors.brandGoldLight,
    opacity: 0.55,
  },

  brandText: {
    fontSize: getFontSize(34),
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
    marginTop: 0,
  },

  hero: {
    marginTop: 0,
    alignItems: "flex-start",
  },

  title: {
    marginTop: getSpacing(4),
    fontSize: getFontSize(26),
    color: VaultColors.textPrimary,
    fontFamily: "Poppins",
    fontWeight: "900",
  },

  form: {
    marginTop: getSpacing(12),
    width: "100%",
  },

  inputSpaced: {
    marginVertical: getSpacing(10),
    width: "100%",
  },

  loginButton: {
    marginTop: getSpacing(14),
    alignSelf: "center",
    width: "50%",
    borderRadius: VaultRadius.lg,
    ...VaultShadows.sm,
  },

  forgotCenterWrap: {
    alignSelf: "center",
    marginTop: getSpacing(12),
    paddingVertical: getSpacing(6),
  },

  forgotText: {
    fontSize: getFontSize(12),
    color: VaultColors.textSecondary,
    fontFamily: "Poppins",
    fontWeight: "800",
    textDecorationLine: "underline",
  },

  socialRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: getSpacing(14),
    marginTop: getSpacing(16),
  },

  socialBtn: {
    width: scale(44),
    height: scale(44),
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    borderWidth: 0,
    borderColor: "transparent",
    borderRadius: 0,
  },

  socialBtnDisabled: {
    opacity: 0.6,
  },

  signupRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: getSpacing(16),
  },

  signupText: {
    fontSize: getFontSize(12),
    color: VaultColors.textMuted,
    fontFamily: "Poppins",
    fontWeight: "700",
  },

  signupLink: {
    fontSize: getFontSize(12),
    color: VaultColors.textSecondary,
    fontFamily: "Poppins",
    fontWeight: "900",
    textDecorationLine: "underline",
  },
});

export default LoginScreen;