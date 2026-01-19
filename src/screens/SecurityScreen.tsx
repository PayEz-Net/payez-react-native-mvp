import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useAuthStore } from '../stores/authStore';
import { accountApi } from '../utils/api';
import { PasswordStrengthMeter } from '../components/PasswordStrengthMeter';

interface SecurityScreenProps {
  navigation: any;
}

export const SecurityScreen: React.FC<SecurityScreenProps> = ({ navigation }) => {
  const { user, session, twoFactorComplete, requires2FA } = useAuthStore();

  // Password change state
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const handleChangePassword = async () => {
    setPasswordError(null);

    // Validation
    if (!currentPassword) {
      setPasswordError('Current password is required');
      return;
    }

    if (!newPassword) {
      setPasswordError('New password is required');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return;
    }

    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(newPassword)) {
      setPasswordError('Password must contain uppercase, lowercase, and number');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    if (currentPassword === newPassword) {
      setPasswordError('New password must be different from current password');
      return;
    }

    setIsChangingPassword(true);

    try {
      const response = await accountApi.changePassword(
        currentPassword,
        newPassword,
        session?.accessToken || ''
      );

      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to change password');
      }

      Alert.alert('Success', 'Your password has been changed successfully');
      setShowPasswordChange(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to change password');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const cancelPasswordChange = () => {
    setShowPasswordChange(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError(null);
  };

  const get2FAStatusText = (): string => {
    if (!requires2FA) return 'Not Required';
    if (twoFactorComplete) return 'Verified';
    return 'Required';
  };

  const get2FAStatusColor = (): string => {
    if (!requires2FA) return '#888888';
    if (twoFactorComplete) return '#4CAF50';
    return '#FF9800';
  };

  return (
    <ScrollView style={styles.container}>
      {/* Security Summary */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Security Status</Text>
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Account Status</Text>
            <View style={[styles.statusBadge, { backgroundColor: '#E8F5E9' }]}>
              <Text style={[styles.statusBadgeText, { color: '#4CAF50' }]}>
                Active
              </Text>
            </View>
          </View>

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Two-Factor Authentication</Text>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: twoFactorComplete ? '#E8F5E9' : '#FFF3E0' },
              ]}
            >
              <Text
                style={[styles.statusBadgeText, { color: get2FAStatusColor() }]}
              >
                {get2FAStatusText()}
              </Text>
            </View>
          </View>

          <View style={[styles.summaryRow, styles.summaryRowLast]}>
            <Text style={styles.summaryLabel}>Email Verified</Text>
            <View style={[styles.statusBadge, { backgroundColor: '#E8F5E9' }]}>
              <Text style={[styles.statusBadgeText, { color: '#4CAF50' }]}>
                Yes
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Password Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Password</Text>
        <View style={styles.card}>
          {!showPasswordChange ? (
            <TouchableOpacity
              style={styles.actionRow}
              onPress={() => setShowPasswordChange(true)}
            >
              <View>
                <Text style={styles.actionLabel}>Change Password</Text>
                <Text style={styles.actionDescription}>
                  Update your account password
                </Text>
              </View>
              <Text style={styles.actionArrow}>›</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.passwordChangeForm}>
              <Text style={styles.formTitle}>Change Password</Text>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Current Password</Text>
                <TextInput
                  style={styles.input}
                  value={currentPassword}
                  onChangeText={setCurrentPassword}
                  placeholder="Enter current password"
                  secureTextEntry={!showPasswords}
                  autoCapitalize="none"
                  editable={!isChangingPassword}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>New Password</Text>
                <TextInput
                  style={styles.input}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  placeholder="Enter new password"
                  secureTextEntry={!showPasswords}
                  autoCapitalize="none"
                  editable={!isChangingPassword}
                />
                {newPassword.length > 0 && (
                  <PasswordStrengthMeter password={newPassword} />
                )}
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Confirm New Password</Text>
                <TextInput
                  style={styles.input}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Confirm new password"
                  secureTextEntry={!showPasswords}
                  autoCapitalize="none"
                  editable={!isChangingPassword}
                />
              </View>

              <TouchableOpacity
                style={styles.showPasswordButton}
                onPress={() => setShowPasswords(!showPasswords)}
              >
                <Text style={styles.showPasswordText}>
                  {showPasswords ? 'Hide passwords' : 'Show passwords'}
                </Text>
              </TouchableOpacity>

              {passwordError && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{passwordError}</Text>
                </View>
              )}

              <View style={styles.formButtons}>
                <TouchableOpacity
                  style={[styles.formButton, styles.cancelButton]}
                  onPress={cancelPasswordChange}
                  disabled={isChangingPassword}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.formButton, styles.saveButton]}
                  onPress={handleChangePassword}
                  disabled={isChangingPassword}
                >
                  {isChangingPassword ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <Text style={styles.saveButtonText}>Change Password</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>

      {/* Two-Factor Authentication Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Two-Factor Authentication</Text>
        <View style={styles.card}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Status</Text>
            <Text
              style={[styles.infoValue, { color: get2FAStatusColor() }]}
            >
              {get2FAStatusText()}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Method</Text>
            <Text style={styles.infoValue}>
              {session?.user?.authenticationMethods?.join(', ') || 'Email/SMS'}
            </Text>
          </View>

          <View style={[styles.infoRow, styles.infoRowLast]}>
            <Text style={styles.infoLabel}>Last Verified</Text>
            <Text style={styles.infoValue}>
              {session?.mfaExpiresAt
                ? new Date(session.mfaExpiresAt).toLocaleDateString()
                : 'N/A'}
            </Text>
          </View>
        </View>
      </View>

      {/* Login Activity Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Login Activity</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.actionRow}>
            <View>
              <Text style={styles.actionLabel}>View Login History</Text>
              <Text style={styles.actionDescription}>
                See recent account activity
              </Text>
            </View>
            <Text style={styles.actionArrow}>›</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionRow, styles.actionRowLast]}>
            <View>
              <Text style={styles.actionLabel}>Active Sessions</Text>
              <Text style={styles.actionDescription}>
                Manage devices logged into your account
              </Text>
            </View>
            <Text style={styles.actionArrow}>›</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Account Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account Security</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.actionRow}>
            <View>
              <Text style={[styles.actionLabel, styles.dangerText]}>
                Sign Out All Devices
              </Text>
              <Text style={styles.actionDescription}>
                Log out from all other devices
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionRow, styles.actionRowLast]}>
            <View>
              <Text style={[styles.actionLabel, styles.dangerText]}>
                Deactivate Account
              </Text>
              <Text style={styles.actionDescription}>
                Temporarily disable your account
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
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
  summaryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    overflow: 'hidden',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  summaryRowLast: {
    borderBottomWidth: 0,
  },
  summaryLabel: {
    fontSize: 16,
    color: '#333333',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    overflow: 'hidden',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  actionRowLast: {
    borderBottomWidth: 0,
  },
  actionLabel: {
    fontSize: 16,
    color: '#333333',
    marginBottom: 2,
  },
  actionDescription: {
    fontSize: 13,
    color: '#888888',
  },
  actionArrow: {
    fontSize: 20,
    color: '#cccccc',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoRowLast: {
    borderBottomWidth: 0,
  },
  infoLabel: {
    fontSize: 16,
    color: '#333333',
  },
  infoValue: {
    fontSize: 16,
    color: '#666666',
  },
  dangerText: {
    color: '#ff3b30',
  },
  passwordChangeForm: {
    padding: 16,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 16,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
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
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  showPasswordButton: {
    alignSelf: 'flex-start',
    marginBottom: 16,
  },
  showPasswordText: {
    color: '#007AFF',
    fontSize: 14,
  },
  errorContainer: {
    backgroundColor: '#ffebee',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#c62828',
    fontSize: 14,
    textAlign: 'center',
  },
  formButtons: {
    flexDirection: 'row',
  },
  formButton: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
    marginRight: 8,
  },
  cancelButtonText: {
    color: '#666666',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: '#007AFF',
    marginLeft: 8,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
