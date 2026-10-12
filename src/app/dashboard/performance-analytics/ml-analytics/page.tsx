"use client";

import React, { useState, useMemo } from "react";
import {
  useGetMLMetricsOverviewQuery,
  useGetMLMetricsSummaryQuery,
  useGetMLEndpointTimeseriesQuery,
  MLEndpointItem,
  MLModelUsage,
} from "@/features/mlAnalytics/mlAnalyticsApi";
import { useGetAgentsListQuery } from "@/features/performanceAnalytics/performanceAnalyticsApi";
import { PageHeader, StatCard, ChartCard, SearchableSelect, SearchableSelectOption } from "@/components/performance-analytics/shared";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from "recharts";

const CHART_COLORS = {
  success: "#10B981",
  error: "#EF4444",
  latency: "#8B5CF6",
  requests: "#3B82F6",
  tokens: "#F59E0B",
};

const CRITICALITY_COLORS = {
  crucial: "bg-red-100 text-red-700",
  important: "bg-yellow-100 text-yellow-700",
  normal: "bg-gray-100 text-gray-700",
};

// Format a possibly-missing token count for display.
const formatNumber = (n?: number | null): string => (n ?? 0).toLocaleString();

// cost_usd arrives as a decimal string or null. Parse to a number, or null if unparseable.
const parseCost = (c?: string | null): number | null => {
  if (c === null || c === undefined) return null;
  const parsed = Number(c);
  return Number.isNaN(parsed) ? null : parsed;
};

// Render a parsed cost (or null) as a dollar figure.
const formatCost = (n: number | null): string => {
  if (n === null) return "—";
  return `$${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: n > 0 && n < 1 ? 6 : 2,
  })}`;
};

// Sum cost across models that carry a parseable cost; null when none do.
const sumModelCost = (models?: MLModelUsage[]): number | null => {
  if (!models || models.length === 0) return null;
  let total = 0;
  let hasCost = false;
  for (const m of models) {
    const cost = parseCost(m.cost_usd);
    if (cost !== null) {
      total += cost;
      hasCost = true;
    }
  }
  return hasCost ? total : null;
};

// Percentage of `part` out of `whole`, guarding a zero/undefined whole.
const percent = (part?: number, whole?: number): string => {
  if (!whole) return "0.0%";
  return `${(((part ?? 0) / whole) * 100).toFixed(1)}%`;
};

export default function MLAnalyticsPage() {
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [selectedEndpoint, setSelectedEndpoint] = useState<MLEndpointItem | null>(null);
  const [dateRange, setDateRange] = useState({
    from: "",
    to: "",
  });
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  const toggleExpanded = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Fetch agents list
  const {
    data: agentsData,
    isLoading: agentsLoading,
  } = useGetAgentsListQuery({});

  // Transform agents data for SearchableSelect
  const agentOptions: SearchableSelectOption[] = useMemo(() => {
    if (!agentsData?.data) return [];
    return agentsData.data.map((agent) => ({
      value: agent.id,
      label: agent.name,
      subLabel: agent.organization_name,
    }));
  }, [agentsData]);

  // Date params for API calls
  const dateParams = useMemo(() => {
    const params: { date_from?: string; date_to?: string } = {};
    if (dateRange.from) params.date_from = dateRange.from;
    if (dateRange.to) params.date_to = dateRange.to;
    return params;
  }, [dateRange]);

  // Fetch ML metrics when agent is selected
  const {
    data: overview,
    isLoading: overviewLoading,
    isFetching: overviewFetching,
    refetch: refetchOverview,
  } = useGetMLMetricsOverviewQuery(
    { agent_id: selectedAgentId, ...dateParams },
    { skip: !selectedAgentId }
  );

  const {
    data: summary,
    isLoading: summaryLoading,
    isFetching: summaryFetching,
    refetch: refetchSummary,
  } = useGetMLMetricsSummaryQuery(
    { agent_id: selectedAgentId, ...dateParams },
    { skip: !selectedAgentId }
  );

  // Fetch timeseries for selected endpoint
  const {
    data: timeseries,
    isLoading: timeseriesLoading,
    isFetching: timeseriesFetching,
  } = useGetMLEndpointTimeseriesQuery(
    {
      agent_id: selectedAgentId,
      endpoint: selectedEndpoint?.endpoint || "/api/chat",
      method: selectedEndpoint?.method || "POST",
      ...dateParams
    },
    { skip: !selectedAgentId || !selectedEndpoint }
  );

  const isAnyLoading = overviewLoading || summaryLoading;
  const isAnyFetching = overviewFetching || summaryFetching;

  const handleRefresh = () => {
    if (selectedAgentId) {
      refetchOverview();
      refetchSummary();
    }
  };

  // Fallback: sum tokens across endpoints, used when neither overview nor
  // summary carries a top-level total_tokens.
  const endpointTokenSum = useMemo(() => {
    if (!summary?.endpoints) return 0;
    return summary.endpoints.reduce((sum, ep) => sum + ep.total_tokens, 0);
  }, [summary]);

  // Token + cost breakdown block. Overview and summary carry identical
  // values; overview is the page's primary source.
  const usage = useMemo(() => overview ?? summary, [overview, summary]);

  const totalTokens = useMemo(
    () => overview?.total_tokens ?? summary?.total_tokens ?? endpointTokenSum,
    [overview, summary, endpointTokenSum]
  );

  const modelCostTotal = useMemo(() => sumModelCost(usage?.models), [usage]);
  const reportedCost = useMemo(() => parseCost(usage?.cost_usd), [usage]);
  const displayCost = reportedCost ?? modelCostTotal;
  const models = useMemo(() => usage?.models ?? [], [usage]);

  // Caveats that qualify the cost figure. The ML API leaves cost unattributed
  // when tokens carry no model, so the figure is not always the full spend.
  const costNotices = useMemo(() => {
    const notes: string[] = [];
    if ((usage?.untracked_tokens ?? 0) > 0) {
      notes.push(
        `${formatNumber(usage?.untracked_tokens)} tokens (${percent(usage?.untracked_tokens, totalTokens)} of total) carry no model attribution.`
      );
    }
    if ((usage?.unpriced_requests ?? 0) > 0) {
      notes.push(`${formatNumber(usage?.unpriced_requests)} requests were not priced.`);
    }
    if (reportedCost === null) {
      notes.push(
        modelCostTotal !== null
          ? "The ML API reported no total cost, so the cost shown is the sum of the priced models only."
          : "The ML API reported no cost for this period."
      );
    }
    return notes;
  }, [usage, totalTokens, reportedCost, modelCostTotal]);

  // Get max response from endpoints
  const maxResponse = useMemo(() => {
    if (!summary?.endpoints?.length) return 0;
    return Math.max(...summary.endpoints.map(ep => ep.max_response_ms));
  }, [summary]);

  // Prepare chart data for endpoint breakdown
  const endpointBreakdownData = useMemo(() => {
    if (!summary?.endpoints) return [];
    return summary.endpoints.map((ep) => ({
      name: ep.endpoint.length > 25 ? ep.endpoint.substring(0, 25) + "..." : ep.endpoint,
      fullName: ep.endpoint,
      method: ep.method,
      requests: ep.request_count,
      avgLatency: ep.avg_response_ms,
      errorRate: ep.error_rate,
      tokens: ep.total_tokens,
    }));
  }, [summary]);

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  // Format datetime for display
  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return "N/A";
    const date = new Date(dateStr);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Page Header */}
      <PageHeader
        title="ML Server Analytics"
        description="Monitor ML API performance, latency, success rates, and usage metrics"
        icon={
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14zM9 8h2v8H9zm4 3h2v5h-2zm-8 2h2v3H5zm12-5h2v8h-2z"/>
          </svg>
        }
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Performance Analytics", href: "/dashboard/performance-analytics" },
          { label: "ML Analytics" },
        ]}
      />

      {/* Filter Bar */}
      <div className="px-6 mt-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="flex flex-wrap items-end gap-4">
            {/* Agent Selector */}
            <div className="flex-1 min-w-[250px]">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Select Agent
              </label>
              <SearchableSelect
                options={agentOptions}
                value={selectedAgentId}
                onChange={(value) => {
                  setSelectedAgentId(value);
                  setSelectedEndpoint(null);
                }}
                placeholder="Search and select an agent..."
                disabled={false}
                isLoading={agentsLoading}
              />
            </div>

            {/* Date From */}
            <div className="min-w-[180px]">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                From Date
              </label>
              <input
                type="date"
                value={dateRange.from}
                onChange={(e) => setDateRange((prev) => ({ ...prev, from: e.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white"
              />
            </div>

            {/* Date To */}
            <div className="min-w-[180px]">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                To Date
              </label>
              <input
                type="date"
                value={dateRange.to}
                onChange={(e) => setDateRange((prev) => ({ ...prev, to: e.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white"
              />
            </div>

            {/* Refresh Button */}
            <div>
              <button
                onClick={handleRefresh}
                disabled={isAnyLoading || isAnyFetching || !selectedAgentId}
                className="px-4 py-2.5 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <svg
                  className={`w-4 h-4 ${isAnyFetching ? "animate-spin" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* No Agent Selected State */}
      {!selectedAgentId && (
        <div className="px-6 mt-6">
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-purple-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Select an Agent to View Analytics</h3>
            <p className="text-gray-500 max-w-md mx-auto">
              Choose an agent from the dropdown above to view ML server performance metrics,
              latency data, and usage statistics.
            </p>
          </div>
        </div>
      )}

      {/* Stats Cards - Only show when agent is selected */}
      {selectedAgentId && (
        <>
          {/* Date Range Info */}
          {overview && (
            <div className="px-6 mt-4">
              <div className="bg-purple-50 border border-purple-200 rounded-lg px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm font-medium text-purple-800">
                    Data Period: {formatDate(overview.date_from)} - {formatDate(overview.date_to)}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-purple-600">
                    {overview.endpoints_tracked} endpoints tracked
                  </span>
                  <span className="text-xs text-purple-600">
                    Last request: {formatDateTime(overview.last_request_at)}
                  </span>
                </div>
              </div>
            </div>
          )}

          <div className="px-6 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title="Total Requests"
                value={overview?.total_requests || 0}
                icon={
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14h-2V9h2v8zm4 0h-2V7h2v10zm-8 0H6v-5h2v5z"/>
                  </svg>
                }
                color="blue"
                isLoading={overviewLoading || overviewFetching}
                description="Total ML API calls"
              />
              <StatCard
                title="Avg Response"
                value={(overview?.avg_response_ms || 0).toFixed(1)}
                suffix="ms"
                icon={
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/>
                  </svg>
                }
                color="purple"
                isLoading={overviewLoading || overviewFetching}
                description="Average response time"
              />
              <StatCard
                title="Max Response"
                value={maxResponse.toFixed(0)}
                suffix="ms"
                icon={
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>
                  </svg>
                }
                color="orange"
                isLoading={summaryLoading || summaryFetching}
                description="Maximum response time"
              />
              <StatCard
                title="Errors"
                value={overview?.total_errors ?? 0}
                icon={
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
                  </svg>
                }
                color={(overview?.total_errors ?? 0) > 0 ? "red" : "green"}
                isLoading={overviewLoading || overviewFetching}
                description={`${((overview?.error_rate ?? 0) * 100).toFixed(2)}% error rate`}
              />
            </div>
          </div>

          {/* Token & Cost Stat Cards */}
          <div className="px-6 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title="Total Tokens"
                value={formatNumber(totalTokens)}
                icon={
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M4 4h7v7H4V4zm9 0h7v7h-7V4zM4 13h7v7H4v-7zm9 0h7v7h-7v-7z"/>
                  </svg>
                }
                color="teal"
                isLoading={overviewLoading || overviewFetching || summaryLoading || summaryFetching}
                description="Input + output + untracked"
              />
              <StatCard
                title="Input Tokens"
                value={formatNumber(usage?.input_tokens)}
                icon={
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                  </svg>
                }
                color="blue"
                isLoading={overviewLoading || overviewFetching || summaryLoading || summaryFetching}
                description={`${formatNumber(usage?.cached_input_tokens)} cached (${percent(usage?.cached_input_tokens, usage?.input_tokens)})`}
              />
              <StatCard
                title="Output Tokens"
                value={formatNumber(usage?.output_tokens)}
                icon={
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5z"/>
                  </svg>
                }
                color="indigo"
                isLoading={overviewLoading || overviewFetching || summaryLoading || summaryFetching}
                description="Generated tokens"
              />
              <StatCard
                title="Est. Cost"
                value={formatCost(displayCost)}
                icon={
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05.82 1.87 2.65 1.87 1.96 0 2.4-.98 2.4-1.59 0-.83-.44-1.61-2.67-2.14-2.48-.6-4.18-1.62-4.18-3.67 0-1.72 1.39-2.84 3.11-3.21V4h2.67v1.95c1.86.45 2.79 1.86 2.85 3.39H14.3c-.05-1.11-.64-1.87-2.22-1.87-1.5 0-2.4.68-2.4 1.64 0 .84.65 1.39 2.67 1.91s4.18 1.39 4.18 3.91c-.01 1.83-1.38 2.83-3.12 3.16z"/>
                  </svg>
                }
                color="green"
                isLoading={overviewLoading || overviewFetching || summaryLoading || summaryFetching}
                description={
                  reportedCost !== null
                    ? "Reported by ML API"
                    : modelCostTotal !== null
                    ? "Sum of priced models · partial"
                    : "Not priced"
                }
              />
            </div>
          </div>

          {/* Top Endpoint Banner */}
          {overview?.top_endpoint && (
            <div className="px-6 mt-4">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-blue-800">Top Endpoint</p>
                      <p className="text-xs text-blue-600 font-mono">
                        <span className="px-1.5 py-0.5 bg-blue-100 rounded text-blue-700 mr-2">
                          {overview.top_endpoint.method}
                        </span>
                        {overview.top_endpoint.endpoint}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-blue-700">{overview.top_endpoint.request_count}</p>
                    <p className="text-xs text-blue-600">requests</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Token & Cost Breakdown */}
          <div className="px-6 mt-6">
            <ChartCard
              title="Token & Cost Breakdown"
              description="How this agent's tokens and spend break down for the selected period"
              isLoading={overviewLoading || overviewFetching || summaryLoading || summaryFetching}
              isEmpty={!usage}
            >
              <div className="space-y-6">
                {/* Composition bar */}
                <div>
                  <div className="flex h-4 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="bg-blue-500"
                      style={{ width: percent(usage?.input_tokens, totalTokens) }}
                      title="Input"
                    />
                    <div
                      className="bg-indigo-500"
                      style={{ width: percent(usage?.output_tokens, totalTokens) }}
                      title="Output"
                    />
                    <div
                      className="bg-gray-400"
                      style={{ width: percent(usage?.untracked_tokens, totalTokens) }}
                      title="Untracked"
                    />
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>Input
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>Output
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full bg-gray-400"></span>Untracked
                    </span>
                  </div>
                </div>

                {/* Figures */}
                <dl className="divide-y divide-gray-100 text-sm">
                  <div className="flex items-center justify-between py-2">
                    <dt className="text-gray-600">Input tokens</dt>
                    <dd className="font-medium text-gray-900">{formatNumber(usage?.input_tokens)}</dd>
                  </div>
                  <div className="flex items-center justify-between py-2 pl-4">
                    <dt className="text-gray-500">of which cached</dt>
                    <dd className="text-gray-700">
                      {formatNumber(usage?.cached_input_tokens)}{" "}
                      <span className="text-gray-400">
                        ({percent(usage?.cached_input_tokens, usage?.input_tokens)} of input)
                      </span>
                    </dd>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <dt className="text-gray-600">Output tokens</dt>
                    <dd className="font-medium text-gray-900">{formatNumber(usage?.output_tokens)}</dd>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <dt className="text-gray-600">Untracked tokens</dt>
                    <dd className="font-medium text-gray-900">
                      {formatNumber(usage?.untracked_tokens)}{" "}
                      <span className="text-gray-400 text-xs">
                        ({percent(usage?.untracked_tokens, totalTokens)} of total)
                      </span>
                    </dd>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <dt className="font-semibold text-gray-900">Total tokens</dt>
                    <dd className="font-bold text-gray-900">{formatNumber(totalTokens)}</dd>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <dt className="text-gray-600">Cost</dt>
                    <dd className="font-medium text-gray-900">{formatCost(displayCost)}</dd>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <dt className="text-gray-600">Unpriced requests</dt>
                    <dd className="font-medium text-gray-900">{formatNumber(usage?.unpriced_requests)}</dd>
                  </div>
                </dl>

                {costNotices.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
                    {costNotices.join(" ")}
                  </div>
                )}
              </div>
            </ChartCard>
          </div>

          {/* Model Usage Table */}
          <div className="px-6 mt-6">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Model Usage</h3>
                <p className="text-sm text-gray-500">Token consumption and cost per model</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Model</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Input Tokens</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Cached Input</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Output Tokens</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Tokens</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Cost (USD)</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {models.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                          No model usage reported for this period.
                        </td>
                      </tr>
                    ) : (
                      models.map((m) => (
                        <tr key={m.model}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <code className="text-sm text-gray-900 font-mono">{m.model}</code>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                            {formatNumber(m.input_tokens)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                            {formatNumber(m.cached_input_tokens)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                            {formatNumber(m.output_tokens)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                            {formatNumber(m.total_tokens)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                            {formatCost(parseCost(m.cost_usd))}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {models.length > 0 && (
                    <tfoot className="bg-gray-50">
                      <tr>
                        <td className="px-6 py-3 text-sm font-semibold text-gray-900">Total</td>
                        <td className="px-6 py-3 text-sm font-semibold text-gray-900 text-right">
                          {formatNumber(models.reduce((sum, m) => sum + m.input_tokens, 0))}
                        </td>
                        <td className="px-6 py-3 text-sm font-semibold text-gray-900 text-right">
                          {formatNumber(models.reduce((sum, m) => sum + m.cached_input_tokens, 0))}
                        </td>
                        <td className="px-6 py-3 text-sm font-semibold text-gray-900 text-right">
                          {formatNumber(models.reduce((sum, m) => sum + m.output_tokens, 0))}
                        </td>
                        <td className="px-6 py-3 text-sm font-semibold text-gray-900 text-right">
                          {formatNumber(models.reduce((sum, m) => sum + m.total_tokens, 0))}
                        </td>
                        <td className="px-6 py-3 text-sm font-semibold text-gray-900 text-right">
                          {formatCost(modelCostTotal)}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </div>

          {/* Endpoint Performance Table */}
          <div className="px-6 mt-6">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900">Endpoint Performance</h3>
                <p className="text-sm text-gray-500">Click on an endpoint to view detailed timeseries data</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-3 w-10"></th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Endpoint</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Method</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Criticality</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Requests</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Errors</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Response</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Max Response</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Tokens</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Cost</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Last Request</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {summaryLoading || summaryFetching ? (
                      <tr>
                        <td colSpan={11} className="px-6 py-8 text-center text-gray-500">
                          <div className="flex items-center justify-center gap-2">
                            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Loading endpoints...
                          </div>
                        </td>
                      </tr>
                    ) : !summary?.endpoints?.length ? (
                      <tr>
                        <td colSpan={11} className="px-6 py-8 text-center text-gray-500">
                          No endpoint data available
                        </td>
                      </tr>
                    ) : (
                      summary.endpoints.map((endpoint) => {
                        const key = `${endpoint.endpoint}-${endpoint.method}`;
                        const isExpanded = expandedKeys.has(key);
                        const endpointCost = parseCost(endpoint.cost_usd) ?? sumModelCost(endpoint.models);
                        return (
                          <React.Fragment key={key}>
                            <tr
                              onClick={() => setSelectedEndpoint(endpoint)}
                              className={`cursor-pointer transition-colors ${
                                selectedEndpoint?.endpoint === endpoint.endpoint && selectedEndpoint?.method === endpoint.method
                                  ? "bg-purple-50"
                                  : "hover:bg-gray-50"
                              }`}
                            >
                              <td className="px-3 py-4 whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleExpanded(key);
                                  }}
                                  aria-label={isExpanded ? "Collapse endpoint details" : "Expand endpoint details"}
                                  aria-expanded={isExpanded}
                                  className="p-1 rounded hover:bg-gray-200 transition-colors"
                                >
                                  <svg
                                    className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                  </svg>
                                </button>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <code className="text-sm text-gray-900 font-mono">{endpoint.endpoint}</code>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-center">
                                <span className={`px-2 py-1 text-xs font-medium rounded ${
                                  endpoint.method === "GET" ? "bg-green-100 text-green-700" :
                                  endpoint.method === "POST" ? "bg-blue-100 text-blue-700" :
                                  endpoint.method === "PUT" ? "bg-yellow-100 text-yellow-700" :
                                  endpoint.method === "DELETE" ? "bg-red-100 text-red-700" :
                                  "bg-gray-100 text-gray-700"
                                }`}>
                                  {endpoint.method}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-center">
                                <span className={`px-2 py-1 text-xs font-medium rounded capitalize ${CRITICALITY_COLORS[endpoint.criticality]}`}>
                                  {endpoint.criticality}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-medium">
                                {endpoint.request_count.toLocaleString()}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right">
                                <span className={`text-sm font-medium ${endpoint.error_count > 0 ? "text-red-600" : "text-green-600"}`}>
                                  {endpoint.error_count}
                                </span>
                                <div className="text-xs text-gray-400">
                                  {(endpoint.error_rate * 100).toFixed(2)}%
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                                {endpoint.avg_response_ms.toFixed(1)}ms
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                                {endpoint.max_response_ms}ms
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                                {endpoint.total_tokens.toLocaleString()}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                                {formatCost(endpointCost)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">
                                {formatDateTime(endpoint.last_request_at)}
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr key={`${key}-detail`} className="bg-gray-50">
                                <td colSpan={11} className="px-6 py-4">
                                  <div className="flex flex-wrap gap-3 mb-3">
                                    <div className="bg-white border border-gray-200 rounded-lg px-3 py-2">
                                      <p className="text-xs text-gray-500 uppercase tracking-wider">Input</p>
                                      <p className="text-sm font-semibold text-gray-900">{formatNumber(endpoint.input_tokens)}</p>
                                    </div>
                                    <div className="bg-white border border-gray-200 rounded-lg px-3 py-2">
                                      <p className="text-xs text-gray-500 uppercase tracking-wider">Cached Input</p>
                                      <p className="text-sm font-semibold text-gray-900">{formatNumber(endpoint.cached_input_tokens)}</p>
                                    </div>
                                    <div className="bg-white border border-gray-200 rounded-lg px-3 py-2">
                                      <p className="text-xs text-gray-500 uppercase tracking-wider">Output</p>
                                      <p className="text-sm font-semibold text-gray-900">{formatNumber(endpoint.output_tokens)}</p>
                                    </div>
                                    <div className="bg-white border border-gray-200 rounded-lg px-3 py-2">
                                      <p className="text-xs text-gray-500 uppercase tracking-wider">Untracked</p>
                                      <p className="text-sm font-semibold text-gray-900">{formatNumber(endpoint.untracked_tokens)}</p>
                                    </div>
                                    <div className="bg-white border border-gray-200 rounded-lg px-3 py-2">
                                      <p className="text-xs text-gray-500 uppercase tracking-wider">Total Tokens</p>
                                      <p className="text-sm font-semibold text-gray-900">{formatNumber(endpoint.total_tokens)}</p>
                                    </div>
                                    <div className="bg-white border border-gray-200 rounded-lg px-3 py-2">
                                      <p className="text-xs text-gray-500 uppercase tracking-wider">Unpriced Requests</p>
                                      <p className="text-sm font-semibold text-gray-900">{formatNumber(endpoint.unpriced_requests)}</p>
                                    </div>
                                    <div className="bg-white border border-gray-200 rounded-lg px-3 py-2">
                                      <p className="text-xs text-gray-500 uppercase tracking-wider">Last Status Code</p>
                                      <p className="text-sm font-semibold text-gray-900">{endpoint.last_status_code ?? "N/A"}</p>
                                    </div>
                                  </div>

                                  {!endpoint.models?.length ? (
                                    <p className="text-sm text-gray-500">No model usage reported for this endpoint.</p>
                                  ) : (
                                    <div className="overflow-x-auto">
                                      <table className="min-w-full divide-y divide-gray-200 bg-white rounded-lg border border-gray-200">
                                        <thead className="bg-gray-100">
                                          <tr>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Model</th>
                                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Input</th>
                                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Cached</th>
                                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Output</th>
                                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Cost</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                          {endpoint.models.map((m) => (
                                            <tr key={m.model}>
                                              <td className="px-4 py-2 text-sm font-mono text-gray-900">{m.model}</td>
                                              <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatNumber(m.input_tokens)}</td>
                                              <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatNumber(m.cached_input_tokens)}</td>
                                              <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatNumber(m.output_tokens)}</td>
                                              <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatNumber(m.total_tokens)}</td>
                                              <td className="px-4 py-2 text-sm text-gray-900 text-right">{formatCost(parseCost(m.cost_usd))}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Endpoint Timeseries Chart - Only show when endpoint is selected */}
          {selectedEndpoint && (
            <div className="px-6 mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Latency Trend Chart */}
              <ChartCard
                title={`Latency Trend - ${selectedEndpoint.endpoint}`}
                description={`${selectedEndpoint.method} request latency over time`}
                isLoading={timeseriesLoading || timeseriesFetching}
                isEmpty={!timeseries?.daily?.length}
                className="lg:col-span-2"
              >
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={timeseries?.daily?.map((d) => ({ ...d, date: formatDate(d.date) })) || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="date" tick={{ fontSize: 12, fill: "#6B7280" }} />
                    <YAxis tick={{ fontSize: 12, fill: "#6B7280" }} tickFormatter={(v) => `${v}ms`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#fff", border: "1px solid #E5E7EB", borderRadius: "8px" }}
                      formatter={(value: number, name: string) => [
                        `${value.toFixed(1)}ms`,
                        name === "avg_response_ms" ? "Avg Response" : "Max Response"
                      ]}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="avg_response_ms" name="Avg Response" stroke={CHART_COLORS.latency} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                    <Line type="monotone" dataKey="max_response_ms" name="Max Response" stroke="#EF4444" strokeWidth={1} strokeDasharray="5 5" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>

              {/* Request Count Trend */}
              <ChartCard
                title="Daily Request Volume"
                description="Number of requests per day"
                isLoading={timeseriesLoading || timeseriesFetching}
                isEmpty={!timeseries?.daily?.length}
              >
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={timeseries?.daily?.map((d) => ({
                    ...d,
                    date: formatDate(d.date),
                    success_count: d.request_count - d.error_count,
                  })) || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="date" tick={{ fontSize: 12, fill: "#6B7280" }} />
                    <YAxis tick={{ fontSize: 12, fill: "#6B7280" }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#fff", border: "1px solid #E5E7EB", borderRadius: "8px" }}
                      formatter={(value: number, name: string) => [
                        value,
                        name === "success_count" ? "Success" : "Errors"
                      ]}
                    />
                    <Legend />
                    <Bar dataKey="success_count" name="Success" stackId="a" fill={CHART_COLORS.success} />
                    <Bar dataKey="error_count" name="Errors" stackId="a" fill={CHART_COLORS.error} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              {/* Tokens Chart */}
              <ChartCard
                title="Daily Token Usage"
                description="Tokens consumed per day"
                isLoading={timeseriesLoading || timeseriesFetching}
                isEmpty={!timeseries?.daily?.length}
              >
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={timeseries?.daily?.map((d) => ({ ...d, date: formatDate(d.date) })) || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis dataKey="date" tick={{ fontSize: 12, fill: "#6B7280" }} />
                    <YAxis tick={{ fontSize: 12, fill: "#6B7280" }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#fff", border: "1px solid #E5E7EB", borderRadius: "8px" }}
                      formatter={(value: number) => [value.toLocaleString(), "Tokens"]}
                    />
                    <Bar dataKey="total_tokens" name="Tokens" fill={CHART_COLORS.tokens} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
          )}

          {/* Endpoint Breakdown Chart */}
          {endpointBreakdownData.length > 0 && (
            <div className="px-6 mt-6">
              <ChartCard
                title="Request Distribution by Endpoint"
                description="Comparison of request counts across endpoints"
                isLoading={summaryLoading || summaryFetching}
                isEmpty={!endpointBreakdownData.length}
              >
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={endpointBreakdownData}
                    layout="vertical"
                    margin={{ left: 20, right: 30 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis type="number" tick={{ fontSize: 12, fill: "#6B7280" }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: "#6B7280" }} width={180} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "#fff", border: "1px solid #E5E7EB", borderRadius: "8px" }}
                      formatter={(value: number, name: string) => [
                        name === "requests" ? value.toLocaleString() + " requests" :
                        name === "avgLatency" ? value.toFixed(1) + "ms" :
                        value.toLocaleString(),
                        name === "requests" ? "Requests" : name === "avgLatency" ? "Avg Latency" : "Tokens"
                      ]}
                      labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
                    />
                    <Bar dataKey="requests" fill={CHART_COLORS.requests} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>
          )}
        </>
      )}

      {/* Bottom spacing */}
      <div className="h-8"></div>
    </div>
  );
}
