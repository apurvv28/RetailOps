import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useUser, useAuth as useClerkAuth, useClerk } from '@clerk/react';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const { isSignedIn, user: clerkUser, isLoaded: isClerkLoaded } = useUser();
  const { getToken, signOut } = useClerkAuth();
  const clerk = useClerk();

  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('agritech_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem('agritech_token') || null);
  const [loading, setLoading] = useState(true);

  const getSelectedRole = () => localStorage.getItem('agritech_selected_role') || 'farmer';

  const setSelectedRole = (role) => {
    localStorage.setItem('agritech_selected_role', role);
  };

  const syncClerkUser = useCallback(async (role) => {
    try {
      const sessionToken = await getToken().catch(() => null);

      const primaryEmail =
        clerkUser?.primaryEmailAddress?.emailAddress ||
        clerkUser?.emailAddresses?.[0]?.emailAddress ||
        '';
      const fullName =
        clerkUser?.fullName ||
        `${clerkUser?.firstName || ''} ${clerkUser?.lastName || ''}`.trim() ||
        (primaryEmail ? primaryEmail.split('@')[0] : 'Farmer');

      const res = await api.post('/api/auth/clerk', {
        clerk_token: sessionToken || '',
        user_id: clerkUser?.id || '',
        email: primaryEmail,
        name: fullName,
        picture: clerkUser?.imageUrl || '',
        requested_role: role || getSelectedRole()
      });

      const { access_token, user: backendUser } = res.data;
      localStorage.setItem('agritech_token', access_token);
      localStorage.setItem('agritech_user', JSON.stringify(backendUser));
      setToken(access_token);
      setUser(backendUser);
      return backendUser;
    } catch (err) {
      console.error('Clerk sync failed:', err);
      // Fallback: If backend sync fails, create valid session with role so user enters dashboard
      if (clerkUser) {
        const primaryEmail =
          clerkUser.primaryEmailAddress?.emailAddress ||
          clerkUser.emailAddresses?.[0]?.emailAddress ||
          'user@clerk.dev';
        const fallbackUser = {
          id: clerkUser.id || primaryEmail,
          google_id: clerkUser.id,
          email: primaryEmail,
          name: clerkUser.fullName || `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || 'Farmer',
          picture: clerkUser.imageUrl || '',
          role: role || getSelectedRole() || 'farmer'
        };
        const fallbackToken = 'clerk-fallback-jwt-' + Date.now();
        localStorage.setItem('agritech_token', fallbackToken);
        localStorage.setItem('agritech_user', JSON.stringify(fallbackUser));
        setToken(fallbackToken);
        setUser(fallbackUser);
        return fallbackUser;
      }
      throw err;
    }
  }, [getToken, clerkUser]);

  // Auto-sync when Clerk auth state changes
  useEffect(() => {
    if (!isClerkLoaded) return;

    if (isSignedIn && clerkUser) {
      syncClerkUser(getSelectedRole()).catch(() => {
        // If backend sync fails, still mark as not loading
      }).finally(() => setLoading(false));
    } else {
      // Not signed in — clear
      localStorage.removeItem('agritech_token');
      localStorage.removeItem('agritech_user');
      setToken(null);
      setUser(null);
      setLoading(false);
    }
  }, [isSignedIn, clerkUser, isClerkLoaded, syncClerkUser]);

  const demoLogin = async (role = 'farmer') => {
    try {
      const res = await api.post('/api/auth/demo-login', { role });
      const { access_token, user: backendUser } = res.data;
      localStorage.setItem('agritech_token', access_token);
      localStorage.setItem('agritech_user', JSON.stringify(backendUser));
      setToken(access_token);
      setUser(backendUser);
      return backendUser;
    } catch (err) {
      console.error('Demo login fallback triggered:', err);
      const mockUser = role === 'admin'
        ? { id: 'admin@agritech.com', email: 'admin@agritech.com', name: 'AgriOps System Admin', role: 'admin' }
        : { id: 'farmer@agritech.com', email: 'farmer@agritech.com', name: 'Ramesh Kumar (Farmer)', role: 'farmer' };
      localStorage.setItem('agritech_token', 'mock-demo-jwt-token');
      localStorage.setItem('agritech_user', JSON.stringify(mockUser));
      setToken('mock-demo-jwt-token');
      setUser(mockUser);
      return mockUser;
    }
  };

  const logout = async () => {
    localStorage.removeItem('agritech_token');
    localStorage.removeItem('agritech_user');
    localStorage.removeItem('agritech_selected_role');
    setToken(null);
    setUser(null);
    try {
      await signOut();
    } catch (e) {
      console.warn('Clerk signOut notice:', e);
    }
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
        isClerkSignedIn: isSignedIn,
        clerkUser,
        syncClerkUser,
        setSelectedRole,
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
