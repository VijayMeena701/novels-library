'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { api, User } from '../utils/api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function isProtectedRoute(pathname: string): boolean {
  return pathname.startsWith('/profile') || pathname.startsWith('/scraper');
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    async function checkAuth() {
      if (api.isLoggedIn()) {
        try {
          const data = await api.getMe();
          setUser(data.user);
        } catch (err) {
          console.error('Failed to authenticate stored token:', err);
          api.logout();
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    }
    checkAuth();
  }, []);

  // Redirect unauthenticated users
  useEffect(() => {
    if (!loading) {
      const isAuthPage = pathname === '/login';
      if (!user && !isAuthPage && isProtectedRoute(pathname)) {
        router.push('/login');
      } else if (user && isAuthPage) {
        router.push('/profile');
      }
    }
  }, [user, loading, pathname, router]);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const data = await api.login(email, password);
      setUser(data.user);
      router.push('/profile');
    } catch (err) {
      setLoading(false);
      throw err;
    }
  };

  const register = async (username: string, email: string, password: string) => {
    setLoading(true);
    try {
      const data = await api.register(username, email, password);
      setUser(data.user);
      router.push('/profile');
    } catch (err) {
      setLoading(false);
      throw err;
    }
  };

  const logout = () => {
    api.logout();
    setUser(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
