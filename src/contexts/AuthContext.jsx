import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";

const AuthContext = createContext(null);

const VERIFY_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Helper: safely call Electron auth IPC (returns null when running in plain browser/dev)
function getAuthAPI() {
  return window.electronAPI?.auth ?? null;
}

export function AuthProvider({ children }) {
  // "loading" | "login" | "authenticated" | "locked"
  const [authState, setAuthState] = useState("loading");
  const [user, setUser] = useState(null);
  const [offline, setOffline] = useState(false);
  const [authError, setAuthError] = useState("");
  const verifyTimerRef = useRef(null);

  // ── Startup check ────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const api = getAuthAPI();

      // Dev bypass ONLY when there is genuinely no Electron context at all
      // (i.e. opened in a plain browser during development).
      // If window.electronAPI exists but auth is missing, that's a bug — lock the app.
      if (!window.electronAPI && !api) {
        console.warn(
          "[Auth] No Electron context detected — bypassing auth for browser dev mode",
        );
        setAuthState("authenticated");
        setUser({
          email: "dev@localhost",
          firstName: "Dev",
          plan: "pro",
          subscriptionStatus: "active",
        });
        return;
      }

      if (!api) {
        // Electron is present but auth IPC is missing — something went wrong
        setAuthError(
          "License verification unavailable. Please reinstall the app.",
        );
        setAuthState("login");
        return;
      }

      const hasToken = await api.hasToken();
      if (!hasToken) {
        setAuthState("login");
        return;
      }

      // Token exists → verify
      const result = await api.verify();
      handleVerifyResult(result);
    })();

    return () => clearInterval(verifyTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Background 24-hour re-verification ───────────────────────────
  const startVerifyTimer = useCallback(() => {
    if (verifyTimerRef.current) clearInterval(verifyTimerRef.current);
    verifyTimerRef.current = setInterval(async () => {
      const api = getAuthAPI();
      if (!api) return;
      const result = await api.verify();
      handleVerifyResult(result);
    }, VERIFY_INTERVAL_MS);
  }, []);

  // ── Process a verify result ──────────────────────────────────────
  const handleVerifyResult = useCallback(
    (result) => {
      if (result.success) {
        setUser(result.user);
        setOffline(!!result.offline);
        setAuthState("authenticated");
        setAuthError("");
        startVerifyTimer();
      } else if (result.locked) {
        setAuthState("login");
        setUser(null);
        setOffline(false);
        setAuthError(result.error || "");
      }
    },
    [startVerifyTimer],
  );

  // ── Login action ─────────────────────────────────────────────────
  const login = useCallback(
    async (email, password) => {
      const api = getAuthAPI();
      if (!api) return { success: false, error: "Not running in Electron." };

      const result = await api.login(email, password);
      if (result.success) {
        setUser(result.user);
        setOffline(false);
        setAuthError("");
        setAuthState("authenticated");
        startVerifyTimer();
      }
      return result;
    },
    [startVerifyTimer],
  );

  // ── Logout action ────────────────────────────────────────────────
  const logout = useCallback(async () => {
    const api = getAuthAPI();
    if (api) await api.logout();
    if (verifyTimerRef.current) clearInterval(verifyTimerRef.current);
    setUser(null);
    setOffline(false);
    setAuthError("");
    setAuthState("login");
  }, []);

  // ── Open external URL (turbodm.pro) ────────────────────────────
  const openExternal = useCallback((url) => {
    const api = getAuthAPI();
    if (api) {
      api.openExternal(url);
    } else {
      window.open(url, "_blank");
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        authState,
        user,
        offline,
        authError,
        login,
        logout,
        openExternal,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
