import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import authService from "../services/authService";
import databaseService from "../services/databaseService";
import { upsertUser, upsertUserSettings } from "../services/localRepo";
import { startSyncListener, stopSyncListener } from "../services/firebaseSync";

const AuthContext = createContext(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [bootLoading, setBootLoading] = useState(true);
  const [networkError, setNetworkError] = useState(false);

  const mountedRef = useRef(true);
  const bootDoneRef = useRef(false);

  const setAuthState = (nextUser, authed) => {
    if (!mountedRef.current) return;
    setUser(nextUser);
    setIsAuthenticated(!!authed);
  };

  const buildMergedUser = (firebaseUser, profile, settings) => ({
    uid: firebaseUser?.uid,
    email: firebaseUser?.email || profile?.email || "",
    name: profile?.name || firebaseUser?.displayName || "",
    username: profile?.username || firebaseUser?.displayName || "",
    photoURL: profile?.avatar_url || profile?.photoURL || firebaseUser?.photoURL || null,
    avatar_url: profile?.avatar_url || profile?.photoURL || firebaseUser?.photoURL || null,
    user_type: profile?.user_type || "user",
    base_currency: String(settings?.base_currency || profile?.base_currency || "SAR").toUpperCase(),
    city: profile?.city || "Saudi Arabia",
  });

  const persistLocalUser = async (merged, profile, settings) => {
    await upsertUser({
      uid: merged.uid,
      name: merged.name,
      email: merged.email,
      email_lower: merged.email ? String(merged.email).toLowerCase() : "",
      username: merged.username,
      username_lower: merged.username ? String(merged.username).toLowerCase().trim().replace(/\s+/g, "") : "",
      user_type: merged.user_type,
      registration_date: profile?.registration_date || null,
      created_at: Date.now(),
      updated_at: Date.now(),
    });

    if (settings || merged.base_currency) {
      await upsertUserSettings({
        uid: merged.uid,
        ...(settings || {}),
        language: settings?.language || "en",
        base_currency: merged.base_currency || "SAR",
        updated_at: Date.now(),
      });
    }
  };

  const refreshUserProfile = async (uidOverride = null) => {
    const firebaseUser = authService.getCurrentUser();
    const uid = uidOverride || firebaseUser?.uid;
    if (!uid || !firebaseUser) return null;

    try {
      const [profileRes, settingsRes] = await Promise.all([
        databaseService.getUserProfile(uid),
        databaseService.ensureDefaultUserSettings(uid),
      ]);

      const profile = profileRes?.success ? profileRes.data || null : null;
      const settings = settingsRes?.success ? settingsRes.data || null : null;
      const merged = buildMergedUser(firebaseUser, profile, settings);

      try {
        await persistLocalUser(merged, profile, settings);
      } catch {}

      setAuthState(merged, true);
      return merged;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    let unsubscribe;

    const finishBootOnce = () => {
      if (!mountedRef.current || bootDoneRef.current) return;
      bootDoneRef.current = true;
      setBootLoading(false);
    };

    const init = async () => {
      setBootLoading(true);
      setNetworkError(false);

      try {
        try {
          const conn = await databaseService.checkConnection();
          if (conn?.success === false) setNetworkError(true);
        } catch {}

        unsubscribe = authService.onAuthStateChange(async (firebaseUser) => {
          try {
            if (!mountedRef.current) return;

            if (!firebaseUser || !firebaseUser.emailVerified) {
              try {
                stopSyncListener();
              } catch {}
              setAuthState(null, false);
              return;
            }

            let profile = null;
            let settings = null;

            try {
              const profileRes = await databaseService.getUserProfile(firebaseUser.uid);
              profile = profileRes?.success ? profileRes.data || null : null;
            } catch {}

            try {
              const settingsRes = await databaseService.ensureDefaultUserSettings(firebaseUser.uid);
              settings = settingsRes?.success ? settingsRes.data || null : null;
            } catch {}

            const merged = buildMergedUser(firebaseUser, profile, settings);

            try {
              await persistLocalUser(merged, profile, settings);
            } catch {}

            try {
              startSyncListener(merged.uid);
            } catch {}

            setAuthState(merged, true);

            try {
              await databaseService.updateUserProfile(firebaseUser.uid, { lastLogin: Date.now() });
            } catch {}
          } catch {
            if (!mountedRef.current) return;
            setNetworkError(true);
            setAuthState(null, false);
          } finally {
            finishBootOnce();
          }
        });
      } catch {
        if (!mountedRef.current) return;
        setNetworkError(true);
        setAuthState(null, false);
        finishBootOnce();
      }
    };

    init();

    return () => {
      mountedRef.current = false;
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const login = async (email, password) => {
    setNetworkError(false);
    try {
      const res = await authService.login(email, password);
      if (!res?.success && String(res?.code || "").toLowerCase().includes("network")) {
        setNetworkError(true);
      }
      return res;
    } catch {
      setNetworkError(true);
      return { success: false, error: "Network error. Please check your connection." };
    }
  };

  const register = async (userData) => {
    setNetworkError(false);
    try {
      const res = await authService.register(userData);
      if (!res?.success && String(res?.code || "").toLowerCase().includes("network")) {
        setNetworkError(true);
      }
      return res;
    } catch {
      setNetworkError(true);
      return { success: false, error: "Network error. Please check your connection." };
    }
  };

  const logout = async () => {
    try {
      const res = await authService.logout();
      if (res?.success) {
        try {
          stopSyncListener();
        } catch {}
        setUser(null);
        setIsAuthenticated(false);
      }
      return res;
    } catch {
      return { success: false, error: "Failed to logout. Please try again." };
    }
  };

  const resetPassword = async (email) => {
    setNetworkError(false);
    try {
      const res = await authService.resetPassword(email);
      if (!res?.success && String(res?.code || "").toLowerCase().includes("network")) {
        setNetworkError(true);
      }
      return res;
    } catch {
      setNetworkError(true);
      return { success: false, error: "Network error. Please check your connection." };
    }
  };

  const changePassword = async (newPassword) => {
    setNetworkError(false);
    try {
      const res = await authService.changePassword(newPassword);
      if (!res?.success && String(res?.code || "").toLowerCase().includes("network")) {
        setNetworkError(true);
      }
      return res;
    } catch {
      setNetworkError(true);
      return { success: false, error: "Network error. Please check your connection." };
    }
  };

  const retryConnection = async () => {
    setNetworkError(false);
    try {
      const res = await databaseService.checkConnection();
      const ok = !!res?.success;
      if (!ok) setNetworkError(true);
      return ok;
    } catch {
      setNetworkError(true);
      return false;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        bootLoading,
        networkError,
        login,
        register,
        logout,
        resetPassword,
        changePassword,
        retryConnection,
        refreshUserProfile,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
