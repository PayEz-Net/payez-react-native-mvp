import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AuthState,
  Session,
  User,
  LoginCredentials,
  SignupCredentials,
  TwoFactorVerification,
  AuthFlowState,
  isValidSession,
  hasCompletedTwoFactor
} from '../types/auth';
import { accountApi, configureApiAuth } from '../utils/api';

interface AuthStore extends AuthState {
  // State
  authFlowState: AuthFlowState;

  // Session viability state (synced from Next.js v2.6.61)
  requires2FA: boolean;
  twoFactorComplete: boolean;
  accessTokenExpired: boolean;
  hasRefreshToken: boolean;
  lastViabilityCheck: number | null;
  isRefreshing: boolean;
  refreshQueue: Array<() => void>;

  // Actions
  setSession: (session: Session | null) => void;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setAuthFlowState: (state: AuthFlowState) => void;

  // Auth methods
  login: (credentials: LoginCredentials) => Promise<void>;
  signup: (credentials: SignupCredentials) => Promise<void>;
  logout: () => Promise<void>;
  verifyTwoFactor: (verification: TwoFactorVerification) => Promise<void>;
  refreshToken: () => Promise<void>;

  // Session management
  loadSession: () => Promise<void>;
  clearSession: () => Promise<void>;
  updateSession: (updates: Partial<Session>) => void;

  // Session viability methods (new)
  checkSessionViability: () => Promise<void>;
  coordinateTokenRefresh: () => Promise<void>;
  updateTokensAtomic: (accessToken: string, refreshToken?: string) => Promise<void>;
  checkTokenExpiry: () => boolean;
  checkMfaExpiry: () => boolean;
}

const STORAGE_KEY = '@PayEzAuth:session';
const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000; // 5 minutes before expiry

export const useAuthStore = create<AuthStore>((set, get) => ({
  // Initial state
  isAuthenticated: false,
  isLoading: true,
  session: null,
  user: null,
  error: null,
  authFlowState: AuthFlowState.UNAUTHENTICATED,

  // Session viability state
  requires2FA: false,
  twoFactorComplete: false,
  accessTokenExpired: false,
  hasRefreshToken: false,
  lastViabilityCheck: null,
  isRefreshing: false,
  refreshQueue: [],

  // Basic setters
  setSession: (session) => {
    const authFlowState = !session
      ? AuthFlowState.UNAUTHENTICATED
      : !hasCompletedTwoFactor(session)
      ? AuthFlowState.REQUIRES_2FA
      : AuthFlowState.AUTHENTICATED;

    set({
      session,
      user: session?.user || null,
      isAuthenticated: hasCompletedTwoFactor(session),
      authFlowState,
      error: null
    });
  },

  setUser: (user) => set({ user }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error, isLoading: false }),
  setAuthFlowState: (authFlowState) => set({ authFlowState }),

  // Login method - connected to real IDP
  login: async (credentials) => {
    set({ isLoading: true, error: null });

    try {
      console.log('[AuthStore] Attempting login for:', credentials.email);

      const response = await accountApi.login(credentials.email, credentials.password);

      if (!response.success) {
        const errorMessage = response.error?.message || 'Login failed';
        throw new Error(errorMessage);
      }

      const data = response.data as any;

      // Parse JWT to extract user info (basic decode, no verification - server already verified)
      const tokenPayload = parseJwtPayload(data.access_token);

      // Build session from API response
      const session: Session = {
        user: {
          id: tokenPayload?.sub || data.user_id || '',
          email: tokenPayload?.email || credentials.email,
          name: tokenPayload?.name || data.full_name || '',
          roles: tokenPayload?.roles || data.roles || [],
          requiresTwoFactor: data.requires_2fa ?? true,
          twoFactorSessionVerified: data.two_factor_complete ?? false,
          authenticationMethods: data.available_2fa_methods || ['email', 'sms'],
        },
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: data.expires_at || new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString(),
      };

      console.log('[AuthStore] Login successful, requires 2FA:', session.user.requiresTwoFactor);

      // Store session
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(session));

      get().setSession(session);
      set({
        isLoading: false,
        requires2FA: session.user.requiresTwoFactor ?? false,
        twoFactorComplete: session.user.twoFactorSessionVerified ?? false,
        hasRefreshToken: !!session.refreshToken,
      });

    } catch (error) {
      console.error('[AuthStore] Login error:', error);
      set({
        error: error instanceof Error ? error.message : 'Login failed',
        isLoading: false,
        authFlowState: AuthFlowState.ERROR
      });
      throw error;
    }
  },

  // Signup method - connected to real IDP
  signup: async (credentials) => {
    set({ isLoading: true, error: null });

    try {
      console.log('[AuthStore] Attempting signup for:', credentials.email);

      const response = await accountApi.signup({
        email: credentials.email,
        password: credentials.password,
        firstName: credentials.firstName,
        lastName: credentials.lastName,
      });

      if (!response.success) {
        const errorMessage = response.error?.message || 'Registration failed';
        throw new Error(errorMessage);
      }

      console.log('[AuthStore] Signup successful');
      set({ isLoading: false });

      // Note: After signup, user typically needs to verify email then login
      // The caller should navigate to login or show success message

    } catch (error) {
      console.error('[AuthStore] Signup error:', error);
      set({
        error: error instanceof Error ? error.message : 'Registration failed',
        isLoading: false
      });
      throw error;
    }
  },

  // Two-factor verification - connected to real IDP
  verifyTwoFactor: async (verification) => {
    const { session } = get();

    if (!isValidSession(session)) {
      throw new Error('No valid session for 2FA verification');
    }

    set({
      isLoading: true,
      error: null,
      authFlowState: AuthFlowState.VERIFYING_2FA
    });

    try {
      console.log('[AuthStore] Verifying 2FA code via:', verification.method);

      // Call appropriate 2FA verification endpoint based on method
      const response = await accountApi.verifyTwoFactor(
        verification.code,
        verification.method as 'sms' | 'email',
        session.accessToken
      );

      if (!response.success) {
        throw new Error(response.error?.message || 'Invalid verification code');
      }

      const data = response.data as any;

      // 2FA verification returns new tokens with MFA claims
      const updatedSession: Session = {
        ...session,
        user: {
          ...session.user,
          twoFactorSessionVerified: true,
        },
        accessToken: data.access_token || session.accessToken,
        refreshToken: data.refresh_token || session.refreshToken,
        mfaExpiresAt: data.mfa_expires_at || new Date(Date.now() + 86400000).toISOString(), // 24 hours default
      };

      console.log('[AuthStore] 2FA verified successfully');

      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSession));
      get().setSession(updatedSession);
      set({
        isLoading: false,
        twoFactorComplete: true,
      });

    } catch (error) {
      console.error('[AuthStore] 2FA verification error:', error);
      set({
        error: error instanceof Error ? error.message : '2FA verification failed',
        isLoading: false,
        authFlowState: AuthFlowState.REQUIRES_2FA
      });
      throw error;
    }
  },

  // Logout - connected to real IDP
  logout: async () => {
    set({ isLoading: true });

    try {
      const { session } = get();

      if (session?.accessToken) {
        // Revoke token on server (best effort - don't block on failure)
        try {
          await accountApi.revokeToken(session.accessToken);
          console.log('[AuthStore] Token revoked on server');
        } catch (revokeError) {
          console.warn('[AuthStore] Token revoke failed (continuing with local logout):', revokeError);
        }
      }

      await AsyncStorage.removeItem(STORAGE_KEY);

      set({
        session: null,
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        authFlowState: AuthFlowState.UNAUTHENTICATED
      });

    } catch (error) {
      console.error('Logout error:', error);
      // Clear local state even if API call fails
      await AsyncStorage.removeItem(STORAGE_KEY);
      set({
        session: null,
        user: null,
        isAuthenticated: false,
        isLoading: false,
        authFlowState: AuthFlowState.UNAUTHENTICATED
      });
    }
  },

  // Token refresh
  refreshToken: async () => {
    const { session } = get();

    if (!session?.refreshToken) {
      throw new Error('No refresh token available');
    }

    set({ authFlowState: AuthFlowState.REFRESHING_TOKEN });

    try {
      // TODO: Implement actual token refresh
      // const response = await authApi.refreshToken(session.refreshToken);

      console.log('Token refresh stub');
      set({ authFlowState: AuthFlowState.AUTHENTICATED });

    } catch (error) {
      // If refresh fails, clear session
      await get().clearSession();
      throw error;
    }
  },

  // Load session from storage
  loadSession: async () => {
    set({ isLoading: true });

    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);

      if (stored) {
        const session: Session = JSON.parse(stored);

        // Check if token is expired
        if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
          // Try to refresh if we have a refresh token
          if (session.refreshToken) {
            await get().refreshToken();
          } else {
            await get().clearSession();
          }
        } else {
          get().setSession(session);
        }
      }

      set({ isLoading: false });

    } catch (error) {
      console.error('Failed to load session:', error);
      set({ isLoading: false });
    }
  },

  // Clear session
  clearSession: async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    set({
      session: null,
      user: null,
      isAuthenticated: false,
      error: null,
      authFlowState: AuthFlowState.UNAUTHENTICATED
    });
  },

  // Update session (partial updates)
  updateSession: (updates) => {
    const { session } = get();
    if (!session) return;

    const updatedSession = { ...session, ...updates };
    set({ session: updatedSession });

    // Persist to storage
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSession))
      .catch(error => console.error('Failed to persist session update:', error));
  },

  // ===============================
  // SESSION VIABILITY METHODS
  // ===============================

  // Check if current session is viable
  checkSessionViability: async () => {
    const { session, isRefreshing } = get();

    if (!session?.accessToken) {
      set({
        isAuthenticated: false,
        requires2FA: false,
        twoFactorComplete: false,
        accessTokenExpired: false,
        hasRefreshToken: false,
        lastViabilityCheck: Date.now(),
      });
      return;
    }

    try {
      // Check local token expiry first
      const tokenExpired = get().checkTokenExpiry();
      const mfaExpired = get().checkMfaExpiry();

      // If token is expired, try to refresh
      if (tokenExpired && !isRefreshing) {
        console.log('[AuthStore] Token expired, initiating refresh');
        await get().coordinateTokenRefresh();
      }

      // Optionally validate with server (for critical operations)
      // This is lighter than the web version since we don't have Redis
      // const response = await accountApi.validateToken(session.accessToken);

      set({
        accessTokenExpired: tokenExpired,
        hasRefreshToken: !!session.refreshToken,
        requires2FA: session.user?.requiresTwoFactor ?? false,
        twoFactorComplete: (session.user?.twoFactorSessionVerified ?? false) && !mfaExpired,
        lastViabilityCheck: Date.now(),
      });

    } catch (error) {
      console.error('[AuthStore] Viability check error:', error);
      set({ lastViabilityCheck: Date.now() });
    }
  },

  // Coordinate token refresh to prevent multiple simultaneous refreshes
  coordinateTokenRefresh: async () => {
    const { isRefreshing, session, refreshQueue } = get();

    // If already refreshing, add to queue and wait
    if (isRefreshing) {
      console.log('[AuthStore] Refresh already in progress, queuing...');
      return new Promise<void>((resolve) => {
        set({ refreshQueue: [...refreshQueue, resolve] });
      });
    }

    if (!session?.refreshToken) {
      console.error('[AuthStore] No refresh token available');
      await get().clearSession();
      return;
    }

    set({ isRefreshing: true });

    try {
      console.log('[AuthStore] Starting coordinated token refresh');

      const response = await accountApi.refreshToken(session.refreshToken);

      if (response.success && response.data) {
        const { access_token, refresh_token } = response.data as any;
        await get().updateTokensAtomic(access_token, refresh_token);
        console.log('[AuthStore] Token refresh successful');
      } else {
        throw new Error(response.error?.message || 'Token refresh failed');
      }

    } catch (error) {
      console.error('[AuthStore] Token refresh failed:', error);
      // Clear session on refresh failure
      await get().clearSession();
      throw error;

    } finally {
      // Process queued refresh requests
      const { refreshQueue: queue } = get();
      set({ isRefreshing: false, refreshQueue: [] });

      // Notify all queued callers
      queue.forEach((resolve) => resolve());
    }
  },

  // Atomically update tokens and persist
  updateTokensAtomic: async (accessToken: string, refreshToken?: string) => {
    const { session } = get();

    if (!session) {
      throw new Error('No session to update');
    }

    // Calculate new expiry (assume 1 hour for access token if not provided)
    const expiresAt = new Date(Date.now() + 3600000).toISOString();

    const updatedSession: Session = {
      ...session,
      accessToken,
      refreshToken: refreshToken || session.refreshToken,
      expiresAt,
    };

    // Persist first, then update state
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSession));

    set({
      session: updatedSession,
      accessTokenExpired: false,
      hasRefreshToken: !!updatedSession.refreshToken,
      lastViabilityCheck: Date.now(),
    });

    console.log('[AuthStore] Tokens updated atomically');
  },

  // Check if access token is expired or about to expire
  checkTokenExpiry: () => {
    const { session } = get();

    if (!session?.expiresAt) {
      return false; // Can't determine, assume valid
    }

    const expiresAt = new Date(session.expiresAt).getTime();
    const now = Date.now();

    // Consider expired if within buffer period
    return expiresAt < (now + TOKEN_EXPIRY_BUFFER_MS);
  },

  // Check if MFA verification has expired
  checkMfaExpiry: () => {
    const { session } = get();

    if (!session?.mfaExpiresAt) {
      return false; // No MFA expiry set, assume valid
    }

    const mfaExpiresAt = new Date(session.mfaExpiresAt).getTime();
    const now = Date.now();

    if (mfaExpiresAt < now) {
      console.warn('[AuthStore] MFA expired, 2FA re-verification required');
      return true;
    }

    return false;
  },
}));

/**
 * Parse JWT payload without verification
 * Server has already verified the token - we just need to extract claims
 */
function parseJwtPayload(token: string): any | null {
  try {
    if (!token) return null;

    const parts = token.split('.');
    if (parts.length !== 3) return null;

    // Base64url decode the payload (second part)
    const payload = parts[1];
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );

    return JSON.parse(jsonPayload);
  } catch (error) {
    console.warn('[AuthStore] Failed to parse JWT payload:', error);
    return null;
  }
}

// Configure API auth callbacks after store creation
// This enables the 401 interceptor to refresh tokens automatically
configureApiAuth({
  getToken: () => {
    const state = useAuthStore.getState();
    return state.session?.accessToken || null;
  },
  refreshToken: async () => {
    const state = useAuthStore.getState();
    try {
      await state.coordinateTokenRefresh();
      // Return the new token after refresh
      const newState = useAuthStore.getState();
      return newState.session?.accessToken || null;
    } catch (error) {
      console.error('[AuthStore] Token refresh failed in API interceptor:', error);
      return null;
    }
  },
});