import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuthStore } from '../stores/authStore';
import { AuthFlowState } from '../types/auth';

// Import screens
import { LoginScreen } from '../screens/LoginScreen';
import { TwoFactorScreen } from '../screens/TwoFactorScreen';
// TODO: Import additional screens as they're created
// import { SignupScreen } from '../screens/SignupScreen';
// import { HomeScreen } from '../screens/HomeScreen';
// import { ProfileScreen } from '../screens/ProfileScreen';

// Define navigation param lists
export type RootStackParamList = {
  Login: undefined;
  Signup: undefined;
  TwoFactor: undefined;
  ForgotPassword: undefined;
  Home: undefined;
  Profile: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();

export const AppNavigator: React.FC = () => {
  const { authFlowState, loadSession } = useAuthStore();

  useEffect(() => {
    // Load persisted session on app start
    loadSession();
  }, []);

  const renderAuthStack = () => (
    <>
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{
          headerShown: false,
        }}
      />
      {/* TODO: Add Signup screen */}
      {/* <Stack.Screen
        name="Signup"
        component={SignupScreen}
        options={{
          title: 'Create Account',
        }}
      /> */}
      {/* TODO: Add ForgotPassword screen */}
      {/* <Stack.Screen
        name="ForgotPassword"
        component={ForgotPasswordScreen}
        options={{
          title: 'Reset Password',
        }}
      /> */}
    </>
  );

  const renderTwoFactorStack = () => (
    <Stack.Screen
      name="TwoFactor"
      component={TwoFactorScreen}
      options={{
        headerShown: false,
        // Prevent going back to login screen
        gestureEnabled: false,
        headerLeft: () => null,
      }}
    />
  );

  const renderMainStack = () => (
    <>
      {/* TODO: Add main app screens */}
      {/* <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: 'PayEz',
        }}
      />
      <Stack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: 'Profile',
        }}
      /> */}
      {/* Temporary placeholder until main screens are implemented */}
      <Stack.Screen
        name="Home"
        component={TempHomeScreen}
        options={{
          title: 'PayEz Home',
        }}
      />
    </>
  );

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: true }}>
        {authFlowState === AuthFlowState.UNAUTHENTICATED && renderAuthStack()}
        {authFlowState === AuthFlowState.REQUIRES_2FA && renderTwoFactorStack()}
        {authFlowState === AuthFlowState.VERIFYING_2FA && renderTwoFactorStack()}
        {authFlowState === AuthFlowState.AUTHENTICATED && renderMainStack()}
        {authFlowState === AuthFlowState.REFRESHING_TOKEN && (
          // Show loading screen while refreshing token
          <Stack.Screen
            name="Loading"
            component={LoadingScreen}
            options={{ headerShown: false }}
          />
        )}
        {authFlowState === AuthFlowState.ERROR && renderAuthStack()}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

// Temporary screens until full implementation
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

const TempHomeScreen: React.FC = () => {
  const { logout, user } = useAuthStore();

  return (
    <View style={styles.tempContainer}>
      <Text style={styles.tempTitle}>Welcome to PayEz!</Text>
      <Text style={styles.tempSubtitle}>User: {user?.email}</Text>
      <Text style={styles.tempInfo}>
        Authentication successful. Main app screens to be implemented.
      </Text>
      <TouchableOpacity style={styles.logoutButton} onPress={logout}>
        <Text style={styles.logoutButtonText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
};

const LoadingScreen: React.FC = () => (
  <View style={styles.tempContainer}>
    <Text style={styles.tempTitle}>Loading...</Text>
  </View>
);

const styles = StyleSheet.create({
  tempContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  tempTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  tempSubtitle: {
    fontSize: 16,
    color: '#666666',
    marginBottom: 20,
  },
  tempInfo: {
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
    marginBottom: 30,
  },
  logoutButton: {
    paddingHorizontal: 30,
    paddingVertical: 12,
    backgroundColor: '#ff4444',
    borderRadius: 8,
  },
  logoutButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});