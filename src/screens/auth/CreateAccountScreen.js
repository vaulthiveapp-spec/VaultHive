import React, { useEffect, useRef, useState } from "react";
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
  sendEmailVerification,
  signOut,
  deleteUser,
} from "firebase/auth";
import {
  ref,
  get,
  set,
  update,
  serverTimestamp,
  runTransaction,
} from "firebase/database";

import { TopWave, BottomWave } from "../../components/Waves";
import Button from "../../components/Button";
import Input from "../../components/Input";
import GoogleIcon from "../../components/GoogleIcon";
import FacebookIcon from "../../components/FacebookIcon";
import AppleIcon from "../../components/AppleIcon";
import PhoneInput from "../../components/PhoneInput";

import {
  validateEmail,
  validatePassword,
  validateName,
  validatePhoneNumber,
} from "../../utils/validation";
import { scale, getFontSize, getSpacing } from "../../utils/responsive";

import authService from "../../services/authService";
import { useAlert } from "../../components/AlertProvider";
import { auth, database } from "../../config/firebase";
import {
  VaultColors,
  VaultRadius,
  VaultSpacing,
  VaultShadows,
} from "../../styles/DesignSystem";

WebBrowser.maybeCompleteAuthSession();

const PASSWORD_POLICY = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: false,
  requireSpecialChars: true,
  allowedSpecialSet: "%&@",
};

const WAVE_H = scale(130);
const FORM_MAX_W = scale(320);
const FORM_WIDTH_PERCENT = "86%";

const liveConfirmError = (password, confirmPassword) => {
  if (!confirmPassword) return null;
  return password === confirmPassword ? null : "Passwords do not match";
};

const makeNonce = (length = 32) => {
  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
};

const CreateAccountScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const alert = useAlert();

  const [formData, setFormData] = useState({
    userName: "",
    email: "",
    mobileNumber: "",
    password: "",
    confirmPassword: "",
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);

  const redirectedRef = useRef(false);

  const safeNavigateToLogin = (email) => {
    if (redirectedRef.current) return;
    redirectedRef.current = true;
    navigation.replace("Login", email ? { prefill: { email } } : undefined);
  };

  const showFriendlyError = (err, fallbackTitle = "Error") => {
    if (typeof authService?.friendlyError === "function") {
      const info = authService.friendlyError(err);
      alert.error(info?.title || fallbackTitle, info?.message || "Please try again.");
      return;
    }
    alert.error(fallbackTitle, err?.message || "Please try again.");
  };

  const [gRequest, gResponse, gPromptAsync] = Google.useAuthRequest({
    expoClientId: process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    scopes: ["profile", "email"],
    redirectUri: makeRedirectUri({ scheme: "vaulthive" }),
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

  const usernameKey = (name = "") =>
    String(name)
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "")
      .replace(/[.#$\[\]]/g, "_");

  const checkUsernameUnique = async (rawName) => {
    const key = usernameKey(rawName);
    if (!key) return { ok: false, reason: "Choose a username" };

    const snap = await get(ref(database, `usernames/${key}`));
    if (snap.exists()) {
      return { ok: false, reason: "This username is already taken" };
    }

    return { ok: true, key };
  };

  const reserveUsernameTxn = async (uid, rawName) => {
    const key = usernameKey(rawName);
    if (!key) throw new Error("auth/invalid-username");

    const unameRef = ref(database, `usernames/${key}`);
    const tx = await runTransaction(
      unameRef,
      (current) => {
        if (current === null) return uid;
        if (current === uid) return uid;
        return;
      },
      { applyLocally: false }
    );

    if (!tx.committed || tx.snapshot.val() !== uid) {
      throw new Error("auth/username-taken");
    }

    return rawName;
  };

  const buildCandidates = (providerUser) => {
    const cands = [];

    if (formData.userName && !validateName(formData.userName)) {
      cands.push(formData.userName);
    }

    if (providerUser?.displayName) cands.push(providerUser.displayName);
    if (providerUser?.email) cands.push(providerUser.email.split("@")[0]);

    cands.push(
      `user_${(providerUser?.uid || "").slice(0, 6) || Math.random().toString(36).slice(2, 8)}`
    );

    return Array.from(new Set(cands.map((s) => String(s).trim()).filter(Boolean)));
  };

  const reserveAnyUsername = async (uid, providerUser) => {
    const bases = buildCandidates(providerUser);

    for (const base of bases) {
      try {
        return await reserveUsernameTxn(uid, base);
      } catch {}

      for (let i = 0; i < 15; i++) {
        const suffix = Math.floor(100 + Math.random() * 900);
        try {
          return await reserveUsernameTxn(uid, `${base}_${suffix}`);
        } catch {}
      }
    }

    return await reserveUsernameTxn(uid, `user_${uid.slice(0, 8)}`);
  };

  const ensureProfileDefaults = async (firebaseUser, chosenUserName) => {
    const userRef = ref(database, `users/${firebaseUser.uid}`);
    const snap = await get(userRef);

    if (!snap.exists()) {
      await set(userRef, {
        uid: firebaseUser.uid,
        userName: chosenUserName || firebaseUser.displayName || "",
        userNameLower: usernameKey(chosenUserName || firebaseUser.displayName || ""),
        email: firebaseUser.email || formData.email || "",
        mobileNumber: formData.mobileNumber || "",
        UserType: "User",
        RegistrationDate: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isEmailVerified: !!firebaseUser.emailVerified,
      });
    } else {
      await update(userRef, {
        updatedAt: serverTimestamp(),
      });
    }
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };

      setErrors((prevErrors) => {
        const e = { ...prevErrors };

        if (field === "userName") e.userName = validateName(next.userName) || null;
        if (field === "email") e.email = validateEmail(next.email) || null;
        if (field === "mobileNumber") {
          e.mobileNumber = validatePhoneNumber(next.mobileNumber) || null;
        }

        if (field === "password" || field === "confirmPassword") {
          e.password = validatePassword(next.password, PASSWORD_POLICY) || null;
          e.confirmPassword = liveConfirmError(next.password, next.confirmPassword);
        }

        return e;
      });

      return next;
    });
  };

  const validateForm = () => {
    const newErrors = {};

    const nameError = validateName(formData.userName);
    if (nameError) newErrors.userName = nameError;

    const emailError = validateEmail(formData.email);
    if (emailError) newErrors.email = emailError;

    const phoneError = validatePhoneNumber(formData.mobileNumber);
    if (phoneError) newErrors.mobileNumber = phoneError;

    const passwordError = validatePassword(formData.password, PASSWORD_POLICY);
    if (passwordError) newErrors.password = passwordError;

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = "Confirm password is required";
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const finalizeSocialUser = async (firebaseUser, providerName) => {
    const chosenUserName = await reserveAnyUsername(firebaseUser.uid, firebaseUser);
    await ensureProfileDefaults(firebaseUser, chosenUserName);

    if (!firebaseUser.emailVerified && firebaseUser.email) {
      let sent = false;

      try {
        await sendEmailVerification(firebaseUser);
        sent = true;
      } catch {}

      try {
        await signOut(auth);
      } catch {}

      const msg = sent
        ? `We sent a verification link to ${firebaseUser.email}.\n\nVerify, then log in.`
        : `Your account was created, but we couldn’t send the verification email right now.\n\nPlease check your internet connection and try again later.`;

      alert.success("Check your email", msg, {
        actions: [{ text: "OK", onPress: () => safeNavigateToLogin(firebaseUser.email) }],
      });
      return;
    }

    try {
      await signOut(auth);
    } catch {}

    alert.success(`Signed in with ${providerName}`, "You can log in now.", {
      actions: [{ text: "OK", onPress: () => safeNavigateToLogin(firebaseUser.email || "") }],
    });
  };

  const cleanupSocialFailure = async (err) => {
    if (
      (err?.message === "auth/username-taken" || err?.code === "auth/username-taken") &&
      auth.currentUser
    ) {
      try {
        await deleteUser(auth.currentUser);
      } catch {}

      try {
        await signOut(auth);
      } catch {}
    }
  };

  const handleSignUp = async () => {
    if (!validateForm()) return;

    setLoading(true);

    try {
      const uniq = await checkUsernameUnique(formData.userName);
      if (!uniq.ok) {
        setErrors((prev) => ({ ...prev, userName: uniq.reason }));
        return;
      }

      const result = await authService.register(formData);

      if (!result?.success) {
        if (result?.field) {
          setErrors((prev) => ({ ...prev, [result.field]: result.error }));
        }

        alert.error(
          result?.title || "Registration Failed",
          result?.error || "Please try again."
        );
        return;
      }

      const email = formData.email;
      const msg = result?.verificationEmailSent
        ? `We sent a verification email to ${email}.\n\nOpen your inbox, verify your account, then come back and log in.`
        : `Your account was created, but we couldn’t send the verification email right now.\n\nPlease check your internet connection and try again later.`;

      alert.success("Account Created!", msg, {
        actions: [{ text: "OK", onPress: () => safeNavigateToLogin(email) }],
      });
    } catch (error) {
      showFriendlyError(error, "Registration Failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSocialSignUp = async (type) => {
    try {
      if (socialLoading) return;

      if (type === "Google") await gPromptAsync();
      if (type === "Facebook") await fPromptAsync();
      if (type === "Apple") await handleAppleSignUp();
    } catch (e) {
      showFriendlyError(e, `${type} Sign-in Failed`);
    }
  };

  const handleAppleSignUp = async () => {
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
      await finalizeSocialUser(result.user, "Apple");
    } catch (err) {
      await cleanupSocialFailure(err);
      showFriendlyError(err, "Apple Sign-in Failed");
    } finally {
      setSocialLoading(false);
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

        await finalizeSocialUser(result.user, "Google");
      } catch (err) {
        await cleanupSocialFailure(err);
        showFriendlyError(err, "Google Sign-in Failed");
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

        await finalizeSocialUser(result.user, "Facebook");
      } catch (err) {
        await cleanupSocialFailure(err);
        showFriendlyError(err, "Facebook Sign-in Failed");
      } finally {
        setSocialLoading(false);
      }
    };

    runFacebook();
  }, [fResponse]);

  const handleLogin = () => navigation.replace("Login");

  const scrollBottomPadding = isKeyboardVisible
    ? Math.max(insets.bottom, getSpacing(16))
    : WAVE_H + Math.max(insets.bottom, getSpacing(18));

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <StatusBar style="light" backgroundColor={VaultColors.appBackground} />

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
            <View style={styles.bodyWrap}>
              <View style={styles.hero}>
                <Text style={styles.title}>Create Account</Text>
              </View>

              <View style={styles.form}>
                <Input
                  placeholder="username"
                  leftIcon="user"
                  value={formData.userName}
                  onChangeText={(v) => handleInputChange("userName", v)}
                  error={errors.userName}
                  style={styles.inputTight}
                />

                <Input
                  placeholder="email"
                  leftIcon="mail"
                  value={formData.email}
                  onChangeText={(v) => handleInputChange("email", v)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  error={errors.email}
                  style={styles.inputTight}
                />

                <PhoneInput
                  label={null}
                  value={formData.mobileNumber}
                  onChangeText={(v) => handleInputChange("mobileNumber", v)}
                  error={errors.mobileNumber}
                  style={styles.inputTight}
                />

                <Input
                  placeholder="password"
                  leftIcon="lock"
                  value={formData.password}
                  onChangeText={(v) => handleInputChange("password", v)}
                  secureTextEntry
                  showPasswordToggle
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="newPassword"
                  error={errors.password}
                  style={styles.inputTight}
                />

                <Input
                  placeholder="confirm password"
                  leftIcon="lock"
                  value={formData.confirmPassword}
                  onChangeText={(v) => handleInputChange("confirmPassword", v)}
                  secureTextEntry
                  showPasswordToggle
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="newPassword"
                  error={errors.confirmPassword}
                  style={styles.inputTight}
                />

                <Button
                  title="Sign Up"
                  onPress={handleSignUp}
                  variant="primary"
                  loading={loading}
                  style={styles.signupButton}
                />

                <View style={styles.loginPrompt}>
                  <Text style={styles.loginPromptText}>Already have an account? </Text>
                  <TouchableOpacity onPress={handleLogin} activeOpacity={0.85}>
                    <Text style={styles.loginLink}>Log In</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.socialRow}>
                  <TouchableOpacity
                    style={[
                      styles.socialBtn,
                      (socialLoading || !appleAvailable) && styles.socialBtnDisabled,
                    ]}
                    onPress={() => handleSocialSignUp("Apple")}
                    disabled={socialLoading || !appleAvailable}
                    activeOpacity={0.85}
                  >
                    <AppleIcon width={34} height={33} color="#000000" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.socialBtn,
                      (socialLoading || !gRequest) && styles.socialBtnDisabled,
                    ]}
                    onPress={() => handleSocialSignUp("Google")}
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
                    onPress={() => handleSocialSignUp("Facebook")}
                    disabled={socialLoading || !fRequest}
                    activeOpacity={0.85}
                  >
                    <FacebookIcon width={34} height={33} />
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

  bodyWrap: {
    width: FORM_WIDTH_PERCENT,
    maxWidth: FORM_MAX_W,
  },

  hero: {
    alignItems: "flex-start",
  },

  title: {
    marginTop: getSpacing(0),
    fontSize: getFontSize(26),
    color: VaultColors.textPrimary,
    fontFamily: "Poppins",
    fontWeight: "900",
  },

  form: {
    marginTop: getSpacing(10),
    width: "100%",
  },

  inputTight: {
    marginVertical: getSpacing(6),
    width: "100%",
  },

  signupButton: {
    marginTop: getSpacing(12),
    alignSelf: "center",
    width: "60%",
    borderRadius: VaultRadius.lg,
    ...VaultShadows.sm,
  },

  loginPrompt: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    flexWrap: "wrap",
    marginTop: getSpacing(12),
  },

  loginPromptText: {
    fontSize: getFontSize(12),
    color: VaultColors.textMuted,
    fontFamily: "Poppins",
    fontWeight: "700",
  },

  loginLink: {
    fontSize: getFontSize(12),
    color: VaultColors.textSecondary,
    fontFamily: "Poppins",
    fontWeight: "900",
    textDecorationLine: "underline",
  },

  socialRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: getSpacing(18),
    marginTop: getSpacing(6),
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


});

export default CreateAccountScreen;