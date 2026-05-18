import { createContext, useState, useEffect, useCallback } from 'react';
import { login as apiLogin, logout as apiLogout, refresh, getMe } from '../api/auth';
import { setAccessToken, clearAccessToken } from '../api/client';
import { getUserPermissions } from '../api/rbac';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,        setUser]        = useState(null);
  const [loading,     setLoading]     = useState(true);
  // null = not yet fetched (or fetch failed — show all UI)
  // string[] = resolved permission keys from GET /users/:id/permissions
  const [permissions, setPermissions] = useState(null);

  // Fetch the current user's resolved permission set.
  // On any failure (403 for non-admin users, network error, etc.),
  // leaves permissions as null so the UI degrades gracefully — the backend
  // middleware still enforces actual authorization on every API call.
  async function fetchPermissions(userId) {
    try {
      const data = await getUserPermissions(userId);
      setPermissions(data.resolved ?? []);
    } catch {
      setPermissions(null);
    }
  }

  // On mount: attempt a silent refresh using the httpOnly cookie.
  useEffect(() => {
    refresh()
      .then(async ({ access_token }) => {
        setAccessToken(access_token);
        const profile = await getMe();
        const u = profile.user ?? profile;
        setUser(u);
        fetchPermissions(u.id); // fire-and-forget — loading=false proceeds immediately
      })
      .catch(() => { /* no valid session — stay logged out */ })
      .finally(() => setLoading(false));
  }, []);

  // Listen for the 401 event dispatched by the axios interceptor when refresh fails.
  useEffect(() => {
    function handleAuthLogout() {
      clearAccessToken();
      setUser(null);
      setPermissions(null);
    }
    window.addEventListener('auth:logout', handleAuthLogout);
    return () => window.removeEventListener('auth:logout', handleAuthLogout);
  }, []);

  const login = useCallback(async ({ phone, password }) => {
    const data = await apiLogin({ phone, password });
    setAccessToken(data.access_token);
    const u = data.user;
    setUser(u);
    // Fire-and-forget: permissions will appear shortly after navigation completes.
    // Does not block the post-login redirect.
    fetchPermissions(u.id);
    return u;
  }, []);

  const logout = useCallback(async () => {
    try { await apiLogout(); } catch { /* ignore network errors on logout */ }
    clearAccessToken();
    setUser(null);
    setPermissions(null);
  }, []);

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
