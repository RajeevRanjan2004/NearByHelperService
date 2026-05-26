import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  fetchCurrentUser,
  loginUser,
  registerUser,
  setAuthToken,
} from "../services/api";

const AuthContext = createContext(null);
const storageKey = "nearby-helper-auth";

function AuthProvider({ children }) {
  const [token, setToken] = useState("");
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function restoreSession() {
      const raw = window.localStorage.getItem(storageKey);

      if (!raw) {
        setIsLoading(false);
        return;
      }

      try {
        const parsed = JSON.parse(raw);

        if (!parsed?.token) {
          window.localStorage.removeItem(storageKey);
          setIsLoading(false);
          return;
        }

        setAuthToken(parsed.token);
        const currentUser = await fetchCurrentUser();
        setToken(parsed.token);
        setUser(currentUser);
      } catch (_error) {
        window.localStorage.removeItem(storageKey);
        setAuthToken("");
        setToken("");
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }

    restoreSession();
  }, []);

  function persistSession(nextToken, nextUser) {
    setToken(nextToken);
    setUser(nextUser);
    setAuthToken(nextToken);
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        token: nextToken,
      })
    );
  }

  async function register(values) {
    const session = await registerUser(values);
    persistSession(session.token, session.user);
    return session.user;
  }

  async function login(values) {
    const session = await loginUser(values);
    persistSession(session.token, session.user);
    return session.user;
  }

  function logout() {
    window.localStorage.removeItem(storageKey);
    setAuthToken("");
    setToken("");
    setUser(null);
  }

  const value = useMemo(
    () => ({
      token,
      user,
      isLoading,
      isAuthenticated: Boolean(token && user),
      login,
      logout,
      register,
      setUser,
    }),
    [isLoading, token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}

export { AuthProvider, useAuth };
