import React, { createContext, useContext, useState, useEffect } from 'react';
import { AuthService } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem('agritech_user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState(() => localStorage.getItem('agritech_token') || null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('agritech_token');
      if (storedToken) {
        try {
          const res = await AuthService.getMe();
          if (res?.user) {
            setUser(res.user);
            localStorage.setItem('agritech_user', JSON.stringify(res.user));
          } else {
            logout();
          }
        } catch (err) {
          console.warn('Session verification notice, retaining cached session:', err);
          const savedUser = localStorage.getItem('agritech_user');
          if (savedUser) {
            try {
              setUser(JSON.parse(savedUser));
            } catch {
              logout();
            }
          } else {
            logout();
          }
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    };
    initAuth();
  }, []);

  const saveSession = (authToken, userData) => {
    localStorage.setItem('agritech_token', authToken);
    localStorage.setItem('agritech_user', JSON.stringify(userData));
    setToken(authToken);
    setUser(userData);
  };

  const loginWithGoogle = async (idToken, role = 'farmer') => {
    try {
      const data = await AuthService.loginWithGoogle(idToken, role);
      saveSession(data.access_token, data.user);
      return data.user;
    } catch (err) {
      console.error('Google login failed:', err);
      throw err;
    }
  };

  const demoLogin = async (role = 'farmer') => {
    try {
      const data = await AuthService.demoLogin(role);
      saveSession(data.access_token, data.user);
      return data.user;
    } catch (err) {
      console.error('Demo login fallback triggered:', err);
      const mockUser = role === 'admin'
        ? { id: 1, email: 'admin@agritech.com', name: 'AgriOps System Admin', role: 'admin' }
        : { id: 2, email: 'farmer@agritech.com', name: 'Ramesh Kumar (Farmer)', role: 'farmer' };
      saveSession('mock-demo-jwt-token', mockUser);
      return mockUser;
    }
  };

  const logout = () => {
    localStorage.removeItem('agritech_token');
    localStorage.removeItem('agritech_user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        role: user?.role || null,
        isAdmin: user?.role === 'admin',
        isFarmer: user?.role === 'farmer' || user?.role === 'admin',
        saveSession,
        loginWithGoogle,
        demoLogin,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
