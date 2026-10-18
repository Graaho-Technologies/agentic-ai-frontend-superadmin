// src/store.ts
import { configureStore } from '@reduxjs/toolkit';
import { userApi } from '@/features/user/userApi';
import { agentApi } from '@/features/agent/agentApi';
import { authApi } from '@/features/auth/authApi';
import { activationApi } from '@/features/activation/activationApi';
import { fileApi } from './features/fileApi';
import { agentTemplateApi } from './features/agentTemplateApi/agentTemplateApi';
import { planApi } from '@/features/plan/planApi';
import { billingApi } from '@/features/subscriptionModel/billing/billingApi';
import { cmsSettingsApi } from '@/features/cmsSettings/cmsSettingsApi';
import { demoUsersApi } from '@/features/demoUsers/demoUsersApi';
import { performanceAnalyticsApi } from '@/features/performanceAnalytics/performanceAnalyticsApi';
import { mlAnalyticsApi } from '@/features/mlAnalytics/mlAnalyticsApi';
import { rbacApi } from '@/features/rbac/rbacApi';
import { orgManagementApi } from '@/features/orgManagement/orgManagementApi';

export const store = configureStore({
  reducer: {
    // RTK Query APIs
    [userApi.reducerPath]: userApi.reducer,
    [agentApi.reducerPath]: agentApi.reducer,
    [authApi.reducerPath]: authApi.reducer,
    [activationApi.reducerPath]: activationApi.reducer,
    [agentTemplateApi.reducerPath]: agentTemplateApi.reducer,
    [fileApi.reducerPath]: fileApi.reducer,
    [planApi.reducerPath]: planApi.reducer,
    [billingApi.reducerPath]: billingApi.reducer,
    [cmsSettingsApi.reducerPath]: cmsSettingsApi.reducer,
    [demoUsersApi.reducerPath]: demoUsersApi.reducer,
    [performanceAnalyticsApi.reducerPath]: performanceAnalyticsApi.reducer,
    [mlAnalyticsApi.reducerPath]: mlAnalyticsApi.reducer,
    [rbacApi.reducerPath]: rbacApi.reducer,
    [orgManagementApi.reducerPath]: orgManagementApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [
          'persist/PERSIST',
          'persist/REHYDRATE',
        ],
      },
    })
    .concat(userApi.middleware)
    .concat(agentApi.middleware)
    .concat(authApi.middleware)
    .concat(activationApi.middleware)
    .concat(agentTemplateApi.middleware)
    .concat(fileApi.middleware)
    .concat(planApi.middleware)
    .concat(billingApi.middleware)
    .concat(cmsSettingsApi.middleware)
    .concat(demoUsersApi.middleware)
    .concat(performanceAnalyticsApi.middleware)
    .concat(mlAnalyticsApi.middleware)
    .concat(rbacApi.middleware)
    .concat(orgManagementApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;