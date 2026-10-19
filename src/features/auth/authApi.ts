import { createApi, BaseQueryFn, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import {
  signIn,
  signUp,
  signOut,
  fetchAuthSession,
  confirmSignUp,
  resendSignUpCode,
  resetPassword,
  confirmResetPassword
} from 'aws-amplify/auth';
import { loginUser, logout } from './authReducer';
import {
  setTokens,
  clearTokens,
  setStoredUser,
  resolveBaseUrl
} from '@/lib/api/baseQueryWithAuth';

// Fix: Make all body properties optional and add country
type AuthArgs = {
  url: string;
  body?: {
    username?: string;
    password?: string;
    confirmationCode?: string;
    name?: string;
    country?: string;
    newPassword?: string;
  };
};

type AdminLoginResponse = {
  message?: string;
  login_timestamp?: string;
  access?: string;       // JWT access token from Django
  refresh?: string;      // JWT refresh token from Django
  token?: string;        // Alternative token field
  user: {
    id: string;
    sub_id?: string;
    email: string;
    full_name: string;
    is_active: boolean;
    role?: string;
  };
};

type AuthResult = {
  access?: string;
  email?: string;
  message?: string;
  nextStep?: { signInStep: string; userAttributes?: Record<string, string> };
  requiresVerification?: boolean;
  country?: string;
  sub_id?: string;
  isAdmin?: boolean;
  username?: string;
  first_name?: string;
  last_name?: string;
  id?: string;
  full_name?: string;
  is_active?: boolean;
  login_timestamp?: string;
  role?: string;
};

type AuthError = {
  status: number;
  data: string;
};

// Custom baseQuery that completely replaces HTTP requests for AWS Cognito
const amplifyBaseQuery: BaseQueryFn<AuthArgs, AuthResult, AuthError> = async (args, api) => {
  try {
    switch (args.url) {
      case 'login': {
        if (!args.body?.username || !args.body?.password) {
          throw new Error('Missing credentials');
        }

        const signInResult = await signIn({
          username: args.body.username,
          password: args.body.password,
        });

        // Handle different sign-in steps
        if (signInResult.nextStep) {
          return { 
            data: { 
              message: 'Additional step required',
              nextStep: signInResult.nextStep 
            } 
          };
        }

        // If sign-in is complete, get the session
        const session = await fetchAuthSession();
        const access = session.tokens?.accessToken?.toString() || '';
        const userData = { access, email: args.body.username };

        // Dispatch to Redux store
        api.dispatch(loginUser(userData));
        return { data: userData };
      }

      case 'register': {
        if (!args.body?.username || !args.body?.password || !args.body?.name) {
          throw new Error('Missing credentials or name');
        }

        // Register with Cognito (WITHOUT custom:country)
        const registrationResponse = await signUp({
          username: args.body.username,
          password: args.body.password,
          options: {
            userAttributes: {
              email: args.body.username,
              name: args.body.name,
              // country: args.body.country,
              // Remove custom:country - we'll store this in the backend later
            }
          },
        });
        
        console.log('Registration response authapi:', registrationResponse);
        console.log('args response:', args);
        
        // Check if verification is required
        const requiresVerification = registrationResponse.nextStep?.signUpStep === 'CONFIRM_SIGN_UP';
        
        return { 
          data: { 
            message: requiresVerification 
              ? 'Registration successful. Please check your email for verification code.' 
              : 'Registration successful.',
            requiresVerification,
            email: args.body.username,
            // Include country in response so frontend can use it when creating user in backend
            country: args.body.country,
            sub_id: registrationResponse.userId
          } 
        };
      }

      case 'confirmSignUp': {
        if (!args.body?.username || !args.body?.confirmationCode) {
          throw new Error('Missing username or confirmation code');
        }

        const confirmResult = await confirmSignUp({
          username: args.body.username,
          confirmationCode: args.body.confirmationCode,
        });
        
        console.log('Confirmation result:', confirmResult);
        
        return { data: { message: 'Email verified successfully' } };
      }

      case 'resendSignUp': {
        if (!args.body?.username) {
          throw new Error('Missing username');
        }

        await resendSignUpCode({
          username: args.body.username,
        });
        return { data: { message: 'Verification code sent' } };
      }

      case 'resetPassword': {
        if (!args.body?.username) {
          throw new Error('Missing username');
        }

        const resetResult = await resetPassword({
          username: args.body.username,
        });
        
        console.log('Password reset result:', resetResult);
        
        return { 
          data: { 
            message: 'Password reset code sent to your email',
            email: args.body.username
          } 
        };
      }

      case 'confirmResetPassword': {
        if (!args.body?.username || !args.body?.confirmationCode || !args.body?.newPassword) {
          throw new Error('Missing username, confirmation code, or new password');
        }

        await confirmResetPassword({
          username: args.body.username,
          confirmationCode: args.body.confirmationCode,
          newPassword: args.body.newPassword,
        });
        
        console.log('Password reset confirmed successfully');
        
        return { data: { message: 'Password reset successful. You can now sign in with your new password.' } };
      }

      case 'logout': {
        await signOut();
        api.dispatch(logout());
        return { data: { message: 'Logged out successfully' } };
      }

      default:
        throw new Error('Invalid endpoint');
    }
  } catch (error: unknown) {
    console.error('Auth API Error:', error);

    // Map Amplify errors to user-friendly messages
    let errorMessage = 'An unknown error occurred';

    if (
      typeof error === 'object' &&
      error !== null &&
      'name' in error &&
      typeof (error as { name: unknown }).name === 'string'
    ) {
      const errorName = (error as { name: string }).name;
      if (errorName === 'UserNotConfirmedException') {
        errorMessage = 'Please verify your email address before signing in.';
      } else if (errorName === 'NotAuthorizedException') {
        errorMessage = 'Invalid email or password.';
      } else if (errorName === 'UserNotFoundException') {
        errorMessage = 'Account not found. Please check your email or create an account.';
      } else if (errorName === 'CodeMismatchException') {
        errorMessage = 'Invalid verification code.';
      } else if (errorName === 'ExpiredCodeException') {
        errorMessage = 'Verification code has expired. Please request a new one.';
      } else if (errorName === 'UsernameExistsException') {
        errorMessage = 'An account with this email already exists.';
      } else if (errorName === 'InvalidPasswordException') {
        errorMessage = 'Password does not meet requirements. Password must be at least 8 characters with uppercase, lowercase, number, and special character.';
      } else if (errorName === 'InvalidParameterException') {
        errorMessage = 'Invalid parameters provided.';
      } else if (errorName === 'LimitExceededException') {
        errorMessage = 'Too many attempts. Please try again later.';
      }
    }

    if (
      typeof error === 'object' &&
      error !== null &&
      'message' in error &&
      typeof (error as { message: unknown }).message === 'string'
    ) {
      errorMessage = (error as { message: string }).message;
    }

    return {
      error: {
        status: 400,
        data: errorMessage,
      },
    };
  }
};

// Django baseQuery for admin authentication
const djangoBaseQuery = fetchBaseQuery({
  baseUrl: resolveBaseUrl(),
  prepareHeaders: (headers) => {
    headers.set('Content-Type', 'application/json');
    return headers;
  },
});

export const authApi = createApi({
  reducerPath: 'authApi',
  baseQuery: amplifyBaseQuery,
  tagTypes: ['Auth'],
  endpoints: (builder) => ({
    login: builder.mutation<AuthResult, { username: string; password: string }>({
      query: (credentials) => ({ 
        url: 'login', 
        body: credentials 
      }),
    }),
    register: builder.mutation<AuthResult, { username: string; password: string; name: string; country?: string }>({
      query: (credentials) => ({ 
        url: 'register', 
        body: credentials 
      }),
    }),
    confirmSignUp: builder.mutation<AuthResult, { username: string; confirmationCode: string }>({
      query: (data) => ({ 
        url: 'confirmSignUp', 
        body: data 
      }),
    }),
    resendSignUp: builder.mutation<AuthResult, { username: string }>({
      query: (data) => ({ 
        url: 'resendSignUp', 
        body: data 
      }),
    }),
    resetPassword: builder.mutation<AuthResult, { username: string }>({
      query: (data) => ({ 
        url: 'resetPassword', 
        body: data 
      }),
    }),
    confirmResetPassword: builder.mutation<AuthResult, { username: string; confirmationCode: string; newPassword: string }>({
      query: (data) => ({ 
        url: 'confirmResetPassword', 
        body: data 
      }),
    }),
    logout: builder.mutation<AuthResult, void>({
      query: () => ({ url: 'logout' }),
    }),

    // Django Admin Login - with JWT Token Support
    adminLogin: builder.mutation<AuthResult, { email: string; password: string }>({
      queryFn: async (credentials, api) => {
        try {
          const result = await djangoBaseQuery(
            {
              url: 'login/',
              method: 'POST',
              body: credentials,
            },
            api,
            {}
          );

          if (result.error) {
            const errorData = result.error.data as unknown;
            let errorMessage = 'Login failed';

            if (typeof errorData === 'object' && errorData !== null) {
              const e = errorData as { non_field_errors?: string[]; detail?: string };
              if (e.non_field_errors?.length) errorMessage = e.non_field_errors[0];
              else if (e.detail) errorMessage = e.detail;
            } else if (typeof errorData === 'string') {
              errorMessage = errorData;
            }

            return {
              error: {
                status: typeof result.error.status === 'number' ? result.error.status : 500,
                data: errorMessage,
              },
            };
          }

          const response = result.data as AdminLoginResponse;

          if (!response?.user) {
            return {
              error: { status: 400, data: 'Invalid response format from server' },
            };
          }

          const user = response.user;

          // Extract tokens from response (Django JWT returns access/refresh tokens)
          const accessToken = response.access || response.token || '';
          const refreshToken = response.refresh || '';

          // Store JWT tokens if available
          if (accessToken) {
            setTokens(accessToken, refreshToken);
            console.log('[Auth] JWT tokens stored successfully');
          }

          // Store user data
          const storedUser = {
            id: user.id,
            sub_id: user.sub_id,
            email: user.email,
            full_name: user.full_name,
            is_active: user.is_active,
            role: user.role || 'super_admin',
          };
          setStoredUser(storedUser);

          const adminUserData = {
            access: accessToken || 'admin_session',
            email: user.email,
            username: user.email,
            isAdmin: true,
            id: user.id,
            sub_id: user.sub_id || '',
            full_name: user.full_name,
            first_name: user.full_name.split(' ')[0],
            last_name: user.full_name.split(' ').slice(1).join(' '),
            is_active: user.is_active,
            role: user.role || 'super_admin',
            message: response.message || 'Admin login successful',
            login_timestamp: response.login_timestamp || new Date().toISOString(),
          };

          // Also keep backward compatibility with existing storage keys
          localStorage.setItem('adminUser', JSON.stringify(adminUserData));
          localStorage.setItem('isAdminLoggedIn', 'true');
          localStorage.setItem('isSuperAdminLoggedIn', 'true');
          api.dispatch(loginUser(adminUserData));

          return { data: adminUserData };
        } catch (error) {
          console.error('Admin login error:', error);
          return { error: { status: 500, data: 'Network error. Please try again.' } };
        }
      },
    }),

    // Django Admin Logout
    adminLogout: builder.mutation<AuthResult, void>({
      queryFn: async (_, api) => {
        try {
          // Clear all tokens and user data
          clearTokens();
          localStorage.removeItem('adminUser');
          localStorage.removeItem('isAdminLoggedIn');

          // Make request to Django admin logout endpoint
          await djangoBaseQuery(
            {
              url: 'admin/logout/',
              method: 'POST',
            },
            api,
            {}
          );

          // Dispatch logout to Redux store
          api.dispatch(logout());

          // Return a type-safe AuthResult
          return {
            data: {
              access: undefined,
              email: undefined,
              username: undefined,
              first_name: undefined,
              last_name: undefined,
              id: undefined,
              sub_id: undefined,
              full_name: undefined,
              is_active: undefined,
              login_timestamp: new Date().toISOString(),
              isAdmin: false,
              country: undefined,
              role: undefined,
              message: 'Admin logged out successfully',
            },
          };
        } catch (error) {
          console.error('Admin logout error:', error);
          // Still clear local state even if server request fails
          clearTokens();
          localStorage.removeItem('adminUser');
          localStorage.removeItem('isAdminLoggedIn');
          api.dispatch(logout());

          return {
            data: {
              access: undefined,
              email: undefined,
              username: undefined,
              first_name: undefined,
              last_name: undefined,
              id: undefined,
              sub_id: undefined,
              full_name: undefined,
              is_active: undefined,
              login_timestamp: new Date().toISOString(),
              isAdmin: false,
              country: undefined,
              role: undefined,
              message: 'Logged out locally',
            },
          };
        }
      },
    }),
  }),
});

export const {
  useLoginMutation,
  useRegisterMutation,
  useConfirmSignUpMutation,
  useResendSignUpMutation,
  useResetPasswordMutation,
  useConfirmResetPasswordMutation,
  useLogoutMutation,
  useAdminLoginMutation,
  useAdminLogoutMutation,
} = authApi;