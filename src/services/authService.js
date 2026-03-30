import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updatePassword,
  updateProfile,
  onAuthStateChanged,
  sendEmailVerification,
  deleteUser,
} from "firebase/auth";
import { ref, get, update, serverTimestamp, runTransaction } from "firebase/database";
import { auth, database } from "../config/firebase";

const usernameKey = (name = "") =>
  String(name).toLowerCase().trim().replace(/[.#$\[\]]/g, "_");

const buildActionCodeSettings = () => {
  const url = process.env.EXPO_PUBLIC_VERIFY_REDIRECT_URL;
  const dynamicLinkDomain = process.env.EXPO_PUBLIC_DYNAMIC_LINK_DOMAIN;
  const androidPackage = process.env.EXPO_PUBLIC_ANDROID_PACKAGE;
  const iosBundleId = process.env.EXPO_PUBLIC_IOS_BUNDLE_ID;

  if (!url) return undefined;

  const cfg = { url, handleCodeInApp: true };
  if (dynamicLinkDomain) cfg.dynamicLinkDomain = dynamicLinkDomain;
  if (androidPackage) cfg.android = { packageName: androidPackage, installApp: true };
  if (iosBundleId) cfg.iOS = { bundleId: iosBundleId };
  return cfg;
};

const sendVerificationEmailSafe = async (user) => {
  const acs = buildActionCodeSettings();
  if (acs) return sendEmailVerification(user, acs);
  return sendEmailVerification(user);
};

async function reserveUsername(uid, rawName) {
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

  if (!tx.committed || tx.snapshot.val() !== uid) throw new Error("auth/username-taken");
  return key;
}

const FRIENDLY = {
  "auth/email-already-in-use": { title: "Email already used", message: "This email is already registered. Try logging in.", field: "email" },
  "auth/invalid-email": { title: "Invalid email", message: "Please enter a valid email address.", field: "email" },
  "auth/weak-password": { title: "Weak password", message: "Use at least 8 characters with 1 uppercase and 1 special (% & @).", field: "password" },
  "auth/wrong-password": { title: "Wrong password", message: "The password you entered is incorrect.", field: "password" },
  "auth/user-not-found": { title: "Account not found", message: "No account is linked to this email.", field: "email" },
  "auth/user-disabled": { title: "Account disabled", message: "This account has been disabled. Please contact support." },
  "auth/too-many-requests": { title: "Too many attempts", message: "Please wait a few minutes and try again." },
  "auth/network-request-failed": { title: "Connection problem", message: "Check your internet connection and try again." },
  "auth/invalid-credential": { title: "Login failed", message: "Email or password is incorrect." },
  "auth/operation-not-allowed": { title: "Sign up is disabled", message: "Email/password sign up is not enabled in Firebase." },
  "auth/email-not-verified": { title: "Verify your email", message: "Please verify your email first, then try logging in." },
  "auth/username-taken": { title: "Username taken", message: "That username is already taken. Try adding numbers.", field: "userName" },
  "auth/invalid-username": { title: "Invalid username", message: "Please choose a valid username.", field: "userName" },
  "auth/missing-continue-uri": { title: "Verification not configured", message: "Set EXPO_PUBLIC_VERIFY_REDIRECT_URL (or use default verification link)." },
  "auth/invalid-continue-uri": { title: "Verification not configured", message: "Set EXPO_PUBLIC_VERIFY_REDIRECT_URL (or use default verification link)." },
  "db/permission-denied": { title: "Access denied", message: "Database rules blocked the request." },
  "permission_denied": { title: "Access denied", message: "Database rules blocked the request." },
  unknown: { title: "Something went wrong", message: "Please try again." },
};

function normalizeCode(errOrCode) {
  if (!errOrCode) return "unknown";
  if (typeof errOrCode === "string") return errOrCode;

  const code = errOrCode.code ? String(errOrCode.code) : "";
  if (code) return code;

  const msg = errOrCode.message ? String(errOrCode.message) : "";
  if (msg.startsWith("auth/")) return msg;

  const lower = msg.toLowerCase();
  if (lower.includes("permission_denied") || lower.includes("permission denied")) return "db/permission-denied";
  if (lower.includes("network request failed")) return "auth/network-request-failed";
  return "unknown";
}

function friendlyFrom(errOrCode) {
  const code = normalizeCode(errOrCode);
  const f = FRIENDLY[code] || FRIENDLY.unknown;
  return { code, title: f.title, message: f.message, field: f.field || null };
}

class AuthService {
  friendlyError(errOrCode) {
    return friendlyFrom(errOrCode);
  }

  async register(userData) {
    const { email, password, userName, mobileNumber } = userData;
    let user;

    try {
      const emailLower = String(email || "").toLowerCase().trim();
      const pass = String(password || "");

      const cred = await createUserWithEmailAndPassword(auth, emailLower, pass);
      user = cred.user;

      try {
        if (userName) await updateProfile(user, { displayName: userName });
      } catch {}

      const unameLower = await reserveUsername(user.uid, userName);

      const profile = {
        name: userName || "",
        email: user.email || emailLower,
        email_lower: (user.email || emailLower).toLowerCase(),
        username: userName || "",
        username_lower: unameLower,
        user_type: "user",
        registration_date: new Date().toISOString().slice(0, 10),
        mobileNumber: mobileNumber || "",
      };

      const settings = {
        theme: "light",
        language: "en",
        push_enabled: true,
        biometric_enabled: false,
        notif_return_deadline: true,
        notif_warranty_expiry: true,
        notif_weekly_summary: true,
      };

      const updatesObj = {};
      updatesObj[`users/${user.uid}`] = profile;
      updatesObj[`user_settings/${user.uid}`] = settings;
      updatesObj[`usernames/${unameLower}`] = { uid: user.uid, email: profile.email };

      await update(ref(database), updatesObj);

      let verificationSent = false;
      try {
        await sendVerificationEmailSafe(user);
        verificationSent = true;
      } catch (e) {
        if (__DEV__) console.log("[verify email failed]", e?.code, e?.message, e);
      }

      try {
        await signOut(auth);
      } catch {}

      return {
        success: true,
        verificationEmailSent: verificationSent,
        user: {
          uid: user.uid,
          email: emailLower,
          displayName: userName || "",
          emailVerified: user.emailVerified,
        },
      };
    } catch (error) {
      const info = friendlyFrom(error);

      if (user && info.code === "auth/username-taken") {
        try {
          await deleteUser(user);
        } catch {}
      }

      return {
        success: false,
        code: info.code,
        title: info.title,
        error: info.message,
        field: info.field,
      };
    }
  }

  async login(email, password) {
    try {
      const emailLower = String(email || "").toLowerCase().trim();
      const userCredential = await signInWithEmailAndPassword(auth, emailLower, String(password || ""));
      const user = userCredential.user;

      if (!user.emailVerified) {
        try {
          await signOut(auth);
        } catch {}
        const info = friendlyFrom("auth/email-not-verified");
        return { success: false, code: info.code, title: info.title, error: info.message };
      }

      const userRef = ref(database, `users/${user.uid}`);
      const snapshot = await get(userRef);
      const userData = snapshot.exists() ? snapshot.val() : {};

      await update(userRef, {
        lastLogin: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isEmailVerified: true,
      });

      return {
        success: true,
        user: {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          emailVerified: user.emailVerified,
          ...userData,
        },
      };
    } catch (error) {
      const info = friendlyFrom(error);
      return {
        success: false,
        code: info.code,
        title: info.title,
        error: info.message,
        field: info.field,
      };
    }
  }

  async logout() {
    try {
      await signOut(auth);
      return { success: true };
    } catch (error) {
      const info = friendlyFrom(error);
      return { success: false, code: info.code, title: info.title, error: info.message };
    }
  }

  async resetPassword(email) {
    try {
      const emailLower = String(email || "").toLowerCase().trim();
      await sendPasswordResetEmail(auth, emailLower);
      return {
        success: true,
        message: "If an account exists for this email, a password reset email has been sent.",
      };
    } catch (error) {
      const info = friendlyFrom(error);
      return {
        success: false,
        code: info.code,
        title: info.title,
        error: info.message,
        field: info.field,
      };
    }
  }

  async resendVerificationEmail() {
    try {
      const user = auth.currentUser;

      if (!user) {
        return {
          success: false,
          code: "auth/no-current-user",
          title: "Not signed in",
          error: "Please sign in first.",
        };
      }

      if (user.emailVerified) {
        return {
          success: false,
          code: "auth/already-verified",
          title: "Already verified",
          error: "Your email is already verified.",
        };
      }

      await sendVerificationEmailSafe(user);
      return { success: true, message: "Verification email sent" };
    } catch (error) {
      const info = friendlyFrom(error);
      return { success: false, code: info.code, title: info.title, error: info.message };
    }
  }

  async changePassword(newPassword) {
    try {
      const user = auth.currentUser;

      if (!user) {
        return {
          success: false,
          code: "auth/no-current-user",
          title: "Not signed in",
          error: "Please sign in first.",
        };
      }

      await updatePassword(user, String(newPassword || ""));
      const userRef = ref(database, `users/${user.uid}`);
      await update(userRef, {
        lastPasswordChange: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      return { success: true, message: "Password updated successfully" };
    } catch (error) {
      const info = friendlyFrom(error);
      return { success: false, code: info.code, title: info.title, error: info.message };
    }
  }

  getCurrentUser() {
    return auth.currentUser;
  }

  onAuthStateChange(callback) {
    return onAuthStateChanged(auth, callback);
  }
}

export default new AuthService();