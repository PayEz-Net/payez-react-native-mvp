// Authentication types for PayEz React Native MVP
// Based on Next.js MVP auth types

export interface User {
  id: string;
  email: string;
  name?: string;
  roles?: string[];
  requiresTwoFactor?: boolean;
  twoFactorSessionVerified?: boolean;
  authenticationMethods?: string[];
}

export interface Session {
  user: User;
  accessToken: string;
  refreshToken?: string;
  sessionToken?: string;
  expiresAt?: string;
  mfaExpiresAt?: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  session: Session | null;
  user: User | null;
  error: string | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupCredentials {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface TwoFactorVerification {
  code: string;
  method: 'sms' | 'email' | 'authenticator';
}

export interface MaskedContactInfo {
  email?: string;
  phone?: string;
  authenticatorEnabled?: boolean;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface TokenPayload {
  sub: string;
  email: string;
  roles?: string[];
  iat: number;
  exp: number;
  mfa?: boolean;
}

// Type guards
export function isValidSession(session: Session | null): session is Session {
  return !!(
    session?.user?.id &&
    session?.user?.email &&
    session?.accessToken
  );
}

export function hasCompletedTwoFactor(session: Session | null): boolean {
  if (!isValidSession(session)) return false;

  // If user doesn't require 2FA, they're authenticated
  if (!session.user.requiresTwoFactor) return true;

  // If they require 2FA, check if verified
  return session.user.twoFactorSessionVerified === true;
}

// Auth flow states
export enum AuthFlowState {
  UNAUTHENTICATED = 'unauthenticated',
  AUTHENTICATED = 'authenticated',
  REQUIRES_2FA = 'requires_2fa',
  VERIFYING_2FA = 'verifying_2fa',
  REFRESHING_TOKEN = 'refreshing_token',
  ERROR = 'error'
}