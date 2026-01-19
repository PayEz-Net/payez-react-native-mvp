/**
 * useSessionViability - Session state hook for React Native
 *
 * This hook provides real-time session state by:
 * 1. Checking local token validity
 * 2. Periodically verifying with IDP via /api/ExternalAuth/validate
 * 3. Handling app foreground/background transitions
 * 4. Triggering callbacks when session becomes invalid
 *
 * Adapted from Next.js useViabilitySession for React Native environment.
 */

import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useAuthStore } from '../stores/authStore';

export interface SessionViabilityState {
  /** Whether the user is authenticated */
  isAuthenticated: boolean;
  /** Whether the viability check is in progress */
  isLoading: boolean;
  /** Whether 2FA is required */
  requires2FA: boolean;
  /** Whether 2FA has been completed for this session */
  twoFactorComplete: boolean;
  /** Whether the access token has expired (refresh may be needed) */
  accessTokenExpired: boolean;
  /** Whether a refresh token is available */
  hasRefreshToken: boolean;
  /** Error message if viability check failed */
  error: string | null;
  /** Timestamp of last successful viability check */
  lastChecked: number | null;
  /** Force a viability check now */
  refresh: () => Promise<void>;
}

export interface UseSessionViabilityOptions {
  /** Polling interval in milliseconds (default: 30000 = 30 seconds) */
  pollInterval?: number;
  /** Whether to poll automatically (default: true) */
  enablePolling?: boolean;
  /** Callback when session becomes invalid */
  onSessionInvalid?: () => void;
  /** Callback when token needs refresh */
  onTokenExpired?: () => void;
}

/**
 * Hook that provides session viability state
 * Adapted for React Native from Next.js useViabilitySession
 */
export function useSessionViability(
  options: UseSessionViabilityOptions = {}
): SessionViabilityState {
  const {
    pollInterval = 30000,
    enablePolling = true,
    onSessionInvalid,
    onTokenExpired,
  } = options;

  const {
    isAuthenticated,
    isLoading,
    session,
    user,
    error,
    checkSessionViability,
    lastViabilityCheck,
    requires2FA,
    twoFactorComplete,
    accessTokenExpired,
    hasRefreshToken,
  } = useAuthStore();

  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const prevAuthRef = useRef<boolean | null>(null);

  // Handle auth state changes
  useEffect(() => {
    if (prevAuthRef.current !== null && prevAuthRef.current !== isAuthenticated) {
      console.log('[useSessionViability] Auth state changed:', {
        was: prevAuthRef.current,
        now: isAuthenticated,
      });

      if (!isAuthenticated && onSessionInvalid) {
        onSessionInvalid();
      }
    }
    prevAuthRef.current = isAuthenticated;
  }, [isAuthenticated, onSessionInvalid]);

  // Handle token expiry
  useEffect(() => {
    if (accessTokenExpired && onTokenExpired) {
      onTokenExpired();
    }
  }, [accessTokenExpired, onTokenExpired]);

  // Handle app state changes (foreground/background)
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      // App came to foreground
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        console.log('[useSessionViability] App came to foreground, checking session');

        // Debounce: only check if last check was > 10 seconds ago
        const now = Date.now();
        if (lastViabilityCheck === null || now - lastViabilityCheck > 10000) {
          checkSessionViability();
        }
      }

      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription?.remove();
    };
  }, [checkSessionViability, lastViabilityCheck]);

  // Setup polling
  useEffect(() => {
    if (!enablePolling || !isAuthenticated) {
      // Stop polling if disabled or not authenticated
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      return;
    }

    // Start polling
    pollIntervalRef.current = setInterval(() => {
      checkSessionViability();
    }, pollInterval);

    // Cleanup
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [enablePolling, isAuthenticated, pollInterval, checkSessionViability]);

  // Initial viability check
  useEffect(() => {
    if (isAuthenticated && lastViabilityCheck === null) {
      checkSessionViability();
    }
  }, [isAuthenticated, lastViabilityCheck, checkSessionViability]);

  const refresh = useCallback(async () => {
    await checkSessionViability();
  }, [checkSessionViability]);

  return {
    isAuthenticated,
    isLoading,
    requires2FA,
    twoFactorComplete,
    accessTokenExpired,
    hasRefreshToken,
    error,
    lastChecked: lastViabilityCheck,
    refresh,
  };
}

/**
 * Simplified hook that just returns authentication status
 * Use this in components that only need to know if user is logged in
 */
export function useIsAuthenticated(): {
  isAuthenticated: boolean;
  isLoading: boolean;
} {
  const { isAuthenticated, isLoading } = useSessionViability({
    pollInterval: 60000, // Less frequent polling for simple status
    enablePolling: true,
  });

  return { isAuthenticated, isLoading };
}
