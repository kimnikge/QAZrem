import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { UserInfo } from '../api';

type AuthContextType = {
  user: UserInfo | null;
  token: string | null;
  login: (user: UserInfo, token: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
  initialized: boolean;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const savedToken = sessionStorage.getItem('token');
    const savedUser = sessionStorage.getItem('user');
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
    setInitialized(true);
  }, []);

  const login = (user: UserInfo, token: string) => {
    setUser(user);
    setToken(token);
    sessionStorage.setItem('token', token);
    sessionStorage.setItem('user', JSON.stringify(user));
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAuthenticated: !!token, initialized }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
