import { ApiResponse } from '../types/auth';

// Configuration
// Note: In production, these should come from environment config
const API_BASE_URL = 'https://idp.payez.net';
const CLIENT_ID = 'payez-mobile-client';

interface RequestOptions extends RequestInit {
  token?: string;
  skipAuth?: boolean;
  skipInterceptor?: boolean; // Skip 401 interceptor (used for refresh calls)
}

// Token refresh callback - set by auth store to avoid circular dependency
let tokenRefreshCallback: (() => Promise<string | null>) | null = null;
let getTokenCallback: (() => string | null) | null = null;

/**
 * Configure the API client with auth callbacks
 * Called from auth store initialization to avoid circular imports
 */
export function configureApiAuth(config: {
  getToken: () => string | null;
  refreshToken: () => Promise<string | null>;
}) {
  getTokenCallback = config.getToken;
  tokenRefreshCallback = config.refreshToken;
}

// Type guard for API responses
export function isApiSuccess<T>(response: ApiResponse<T>): response is ApiResponse<T> & { data: T } {
  return response.success && response.data !== undefined;
}

// Extract data from successful response
export function extractApiData<T>(response: ApiResponse<T>): T {
  if (!isApiSuccess(response)) {
    throw new Error(response.error?.message || 'API request failed');
  }
  return response.data;
}

// Standard API client
class StandardizedApi {
  private baseUrl: string;
  private defaultHeaders: HeadersInit;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      'X-Client-Id': CLIENT_ID,
      'X-Platform': 'react-native',
    };
  }

  private async request<T>(
    endpoint: string,
    options: RequestOptions = {},
    isRetry: boolean = false
  ): Promise<ApiResponse<T>> {
    const { token, skipAuth, skipInterceptor, headers = {}, ...fetchOptions } = options;

    const finalHeaders: HeadersInit = {
      ...this.defaultHeaders,
      ...headers,
    };

    // Use provided token or get from callback
    const authToken = token || (!skipAuth && getTokenCallback ? getTokenCallback() : null);
    if (authToken && !skipAuth) {
      finalHeaders['Authorization'] = `Bearer ${authToken}`;
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...fetchOptions,
        headers: finalHeaders,
      });

      const contentType = response.headers.get('content-type');
      const isJson = contentType?.includes('application/json');

      let data: any;
      if (isJson) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      // Handle 401 Unauthorized - attempt token refresh and retry
      if (response.status === 401 && !isRetry && !skipInterceptor && tokenRefreshCallback) {
        console.log('[API] 401 received, attempting token refresh...');

        try {
          const newToken = await tokenRefreshCallback();

          if (newToken) {
            console.log('[API] Token refreshed, retrying request...');
            // Retry with new token
            return this.request<T>(
              endpoint,
              { ...options, token: newToken },
              true // Mark as retry to prevent infinite loop
            );
          }
        } catch (refreshError) {
          console.error('[API] Token refresh failed:', refreshError);
          // Return original 401 error
        }
      }

      if (!response.ok) {
        return {
          success: false,
          error: {
            code: data?.code || `HTTP_${response.status}`,
            message: data?.message || data?.error || response.statusText,
          },
        };
      }

      return {
        success: true,
        data,
      };

    } catch (error) {
      console.error('API request failed:', error);
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: error instanceof Error ? error.message : 'Network request failed',
        },
      };
    }
  }

  async get<T>(endpoint: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  async post<T>(endpoint: string, body?: any, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async put<T>(endpoint: string, body?: any, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T>(endpoint: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}

// Export singleton instance
export const standardizedApi = new StandardizedApi();

// Account-specific API methods
// Endpoints based on PayEz-Core IDP API
class AccountApi {
  private api: StandardizedApi;

  constructor() {
    this.api = new StandardizedApi();
  }

  // Primary authentication
  async login(email: string, password: string) {
    return this.api.post('/api/ExternalAuth/login', { email, password }, { skipAuth: true });
  }

  // Registration
  async signup(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }) {
    return this.api.post('/api/ExternalAuth/lead/registration', {
      email: data.email,
      password: data.password,
      first_name: data.firstName,
      last_name: data.lastName,
    }, { skipAuth: true });
  }

  // Token management
  async refreshToken(refreshToken: string) {
    return this.api.post('/api/ExternalAuth/refresh', { refresh_token: refreshToken }, { skipAuth: true });
  }

  async revokeToken(token: string) {
    return this.api.post('/api/ExternalAuth/revoke', {}, { token });
  }

  async validateToken(token: string) {
    return this.api.post('/api/ExternalAuth/validate', {}, { token });
  }

  // Two-factor authentication
  async getMaskedInfo(token: string) {
    return this.api.post('/api/Account/masked-info', {}, { token });
  }

  async sendTwoFactorSms(token: string) {
    return this.api.post('/api/ExternalAuth/twofa/sms/send', {}, { token });
  }

  async verifyTwoFactorSms(code: string, token: string) {
    return this.api.post('/api/ExternalAuth/twofa/sms/verify', { code }, { token });
  }

  async sendTwoFactorEmail(token: string) {
    return this.api.post('/api/ExternalAuth/twofa/email/send', {}, { token });
  }

  async verifyTwoFactorEmail(code: string, token: string) {
    return this.api.post('/api/ExternalAuth/twofa/email/verify', { code }, { token });
  }

  // Convenience method for 2FA
  async sendTwoFactorCode(method: 'sms' | 'email', token: string) {
    if (method === 'sms') {
      return this.sendTwoFactorSms(token);
    }
    return this.sendTwoFactorEmail(token);
  }

  async verifyTwoFactor(code: string, method: 'sms' | 'email', token: string) {
    if (method === 'sms') {
      return this.verifyTwoFactorSms(code, token);
    }
    return this.verifyTwoFactorEmail(code, token);
  }

  // Profile management
  async getProfile(token: string) {
    return this.api.get('/api/Account/profile', { token });
  }

  async updateProfile(updates: any, token: string) {
    return this.api.put('/api/Account/profile', updates, { token });
  }

  // Password management
  async changePassword(currentPassword: string, newPassword: string, token: string) {
    return this.api.post('/api/Account/change-password',
      { current_password: currentPassword, new_password: newPassword },
      { token }
    );
  }

  // Password reset flow
  async requestPasswordReset(email: string) {
    return this.api.post('/api/Account/send-reset-code', { email }, { skipAuth: true });
  }

  async verifyResetCode(email: string, code: string) {
    return this.api.post('/api/Account/verify-reset-code', { email, code }, { skipAuth: true });
  }

  async confirmPasswordReset(code: string, newPassword: string) {
    return this.api.post('/api/Account/reset-password',
      { code, new_password: newPassword },
      { skipAuth: true }
    );
  }

  // Account recovery (alternative flow)
  async initiateRecovery(email: string) {
    return this.api.post('/api/Account/recovery/initiate', { email }, { skipAuth: true });
  }

  async sendRecoveryCode(email: string) {
    return this.api.post('/api/Account/recovery/send-code', { email }, { skipAuth: true });
  }

  async verifyRecoveryCode(email: string, code: string) {
    return this.api.post('/api/Account/recovery/verify-code', { email, code }, { skipAuth: true });
  }

  // User roles
  async getRoles(token: string) {
    return this.api.get('/api/ExternalAuth/roles', { token });
  }
}

export const accountApi = new AccountApi();

// Utility function to handle token expiration
export async function withTokenRefresh<T>(
  apiCall: () => Promise<ApiResponse<T>>,
  onRefresh: () => Promise<string>
): Promise<ApiResponse<T>> {
  const response = await apiCall();

  // If unauthorized, try to refresh token
  if (!response.success && response.error?.code === 'HTTP_401') {
    try {
      const newToken = await onRefresh();
      // Retry the original call with new token
      // Note: This is simplified - in production you'd pass the new token to the original call
      return apiCall();
    } catch (refreshError) {
      // If refresh fails, return original error
      return response;
    }
  }

  return response;
}