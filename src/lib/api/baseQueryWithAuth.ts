// src/lib/api/baseQueryWithAuth.ts
import { fetchBaseQuery, BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query/react';

// ─── Token Cache ──────────────────────────────────────────────────────────────
// In-memory cache to avoid excessive localStorage reads
let tokenCache: {
  token: string | null;
  expiry: number;
} = {
  token: null,
  expiry: 0,
};

const TOKEN_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// ─── Token Size Limits ────────────────────────────────────────────────────────
// JWT tokens should typically be under 8KB. Anything larger indicates corruption
// or a serious issue that needs re-authentication
const MAX_TOKEN_SIZE = 8 * 1024; // 8KB - reasonable limit for JWT

// ─── Token Storage Keys ───────────────────────────────────────────────────────
export const TOKEN_STORAGE_KEY = 'superAdminToken';
export const REFRESH_TOKEN_STORAGE_KEY = 'superAdminRefreshToken';
export const USER_STORAGE_KEY = 'superAdminUser';

// ─── Public Endpoints (no auth required) ──────────────────────────────────────
const PUBLIC_ENDPOINTS: string[] = [
  'login/',
  'cms-settings/login-page/',
];

const isPublicEndpoint = (url: string): boolean => {
  return PUBLIC_ENDPOINTS.some(endpoint => url.includes(endpoint));
};

// ─── Token Management Functions ───────────────────────────────────────────────

/**
 * Get the current access token from localStorage
 */
export const getAccessToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_STORAGE_KEY);
};

/**
 * Get the current refresh token from localStorage
 */
export const getRefreshToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
};

/**
 * Store tokens in localStorage
 */
export const setTokens = (accessToken: string, refreshToken?: string): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_STORAGE_KEY, accessToken);
  if (refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, refreshToken);
  }
  // Update cache
  tokenCache = {
    token: accessToken,
    expiry: Date.now() + TOKEN_CACHE_DURATION,
  };
};

/**
 * Clear all auth tokens and cookies
 */
export const clearTokens = (): void => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
  localStorage.removeItem(USER_STORAGE_KEY);
  localStorage.removeItem('isSuperAdminLoggedIn');
  // Clear cache
  tokenCache = { token: null, expiry: 0 };
};

/**
 * Nuclear option: Clear ALL storage and cookies to fix 431 errors
 * This is called when we detect header size issues
 */
export const clearAllStorageAndCookies = (): void => {
  if (typeof window === 'undefined') return;

  // Clear all localStorage
  localStorage.clear();

  // Clear all sessionStorage
  sessionStorage.clear();

  // Clear all cookies for current domain
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const eqPos = cookie.indexOf('=');
    const name = eqPos > -1 ? cookie.substring(0, eqPos).trim() : cookie.trim();
    if (name) {
      // Clear for current path and all parent paths
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${window.location.hostname}`;
      // Also try without domain for subdomains
      const domainParts = window.location.hostname.split('.');
      if (domainParts.length > 1) {
        const rootDomain = domainParts.slice(-2).join('.');
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=.${rootDomain}`;
      }
    }
  }

  // Clear token cache
  tokenCache = { token: null, expiry: 0 };

  console.log('[Auth] Cleared all storage and cookies');
};

/**
 * Get cached token or fetch from localStorage
 */
const getCachedToken = (): string | null => {
  const now = Date.now();

  // Return cached token if still valid
  if (tokenCache.token && tokenCache.expiry > now) {
    return tokenCache.token;
  }

  // Fetch from localStorage
  const token = getAccessToken();

  if (token) {
    tokenCache = {
      token,
      expiry: now + TOKEN_CACHE_DURATION,
    };
  }

  return token;
};

/**
 * Clear the token cache (useful after token refresh)
 */
export const clearTokenCache = (): void => {
  tokenCache = { token: null, expiry: 0 };
};

/**
 * Validate token format and size to prevent 431 errors
 * Returns true if token is valid, false otherwise
 */
const isTokenValid = (token: string | null): boolean => {
  if (!token) return false;

  // Check token size - if too large, it's likely corrupted
  if (token.length > MAX_TOKEN_SIZE) {
    console.error('[Auth] Token exceeds maximum size limit. Token may be corrupted.');
    return false;
  }

  // Basic JWT format validation (header.payload.signature)
  const parts = token.split('.');
  if (parts.length !== 3) {
    console.error('[Auth] Token does not have valid JWT format.');
    return false;
  }

  // Check for obvious corruption patterns
  if (token.includes('[object') || token.includes('undefined') || token.includes('null')) {
    console.error('[Auth] Token contains invalid data patterns.');
    return false;
  }

  return true;
};

/**
 * Handle corrupted or oversized token by clearing and redirecting
 */
const handleInvalidToken = (): void => {
  console.error('[Auth] Invalid token detected. Clearing tokens and redirecting to login.');
  clearTokens();

  if (typeof window !== 'undefined') {
    window.location.href = '/auth';
  }
};

// ─── Startup Token Validation ─────────────────────────────────────────────────
// Validate tokens on module load to catch corruption early
if (typeof window !== 'undefined') {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (token && !isTokenValid(token)) {
    console.error('[Auth] Startup: Invalid token detected. Clearing all storage.');
    clearAllStorageAndCookies();
  }
}

// ─── Global Fetch Interceptor for 431 Errors ──────────────────────────────────
// This catches 431 errors even outside RTK Query
if (typeof window !== 'undefined') {
  const originalFetch = window.fetch;
  window.fetch = async (...args) => {
    try {
      const response = await originalFetch(...args);

      // Check for 431 error
      if (response.status === 431) {
        console.error('[Auth] Global: 431 Error detected. Clearing ALL storage and cookies.');
        clearAllStorageAndCookies();
        window.location.href = '/auth';
      }

      return response;
    } catch (error) {
      // Network errors that might indicate header issues
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        // Check if this might be a header size issue by checking storage size
        const totalStorageSize = JSON.stringify(localStorage).length + JSON.stringify(sessionStorage).length;
        if (totalStorageSize > 50000) { // 50KB threshold
          console.error('[Auth] Global: Possible header size issue detected. Clearing storage.');
          clearAllStorageAndCookies();
          window.location.href = '/auth';
        }
      }
      throw error;
    }
  };
}

// ─── Base URL ─────────────────────────────────────────────────────────────────

export const getBaseUrl = (): string => {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!baseUrl) {
    console.error('NEXT_PUBLIC_API_BASE_URL environment variable is not set');
    throw new Error('API base URL not configured. Please set NEXT_PUBLIC_API_BASE_URL in your environment.');
  }
  return baseUrl;
};

// Module-scope safe variant: never throws, so importing this module during
// `next build` prerendering cannot fail when the var is absent. A missing value
// surfaces as a failed request at call time rather than a build crash.
export const resolveBaseUrl = (): string => {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!baseUrl) {
    console.error('NEXT_PUBLIC_API_BASE_URL is not set - API requests will fail');
    return '';
  }
  return baseUrl;
};

// ─── Base Query with Authentication ───────────────────────────────────────────

export const baseQueryWithAuth = fetchBaseQuery({
  baseUrl: resolveBaseUrl(),
  mode: 'cors',
  // NOTE: credentials omitted - using JWT Bearer token, not cookies
  // This prevents 431 errors from accumulated cookies
  prepareHeaders: (headers, { endpoint }) => {
    const url = typeof endpoint === 'string' ? endpoint : '';

    // Skip token for public endpoints
    if (!isPublicEndpoint(url)) {
      const token = getCachedToken();

      if (token) {
        // Validate token before adding to headers to prevent 431 errors
        if (!isTokenValid(token)) {
          // Schedule token cleanup (can't do sync redirect in prepareHeaders)
          setTimeout(() => handleInvalidToken(), 0);
          // Don't add invalid token to headers
        } else {
          headers.set('Authorization', `Bearer ${token}`);
        }
      }
    }

    // Set default headers if not already set (for FormData, browser sets it)
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    headers.set('Accept', 'application/json');

    return headers;
  },
});

// ─── Base Query with Re-authentication ────────────────────────────────────────

export const baseQueryWithReauth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  let result = await baseQueryWithAuth(args, api, extraOptions);

  // Check for 431 Request Header Fields Too Large - indicates token/cookie corruption
  if (result.error && result.error.status === 431) {
    console.error('[Auth] 431 Error - Request headers too large. Clearing ALL storage and cookies.');
    clearAllStorageAndCookies();

    if (typeof window !== 'undefined') {
      window.location.href = '/auth';
    }

    return result;
  }

  // Check for 401 Unauthorized
  if (result.error && result.error.status === 401) {
    const url = typeof args === 'string' ? args : args.url;

    // Don't retry for public endpoints or if already trying to refresh
    if (!isPublicEndpoint(url) && !url.includes('refresh')) {
      console.log('[Auth] 401 received, attempting token refresh...');

      // Try to refresh the token
      const refreshToken = getRefreshToken();

      if (refreshToken) {
        try {
          const refreshResult = await baseQueryWithAuth(
            {
              url: 'token/refresh/',
              method: 'POST',
              body: { refresh: refreshToken },
            },
            api,
            extraOptions
          );

          if (refreshResult.data) {
            const { access, refresh } = refreshResult.data as { access: string; refresh?: string };

            // Store new tokens
            setTokens(access, refresh);

            console.log('[Auth] Token refreshed successfully');

            // Retry the original request
            result = await baseQueryWithAuth(args, api, extraOptions);
          } else {
            // Refresh failed - clear tokens and redirect to login
            console.log('[Auth] Token refresh failed, clearing tokens');
            clearTokens();

            // Redirect to login page
            if (typeof window !== 'undefined') {
              window.location.href = '/auth';
            }
          }
        } catch (error) {
          console.error('[Auth] Error during token refresh:', error);
          clearTokens();
        }
      } else {
        // No refresh token available - clear tokens and redirect
        console.log('[Auth] No refresh token available');
        clearTokens();

        if (typeof window !== 'undefined') {
          window.location.href = '/auth';
        }
      }
    }
  }

  return result;
};

// ─── Base Query without Auth (for public endpoints) ──────────────────────────

export const baseQueryWithoutAuth = fetchBaseQuery({
  baseUrl: resolveBaseUrl(),
  mode: 'cors',
  // NOTE: credentials omitted - using JWT Bearer token, not cookies
  prepareHeaders: (headers) => {
    headers.set('Content-Type', 'application/json');
    headers.set('Accept', 'application/json');
    return headers;
  },
});

// ─── Helper to check if user is authenticated ─────────────────────────────────

export const isAuthenticated = (): boolean => {
  const token = getAccessToken();
  const isLoggedIn = localStorage.getItem('isSuperAdminLoggedIn');
  return Boolean(token && isLoggedIn === 'true');
};

// ─── Get current user from storage ────────────────────────────────────────────

export interface StoredUser {
  id: string;
  sub_id?: string;
  email: string;
  full_name: string;
  is_active: boolean;
  role?: string;
}

export const getStoredUser = (): StoredUser | null => {
  if (typeof window === 'undefined') return null;

  try {
    const userJson = localStorage.getItem(USER_STORAGE_KEY);
    if (userJson) {
      return JSON.parse(userJson) as StoredUser;
    }
    return null;
  } catch (error) {
    console.error('[Auth] Error parsing stored user:', error);
    return null;
  }
};

export const setStoredUser = (user: StoredUser): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
};
