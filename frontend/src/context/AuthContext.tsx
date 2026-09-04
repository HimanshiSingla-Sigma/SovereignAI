import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserProfile } from '../types';
import { apiClient } from '../services/api';

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  tempToken: string | null;
  mfaRequired: boolean;
  mfaSetupRequired: boolean;
  loading: boolean;
  login: (username: string, password: string) => Promise<{ mfaRequired: boolean; mfaSetupRequired: boolean }>;
  verifyMfa: (code: string) => Promise<void>;
  logout: () => void;
  hasPermission: (perm: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('sovereign_token'));
  const [tempToken, setTempToken] = useState<string | null>(null);
  const [mfaRequired, setMfaRequired] = useState<boolean>(false);
  const [mfaSetupRequired, setMfaSetupRequired] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchMe = async () => {
      if (token) {
        try {
          const res = await apiClient.get('/auth/me');
          setUser(res.data);
        } catch (e) {
          localStorage.removeItem('sovereign_token');
          setToken(null);
          setUser(null);
        }
      }
      setLoading(false);
    };
    fetchMe();
  }, [token]);

  const login = async (username: string, password: string) => {
    const res = await apiClient.post('/auth/login', { username, password });
    const data = res.data;

    if (data.mfa_required) {
      setTempToken(data.temp_token);
      setMfaRequired(true);
      setMfaSetupRequired(data.mfa_setup_required || false);
      return { mfaRequired: true, mfaSetupRequired: data.mfa_setup_required || false };
    } else {
      localStorage.setItem('sovereign_token', data.access_token);
      setToken(data.access_token);
      setMfaRequired(false);
      setTempToken(null);
      // Fetch user profile
      const meRes = await apiClient.get('/auth/me', {
        headers: { Authorization: `Bearer ${data.access_token}` }
      });
      setUser(meRes.data);
      return { mfaRequired: false, mfaSetupRequired: false };
    }
  };

  const verifyMfa = async (code: string) => {
    if (!tempToken) throw new Error('MFA session expired. Please log in again.');
    const res = await apiClient.post('/auth/mfa-verify', { code }, {
      headers: { Authorization: `Bearer ${tempToken}` }
    });
    const data = res.data;
    localStorage.setItem('sovereign_token', data.access_token);
    setToken(data.access_token);
    setTempToken(null);
    setMfaRequired(false);
    setMfaSetupRequired(false);

    const meRes = await apiClient.get('/auth/me', {
      headers: { Authorization: `Bearer ${data.access_token}` }
    });
    setUser(meRes.data);
  };

  const logout = () => {
    localStorage.removeItem('sovereign_token');
    setToken(null);
    setUser(null);
    setTempToken(null);
    setMfaRequired(false);
  };

  const hasPermission = (perm: string) => {
    if (!user) return false;
    if (user.role === 'ADMINISTRATOR') return true;
    return user.permissions?.includes(perm) || false;
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      tempToken,
      mfaRequired,
      mfaSetupRequired,
      loading,
      login,
      verifyMfa,
      logout,
      hasPermission
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
