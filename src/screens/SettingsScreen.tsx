import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { useAuthStore } from '../stores/authStore';
import { useBiometricAuth } from '../hooks/useBiometricAuth';

interface SettingsScreenProps {
  navigation: any;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ navigation }) => {
  const { logout } = useAuthStore();
  const {
    isAvailable: biometricAvailable,
    isEnabled: biometricEnabled,
    isLoading: biometricLoading,
    biometryTypeName,
    error: biometricError,
    enable: enableBiometric,
    disable: disableBiometric,
  } = useBiometricAuth();

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  const handleBiometricToggle = async (value: boolean) => {
    if (value) {
      if (!biometricAvailable) {
        Alert.alert(
          'Not Available',
          'Biometric authentication is not available on this device'
        );
        return;
      }

      const success = await enableBiometric();
      if (!success) {
        Alert.alert(
          'Error',
          biometricError || 'Failed to enable biometric login'
        );
      }
    } else {
      const success = await disableBiometric();
      if (!success) {
        Alert.alert('Error', 'Failed to disable biometric login');
      }
    }
  };

  const handleNotificationsToggle = (value: boolean) => {
    setNotificationsEnabled(value);
    // TODO: Update notification preferences
  };

  const handleDarkModeToggle = (value: boolean) => {
    setDarkMode(value);
    // TODO: Apply dark mode theme
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            // TODO: Call API to delete account
            Alert.alert('Account Deletion', 'Please contact support to delete your account.');
          },
        },
      ]
    );
  };

  const handleLogout = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await logout();
          },
        },
      ]
    );
  };

  const openURL = async (url: string) => {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* Security Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Security</Text>
        <View style={styles.settingsCard}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Biometric Login</Text>
              <Text style={styles.settingDescription}>
                Use Face ID or Touch ID to sign in
              </Text>
            </View>
            <Switch
              value={biometricEnabled}
              onValueChange={handleBiometricToggle}
              trackColor={{ false: '#e0e0e0', true: '#4CAF50' }}
              thumbColor="#ffffff"
            />
          </View>

          <TouchableOpacity
            style={[styles.settingRow, styles.settingRowLast]}
            onPress={() => navigation.navigate('ChangePassword')}
          >
            <Text style={styles.settingLabel}>Change Password</Text>
            <Text style={styles.settingArrow}>›</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Notifications Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>
        <View style={styles.settingsCard}>
          <View style={[styles.settingRow, styles.settingRowLast]}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Push Notifications</Text>
              <Text style={styles.settingDescription}>
                Receive alerts about your account
              </Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={handleNotificationsToggle}
              trackColor={{ false: '#e0e0e0', true: '#4CAF50' }}
              thumbColor="#ffffff"
            />
          </View>
        </View>
      </View>

      {/* Appearance Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Appearance</Text>
        <View style={styles.settingsCard}>
          <View style={[styles.settingRow, styles.settingRowLast]}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Dark Mode</Text>
              <Text style={styles.settingDescription}>
                Use dark theme throughout the app
              </Text>
            </View>
            <Switch
              value={darkMode}
              onValueChange={handleDarkModeToggle}
              trackColor={{ false: '#e0e0e0', true: '#4CAF50' }}
              thumbColor="#ffffff"
            />
          </View>
        </View>
      </View>

      {/* About Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.settingsCard}>
          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => openURL('https://payez.net/terms')}
          >
            <Text style={styles.settingLabel}>Terms of Service</Text>
            <Text style={styles.settingArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingRow}
            onPress={() => openURL('https://payez.net/privacy')}
          >
            <Text style={styles.settingLabel}>Privacy Policy</Text>
            <Text style={styles.settingArrow}>›</Text>
          </TouchableOpacity>

          <View style={[styles.settingRow, styles.settingRowLast]}>
            <Text style={styles.settingLabel}>App Version</Text>
            <Text style={styles.settingValue}>1.0.0</Text>
          </View>
        </View>
      </View>

      {/* Account Actions */}
      <View style={styles.section}>
        <View style={styles.settingsCard}>
          <TouchableOpacity
            style={styles.settingRow}
            onPress={handleLogout}
          >
            <Text style={[styles.settingLabel, styles.dangerText]}>Sign Out</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.settingRow, styles.settingRowLast]}
            onPress={handleDeleteAccount}
          >
            <Text style={[styles.settingLabel, styles.dangerText]}>
              Delete Account
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Footer */}
      <Text style={styles.footerText}>
        PayEz Mobile{'\n'}
        Built with React Native
      </Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  section: {
    padding: 20,
    paddingBottom: 0,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888888',
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  settingsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    minHeight: 56,
  },
  settingRowLast: {
    borderBottomWidth: 0,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 16,
    color: '#333333',
  },
  settingDescription: {
    fontSize: 13,
    color: '#888888',
    marginTop: 2,
  },
  settingArrow: {
    fontSize: 20,
    color: '#cccccc',
  },
  settingValue: {
    fontSize: 16,
    color: '#888888',
  },
  dangerText: {
    color: '#ff3b30',
  },
  footerText: {
    textAlign: 'center',
    color: '#999999',
    fontSize: 12,
    lineHeight: 18,
    padding: 30,
  },
});
