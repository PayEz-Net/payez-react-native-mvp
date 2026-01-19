/**
 * Biometric Authentication Service
 *
 * Uses react-native-keychain for secure credential storage with biometric protection.
 * Implements the biometric flow from BAPert's guidance:
 * 1. After successful login+2FA: Store refresh token in keychain
 * 2. On app launch: Check biometric -> retrieve refresh token -> get new access token
 * 3. Access token in memory only (not persisted)
 */

import * as Keychain from 'react-native-keychain';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage keys
const BIOMETRIC_ENABLED_KEY = '@PayEz:biometric_enabled';
const REFRESH_TOKEN_SERVICE = 'com.payez.mobile.refreshToken';

export interface BiometricCapability {
  available: boolean;
  biometryType: Keychain.BIOMETRY_TYPE | null;
  error?: string;
}

export interface BiometricAuthResult {
  success: boolean;
  refreshToken?: string;
  error?: string;
}

/**
 * Check if biometric authentication is available on this device
 */
export async function checkBiometricAvailability(): Promise<BiometricCapability> {
  try {
    const biometryType = await Keychain.getSupportedBiometryType();

    if (!biometryType) {
      return {
        available: false,
        biometryType: null,
        error: 'Biometric authentication not available on this device',
      };
    }

    return {
      available: true,
      biometryType,
    };
  } catch (error) {
    console.error('[BiometricService] Error checking availability:', error);
    return {
      available: false,
      biometryType: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get user-friendly name for biometry type
 */
export function getBiometryTypeName(biometryType: Keychain.BIOMETRY_TYPE | null): string {
  switch (biometryType) {
    case Keychain.BIOMETRY_TYPE.FACE_ID:
      return 'Face ID';
    case Keychain.BIOMETRY_TYPE.TOUCH_ID:
      return 'Touch ID';
    case Keychain.BIOMETRY_TYPE.FINGERPRINT:
      return 'Fingerprint';
    case Keychain.BIOMETRY_TYPE.FACE:
      return 'Face Recognition';
    case Keychain.BIOMETRY_TYPE.IRIS:
      return 'Iris';
    default:
      return 'Biometric';
  }
}

/**
 * Check if biometric login is enabled for this user
 */
export async function isBiometricEnabled(): Promise<boolean> {
  try {
    const enabled = await AsyncStorage.getItem(BIOMETRIC_ENABLED_KEY);
    return enabled === 'true';
  } catch (error) {
    console.error('[BiometricService] Error checking if enabled:', error);
    return false;
  }
}

/**
 * Enable biometric login and store refresh token securely
 */
export async function enableBiometric(refreshToken: string): Promise<boolean> {
  try {
    // Check if biometrics are available
    const { available, biometryType } = await checkBiometricAvailability();
    if (!available) {
      console.warn('[BiometricService] Cannot enable - biometrics not available');
      return false;
    }

    // Store refresh token with biometric protection
    const result = await Keychain.setGenericPassword(
      'payez_user',
      refreshToken,
      {
        service: REFRESH_TOKEN_SERVICE,
        accessible: Keychain.ACCESSIBLE.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
        accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY,
        securityLevel: Keychain.SECURITY_LEVEL.SECURE_HARDWARE,
      }
    );

    if (result) {
      // Mark biometric as enabled
      await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true');
      console.log('[BiometricService] Biometric enabled with', getBiometryTypeName(biometryType));
      return true;
    }

    return false;
  } catch (error) {
    console.error('[BiometricService] Error enabling biometric:', error);
    return false;
  }
}

/**
 * Disable biometric login and remove stored credentials
 */
export async function disableBiometric(): Promise<boolean> {
  try {
    // Remove stored credentials
    await Keychain.resetGenericPassword({ service: REFRESH_TOKEN_SERVICE });

    // Mark biometric as disabled
    await AsyncStorage.setItem(BIOMETRIC_ENABLED_KEY, 'false');

    console.log('[BiometricService] Biometric disabled');
    return true;
  } catch (error) {
    console.error('[BiometricService] Error disabling biometric:', error);
    return false;
  }
}

/**
 * Authenticate with biometrics and retrieve refresh token
 */
export async function authenticateWithBiometric(): Promise<BiometricAuthResult> {
  try {
    // Check if enabled
    const enabled = await isBiometricEnabled();
    if (!enabled) {
      return {
        success: false,
        error: 'Biometric login is not enabled',
      };
    }

    // Prompt for biometric and retrieve credentials
    const credentials = await Keychain.getGenericPassword({
      service: REFRESH_TOKEN_SERVICE,
      authenticationPrompt: {
        title: 'Authenticate to PayEz',
        subtitle: 'Use biometrics to sign in',
        description: 'Touch the sensor or look at the camera',
        cancel: 'Cancel',
      },
    });

    if (credentials && credentials.password) {
      console.log('[BiometricService] Authentication successful');
      return {
        success: true,
        refreshToken: credentials.password,
      };
    }

    return {
      success: false,
      error: 'No stored credentials found',
    };
  } catch (error) {
    console.error('[BiometricService] Authentication error:', error);

    // Handle specific error cases
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage.includes('cancel') || errorMessage.includes('Cancel')) {
      return {
        success: false,
        error: 'Authentication cancelled',
      };
    }

    if (errorMessage.includes('lockout')) {
      return {
        success: false,
        error: 'Too many attempts. Please try again later.',
      };
    }

    return {
      success: false,
      error: 'Biometric authentication failed',
    };
  }
}

/**
 * Update stored refresh token (e.g., after token refresh)
 */
export async function updateStoredRefreshToken(newRefreshToken: string): Promise<boolean> {
  try {
    const enabled = await isBiometricEnabled();
    if (!enabled) {
      return false;
    }

    // Update with new token (without requiring biometric again)
    const result = await Keychain.setGenericPassword(
      'payez_user',
      newRefreshToken,
      {
        service: REFRESH_TOKEN_SERVICE,
        accessible: Keychain.ACCESSIBLE.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
        accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY,
        securityLevel: Keychain.SECURITY_LEVEL.SECURE_HARDWARE,
      }
    );

    return !!result;
  } catch (error) {
    console.error('[BiometricService] Error updating refresh token:', error);
    return false;
  }
}

/**
 * Clear all biometric data (used on logout)
 */
export async function clearBiometricData(): Promise<void> {
  try {
    await Keychain.resetGenericPassword({ service: REFRESH_TOKEN_SERVICE });
    await AsyncStorage.removeItem(BIOMETRIC_ENABLED_KEY);
    console.log('[BiometricService] All biometric data cleared');
  } catch (error) {
    console.error('[BiometricService] Error clearing data:', error);
  }
}
