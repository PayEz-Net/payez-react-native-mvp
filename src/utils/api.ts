import { ApiResponse } from '../types/auth';

// Configuration
const API_BASE_URL = process.env.IDP_BASE_URL || 'https://idp.payez.net';
const CLIENT_ID = process.env.CLIENT_ID || 'payez-mobile-client';

interface RequestOptions extends RequestInit {
  token?: string;
  skipAuth?: boolean;
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
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    const { token, skipAuth, headers = {}, ...fetchOptions } = options;

    const finalHeaders: HeadersInit = {
      ...this.defaultHeaders,
      ...headers,
    };

    if (token && !skipAuth) {
      finalHeaders['Authorization'] = `Bearer ${token}`;
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
class AccountApi {
  private api: StandardizedApi;

  constructor() {
    this.api = new StandardizedApi();
  }

  async login(email: string, password: string) {
    return this.api.post('/auth/login', { email, password }, { skipAuth: true });
  }

  async signup(email: string, password: string, name: string) {
    return this.api.post('/auth/signup', { email, password, name }, { skipAuth: true });
  }

  async logout(token: string) {
    return this.api.post('/auth/logout', {}, { token });
  }

  async refreshToken(refreshToken: string) {
    return this.api.post('/auth/refresh', { refreshToken }, { skipAuth: true });
  }

  async getMaskedInfo(email: string, token: string) {
    return this.api.post('/auth/masked-info', { email }, { token });
  }

  async verifyTwoFactor(code: string, method: string, token: string) {
    return this.api.post('/auth/verify-2fa', { code, method }, { token });
  }

  async sendTwoFactorCode(method: string, token: string) {
    return this.api.post('/auth/send-2fa', { method }, { token });
  }

  async getProfile(token: string) {
    return this.api.get('/user/profile', { token });
  }

  async updateProfile(updates: any, token: string) {
    return this.api.put('/user/profile', updates, { token });
  }

  async changePassword(currentPassword: string, newPassword: string, token: string) {
    return this.api.post('/auth/change-password',
      { currentPassword, newPassword },
      { token }
    );
  }

  async requestPasswordReset(email: string) {
    return this.api.post('/auth/reset-password', { email }, { skipAuth: true });
  }

  async confirmPasswordReset(token: string, newPassword: string) {
    return this.api.post('/auth/confirm-reset',
      { token, newPassword },
      { skipAuth: true }
    );
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