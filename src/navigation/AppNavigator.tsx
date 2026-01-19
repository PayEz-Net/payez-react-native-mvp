import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuthStore } from '../stores/authStore';
import { AuthFlowState } from '../types/auth';
import { linkingConfig } from '../utils/deepLinking';

// Import screens
import { LoginScreen } from '../screens/LoginScreen';
import { SignupScreen } from '../screens/SignupScreen';
import { ForgotPasswordScreen } from '../screens/ForgotPasswordScreen';
import { TwoFactorScreen } from '../screens/TwoFactorScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { SecurityScreen } from '../screens/SecurityScreen';

// Define navigation param lists
export type RootStackParamList = {
  Login: { email?: string } | undefined;
  Signup: undefined;
  TwoFactor: { method?: string } | undefined;
  ForgotPassword: { token?: string; email?: string } | undefined;
  Home: undefined;
  Profile: undefined;
  Settings: undefined;
  Security: undefined;
  ChangePassword: undefined;
  Loading: undefined;
};

const Stack = createStackNavigator<RootStackParamList>();

// Navigation ref for deep linking
export const navigationRef = React.createRef<NavigationContainerRef<RootStackParamList>>();

export const AppNavigator: React.FC = () => {
  const { authFlowState, loadSession } = useAuthStore();
  const isReady = useRef(false);

  useEffect(() => {
    // Load persisted session on app start
    loadSession();
  }, []);

  const onReady = () => {
    isReady.current = true;
  };

  const renderAuthStack = () => (
    <>
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="Signup"
        component={SignupScreen}
        options={{
          title: 'Create Account',
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen
        name="ForgotPassword"
        component={ForgotPasswordScreen}
        options={{
          title: 'Reset Password',
          headerBackTitle: 'Back',
        }}
      />
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
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: 'Profile',
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: 'Settings',
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen
        name="Security"
        component={SecurityScreen}
        options={{
          title: 'Security',
          headerBackTitle: 'Back',
        }}
      />
    </>
  );

  return (
    <NavigationContainer
      ref={navigationRef}
      linking={linkingConfig}
      onReady={onReady}
      fallback={<LoadingScreen />}
    >
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

// Loading screen for token refresh state
const LoadingScreen: React.FC = () => (
  <View style={styles.loadingContainer}>
    <ActivityIndicator size="large" color="#007AFF" />
    <Text style={styles.loadingText}>Loading...</Text>
  </View>
);

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666666',
  },
});