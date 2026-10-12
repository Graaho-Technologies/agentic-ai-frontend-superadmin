import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { getAccessToken } from "@/lib/api/baseQueryWithAuth";

// Get ML API Base URL based on environment
export const getMlApiBaseUrl = (): string => {
  const env = process.env.NEXT_PUBLIC_ENV || "dev";

  if (env === "prod" || env === "production") {
    return process.env.NEXT_PUBLIC_PROD_ML_API_BASE_URL || "https://mlapi.koronik.ai";
  }

  // Default to dev
  return process.env.NEXT_PUBLIC_DEV_ML_API_BASE_URL || "https://mlapi-dev.koronik.ai";
};

// Types for ML Analytics - Based on actual API responses

// Per-model token + cost usage. cost_usd is a decimal string from the API.
export interface MLModelUsage {
  model: string;
  input_tokens: number;
  cached_input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cost_usd: string | null;
}

// Token accounting + cost, returned on the overview, the summary, and each
// endpoint row. Optional: the dev ML API may not return these yet.
export interface MLTokenBreakdown {
  input_tokens?: number;
  cached_input_tokens?: number;
  output_tokens?: number;
  cost_usd?: string | null;
  unpriced_requests?: number;
  untracked_tokens?: number;
  models?: MLModelUsage[];
}

// Overview Response
export interface MLMetricsOverview extends MLTokenBreakdown {
  agent_id: string;
  date_from: string;
  date_to: string;
  total_requests: number;
  total_errors: number;
  error_rate: number;
  avg_response_ms: number;
  last_request_at: string | null;
  endpoints_tracked: number;
  total_tokens?: number;
  top_endpoint: {
    endpoint: string;
    method: string;
    request_count: number;
  } | null;
}

// Endpoint item in summary
export interface MLEndpointItem extends MLTokenBreakdown {
  endpoint: string;
  method: string;
  criticality: "crucial" | "important" | "normal";
  request_count: number;
  error_count: number;
  error_rate: number;
  avg_response_ms: number;
  max_response_ms: number;
  total_tokens: number;
  last_request_at: string | null;
  last_status_code: number | null;
}

// Summary Response
export interface MLMetricsSummary extends MLTokenBreakdown {
  agent_id: string;
  date_from: string;
  date_to: string;
  total_requests: number;
  total_tokens?: number;
  endpoints: MLEndpointItem[];
}

// Daily data point for endpoint timeseries
export interface MLDailyDataPoint {
  date: string;
  request_count: number;
  error_count: number;
  error_rate: number;
  avg_response_ms: number;
  max_response_ms: number;
  total_tokens: number;
  last_request_at: string | null;
  last_status_code: number | null;
}

// Endpoint Timeseries Response
export interface MLEndpointTimeseriesResponse {
  agent_id: string;
  endpoint: string;
  method: string;
  criticality: "crucial" | "important" | "normal";
  date_from: string;
  date_to: string;
  daily: MLDailyDataPoint[];
}

// Request params
interface MLDateRangeParams {
  date_from?: string;
  date_to?: string;
}

interface MLEndpointParams extends MLDateRangeParams {
  endpoint: string;
  method?: string;
}

// ML API Base Query with auth
const mlApiBaseQuery = fetchBaseQuery({
  baseUrl: getMlApiBaseUrl(),
  mode: "cors",
  prepareHeaders: (headers) => {
    const token = getAccessToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    headers.set("Content-Type", "application/json");
    headers.set("Accept", "application/json");
    return headers;
  },
});

export const mlAnalyticsApi = createApi({
  reducerPath: "mlAnalyticsApi",
  baseQuery: mlApiBaseQuery,
  tagTypes: ["MLMetrics"],
  endpoints: (builder) => ({
    // Get ML Metrics Summary for an agent
    getMLMetricsSummary: builder.query<MLMetricsSummary, { agent_id: string } & MLDateRangeParams>({
      query: ({ agent_id, ...params }) => ({
        url: `/api/metrics/${agent_id}/summary`,
        method: "GET",
        params,
      }),
      providesTags: ["MLMetrics"],
    }),

    // Get ML Metrics Overview for an agent
    getMLMetricsOverview: builder.query<
      MLMetricsOverview,
      { agent_id: string } & MLDateRangeParams
    >({
      query: ({ agent_id, ...params }) => ({
        url: `/api/metrics/${agent_id}/overview`,
        method: "GET",
        params,
      }),
      providesTags: ["MLMetrics"],
    }),

    // Get ML Endpoint Timeseries data
    getMLEndpointTimeseries: builder.query<
      MLEndpointTimeseriesResponse,
      { agent_id: string } & MLEndpointParams
    >({
      query: ({ agent_id, ...params }) => ({
        url: `/api/metrics/${agent_id}/endpoint`,
        method: "GET",
        params,
      }),
      providesTags: ["MLMetrics"],
    }),
  }),
});

export const {
  useGetMLMetricsSummaryQuery,
  useGetMLMetricsOverviewQuery,
  useGetMLEndpointTimeseriesQuery,
} = mlAnalyticsApi;
