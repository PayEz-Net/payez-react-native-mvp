/**
 * useDeepLinking - Hook for handling deep links with auth awareness
 *
 * Handles edge cases:
 * - Deep link arrives when user not authenticated
 * - Deep link for auth routes when user is already authenticated
 * - App state changes (background -> foreground with deep link)
 * - Expired tokens in deep link params
 */

import { useEffect, useCallback, useRef } from 'react';
import { Linking, AppState, AppStateStatus } from 'react-native';
import { useNavigation, CommonActions } from '@react-navigation/native';
import { useAuthStore } from '../stores/authStore';
import { AuthFlowState } from '../types/auth';
import {
  parseDeepLink,
  routeRequiresAuth,
  routeRequiresNoAuth,
  savePendingDeepLink,
  consumePendingDeepLink,
} from '../utils/deepLinking';
import { RootStackParamList } from '../navigation/AppNavigator';

export interface UseDeepLinkingOptions {
  /**
   * Called when a deep link is processed successfully
   */
  onLinkProcessed?: (route: keyof RootStackParamList, params: any) => void;

  /**
   * Called when a deep link is saved for later (auth mismatch)
   */
  onLinkPending?: (route: keyof RootStackParamList) => void;

  /**
   * Called when a deep link is rejected
   */
  onLinkRejected?: (reason: string) => void;
}

export function useDeepLinking(options: UseDeepLinkingOptions = {}) {
  const navigation = useNavigation();
  const { authFlowState, isAuthenticated } = useAuthStore();
  const appState = useRef(AppState.currentState);
  const hasProcessedInitialLink = useRef(false);

  const { onLinkProcessed, onLinkPending, onLinkRejected } = options;

  /**
   * Process a deep link URL with auth state awareness
   */
  const processDeepLink = useCallback(
    (url: string) => {
      console.log('[useDeepLinking] Processing URL:', url);

      const { route, params } = parseDeepLink(url);

      if (!route) {
        console.log('[useDeepLinking] No matching route for URL');
        onLinkRejected?.('Unknown route');
        return;
      }

      // Check auth state compatibility
      const needsAuth = routeRequiresAuth(route);
      const needsNoAuth = routeRequiresNoAuth(route);

      if (needsAuth && !isAuthenticated) {
        // Save for after authentication
        console.log('[useDeepLinking] Route requires auth, saving for later:', route);
        savePendingDeepLink(url, route, params);
        onLinkPending?.(route);
        return;
      }

      if (needsNoAuth && isAuthenticated) {
        // User is already authenticated, ignore login/signup links
        console.log('[useDeepLinking] User already authenticated, ignoring:', route);
        onLinkRejected?.('Already authenticated');
        return;
      }

      // Route to appropriate screen
      console.log('[useDeepLinking] Navigating to:', route, params);

      // Use CommonActions for more reliable navigation across navigator states
      navigation.dispatch(
        CommonActions.navigate({
          name: route,
          params,
        })
      );

      onLinkProcessed?.(route, params);
    },
    [isAuthenticated, navigation, onLinkProcessed, onLinkPending, onLinkRejected]
  );

  /**
   * Check and process pending deep link after auth state changes
   */
  const processPendingLink = useCallback(() => {
    const pending = consumePendingDeepLink();

    if (pending && isAuthenticated) {
      console.log('[useDeepLinking] Processing pending link after auth:', pending.route);

      navigation.dispatch(
        CommonActions.navigate({
          name: pending.route,
          params: pending.params,
        })
      );

      onLinkProcessed?.(pending.route, pending.params);
    }
  }, [isAuthenticated, navigation, onLinkProcessed]);

  /**
   * Handle app state changes (background -> foreground)
   */
  const handleAppStateChange = useCallback(
    (nextAppState: AppStateStatus) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App came to foreground - check for any new deep links
        Linking.getInitialURL().then((url) => {
          if (url && !hasProcessedInitialLink.current) {
            processDeepLink(url);
          }
        });
      }

      appState.current = nextAppState;
    },
    [processDeepLink]
  );

  // Set up initial link handler
  useEffect(() => {
    const handleInitialLink = async () => {
      if (hasProcessedInitialLink.current) return;

      try {
        const initialUrl = await Linking.getInitialURL();

        if (initialUrl) {
          console.log('[useDeepLinking] Initial URL detected:', initialUrl);
          hasProcessedInitialLink.current = true;
          processDeepLink(initialUrl);
        }
      } catch (error) {
        console.error('[useDeepLinking] Error getting initial URL:', error);
      }
    };

    handleInitialLink();
  }, [processDeepLink]);

  // Set up link listener for when app is running
  useEffect(() => {
    const subscription = Linking.addEventListener('url', ({ url }) => {
      console.log('[useDeepLinking] URL event received:', url);
      processDeepLink(url);
    });

    return () => {
      subscription.remove();
    };
  }, [processDeepLink]);

  // Set up app state listener
  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [handleAppStateChange]);

  // Process pending links when auth state changes
  useEffect(() => {
    if (authFlowState === AuthFlowState.AUTHENTICATED) {
      processPendingLink();
    }
  }, [authFlowState, processPendingLink]);

  return {
    processDeepLink,
    processPendingLink,
  };
}
