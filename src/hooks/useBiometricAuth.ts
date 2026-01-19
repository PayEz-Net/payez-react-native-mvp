/**
 * useBiometricAuth - Hook for biometric authentication
 *
 * Provides easy access to biometric auth capabilities and actions.
 */

import { useState, useEffect, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { BIOMETRY_TYPE } from 'react-native-keychain';
import { useAuthStore } from '../stores/authStore';
import {
  checkBiometricAvailability,
  isBiometricEnabled,
  enableBiometric,
  disableBiometric,
  authenticateWithBiometric,
  getBiometryTypeName,
  clearBiometricData,
} from '../services/biometricService';
import { accountApi } from '../utils/api';

export interface BiometricAuthState {
  isAvailable: boolean;
  isEnabled: boolean;
  isLoading: boolean;
  biometryType: BIOMETRY_TYPE | null;
  biometryTypeName: string;
  error: string | null;
}

export interface BiometricAuthActions {
  enable: () => Promise<boolean>;
  disable: () => Promise<boolean>;
  authenticate: () => Promise<boolean>;
  checkAvailability: () => Promise<void>;
}

export function useBiometricAuth(): BiometricAuthState & BiometricAuthActions {
  const [state, setState] = useState<BiometricAuthState>({
    isAvailable: false,
    isEnabled: false,
    isLoading: true,
    biometryType: null,
    biometryTypeName: 'Biometric',
    error: null,
  });

  const { session, coordinateTokenRefresh, setSession, clearSession } = useAuthStore();

  // Check availability and enabled status on mount
  useEffect(() => {
    checkAvailability();
  }, []);

  const checkAvailability = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const { available, biometryType } = await checkBiometricAvailability();
      const enabled = await isBiometricEnabled();

      setState({
        isAvailable: available,
        isEnabled: enabled,
        isLoading: false,
        biometryType,
        biometryTypeName: getBiometryTypeName(biometryType),
        error: null,
      });
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to check biometric availability',
      }));
    }
  }, []);

  const enable = useCallback(async (): Promise<boolean> => {
    if (!session?.refreshToken) {
      setState((prev) => ({
        ...prev,
        error: 'No refresh token available. Please log in first.',
      }));
      return false;
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const success = await enableBiometric(session.refreshToken);

      if (success) {
        setState((prev) => ({
          ...prev,
          isEnabled: true,
          isLoading: false,
        }));
        return true;
      }

      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: 'Failed to enable biometric login',
      }));
      return false;
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to enable biometric',
      }));
      return false;
    }
  }, [session?.refreshToken]);

  const disable = useCallback(async (): Promise<boolean> => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const success = await disableBiometric();

      setState((prev) => ({
        ...prev,
        isEnabled: !success,
        isLoading: false,
      }));

      return success;
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to disable biometric',
      }));
      return false;
    }
  }, []);

  const authenticate = useCallback(async (): Promise<boolean> => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const result = await authenticateWithBiometric();

      if (!result.success || !result.refreshToken) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: result.error || 'Authentication failed',
        }));
        return false;
      }

      // Use refresh token to get new access token
      console.log('[useBiometricAuth] Biometric auth successful, refreshing tokens...');

      const response = await accountApi.refreshToken(result.refreshToken);

      if (!response.success) {
        // Refresh token is invalid - clear biometric data
        await clearBiometricData();
        await clearSession();

        setState((prev) => ({
          ...prev,
          isEnabled: false,
          isLoading: false,
          error: 'Session expired. Please log in again.',
        }));
        return false;
      }

      const data = response.data as any;

      // Update session with new tokens
      // Note: This is a simplified flow - in production you'd parse the JWT
      // and build a proper session object
      console.log('[useBiometricAuth] Tokens refreshed successfully');

      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: null,
      }));

      return true;
    } catch (error) {
      console.error('[useBiometricAuth] Authentication error:', error);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Authentication failed',
      }));
      return false;
    }
  }, [clearSession]);

  return {
    ...state,
    enable,
    disable,
    authenticate,
    checkAvailability,
  };
}
