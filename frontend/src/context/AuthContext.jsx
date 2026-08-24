import { createContext, useState, useEffect, useCallback, useRef } from 'react';
import { login as apiLogin, logout as apiLogout, refresh, getMe } from '../api/auth';
import { setAccessToken, clearAccessToken, getAccessToken } from '../api/client';
import { getUserPermissions } from '../api/rbac';

export const AuthContext = createContext(null);

function getTokenExpiryMs(token) {
  if (!token) return 0;
  try {
    const payloadBase64 = token.split('.')[1];
    if (!payloadBase64) return 0;
    const base64 = payloadBase64.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const { exp } = JSON.parse(jsonPayload);
    return exp ? exp * 1000 : 0;
  } catch {
    return 0;
  }
}

export function AuthProvider({ children }) {
  const [user,        setUser]        = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [permissions, setPermissions] = useState(null);
  const refreshTimerRef               = useRef(null);

  const clearRefreshTimer = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  async function fetchPermissions(userId) {
    try {
      const data = await getUserPermissions(userId);
      setPermissions(data.resolved ?? []);
    } catch {
      setPermissions(null);
    }
  }

  const scheduleRefreshTimer = useCallback((token) => {
    clearRefreshTimer();
    const expMs = getTokenExpiryMs(token);
    if (!expMs) return;

    // Refresh 2 minutes (120,000 ms) before expiration
    const refreshBufferMs = 2 * 60 * 1000;
    const timeUntilRefresh = expMs - Date.now() - refreshBufferMs;
    const delay = Math.max(timeUntilRefresh, 0);

    refreshTimerRef.current = setTimeout(() => {
      performSilentRefresh();
    }, delay);
  }, [clearRefreshTimer]);

  const performSilentRefresh = useCallback(async () => {
    const storedRefreshToken = localStorage.getItem('refresh_token');
    if (!storedRefreshToken) return null;

    try {
      const data = await refresh();
      setAccessToken(data.access_token);
      let u = data.user;
      if (!u) {
        const profile = await getMe();
        u = profile.user ?? profile;
      }
      setUser(u);
      fetchPermissions(u.id);
      scheduleRefreshTimer(data.access_token);
      return data;
    } catch (err) {
      clearAccessToken();
      localStorage.removeItem('refresh_token');
      setUser(null);
      setPermissions(null);
      clearRefreshTimer();
      return null;
    }
  }, [scheduleRefreshTimer, clearRefreshTimer]);

  // On mount: attempt session restoration using stored refresh token
  useEffect(() => {
    const storedRefreshToken = localStorage.getItem('refresh_token');
    if (!storedRefreshToken) {
      setLoading(false);
      return;
    }

    performSilentRefresh().finally(() => setLoading(false));
  }, []);

  // Listen for visibility change (e.g. returning to tab)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const storedRefreshToken = localStorage.getItem('refresh_token');
        if (!storedRefreshToken) return;

        const currentToken = getAccessToken();
        const expMs = getTokenExpiryMs(currentToken);
        const now = Date.now();

        if (!currentToken || expMs - now <= 2 * 60 * 1000) {
          performSilentRefresh();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [performSilentRefresh]);

  // Listen for the 401 event dispatched by the axios interceptor when refresh fails.
  useEffect(() => {
    function handleAuthLogout() {
      clearRefreshTimer();
      clearAccessToken();
      localStorage.removeItem('refresh_token');
      setUser(null);
      setPermissions(null);
    }
    window.addEventListener('auth:logout', handleAuthLogout);
    return () => {
      window.removeEventListener('auth:logout', handleAuthLogout);
      clearRefreshTimer();
    };
  }, [clearRefreshTimer]);

  const login = useCallback(async ({ phone, password }) => {
    const data = await apiLogin({ phone, password });
    setAccessToken(data.access_token);
    localStorage.setItem('refresh_token', data.refresh_token);
    const u = data.user;
    setUser(u);
    fetchPermissions(u.id);
    scheduleRefreshTimer(data.access_token);
    return u;
  }, [scheduleRefreshTimer]);

  const logout = useCallback(async () => {
    clearRefreshTimer();
    try { await apiLogout(); } catch { /* ignore network errors on logout */ }
    clearAccessToken();
    localStorage.removeItem('refresh_token');
    setUser(null);
    setPermissions(null);
  }, [clearRefreshTimer]);

  const role            = user?.roles?.[0] ?? null;
  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider value={{
      user, role, isAuthenticated, loading, login, logout,
      permissions,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
