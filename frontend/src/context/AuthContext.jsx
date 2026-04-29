import { createContext, useState, useEffect, useCallback } from 'react';
import { login as apiLogin, logout as apiLogout, refresh, getMe } from '../api/auth';
import { setAccessToken, clearAccessToken } from '../api/client';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);

  // On mount: attempt a silent refresh using the httpOnly cookie.
  // If the cookie is valid we get a new access_token and can load the user profile.
  useEffect(() => {
    refresh()
      .then(async ({ access_token }) => {
        setAccessToken(access_token);
        const profile = await getMe();
        setUser(profile.user ?? profile);
      })
      .catch(() => { /* no valid session — stay logged out */ })
      .finally(() => setLoading(false));
  }, []);

  // Listen for the 401 event dispatched by the axios interceptor when refresh fails.
  useEffect(() => {
    function handleAuthLogout() {
      clearAccessToken();
      setUser(null);
    }
    window.addEventListener('auth:logout', handleAuthLogout);
    return () => window.removeEventListener('auth:logout', handleAuthLogout);
  }, []);

  const login = useCallback(async ({ phone, password }) => {
    const data = await apiLogin({ phone, password });
    setAccessToken(data.access_token);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try { await apiLogout(); } catch { /* ignore network errors on logout */ }
    clearAccessToken();
    setUser(null);
  }, []);

  const role            = user?.roles?.[0] ?? null;
  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider value={{ user, role, isAuthenticated, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
