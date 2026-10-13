// features/subscriptionModel/billing/billingApi.ts
import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithReauth } from '@/lib/api/baseQueryWithAuth';

// Helper function to get admin_id from localStorage
const getAdminId = (): string | null => {
  if (typeof window === 'undefined') return null;
  
  const adminUser = localStorage.getItem('superAdminUser');
  if (!adminUser) return null;
  
  try {
    const parsed = JSON.parse(adminUser);
    return parsed.id || null;
  } catch (error) {
    console.error('Failed to parse superAdminUser from localStorage:', error);
    return null;
  }
};

// ============================================
// TYPES (Matching your backend models)
// ============================================

// Storage unit types
export type StorageUnit = 'bytes' | 'kb' | 'mb' | 'gb' | 'tb';

export interface PlanComponent {
  id: string;
  name: string;
  component_type: string;  // User-defined free text component type
  component_type_display?: string;
  description: string | null;
  quantity?: string | null;
  price?: string | null;
  cost_per_unit: string | null;
  promotion_code: string | null;
  promotion_valid_from: string | null;
  promotion_valid_until: string | null;
  discount_percentage: string | null;
  unit_label: string;
  price_per_unit: string;
  is_active: boolean;
  is_renewable: boolean;
  created_at: string;
  updated_at: string;
  estimated_cost_for_client?: number | null;
  total_cost?: string | null;  // Auto-calculated: cost_per_unit × quantity
  // Storage unit fields
  storage_unit?: StorageUnit | null;
  pricing_unit?: StorageUnit | null;
  base_quantity_bytes?: string | null;
  storage_total_cost?: string | null;
  quantity_in_pricing_unit?: string | null;
  is_storage_component?: boolean;
}

export interface PlanComponentInclusion {
  id: string;
  plan: string;
  component: PlanComponent;
  quantity_multiplier: string;
  total_quantity: string;
  total_price: string;
  is_featured: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface AgentPricing {
  id: string;
  agent_id: string;
  agent_name: string;
  agent_category: string;
  name: string;
  description: string | null;
  price: string;
  unit: 'per_use' | 'per_hour' | 'per_day' | 'per_month' | 'per_transaction' | 'per_request' | 'flat_rate';
  billing_method: 'prepaid' | 'postpaid' | 'pay_as_you_go' | 'subscription';
  promotion_code: string | null;
  promotion_valid_from: string | null;
  promotion_valid_until: string | null;
  discount_percentage: string | null;
  estimated_tokens_per_use: number;
  estimated_storage_mb: string;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

// Individual feature for an agent in a plan
export interface PlanAgentFeature {
  id: string;
  feature_text: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PlanAgentInclusion {
  id: string;
  plan: string;
  agent: string;
  agent_name: string;
  agent_pricing: string | null;
  agent_pricing_name: string | null;
  included_instances: number;
  per_instance_price: string;
  override_price: string | null;
  base_price: string;
  effective_price: string;
  has_price_override: boolean;
  is_featured: boolean;
  display_order: number;
  // Feature list for this agent in this plan (legacy single text field)
  feature_description: string | null;
  // Individual features list
  features: PlanAgentFeature[];
  created_at: string;
  updated_at: string;
}

export interface Plan {
  id: string;
  name: string;
  description: string | null;
  plan_type: 'free' | 'starter' | 'professional' | 'enterprise' | 'custom';
  base_price: string;
  billing_period: 'monthly' | 'quarterly' | 'yearly';
  billing_mode: 'prepaid' | 'postpaid';
  grace_period_days: number;
  // Trial period fields (for free plans)
  has_trial: boolean;
  trial_period_days: number;
  cost_per_unit: string | null;
  promotion_code: string | null;
  promotion_valid_from: string | null;
  promotion_valid_until: string | null;
  discount_percentage: string | null;
  is_active: boolean;
  is_public: boolean;
  display_order: number;
  featured: boolean;
  // Feature list for user-facing display (bullet points, one per line)
  feature_list: string | null;
  // Agent selection limits for subscription
  // When user subscribes, they can choose between min and max agents from the assigned agents
  min_agents_required: number;  // 0 = no minimum
  max_agents_allowed: number;   // 0 = unlimited (all agents)
  // Full data (from PlanDetailSerializer)
  included_components?: PlanComponentInclusion[];
  included_agents?: PlanAgentInclusion[];
  total_components_value?: string;
  total_agents_value?: string;
  total_plan_value?: string;
  // Counts (from PlanSerializer list view)
  components_count?: number;
  agents_count?: number;
  created_at: string;
  updated_at: string;
}

export interface PlansResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Plan[];
}

export interface PlanComponentsResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: PlanComponent[];
}

export interface ComponentTypeOption {
  value: string;
  label: string;
}

export interface ComponentTypesResponse {
  types: ComponentTypeOption[];
  count: number;
}

export interface AgentPricingResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: AgentPricing[];
}

export interface CreatePlanRequest {
  name: string;
  description?: string;
  plan_type: string;
  base_price: number | string;
  billing_period: string;
  billing_mode: string;
  grace_period_days?: number;
  // Trial period fields (for free plans)
  has_trial?: boolean;
  trial_period_days?: number;
  cost_per_unit?: number | string | null;
  promotion_code?: string | null;
  promotion_valid_from?: string | null;
  promotion_valid_until?: string | null;
  discount_percentage?: number | string | null;
  is_active?: boolean;
  is_public?: boolean;
  display_order?: number;
  featured?: boolean;
  // Feature list for user-facing display (bullet points, one per line)
  feature_list?: string | null;
  // Agent selection limits
  min_agents_required?: number;
  max_agents_allowed?: number;
}

export interface CreatePlanComponentRequest {
  name: string;
  component_type: string;
  description?: string | null;
  quantity?: number | string | null;
  price?: number | string | null;
  cost_per_unit?: number | string | null;
  price_per_unit?: number | string | null;
  promotion_code?: string | null;
  promotion_valid_from?: string | null;
  promotion_valid_until?: string | null;
  discount_percentage?: number | string | null;
  unit_label: string;
  is_active?: boolean;
  is_renewable?: boolean;
  estimated_cost_for_client?: number | null;
  // Storage unit fields
  storage_unit?: StorageUnit | null;
  pricing_unit?: StorageUnit | null;
}

export interface PlanAgentsResponse {
  plan_id: string;
  plan_name: string;
  agents: Array<{
    id: string;
    agent_pricing: AgentPricing;
    included_instances: number;
    per_instance_price: string;
    override_price: string | null;
    base_price: string;
    effective_price: string;
    has_price_override: boolean;
    is_featured: boolean;
    display_order: number;
  }>;
  count: number;
}

// ============================================
// ENHANCED PLAN SUMMARY TYPES
// ============================================

export interface AgentComponentConsumptionItem {
  component_id: string;
  component_name: string;
  component_type: string;
  component_type_display: string;
  total_quantity: number;
  unit_label: string;
  base_price_per_unit: number;
  override_price_per_unit: number | null;
  effective_price_per_unit: number;
  is_unlimited: boolean;
  component_cost_per_unit: number | null;
  is_active: boolean;
  estimated_cost_for_client?: number | null;
}

export interface AgentComponentConsumption {
  items: AgentComponentConsumptionItem[];
  count: number;
  total_quantity_allocated: number;
  has_unlimited: boolean;
}

export interface PlanSummaryComponentItem {
  inclusion_id: string;
  component_id: string;
  component_name: string;
  component_type: string;
  component_type_display: string;
  base_quantity: number | null;
  quantity_multiplier: number;
  total_quantity: number;
  unit_label: string;
  base_price: number | null;
  cost_per_unit: number | null;
  price_per_unit: number;
  total_price: number;
  has_promotion: boolean;
  promotion_code: string | null;
  discount_percentage: number;
  discount_amount: number;
  effective_price: number;
  promotion_valid_from: string | null;
  promotion_valid_until: string | null;
  is_renewable: boolean;
  is_featured: boolean;
  display_order: number;
  is_active: boolean;
  estimated_cost_for_client?: number | null;
}

export interface PlanSummaryAgentItem {
  inclusion_id: string;
  agent_id: string;
  agent_name: string;
  agent_category: string;
  agent_type: string;
  agent_pricing_id: string | null;
  pricing_name: string | null;
  pricing_description: string | null;
  unit_price: number;
  included_instances: number;
  total_price: number;
  has_promotion: boolean;
  promotion_code: string | null;
  discount_percentage: number;
  discount_amount: number;
  estimated_tokens_per_use: number;
  estimated_storage_mb: number;
  billing_method: string | null;
  unit: string | null;
  component_consumption: AgentComponentConsumption;
  is_featured: boolean;
  display_order: number;
  is_active: boolean;
}

export interface PlanSummaryResponse {
  plan: {
    id: string;
    name: string;
    description: string | null;
    plan_type: string;
    plan_type_display: string;
    base_price: number;
    cost_per_unit: number | null;
    has_promotion: boolean;
    promotion_code: string | null;
    discount_percentage: number;
    discount_amount: number;
    effective_base_price: number;
    promotion_valid_from: string | null;
    promotion_valid_until: string | null;
    billing_period: string;
    billing_period_display: string;
    billing_mode: string;
    billing_mode_display: string;
    grace_period_days: number;
    is_active: boolean;
    is_public: boolean;
    featured: boolean;
    display_order: number;
    created_at: string;
    updated_at: string;
  };
  components: {
    items: PlanSummaryComponentItem[];
    count: number;
    total_value: number;
    description: string;
  };
  agents: {
    items: PlanSummaryAgentItem[];
    count: number;
    total_value: number;
    description: string;
  };
  pricing_summary: {
    base_price: number;
    effective_base_price: number;
    base_price_discount: number;
    components_value: number;
    agents_value: number;
    total_plan_value: number;
    total_with_discounts: number;
    currency: string;
  };
  statistics: {
    active_subscriptions: number;
    total_subscriptions: number;
    total_plan_components: number;
    total_agents: number;
    total_inclusions: number;
  };
}

// ============================================
// AGENT COMPONENT PRICING TYPES
// ============================================

export interface AgentComponentPricing {
  id: string;
  component_id: string;
  component_name: string;
  component_type: string;
  component_type_display: string;
  total_quantity: number;
  base_price_per_unit: number;
  override_price_per_unit: number | null;
  effective_price_per_unit: number;
  is_unlimited: boolean;
  unit_label: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AgentComponentsResponse {
  agent_id: string;
  agent_name: string;
  components: AgentComponentPricing[];
  count: number;
}

export interface AgentComponentSummaryResponse {
  agent: {
    id: string;
    agent_id: string;
    name: string;
    agent_category: string;
    agent_type: string;
    is_active: boolean;
  };
  components: {
    items: AgentComponentPricing[];
    count: number;
    total_cost_per_execution: number;
  };
  cost_estimates: {
    per_execution: number;
    per_10_executions: number;
    per_100_executions: number;
    per_1000_executions: number;
    currency: string;
  };
}

// ============================================
// API REQUEST/RESPONSE TYPES
// ============================================

export interface PlanStatsResponse {
  total_plans: number;
  active_plans: number;
  inactive_plans: number;
  public_plans: number;
  private_plans: number;
  featured_plans: number;
  plans_by_type: Record<string, number>;
  plans_by_period: Record<string, number>;
}

export interface PlanQueryParams {
  search?: string;
  plan_type?: string;
  is_active?: boolean;
  is_public?: boolean;
  featured?: boolean;
  billing_period?: string;
  ordering?: string;
  limit?: number;
  offset?: number;
}

export interface AddComponentToPlanRequest {
  components: Array<{
    component_id: string;
    quantity_multiplier?: number;
    is_included?: boolean;
  }>;
}

export interface AddAgentToPlanRequest {
  agents: Array<{
    agent_pricing_id: string;
    included_instances?: number;
    per_instance_price?: number;
    override_price?: number | string | null;
    is_included?: boolean;
    feature_description?: string | null;
  }>;
}

export interface AgentComponentRequest {
  component_id: string;
  total_quantity?: number;
  override_price_per_unit?: number | null;
  is_unlimited?: boolean;
  is_active?: boolean;
}

// ============================================
// API
// ============================================

export const billingApi = createApi({
  reducerPath: 'billingApi',
  baseQuery: baseQueryWithReauth,
  tagTypes: [
    'Plan',
    'PlanComponent',
    'AgentPricing',
    'Stats',
    'PlanComponentInclusion',
    'PlanAgentInclusion',
    'PlanAgentFeature',
    'PlanSummary',
    'AgentComponentPricing'
  ],
  keepUnusedDataFor: 300,
  endpoints: (builder) => ({
    // ============================================
    // PLANS
    // ============================================
    getPlans: builder.query<PlansResponse, void | PlanQueryParams>({
      query: (params) => {
        const adminId = getAdminId();
        const queryParams = new URLSearchParams();
        
        if (adminId) {
          queryParams.append('admin_id', adminId);
        }
        
        if (params) {
          Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
              queryParams.append(key, String(value));
            }
          });
        }
        
        return `/plans/?${queryParams.toString()}`;
      },
      providesTags: (result) =>
        result
          ? [
              ...result.results.map(({ id }) => ({ type: 'Plan' as const, id })),
              { type: 'Plan', id: 'LIST' },
            ]
          : [{ type: 'Plan', id: 'LIST' }],
    }),

    getPlan: builder.query<Plan, string>({
      query: (id) => {
        const adminId = getAdminId();
        return `/plans/${id}/?admin_id=${adminId}`;
      },
      providesTags: (result, error, id) => [{ type: 'Plan', id }],
    }),

    createPlan: builder.mutation<Plan, CreatePlanRequest>({
      query: (data) => {
        const adminId = getAdminId();
        return {
          url: `/plans/?admin_id=${adminId}`,
          method: 'POST',
          body: data,
        };
      },
      invalidatesTags: [{ type: 'Plan', id: 'LIST' }, 'Stats'],
    }),

    updatePlan: builder.mutation<Plan, { id: string; data: Partial<CreatePlanRequest> }>({
      query: ({ id, data }) => {
        const adminId = getAdminId();
        return {
          url: `/plans/${id}/?admin_id=${adminId}`,
          method: 'PATCH',
          body: data,
        };
      },
      invalidatesTags: (result, error, { id }) => [
        { type: 'Plan', id },
        { type: 'Plan', id: 'LIST' },
        { type: 'PlanSummary', id },
        'Stats',
      ],
    }),

    deletePlan: builder.mutation<void, string>({
      query: (id) => {
        const adminId = getAdminId();
        return {
          url: `/plans/${id}/?admin_id=${adminId}`,
          method: 'DELETE',
        };
      },
      invalidatesTags: [{ type: 'Plan', id: 'LIST' }, 'Stats'],
    }),

    duplicatePlan: builder.mutation<Plan, string>({
      query: (id) => {
        const adminId = getAdminId();
        return {
          url: `/plans/${id}/duplicate/?admin_id=${adminId}`,
          method: 'POST',
        };
      },
      invalidatesTags: [{ type: 'Plan', id: 'LIST' }, 'Stats'],
    }),

    getPlanStats: builder.query<PlanStatsResponse, void>({
      query: () => {
        const adminId = getAdminId();
        return `/plans/stats/?admin_id=${adminId}`;
      },
      providesTags: ['Stats'],
    }),

    getPlanSummary: builder.query<PlanSummaryResponse, string>({
      query: (planId) => {
        const adminId = getAdminId();
        return `/plans/${planId}/summary/?admin_id=${adminId}`;
      },
      providesTags: (result, error, planId) => [
        { type: 'PlanSummary', id: planId },
        { type: 'Plan', id: planId },
      ],
      keepUnusedDataFor: 300,
    }),

    // ============================================
    // PLAN COMPONENTS
    // ============================================
    getPlanComponents: builder.query<PlanComponentsResponse, void | {
      component_type?: string;
      is_active?: boolean;
      search?: string;
      ordering?: string;
      limit?: number;
      offset?: number;
    }>({
      query: (params) => {
        const adminId = getAdminId();
        const queryParams = new URLSearchParams();

        if (adminId) {
          queryParams.append('admin_id', adminId);
        }

        if (params?.component_type) {
          queryParams.append('component_type', params.component_type);
        }
        if (params?.is_active !== undefined) {
          queryParams.append('is_active', String(params.is_active));
        }
        if (params?.search) {
          queryParams.append('search', params.search);
        }
        if (params?.ordering) {
          queryParams.append('ordering', params.ordering);
        }
        if (params?.limit !== undefined) {
          queryParams.append('limit', String(params.limit));
        }
        if (params?.offset !== undefined) {
          queryParams.append('offset', String(params.offset));
        }

        return `/plan-components/?${queryParams.toString()}`;
      },
      providesTags: (result) =>
        result
          ? [
              ...result.results.map(({ id }) => ({ type: 'PlanComponent' as const, id })),
              { type: 'PlanComponent', id: 'LIST' },
            ]
          : [{ type: 'PlanComponent', id: 'LIST' }],
    }),

    getPlanComponent: builder.query<PlanComponent, string>({
      query: (id) => {
        const adminId = getAdminId();
        return `/plan-components/${id}/?admin_id=${adminId}`;
      },
      providesTags: (result, error, id) => [{ type: 'PlanComponent', id }],
    }),

    createPlanComponent: builder.mutation<PlanComponent, CreatePlanComponentRequest>({
      query: (data) => {
        const adminId = getAdminId();
        const cleanData = Object.fromEntries(
          Object.entries(data).filter(([, v]) => v !== undefined)
        );
        return {
          url: `/plan-components/?admin_id=${adminId}`,
          method: 'POST',
          body: cleanData,
        };
      },
      invalidatesTags: [{ type: 'PlanComponent', id: 'LIST' }],
    }),

    updatePlanComponent: builder.mutation<PlanComponent, { id: string; data: Partial<CreatePlanComponentRequest> }>({
      query: ({ id, data }) => {
        const adminId = getAdminId();
        const cleanData = Object.fromEntries(
          Object.entries(data).filter(([, v]) => v !== undefined)
        );
        return {
          url: `/plan-components/${id}/?admin_id=${adminId}`,
          method: 'PATCH',
          body: cleanData,
        };
      },
      invalidatesTags: (result, error, { id }) => [
        { type: 'PlanComponent', id },
        { type: 'PlanComponent', id: 'LIST' },
      ],
    }),

    deletePlanComponent: builder.mutation<void, string>({
      query: (id) => {
        const adminId = getAdminId();
        return {
          url: `/plan-components/${id}/?admin_id=${adminId}`,
          method: 'DELETE',
        };
      },
      invalidatesTags: [{ type: 'PlanComponent', id: 'LIST' }],
    }),

    // Get unique component types for dropdown/autocomplete
    getComponentTypes: builder.query<ComponentTypesResponse, string | void>({
      query: (search) => {
        const adminId = getAdminId();
        const queryParams = new URLSearchParams();
        if (adminId) queryParams.append('admin_id', adminId);
        if (search) queryParams.append('search', search);
        return `/plan-components/component_types/?${queryParams.toString()}`;
      },
      providesTags: [{ type: 'PlanComponent', id: 'TYPES' }],
    }),

    // ============================================
    // PLAN COMPONENT INCLUSIONS
    // ============================================
    getPlanComponentsInPlan: builder.query<PlanComponentInclusion[], string>({
      query: (planId) => {
        const adminId = getAdminId();
        return `/plans/${planId}/components/?admin_id=${adminId}`;
      },
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'PlanComponentInclusion' as const, id })),
              { type: 'PlanComponentInclusion', id: 'LIST' },
            ]
          : [{ type: 'PlanComponentInclusion', id: 'LIST' }],
    }),

    addComponentToPlan: builder.mutation<PlanComponentInclusion, { planId: string; data: AddComponentToPlanRequest }>({
      query: ({ planId, data }) => {
        const adminId = getAdminId();
        return {
          url: `/plans/${planId}/components/?admin_id=${adminId}`,
          method: 'POST',
          body: data,
        };
      },
      invalidatesTags: (result, error, { planId }) => [
        { type: 'Plan', id: planId },
        { type: 'PlanComponentInclusion', id: 'LIST' },
        { type: 'PlanSummary', id: planId },
      ],
    }),

    updatePlanComponentInclusion: builder.mutation<PlanComponentInclusion, {
      planId: string;
      inclusionId: string;
      data: {
        quantity_multiplier?: number;
        is_featured?: boolean;
        display_order?: number;
      }
    }>({
      query: ({ planId, inclusionId, data }) => {
        const adminId = getAdminId();
        return {
          url: `/plans/${planId}/components/${inclusionId}/?admin_id=${adminId}`,
          method: 'PUT',
          body: data,
        };
      },
      invalidatesTags: (result, error, { planId, inclusionId }) => [
        { type: 'Plan', id: planId },
        { type: 'PlanComponentInclusion', id: inclusionId },
        { type: 'PlanComponentInclusion', id: 'LIST' },
        { type: 'PlanSummary', id: planId },
      ],
    }),

    removeComponentFromPlan: builder.mutation<void, { planId: string; componentId: string }>({
      query: ({ planId, componentId }) => {
        const adminId = getAdminId();
        return {
          url: `/plans/${planId}/components/${componentId}/?admin_id=${adminId}`,
          method: 'DELETE',
        };
      },
      invalidatesTags: (result, error, { planId }) => [
        { type: 'Plan', id: planId },
        { type: 'PlanComponentInclusion', id: 'LIST' },
        { type: 'PlanSummary', id: planId },
      ],
    }),

    // ============================================
    // AGENT PRICING
    // ============================================
    getAgentPricing: builder.query<AgentPricingResponse, void | {
      agent?: string;
      is_active?: boolean;
      search?: string;
      billing_method?: string;
      ordering?: string;
      limit?: number;
      offset?: number;
    }>({
      query: (params) => {
        const adminId = getAdminId();
        const queryParams = new URLSearchParams();

        if (adminId) {
          queryParams.append('admin_id', adminId);
        }

        if (params?.agent) {
          queryParams.append('agent', params.agent);
        }
        if (params?.is_active !== undefined) {
          queryParams.append('is_active', String(params.is_active));
        }
        if (params?.search) {
          queryParams.append('search', params.search);
        }
        if (params?.billing_method) {
          queryParams.append('billing_method', params.billing_method);
        }
        if (params?.ordering) {
          queryParams.append('ordering', params.ordering);
        }
        if (params?.limit !== undefined) {
          queryParams.append('limit', String(params.limit));
        }
        if (params?.offset !== undefined) {
          queryParams.append('offset', String(params.offset));
        }

        return `/agent-pricing/?${queryParams.toString()}`;
      },
      providesTags: (result) =>
        result
          ? [
              ...result.results.map(({ id }) => ({ type: 'AgentPricing' as const, id })),
              { type: 'AgentPricing', id: 'LIST' },
            ]
          : [{ type: 'AgentPricing', id: 'LIST' }],
    }),

    getAgentPricingByAgent: builder.query<AgentPricingResponse, string>({
      query: (agentId) => {
        const adminId = getAdminId();
        return `/agent-pricing/by-agent/${agentId}/?admin_id=${adminId}`;
      },
      providesTags: (result) =>
        result
          ? [
              ...result.results.map(({ id }) => ({ type: 'AgentPricing' as const, id })),
              { type: 'AgentPricing', id: 'LIST' },
            ]
          : [{ type: 'AgentPricing', id: 'LIST' }],
    }),

    getAgentPricingById: builder.query<AgentPricing, string>({
      query: (id) => {
        const adminId = getAdminId();
        return `/agent-pricing/${id}/?admin_id=${adminId}`;
      },
      providesTags: (result, error, id) => [{ type: 'AgentPricing', id }],
    }),

    createAgentPricing: builder.mutation<AgentPricing, Partial<AgentPricing>>({
      query: (data) => {
        const adminId = getAdminId();
        return {
          url: `/agent-pricing/?admin_id=${adminId}`,
          method: 'POST',
          body: data,
        };
      },
      invalidatesTags: [{ type: 'AgentPricing', id: 'LIST' }],
    }),

    updateAgentPricing: builder.mutation<AgentPricing, { id: string; data: Partial<AgentPricing> }>({
      query: ({ id, data }) => {
        const adminId = getAdminId();
        return {
          url: `/agent-pricing/${id}/?admin_id=${adminId}`,
          method: 'PATCH',
          body: data,
        };
      },
      invalidatesTags: (result, error, { id }) => [
        { type: 'AgentPricing', id },
        { type: 'AgentPricing', id: 'LIST' },
      ],
    }),

    deleteAgentPricing: builder.mutation<void, string>({
      query: (id) => {
        const adminId = getAdminId();
        return {
          url: `/agent-pricing/${id}/?admin_id=${adminId}`,
          method: 'DELETE',
        };
      },
      invalidatesTags: [{ type: 'AgentPricing', id: 'LIST' }],
    }),

    // ============================================
    // PLAN AGENT INCLUSIONS
    // ============================================
    getPlanAgentsInPlan: builder.query<PlanAgentsResponse, string>({
      query: (planId) => {
        const adminId = getAdminId();
        return `/plans/${planId}/agents/?admin_id=${adminId}`;
      },
      providesTags: (result) =>
        result
          ? [
              ...result.agents.map(({ id }) => ({ type: 'PlanAgentInclusion' as const, id })),
              { type: 'PlanAgentInclusion', id: 'LIST' },
            ]
          : [{ type: 'PlanAgentInclusion', id: 'LIST' }],
    }),

    addAgentToPlan: builder.mutation<PlanAgentInclusion, { planId: string; data: AddAgentToPlanRequest }>({
      query: ({ planId, data }) => {
        const adminId = getAdminId();
        return {
          url: `/plans/${planId}/agents/?admin_id=${adminId}`,
          method: 'POST',
          body: data,
        };
      },
      invalidatesTags: (result, error, { planId }) => [
        { type: 'Plan', id: planId },
        { type: 'PlanAgentInclusion', id: 'LIST' },
        { type: 'PlanSummary', id: planId },
      ],
    }),

    updatePlanAgentInclusion: builder.mutation<PlanAgentInclusion, {
      planId: string;
      inclusionId: string;
      data: {
        agent_pricing_id?: string;
        included_instances?: number;
        per_instance_price?: number;
        override_price?: number | string | null;
        is_featured?: boolean;
        display_order?: number;
        feature_description?: string | null;
      }
    }>({
      query: ({ planId, inclusionId, data }) => {
        const adminId = getAdminId();
        return {
          url: `/plans/${planId}/agents/${inclusionId}/?admin_id=${adminId}`,
          method: 'PUT',
          body: data,
        };
      },
      invalidatesTags: (result, error, { planId, inclusionId }) => [
        { type: 'Plan', id: planId },
        { type: 'PlanAgentInclusion', id: inclusionId },
        { type: 'PlanAgentInclusion', id: 'LIST' },
        { type: 'PlanSummary', id: planId },
      ],
    }),

    removeAgentFromPlan: builder.mutation<void, { planId: string; inclusionId: string }>({
      query: ({ planId, inclusionId }) => {
        const adminId = getAdminId();
        return {
          url: `/plans/${planId}/agents/${inclusionId}/?admin_id=${adminId}`,
          method: 'DELETE',
        };
      },
      invalidatesTags: (result, error, { planId, inclusionId }) => [
        { type: 'Plan', id: planId },
        { type: 'PlanAgentInclusion', id: inclusionId },
        { type: 'PlanAgentInclusion', id: 'LIST' },
        { type: 'PlanSummary', id: planId },
      ],
    }),

    // ============================================
    // PLAN AGENT FEATURES
    // ============================================
    getAgentFeatures: builder.query<PlanAgentFeature[], { planId: string; inclusionId: string }>({
      query: ({ planId, inclusionId }) => {
        const adminId = getAdminId();
        return `/plans/${planId}/agents/${inclusionId}/features/?admin_id=${adminId}`;
      },
      providesTags: (result, error, { inclusionId }) => [
        { type: 'PlanAgentFeature', id: inclusionId },
        { type: 'PlanAgentFeature', id: 'LIST' },
      ],
    }),

    addAgentFeature: builder.mutation<PlanAgentFeature, {
      planId: string;
      inclusionId: string;
      data: { feature_text: string; display_order?: number };
    }>({
      query: ({ planId, inclusionId, data }) => {
        const adminId = getAdminId();
        return {
          url: `/plans/${planId}/agents/${inclusionId}/features/?admin_id=${adminId}`,
          method: 'POST',
          body: data,
        };
      },
      invalidatesTags: (result, error, { planId, inclusionId }) => [
        { type: 'PlanAgentFeature', id: inclusionId },
        { type: 'PlanAgentFeature', id: 'LIST' },
        { type: 'PlanAgentInclusion', id: inclusionId },
        { type: 'PlanAgentInclusion', id: 'LIST' },
        { type: 'Plan', id: planId },
      ],
    }),

    updateAgentFeature: builder.mutation<PlanAgentFeature, {
      planId: string;
      inclusionId: string;
      featureId: string;
      data: { feature_text?: string; display_order?: number; is_active?: boolean };
    }>({
      query: ({ planId, inclusionId, featureId, data }) => {
        const adminId = getAdminId();
        return {
          url: `/plans/${planId}/agents/${inclusionId}/features/${featureId}/?admin_id=${adminId}`,
          method: 'PUT',
          body: data,
        };
      },
      invalidatesTags: (result, error, { planId, inclusionId, featureId }) => [
        { type: 'PlanAgentFeature', id: inclusionId },
        { type: 'PlanAgentFeature', id: featureId },
        { type: 'PlanAgentInclusion', id: inclusionId },
        { type: 'PlanAgentInclusion', id: 'LIST' },
        { type: 'Plan', id: planId },
      ],
    }),

    deleteAgentFeature: builder.mutation<void, {
      planId: string;
      inclusionId: string;
      featureId: string;
    }>({
      query: ({ planId, inclusionId, featureId }) => {
        const adminId = getAdminId();
        return {
          url: `/plans/${planId}/agents/${inclusionId}/features/${featureId}/?admin_id=${adminId}`,
          method: 'DELETE',
        };
      },
      invalidatesTags: (result, error, { planId, inclusionId }) => [
        { type: 'PlanAgentFeature', id: inclusionId },
        { type: 'PlanAgentFeature', id: 'LIST' },
        { type: 'PlanAgentInclusion', id: inclusionId },
        { type: 'PlanAgentInclusion', id: 'LIST' },
        { type: 'Plan', id: planId },
      ],
    }),

    // ============================================
    // AGENT COMPONENT PRICING
    // ============================================
    getAgentComponents: builder.query<AgentComponentsResponse, string>({
      query: (agentId) => {
        const adminId = getAdminId();
        return `/agent-templates/${agentId}/components/?admin_id=${adminId}`;
      },
      providesTags: (result, error, agentId) => [
        { type: 'AgentComponentPricing', id: agentId },
        { type: 'AgentComponentPricing', id: 'LIST' },
      ],
    }),

    addComponentToAgent: builder.mutation<AgentComponentPricing, { agentId: string; data: AgentComponentRequest }>({
      query: ({ agentId, data }) => {
        const adminId = getAdminId();
        return {
          url: `/agent-templates/${agentId}/components/?admin_id=${adminId}`,
          method: 'POST',
          body: data,
        };
      },
      invalidatesTags: (result, error, { agentId }) => [
        { type: 'AgentComponentPricing', id: agentId },
        { type: 'AgentComponentPricing', id: 'LIST' },
      ],
    }),

    updateAgentComponent: builder.mutation<AgentComponentPricing, { agentId: string; data: AgentComponentRequest }>({
      query: ({ agentId, data }) => {
        const adminId = getAdminId();
        return {
          url: `/agent-templates/${agentId}/update_component/?admin_id=${adminId}`,
          method: 'PATCH',
          body: data,
        };
      },
      invalidatesTags: (result, error, { agentId }) => [
        { type: 'AgentComponentPricing', id: agentId },
        { type: 'AgentComponentPricing', id: 'LIST' },
      ],
    }),

    removeComponentFromAgent: builder.mutation<void, { agentId: string; componentId: string }>({
      query: ({ agentId, componentId }) => {
        const adminId = getAdminId();
        return {
          url: `/agent-templates/${agentId}/remove_component/?component_id=${componentId}&admin_id=${adminId}`,
          method: 'DELETE',
        };
      },
      invalidatesTags: (result, error, { agentId }) => [
        { type: 'AgentComponentPricing', id: agentId },
        { type: 'AgentComponentPricing', id: 'LIST' },
      ],
    }),

    getAgentComponentSummary: builder.query<AgentComponentSummaryResponse, string>({
      query: (agentId) => {
        const adminId = getAdminId();
        return `/agent-templates/${agentId}/component_summary/?admin_id=${adminId}`;
      },
      providesTags: (result, error, agentId) => [
        { type: 'AgentComponentPricing', id: agentId },
      ],
    }),
  }),
});

export const {
  useGetPlansQuery,
  useGetPlanQuery,
  useCreatePlanMutation,
  useUpdatePlanMutation,
  useDeletePlanMutation,
  useDuplicatePlanMutation,
  useGetPlanStatsQuery,

  useGetPlanSummaryQuery,

  useGetPlanComponentsQuery,
  useGetPlanComponentQuery,
  useCreatePlanComponentMutation,
  useUpdatePlanComponentMutation,
  useDeletePlanComponentMutation,
  useGetComponentTypesQuery,
  
  useGetPlanComponentsInPlanQuery,
  useAddComponentToPlanMutation,
  useUpdatePlanComponentInclusionMutation,
  useRemoveComponentFromPlanMutation,
  
  useGetAgentPricingQuery,
  useGetAgentPricingByAgentQuery,
  useGetAgentPricingByIdQuery,
  useCreateAgentPricingMutation,
  useUpdateAgentPricingMutation,
  useDeleteAgentPricingMutation,
  
  useGetPlanAgentsInPlanQuery,
  useAddAgentToPlanMutation,
  useUpdatePlanAgentInclusionMutation,
  useRemoveAgentFromPlanMutation,

  // Agent Features
  useGetAgentFeaturesQuery,
  useAddAgentFeatureMutation,
  useUpdateAgentFeatureMutation,
  useDeleteAgentFeatureMutation,

  useGetAgentComponentsQuery,
  useAddComponentToAgentMutation,
  useUpdateAgentComponentMutation,
  useRemoveComponentFromAgentMutation,
  useGetAgentComponentSummaryQuery,
} = billingApi;