/**
 * Deep Linking Configuration
 *
 * Handles URL schemes and universal links for PayEz app.
 * Edge cases handled:
 * - App cold start with deep link
 * - App in background receiving link
 * - Auth state mismatch (link requires auth but user not logged in)
 * - Expired/invalid tokens in links
 */

import { Linking } from 'react-native';
import { LinkingOptions } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/AppNavigator';

// URL scheme for the app
export const URL_SCHEME = 'payez';

// Universal link domain
export const UNIVERSAL_LINK_DOMAIN = 'payez.net';

/**
 * Deep link paths we support:
 * - payez://login - Open login screen
 * - payez://reset-password?token=xxx - Password reset flow
 * - payez://verify-email?token=xxx - Email verification
 * - payez://2fa - Open 2FA screen (if in auth flow)
 * - https://payez.net/reset-password?token=xxx - Universal link for password reset
 * - https://payez.net/verify-email?token=xxx - Universal link for email verification
 */

export interface DeepLinkParams {
  token?: string;
  email?: string;
  method?: string;
}

/**
 * Parse query string into key-value pairs
 */
function parseQueryString(queryString: string): Record<string, string> {
  const params: Record<string, string> = {};
  if (!queryString) return params;

  const pairs = queryString.split('&');
  for (const pair of pairs) {
    const [key, value] = pair.split('=');
    if (key) {
      params[decodeURIComponent(key)] = value ? decodeURIComponent(value) : '';
    }
  }
  return params;
}

/**
 * Parse deep link URL and extract route/params
 */
export function parseDeepLink(url: string): {
  route: keyof RootStackParamList | null;
  params: DeepLinkParams;
} {
  try {
    // Normalize URL - handle both custom scheme and universal links
    let normalizedUrl = url;
    if (url.startsWith(`${URL_SCHEME}://`)) {
      normalizedUrl = url.replace(`${URL_SCHEME}://`, '');
    } else if (url.startsWith('https://')) {
      normalizedUrl = url.replace(/^https?:\/\/[^/]+\/?/, '');
    }

    // Split path and query string
    const [pathPart, queryPart] = normalizedUrl.split('?');
    const path = pathPart.replace(/^\//, '').replace(/\/$/, '');
    const queryParams = parseQueryString(queryPart || '');

    const params: DeepLinkParams = {
      token: queryParams.token || undefined,
      email: queryParams.email || undefined,
      method: queryParams.method || undefined,
    };

    // Map paths to routes
    switch (path) {
      case 'login':
        return { route: 'Login', params };
      case 'signup':
        return { route: 'Signup', params };
      case 'reset-password':
      case 'forgot-password':
        return { route: 'ForgotPassword', params };
      case 'verify-email':
        // Email verification typically redirects to login with success message
        return { route: 'Login', params };
      case '2fa':
      case 'two-factor':
        return { route: 'TwoFactor', params };
      default:
        return { route: null, params };
    }
  } catch (error) {
    console.error('[DeepLinking] Failed to parse URL:', url, error);
    return { route: null, params: {} };
  }
}

/**
 * Navigation linking configuration for React Navigation
 */
export const linkingConfig: LinkingOptions<RootStackParamList> = {
  prefixes: [
    `${URL_SCHEME}://`,
    `https://${UNIVERSAL_LINK_DOMAIN}`,
    `https://www.${UNIVERSAL_LINK_DOMAIN}`,
  ],

  config: {
    screens: {
      Login: 'login',
      Signup: 'signup',
      ForgotPassword: {
        path: 'reset-password',
        parse: {
          token: (token: string) => token,
        },
      },
      TwoFactor: '2fa',
      Home: 'home',
      Profile: 'profile',
      Settings: 'settings',
      Security: 'security',
      ChangePassword: 'change-password',
    },
  },

  // Custom URL handler for edge cases
  async getInitialURL() {
    // Check if app was opened from a deep link (cold start)
    const url = await Linking.getInitialURL();

    if (url) {
      console.log('[DeepLinking] Initial URL:', url);
      return url;
    }

    return null;
  },

  // Listen for incoming links while app is running
  subscribe(listener) {
    const subscription = Linking.addEventListener('url', ({ url }) => {
      console.log('[DeepLinking] Received URL:', url);
      listener(url);
    });

    return () => {
      subscription.remove();
    };
  },
};

/**
 * Handle deep link with authentication state awareness
 *
 * Edge cases:
 * - If link requires auth and user not logged in, save link and redirect after login
 * - If link is for unauthenticated routes but user is logged in, handle appropriately
 */
export interface PendingDeepLink {
  url: string;
  route: keyof RootStackParamList;
  params: DeepLinkParams;
  timestamp: number;
}

// Store for pending deep links (when auth state doesn't match)
let pendingDeepLink: PendingDeepLink | null = null;

// Deep link expiry time (5 minutes)
const DEEP_LINK_EXPIRY_MS = 5 * 60 * 1000;

/**
 * Save a deep link for later processing (after auth)
 */
export function savePendingDeepLink(
  url: string,
  route: keyof RootStackParamList,
  params: DeepLinkParams
): void {
  pendingDeepLink = {
    url,
    route,
    params,
    timestamp: Date.now(),
  };
  console.log('[DeepLinking] Saved pending deep link:', route);
}

/**
 * Get and clear pending deep link if not expired
 */
export function consumePendingDeepLink(): PendingDeepLink | null {
  if (!pendingDeepLink) {
    return null;
  }

  // Check if expired
  if (Date.now() - pendingDeepLink.timestamp > DEEP_LINK_EXPIRY_MS) {
    console.log('[DeepLinking] Pending deep link expired');
    pendingDeepLink = null;
    return null;
  }

  const link = pendingDeepLink;
  pendingDeepLink = null;
  console.log('[DeepLinking] Consuming pending deep link:', link.route);
  return link;
}

/**
 * Check if a route requires authentication
 */
export function routeRequiresAuth(route: keyof RootStackParamList): boolean {
  const authRequiredRoutes: Array<keyof RootStackParamList> = [
    'Home',
    'Profile',
    'Settings',
    'Security',
    'ChangePassword',
  ];
  return authRequiredRoutes.includes(route);
}

/**
 * Check if a route is for unauthenticated users only
 */
export function routeRequiresNoAuth(route: keyof RootStackParamList): boolean {
  const noAuthRoutes: Array<keyof RootStackParamList> = [
    'Login',
    'Signup',
    'ForgotPassword',
  ];
  return noAuthRoutes.includes(route);
}

/**
 * Open external URL safely
 */
export async function openExternalURL(url: string): Promise<boolean> {
  try {
    const canOpen = await Linking.canOpenURL(url);

    if (canOpen) {
      await Linking.openURL(url);
      return true;
    }

    console.warn('[DeepLinking] Cannot open URL:', url);
    return false;
  } catch (error) {
    console.error('[DeepLinking] Error opening URL:', url, error);
    return false;
  }
}

/**
 * Create a deep link URL for the app
 */
export function createDeepLink(
  route: string,
  params?: Record<string, string>
): string {
  let url = `${URL_SCHEME}://${route}`;

  if (params && Object.keys(params).length > 0) {
    const queryString = Object.entries(params)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');
    url += `?${queryString}`;
  }

  return url;
}
