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

interface AuthStore extends AuthState {
  // State
  authFlowState: AuthFlowState;

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
}

const STORAGE_KEY = '@PayEzAuth:session';

export const useAuthStore = create<AuthStore>((set, get) => ({
  // Initial state
  isAuthenticated: false,
  isLoading: true,
  session: null,
  user: null,
  error: null,
  authFlowState: AuthFlowState.UNAUTHENTICATED,

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

  // Login method
  login: async (credentials) => {
    set({ isLoading: true, error: null });

    try {
      // TODO: Implement actual API call to IDP
      // const response = await authApi.login(credentials);

      // Stub response for MVP
      const stubSession: Session = {
        user: {
          id: 'stub-user-id',
          email: credentials.email,
          name: 'Test User',
          requiresTwoFactor: true,
          twoFactorSessionVerified: false,
        },
        accessToken: 'stub-intermediate-token',
        refreshToken: 'stub-refresh-token',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      };

      // Store session
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(stubSession));

      get().setSession(stubSession);
      set({ isLoading: false });

    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Login failed',
        isLoading: false,
        authFlowState: AuthFlowState.ERROR
      });
      throw error;
    }
  },

  // Signup method
  signup: async (credentials) => {
    set({ isLoading: true, error: null });

    try {
      // TODO: Implement actual API call
      // const response = await authApi.signup(credentials);

      // For MVP, just redirect to login
      console.log('Signup stub:', credentials);
      set({ isLoading: false });

    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Signup failed',
        isLoading: false
      });
      throw error;
    }
  },

  // Two-factor verification
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
      // TODO: Implement actual API call
      // const response = await authApi.verifyTwoFactor({
      //   code: verification.code,
      //   method: verification.method,
      //   token: session.accessToken
      // });

      // Stub: Update session with verified status
      const updatedSession: Session = {
        ...session,
        user: {
          ...session.user,
          twoFactorSessionVerified: true,
        },
        accessToken: 'stub-verified-token-with-mfa-claims',
        mfaExpiresAt: new Date(Date.now() + 86400000).toISOString(), // 24 hours
      };

      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSession));
      get().setSession(updatedSession);
      set({ isLoading: false });

    } catch (error) {
      set({
        error: error instanceof Error ? error.message : '2FA verification failed',
        isLoading: false,
        authFlowState: AuthFlowState.REQUIRES_2FA
      });
      throw error;
    }
  },

  // Logout
  logout: async () => {
    set({ isLoading: true });

    try {
      const { session } = get();

      if (session?.accessToken) {
        // TODO: Call logout endpoint
        // await authApi.logout(session.accessToken);
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
}));