import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { useAuthStore } from '../stores/authStore';
import { AuthFlowState } from '../types/auth';

interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  authFlowState: AuthFlowState;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const { isAuthenticated, isLoading, authFlowState, loadSession } = useAuthStore();

  useEffect(() => {
    // Initialize auth state on mount
    loadSession();
  }, []);

  useEffect(() => {
    // Handle auth flow state changes
    console.log('Auth flow state changed:', authFlowState);

    // You can add additional side effects here based on state changes
    switch (authFlowState) {
      case AuthFlowState.UNAUTHENTICATED:
        // Clear any sensitive data
        break;
      case AuthFlowState.AUTHENTICATED:
        // Maybe start background token refresh timer
        startTokenRefreshTimer();
        break;
      case AuthFlowState.REQUIRES_2FA:
        // Maybe send initial 2FA code
        break;
      case AuthFlowState.ERROR:
        // Handle error state
        break;
    }
  }, [authFlowState]);

  const startTokenRefreshTimer = () => {
    // TODO: Implement token refresh timer
    // This would periodically check token expiration and refresh if needed
    console.log('Token refresh timer would start here');
  };

  const value: AuthContextValue = {
    isAuthenticated,
    isLoading,
    authFlowState,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};