import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  AppState,
  AppStateStatus,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../stores/authStore';
import { TwoFactorVerification, MaskedContactInfo } from '../types/auth';
import { accountApi, isApiSuccess, extractApiData } from '../utils/api';

// Storage key for persisting 2FA method preference
const TWOFACTOR_METHOD_KEY = '@PayEz:2fa_method';

interface TwoFactorScreenProps {
  navigation: any; // TODO: Add proper navigation types
}

export const TwoFactorScreen: React.FC<TwoFactorScreenProps> = ({ navigation }) => {
  const [code, setCode] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<'sms' | 'email' | 'authenticator'>('sms');
  const [maskedInfo, setMaskedInfo] = useState<MaskedContactInfo | null>(null);
  const [loadingMaskedInfo, setLoadingMaskedInfo] = useState(true);
  const [resendingCode, setResendingCode] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [sessionExpired, setSessionExpired] = useState(false);

  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const cooldownRef = useRef<NodeJS.Timeout | null>(null);

  const { session, verifyTwoFactor, isLoading, error, logout, checkSessionViability } = useAuthStore();

  // Load persisted 2FA method preference and masked info on mount
  useEffect(() => {
    loadPersistedMethod();
    loadMaskedInfo();
  }, []);

  // Handle app state changes (foreground/background)
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      // App came to foreground - check if session is still valid
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        console.log('[TwoFactorScreen] App came to foreground, checking session');
        await checkSessionViability();

        // If session expired while in background, show message
        if (!session?.accessToken) {
          setSessionExpired(true);
        }
      }
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [session, checkSessionViability]);

  // Cooldown timer for resend
  useEffect(() => {
    if (cooldown > 0) {
      cooldownRef.current = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => {
        if (cooldownRef.current) clearTimeout(cooldownRef.current);
      };
    }
  }, [cooldown]);

  // Persist method selection when it changes
  useEffect(() => {
    AsyncStorage.setItem(TWOFACTOR_METHOD_KEY, selectedMethod).catch(console.error);
  }, [selectedMethod]);

  const loadPersistedMethod = async () => {
    try {
      const storedMethod = await AsyncStorage.getItem(TWOFACTOR_METHOD_KEY);
      if (storedMethod && ['sms', 'email', 'authenticator'].includes(storedMethod)) {
        setSelectedMethod(storedMethod as 'sms' | 'email' | 'authenticator');
      }
    } catch (err) {
      console.error('Failed to load persisted 2FA method:', err);
    }
  };

  const loadMaskedInfo = async () => {
    if (!session?.accessToken || !session?.user?.email) {
      Alert.alert('Error', 'No session available for 2FA verification');
      navigation.navigate('Login');
      return;
    }

    try {
      const response = await accountApi.getMaskedInfo(
        session.user.email,
        session.accessToken
      );

      if (isApiSuccess(response)) {
        const data = extractApiData(response);
        setMaskedInfo(data);

        // Set default method based on what's available
        if (data.phone) {
          setSelectedMethod('sms');
        } else if (data.email) {
          setSelectedMethod('email');
        } else if (data.authenticatorEnabled) {
          setSelectedMethod('authenticator');
        }
      }
    } catch (err) {
      console.error('Failed to load masked info:', err);
    } finally {
      setLoadingMaskedInfo(false);
    }
  };

  const handleVerify = async () => {
    if (!code || code.length !== 6) {
      Alert.alert('Invalid Code', 'Please enter a 6-digit verification code');
      return;
    }

    const verification: TwoFactorVerification = {
      code,
      method: selectedMethod,
    };

    try {
      await verifyTwoFactor(verification);
      // Navigation will be handled by auth state listener
    } catch (err) {
      Alert.alert(
        'Verification Failed',
        error || 'Invalid verification code. Please try again.'
      );
    }
  };

  const handleResendCode = async () => {
    if (!session?.accessToken) {
      Alert.alert('Error', 'No session available');
      return;
    }

    if (cooldown > 0) {
      return; // Still in cooldown
    }

    setResendingCode(true);

    try {
      const response = await accountApi.sendTwoFactorCode(
        selectedMethod,
        session.accessToken
      );

      if (isApiSuccess(response)) {
        Alert.alert('Success', `Verification code sent via ${selectedMethod}`);
        setCooldown(30); // 30 second cooldown before allowing resend
      } else {
        Alert.alert('Error', 'Failed to send verification code');
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to send verification code');
    } finally {
      setResendingCode(false);
    }
  };

  const handleCancel = () => {
    Alert.alert(
      'Cancel Verification',
      'Are you sure you want to cancel? You will be logged out.',
      [
        { text: 'Stay', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: () => logout(),
        },
      ]
    );
  };

  const renderMethodButton = (method: 'sms' | 'email' | 'authenticator', label: string, info?: string) => {
    const isAvailable =
      (method === 'sms' && maskedInfo?.phone) ||
      (method === 'email' && maskedInfo?.email) ||
      (method === 'authenticator' && maskedInfo?.authenticatorEnabled);

    if (!isAvailable) return null;

    return (
      <TouchableOpacity
        style={[
          styles.methodButton,
          selectedMethod === method && styles.methodButtonActive,
        ]}
        onPress={() => setSelectedMethod(method)}
        disabled={loadingMaskedInfo}
      >
        <Text
          style={[
            styles.methodButtonText,
            selectedMethod === method && styles.methodButtonTextActive,
          ]}
        >
          {label}
        </Text>
        {info && <Text style={styles.methodInfo}>{info}</Text>}
      </TouchableOpacity>
    );
  };

  if (loadingMaskedInfo) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading verification options...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.header}>
          <Text style={styles.title}>Two-Factor Authentication</Text>
          <Text style={styles.subtitle}>
            Enter the verification code sent to your registered device
          </Text>
        </View>

        <View style={styles.methodContainer}>
          <Text style={styles.sectionTitle}>Verification Method</Text>
          {renderMethodButton('sms', 'SMS', maskedInfo?.phone)}
          {renderMethodButton('email', 'Email', maskedInfo?.email)}
          {renderMethodButton('authenticator', 'Authenticator App')}
        </View>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Verification Code</Text>
            <TextInput
              style={styles.input}
              value={code}
              onChangeText={setCode}
              placeholder="000000"
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
              editable={!isLoading}
            />
          </View>

          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleVerify}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.buttonText}>Verify</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkButton}
            onPress={handleResendCode}
            disabled={resendingCode || isLoading || cooldown > 0}
          >
            <Text style={[styles.linkText, cooldown > 0 && styles.linkTextDisabled]}>
              {resendingCode
                ? 'Sending...'
                : cooldown > 0
                ? `Resend Code (${cooldown}s)`
                : 'Resend Code'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkButton}
            onPress={handleCancel}
            disabled={isLoading}
          >
            <Text style={[styles.linkText, styles.cancelText]}>Cancel</Text>
          </TouchableOpacity>
        </View>

        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666666',
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  methodContainer: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 15,
  },
  methodButton: {
    padding: 15,
    borderWidth: 1,
    borderColor: '#dddddd',
    borderRadius: 8,
    marginBottom: 10,
    backgroundColor: '#f9f9f9',
  },
  methodButtonActive: {
    borderColor: '#007AFF',
    backgroundColor: '#e6f2ff',
  },
  methodButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
  },
  methodButtonTextActive: {
    color: '#007AFF',
  },
  methodInfo: {
    fontSize: 12,
    color: '#666666',
    marginTop: 4,
  },
  form: {
    marginBottom: 30,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: '#dddddd',
    borderRadius: 8,
    paddingHorizontal: 15,
    fontSize: 20,
    backgroundColor: '#f9f9f9',
    textAlign: 'center',
    letterSpacing: 10,
  },
  button: {
    height: 50,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  linkButton: {
    alignItems: 'center',
    marginTop: 15,
  },
  linkText: {
    color: '#007AFF',
    fontSize: 14,
  },
  linkTextDisabled: {
    color: '#999999',
  },
  cancelText: {
    color: '#666666',
  },
  errorContainer: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#ffebee',
    borderRadius: 8,
  },
  errorText: {
    color: '#c62828',
    textAlign: 'center',
  },
});