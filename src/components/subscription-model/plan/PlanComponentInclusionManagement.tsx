// components/subscription-model/plan/PlanComponentInclusionManagement.tsx
"use client";
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  useGetPlansQuery,
  useGetPlanComponentsQuery,
  useAddComponentToPlanMutation,
  useRemoveComponentFromPlanMutation,
  useUpdatePlanComponentInclusionMutation,
} from '@/features/subscriptionModel/billing/billingApi';

// ============================================
// TYPES
// ============================================
interface Plan {
  id: string;
  name: string;
  description: string | null;
  plan_type: string;
  base_price: string;
  billing_period: string;
  billing_mode: string;
  grace_period_days: number;
  is_active: boolean;
  is_public: boolean;
  display_order: number;
  featured: boolean;
}

interface PlanComponent {
  id: string;
  name: string;
  component_type: string;
  component_type_display: string;
  description: string | null;
  quantity: string | null;
  price: string | null;
  unit_label: string;
  cost_per_unit: string;
  price_per_unit: string;
  effective_price: string;
  promotion_code: string | null;
  promotion_valid_from: string | null;
  promotion_valid_until: string | null;
  discount_percentage: string | null;
  is_promotion_valid: boolean;
  is_active: boolean;
  is_renewable: boolean;
  created_at: string;
  updated_at: string;
}

interface PlanComponentInclusion {
  id: string;
  component: PlanComponent;
  quantity_multiplier: string;
  total_quantity: string;
  total_price: string;
  is_featured: boolean;
  display_order: number;
}

interface PlanComponentsResponse {
  plan_id: string;
  plan_name: string;
  components: PlanComponentInclusion[];
  count: number;
}

interface ApiErrorResponse {
  data?: {
    detail?: string;
    message?: string;
    error?: string;
  };
}

// ============================================
// CONSTANTS
// ============================================
const PAGE_SIZE_OPTIONS = [10, 25, 50];
const DEFAULT_PAGE_SIZE = 10;

const PLAN_TYPE_STYLES: Record<string, { badge: string; gradient: string; ring: string }> = {
  free: { badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', gradient: 'from-emerald-500 to-teal-500', ring: 'ring-emerald-500' },
  starter: { badge: 'bg-sky-50 text-sky-700 border-sky-200', gradient: 'from-sky-500 to-blue-500', ring: 'ring-sky-500' },
  professional: { badge: 'bg-indigo-50 text-indigo-700 border-indigo-200', gradient: 'from-indigo-500 to-purple-500', ring: 'ring-indigo-500' },
  enterprise: { badge: 'bg-amber-50 text-amber-700 border-amber-200', gradient: 'from-amber-500 to-orange-500', ring: 'ring-amber-500' },
  custom: { badge: 'bg-pink-50 text-pink-700 border-pink-200', gradient: 'from-pink-500 to-rose-500', ring: 'ring-pink-500' },
};

const getPlanStyle = (planType: string) =>
  PLAN_TYPE_STYLES[planType?.toLowerCase()] || PLAN_TYPE_STYLES.custom;

// ============================================
// HELPERS
// ============================================
const formatMoney = (price: string | number | null | undefined) => {
  if (price === null || price === undefined) return '$0.00';
  const num = typeof price === 'string' ? parseFloat(price) : price;
  return isNaN(num) ? '$0.00' : `$${num.toFixed(2)}`;
};

const formatUnitPrice = (price: string | number | null | undefined) => {
  if (price === null || price === undefined) return '$0.00';
  const num = typeof price === 'string' ? parseFloat(price) : price;
  if (isNaN(num)) return '$0.00';
  if (num !== 0 && Math.abs(num) < 0.01) {
    const [whole, fraction = ''] = num.toFixed(10).split('.');
    const trimmed = fraction.replace(/0+$/, '').padEnd(2, '0');
    return `$${whole}.${trimmed}`;
  }
  return `$${num.toFixed(2)}`;
};

const formatComponentType = (type: string) =>
  type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

// ============================================
// HELPER COMPONENTS
// ============================================
const LoadingSpinner = ({ size = 'md', className = '' }: { size?: 'sm' | 'md' | 'lg'; className?: string }) => {
  const sizeClasses = { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-8 w-8' };
  return (
    <svg className={`animate-spin ${sizeClasses[size]} ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
};

const PlanCardSkeleton = () => (
  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-pulse">
    <div className="h-2 bg-gray-200" />
    <div className="p-6 space-y-4">
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1">
          <div className="h-5 bg-gray-200 rounded w-2/3" />
          <div className="h-4 bg-gray-100 rounded w-1/3" />
        </div>
        <div className="h-6 w-20 bg-gray-100 rounded-lg" />
      </div>
      <div className="h-8 bg-gray-200 rounded w-1/2" />
      <div className="h-4 bg-gray-100 rounded w-full" />
      <div className="h-4 bg-gray-100 rounded w-3/4" />
      <div className="h-11 bg-gray-200 rounded-xl w-full mt-2" />
    </div>
  </div>
);

const TableSkeleton = ({ rows = 5 }: { rows?: number }) => (
  <div className="animate-pulse">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-gray-100">
        <div className="w-10 h-10 bg-gray-200 rounded-lg" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-200 rounded w-1/3" />
          <div className="h-3 bg-gray-100 rounded w-1/4" />
        </div>
        <div className="h-4 bg-gray-100 rounded w-20" />
        <div className="h-4 bg-gray-100 rounded w-20" />
        <div className="h-6 bg-gray-200 rounded-lg w-12" />
        <div className="h-6 bg-gray-200 rounded-full w-16" />
        <div className="flex gap-2">
          <div className="h-8 w-8 bg-gray-100 rounded-lg" />
          <div className="h-8 w-8 bg-gray-100 rounded-lg" />
        </div>
      </div>
    ))}
  </div>
);

// Pagination Component
const Pagination = ({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}) => {
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  if (totalItems === 0) return null;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 bg-gray-50/50 border-t border-gray-100">
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-600">
          Showing <span className="font-semibold text-gray-900">{startItem}</span> to{' '}
          <span className="font-semibold text-gray-900">{endItem}</span> of{' '}
          <span className="font-semibold text-gray-900">{totalItems}</span>
        </span>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500">Per page:</label>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="px-2 py-1 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="px-3 py-1 text-sm font-medium text-gray-700">
          {currentPage} / {totalPages}
        </span>
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
};

// ============================================
// PLAN CARD (Step A: pick a plan visually)
// ============================================
const PlanCard = ({
  plan,
  onView,
  onAssign,
}: {
  plan: Plan;
  onView: () => void;
  onAssign: () => void;
}) => {
  const style = getPlanStyle(plan.plan_type);

  return (
    <div
      onClick={onView}
      className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-indigo-200 hover:-translate-y-0.5 transition-all duration-200 overflow-hidden cursor-pointer flex flex-col"
    >
      {/* Top color strip by plan type */}
      <div className={`h-1.5 bg-gradient-to-r ${style.gradient}`} />

      <div className="p-6 flex flex-col flex-1">
        {/* Name + type */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-gray-900 truncate group-hover:text-indigo-700 transition-colors">
              {plan.name}
            </h3>
            <span className={`inline-flex items-center mt-1.5 px-2.5 py-0.5 rounded-lg text-xs font-semibold border ${style.badge}`}>
              {plan.plan_type.toUpperCase()}
            </span>
          </div>
          {plan.featured && (
            <span className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg text-xs font-semibold">
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              Featured
            </span>
          )}
        </div>

        {/* Price */}
        <div className="mt-4 flex items-baseline gap-1.5">
          <span className="text-3xl font-extrabold text-gray-900">{formatMoney(plan.base_price)}</span>
          <span className="text-sm font-medium text-gray-500">/ {plan.billing_period}</span>
        </div>

        {/* Description */}
        <p className="mt-3 text-sm text-gray-500 line-clamp-2 min-h-[2.5rem]">
          {plan.description || 'No description provided for this plan.'}
        </p>

        {/* Meta badges */}
        <div className="mt-4 flex flex-wrap gap-2">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${
            plan.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${plan.is_active ? 'bg-emerald-500' : 'bg-red-500'}`} />
            {plan.is_active ? 'Active' : 'Inactive'}
          </span>
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${
            plan.is_public ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600'
          }`}>
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {plan.is_public ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              )}
            </svg>
            {plan.is_public ? 'Public' : 'Private'}
          </span>
          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-50 text-gray-600 border border-gray-100 capitalize">
            {plan.billing_mode}
          </span>
        </div>

        {/* Actions */}
        <div className="mt-5 pt-4 border-t border-gray-100 flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onAssign(); }}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-indigo-500/20 group-hover:shadow-indigo-500/30"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Assign Components
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onView(); }}
            className="inline-flex items-center justify-center p-2.5 text-gray-500 hover:text-indigo-600 bg-gray-50 hover:bg-indigo-50 rounded-xl transition-all"
            title="View assigned components"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================
// SELECTABLE COMPONENT CARD (select + inline quantity)
// ============================================
const SelectableComponentCard = ({
  component,
  selected,
  onToggle,
  multiplierValue,
  onMultiplierChange,
  disabled,
}: {
  component: PlanComponent;
  selected: boolean;
  onToggle: () => void;
  multiplierValue: string;
  onMultiplierChange: (value: string) => void;
  disabled?: boolean;
}) => {
  const multiplier = parseFloat(multiplierValue) || 1;
  const baseQty = component.quantity ? parseFloat(component.quantity) : null;

  return (
    <div
      className={`rounded-xl border-2 transition-all duration-150 ${
        selected
          ? 'border-indigo-500 bg-indigo-50/40 shadow-md shadow-indigo-500/10'
          : 'border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/30'
      }`}
    >
      {/* Clickable selector row */}
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        className="relative w-full text-left p-4 disabled:opacity-60"
      >
        {/* Check indicator */}
        <span className={`absolute top-3 right-3 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
          selected ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-gray-300'
        }`}>
          {selected && (
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </span>

        <div className="flex items-start gap-3 pr-7">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
            selected ? 'bg-indigo-600' : 'bg-gradient-to-br from-indigo-100 to-purple-100'
          }`}>
            <span className={`font-bold text-sm ${selected ? 'text-white' : 'text-indigo-600'}`}>
              {component.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-gray-900 truncate">{component.name}</div>
            <div className="text-xs text-gray-500 mt-0.5">{formatComponentType(component.component_type)}</div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-md text-xs font-semibold border border-emerald-100">
                {formatUnitPrice(component.price_per_unit)} / {component.unit_label}
              </span>
              {component.quantity && (
                <span className="inline-flex items-center px-2 py-0.5 bg-gray-50 text-gray-600 rounded-md text-xs font-medium border border-gray-100">
                  Base: {component.quantity} {component.unit_label}
                </span>
              )}
              {component.is_promotion_valid && (
                <span className="inline-flex items-center px-2 py-0.5 bg-purple-50 text-purple-700 rounded-md text-xs font-medium border border-purple-100">
                  {component.discount_percentage}% off
                </span>
              )}
            </div>
          </div>
        </div>
      </button>

      {/* Inline quantity (shown when selected) */}
      {selected && (
        <div className="px-4 pb-4 space-y-3">
          {/* Multiplier */}
          <div className="pt-3 border-t border-indigo-100 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide flex-shrink-0 sm:w-28">
              Multiplier
            </label>
            <div className="flex items-center gap-2 flex-1 flex-wrap">
              <div className="relative w-32">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-medium">×</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={multiplierValue}
                  onChange={(e) => onMultiplierChange(e.target.value)}
                  disabled={disabled}
                  className="w-full pl-8 pr-3 py-2 bg-white border border-gray-200 rounded-xl text-gray-900 font-semibold focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:opacity-50 transition-all"
                />
              </div>
              <span className="text-xs text-gray-400">
                Scales the component&apos;s base quantity (×2 = double)
              </span>
            </div>
          </div>

          {/* Result preview */}
          {baseQty !== null && !isNaN(baseQty) && (
            <div className="pt-2 border-t border-indigo-100 flex flex-wrap items-center gap-2 text-xs">
              <svg className="w-3.5 h-3.5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
              <span className="text-gray-500">Customer gets:</span>
              <span className="font-bold text-indigo-600">
                {(baseQty * multiplier).toLocaleString()} {component.unit_label}
              </span>
              <span className="text-gray-400">({baseQty.toLocaleString()} × {multiplier})</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ============================================
// CUSTOM HOOK
// ============================================
const useGetPlanComponentsInPlan = (planId: string) => {
  const [data, setData] = useState<PlanComponentsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getAdminId = (): string | null => {
    if (typeof window === 'undefined') return null;
    const adminUser = localStorage.getItem('superAdminUser');
    if (!adminUser) return null;
    try {
      return JSON.parse(adminUser).id || null;
    } catch {
      return null;
    }
  };

  const fetchData = useCallback(async (isRefetch = false) => {
    if (!planId) return;

    if (isRefetch) {
      setIsFetching(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const adminId = getAdminId();
      if (!adminId) throw new Error('Admin ID not found');

      const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
      if (!BASE_URL) {
        throw new Error('API base URL not configured');
      }
      const response = await fetch(
        `${BASE_URL}plans/${planId}/components/?admin_id=${adminId}&ordering=-created_at`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('superAdminToken')}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const result: PlanComponentsResponse = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch components');
    } finally {
      setIsLoading(false);
      setIsFetching(false);
    }
  }, [planId]);

  useEffect(() => {
    if (planId) {
      fetchData(false);
    } else {
      setData(null);
    }
  }, [planId, fetchData]);

  const refetch = useCallback(() => {
    if (planId) fetchData(true);
  }, [planId, fetchData]);

  return { data, isLoading, isFetching, error, refetch };
};

// ============================================
// MAIN COMPONENT
// ============================================
interface PlanComponentInclusionManagementProps {
  /** When provided, the component is locked to this plan (no plan picker view). */
  planId?: string;
  /** Renders without page chrome (min-height/padding) so it fits inside a modal. */
  embedded?: boolean;
}

const PlanComponentInclusionManagement = ({ planId, embedded = false }: PlanComponentInclusionManagementProps) => {
  // Get plan from URL query params
  const searchParams = useSearchParams();
  const planFromUrl = planId || searchParams.get('plan');

  // ---- State ----
  const [selectedPlanId, setSelectedPlanId] = useState<string>(planId || '');
  const [planSearch, setPlanSearch] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Assign flow (single step: select + configure inline)
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [componentSearch, setComponentSearch] = useState('');
  const [selectedComponentIds, setSelectedComponentIds] = useState<string[]>([]);
  const [multipliers, setMultipliers] = useState<Record<string, string>>({});

  // Edit flow
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedInclusion, setSelectedInclusion] = useState<PlanComponentInclusion | null>(null);
  const [editForm, setEditForm] = useState({ quantity_multiplier: '1', is_featured: false });

  // Table
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // ---- API Hooks ----
  const { data: plansResponse, isLoading: isLoadingPlans } = useGetPlansQuery({});
  const plans: Plan[] = (plansResponse?.results || []) as unknown as Plan[];

  // Auto-select plan from URL when plans are loaded
  useEffect(() => {
    if (planFromUrl && plans.length > 0 && !selectedPlanId) {
      const planExists = plans.some(p => p.id === planFromUrl);
      if (planExists) {
        setSelectedPlanId(planFromUrl);
      }
    }
  }, [planFromUrl, plans, selectedPlanId]);

  const { data: componentsResponse, isLoading: isLoadingComponents } = useGetPlanComponentsQuery({ is_active: true, limit: 1000 });
  const allComponents = (componentsResponse?.results || []) as unknown as PlanComponent[];

  const { data: inclusionsData, isLoading: isLoadingInclusions, isFetching, error: inclusionsError, refetch } = useGetPlanComponentsInPlan(selectedPlanId);

  const [addComponentToPlan, { isLoading: isAdding }] = useAddComponentToPlanMutation();
  const [updateComponentInPlan, { isLoading: isUpdating }] = useUpdatePlanComponentInclusionMutation();
  const [removeComponent] = useRemoveComponentFromPlanMutation();

  // ---- Derived state ----
  const inclusions = useMemo(() => inclusionsData?.components || [], [inclusionsData]);
  const selectedPlan = plans.find(p => p.id === selectedPlanId);
  const showOverlay = isFetching && !isLoadingInclusions;

  const filteredPlans = useMemo(() => {
    const q = planSearch.trim().toLowerCase();
    if (!q) return plans;
    return plans.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.plan_type.toLowerCase().includes(q) ||
      (p.description || '').toLowerCase().includes(q)
    );
  }, [plans, planSearch]);

  // Pagination
  const totalItems = inclusions.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const paginatedInclusions = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return inclusions.slice(start, start + pageSize);
  }, [inclusions, currentPage, pageSize]);

  // Available components (not already in plan)
  const availableComponents = useMemo(() => {
    const includedIds = new Set(inclusions.map(i => i.component.id));
    return allComponents.filter(c => !includedIds.has(c.id));
  }, [allComponents, inclusions]);

  const filteredAvailableComponents = useMemo(() => {
    const q = componentSearch.trim().toLowerCase();
    if (!q) return availableComponents;
    return availableComponents.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.component_type.toLowerCase().includes(q) ||
      (c.description || '').toLowerCase().includes(q)
    );
  }, [availableComponents, componentSearch]);

  const allFilteredSelected = useMemo(
    () => filteredAvailableComponents.length > 0 && filteredAvailableComponents.every(c => selectedComponentIds.includes(c.id)),
    [filteredAvailableComponents, selectedComponentIds]
  );

  // ---- Success toast auto-dismiss ----
  useEffect(() => {
    if (!successMessage) return;
    const t = setTimeout(() => setSuccessMessage(null), 4000);
    return () => clearTimeout(t);
  }, [successMessage]);

  // ---- Handlers ----
  const openPlan = useCallback((planId: string) => {
    setSelectedPlanId(planId);
    setCurrentPage(1);
  }, []);

  const backToPlans = useCallback(() => {
    setSelectedPlanId('');
    setPlanSearch('');
    setCurrentPage(1);
  }, []);

  const resetAssignFlow = useCallback(() => {
    setComponentSearch('');
    setSelectedComponentIds([]);
    setMultipliers({});
  }, []);

  const openAssignFlow = useCallback((planId: string) => {
    setSelectedPlanId(planId);
    setCurrentPage(1);
    resetAssignFlow();
    setIsAssignOpen(true);
  }, [resetAssignFlow]);

  const closeAssignFlow = useCallback(() => {
    if (isAdding) return;
    setIsAssignOpen(false);
    resetAssignFlow();
  }, [isAdding, resetAssignFlow]);

  const toggleComponent = useCallback((componentId: string) => {
    setSelectedComponentIds(prev =>
      prev.includes(componentId)
        ? prev.filter(id => id !== componentId)
        : [...prev, componentId]
    );
    setMultipliers(prev => (prev[componentId] ? prev : { ...prev, [componentId]: '1' }));
  }, []);

  // Bulk select/deselect all currently visible (filtered) components
  const toggleSelectAll = useCallback(() => {
    const filteredIds = filteredAvailableComponents.map(c => c.id);
    if (allFilteredSelected) {
      const idSet = new Set(filteredIds);
      setSelectedComponentIds(prev => prev.filter(id => !idSet.has(id)));
    } else {
      setSelectedComponentIds(prev => Array.from(new Set([...prev, ...filteredIds])));
      setMultipliers(prev => {
        const next = { ...prev };
        filteredIds.forEach(id => {
          if (!next[id]) next[id] = '1';
        });
        return next;
      });
    }
  }, [filteredAvailableComponents, allFilteredSelected]);

  const handleAssignSubmit = async () => {
    if (!selectedPlanId || selectedComponentIds.length === 0) return;

    try {
      await addComponentToPlan({
        planId: selectedPlanId,
        data: {
          components: selectedComponentIds.map(id => ({
            component_id: id,
            quantity_multiplier: parseFloat(multipliers[id]) || 1,
            is_included: true,
          })),
        },
      }).unwrap();

      const count = selectedComponentIds.length;
      setIsAssignOpen(false);
      resetAssignFlow();
      refetch();
      setSuccessMessage(`${count} component${count > 1 ? 's' : ''} assigned to "${selectedPlan?.name}" successfully!`);
    } catch (error: unknown) {
      const apiError = error as ApiErrorResponse;
      alert(apiError?.data?.detail || apiError?.data?.message || 'Failed to assign components');
    }
  };

  const handleEdit = useCallback((inclusion: PlanComponentInclusion) => {
    setSelectedInclusion(inclusion);
    setEditForm({
      quantity_multiplier: inclusion.quantity_multiplier,
      is_featured: inclusion.is_featured,
    });
    setIsEditModalOpen(true);
  }, []);

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlanId || !selectedInclusion) return;

    try {
      await updateComponentInPlan({
        planId: selectedPlanId,
        inclusionId: selectedInclusion.id,
        data: {
          quantity_multiplier: parseFloat(editForm.quantity_multiplier) || 1,
          is_featured: editForm.is_featured,
        },
      }).unwrap();

      setIsEditModalOpen(false);
      setSelectedInclusion(null);
      refetch();
      setSuccessMessage('Component updated successfully!');
    } catch (error: unknown) {
      const apiError = error as ApiErrorResponse;
      alert(apiError?.data?.detail || apiError?.data?.message || 'Failed to update component');
    }
  };

  const handleRemove = async (inclusionId: string, componentName: string) => {
    if (!selectedPlanId) return;
    if (!window.confirm(`Remove "${componentName}" from this plan?`)) return;

    setRemovingId(inclusionId);
    try {
      await removeComponent({ planId: selectedPlanId, componentId: inclusionId }).unwrap();
      refetch();
      setSuccessMessage(`"${componentName}" removed from the plan.`);
    } catch (error: unknown) {
      const apiError = error as ApiErrorResponse;
      alert(apiError?.data?.detail || 'Failed to remove component');
    } finally {
      setRemovingId(null);
    }
  };

  const planStyle = selectedPlan ? getPlanStyle(selectedPlan.plan_type) : null;

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className={embedded ? '' : 'min-h-screen bg-gray-50/30'}>
      <div className={embedded ? '' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8'}>

        {/* Success Toast */}
        {successMessage && (
          <div className="fixed top-6 right-6 z-[60] animate-[slideIn_0.2s_ease-out]">
            <div className="flex items-center gap-3 px-5 py-3.5 bg-white rounded-xl shadow-2xl border border-emerald-100">
              <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <span className="text-sm font-medium text-gray-800">{successMessage}</span>
              <button onClick={() => setSuccessMessage(null)} className="ml-2 p-1 text-gray-400 hover:text-gray-600 rounded-lg">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* ============================================ */}
        {/* VIEW 1: PLAN CARDS LIST                      */}
        {/* ============================================ */}
        {!selectedPlanId && (
          <>
            {/* Header */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">Link Components to Plans</h1>
                  <p className="text-gray-500 mt-1">
                    Pick a plan below, then assign the components (tokens, storage, API calls...) it should include.
                  </p>
                </div>
                <div className="relative w-full lg:w-80">
                  <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    value={planSearch}
                    onChange={(e) => setPlanSearch(e.target.value)}
                    placeholder="Search plans..."
                    className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-700 placeholder-gray-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                </div>
              </div>

              {/* How it works strip */}
              <div className="mt-5 flex flex-col sm:flex-row gap-3">
                {[
                  { n: 1, label: 'Pick a plan card below' },
                  { n: 2, label: 'Click "Assign Components"' },
                  { n: 3, label: 'Choose components & set quantity' },
                ].map((s, i) => (
                  <div key={s.n} className="flex items-center gap-3 flex-1">
                    <div className="flex items-center gap-2.5 px-3.5 py-2 bg-indigo-50/60 border border-indigo-100 rounded-xl flex-1">
                      <span className="w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {s.n}
                      </span>
                      <span className="text-sm font-medium text-indigo-900">{s.label}</span>
                    </div>
                    {i < 2 && (
                      <svg className="hidden sm:block w-5 h-5 text-indigo-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Plan cards grid */}
            {isLoadingPlans ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {Array.from({ length: 6 }).map((_, i) => <PlanCardSkeleton key={i} />)}
              </div>
            ) : filteredPlans.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12">
                <div className="text-center max-w-md mx-auto">
                  <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    {planSearch ? 'No plans match your search' : 'No plans found'}
                  </h3>
                  <p className="text-gray-500">
                    {planSearch
                      ? `Nothing found for "${planSearch}". Try a different keyword.`
                      : 'Create a plan first from the Plans page, then come back here to assign components.'}
                  </p>
                  {planSearch && (
                    <button
                      onClick={() => setPlanSearch('')}
                      className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all font-medium"
                    >
                      Clear search
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {filteredPlans.map((plan) => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    onView={() => openPlan(plan.id)}
                    onAssign={() => openAssignFlow(plan.id)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* ============================================ */}
        {/* VIEW 2: SELECTED PLAN DETAIL                 */}
        {/* ============================================ */}
        {selectedPlanId && (
          <>
            {/* Back + header */}
            {!embedded && (
              <button
                onClick={backToPlans}
                className="inline-flex items-center gap-2 mb-4 px-3 py-2 text-sm font-medium text-gray-600 hover:text-indigo-600 bg-white hover:bg-indigo-50 border border-gray-200 hover:border-indigo-200 rounded-xl transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                All Plans
              </button>
            )}

            {/* Plan banner */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6">
              {planStyle && <div className={`h-1.5 bg-gradient-to-r ${planStyle.gradient}`} />}
              <div className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h1 className="text-2xl font-bold text-gray-900">{selectedPlan?.name || 'Plan'}</h1>
                      {selectedPlan && planStyle && (
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border ${planStyle.badge}`}>
                          {selectedPlan.plan_type.toUpperCase()}
                        </span>
                      )}
                      {selectedPlan && (
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${
                          selectedPlan.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${selectedPlan.is_active ? 'bg-emerald-500' : 'bg-red-500'}`} />
                          {selectedPlan.is_active ? 'Active' : 'Inactive'}
                        </span>
                      )}
                    </div>
                    {selectedPlan && (
                      <div className="mt-2 flex items-baseline gap-1.5">
                        <span className="text-2xl font-extrabold text-gray-900">{formatMoney(selectedPlan.base_price)}</span>
                        <span className="text-sm font-medium text-gray-500">/ {selectedPlan.billing_period}</span>
                        <span className="ml-2 text-xs text-gray-400 capitalize">• {selectedPlan.billing_mode}</span>
                      </div>
                    )}
                    {selectedPlan?.description && (
                      <p className="mt-2 text-sm text-gray-500 max-w-2xl">{selectedPlan.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="text-center px-5 py-3 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border border-indigo-100">
                      <div className="text-3xl font-bold text-indigo-600">{isLoadingInclusions ? '—' : inclusions.length}</div>
                      <div className="text-xs font-medium text-gray-500 mt-0.5">Assigned Components</div>
                    </div>
                    <button
                      onClick={() => { resetAssignFlow(); setIsAssignOpen(true); }}
                      disabled={isLoadingInclusions || isLoadingComponents}
                      className="inline-flex items-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl font-semibold transition-all shadow-lg shadow-indigo-500/25"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      Assign Components
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Error */}
            {inclusionsError && (
              <div className="bg-white rounded-2xl shadow-sm border border-red-100 p-8">
                <div className="text-center">
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Error Loading Components</h3>
                  <p className="text-gray-500 mt-2">{inclusionsError}</p>
                  <button
                    onClick={() => refetch()}
                    className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            )}

            {/* Assigned components table */}
            {!inclusionsError && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden relative">
                {/* Loading Overlay */}
                {showOverlay && (
                  <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px] z-10 flex items-center justify-center">
                    <div className="flex items-center gap-3 bg-white px-5 py-3 rounded-xl shadow-lg border border-gray-100">
                      <LoadingSpinner size="sm" className="text-indigo-600" />
                      <span className="text-sm font-medium text-gray-700">Updating...</span>
                    </div>
                  </div>
                )}

                {isLoadingInclusions ? (
                  <TableSkeleton rows={pageSize} />
                ) : inclusions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <div className="w-20 h-20 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-2xl flex items-center justify-center mb-6">
                      <svg className="w-10 h-10 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">No Components Assigned Yet</h3>
                    <p className="text-gray-500 mb-6 text-center max-w-sm">
                      This plan is empty. Click the button below to choose which components customers will get with this plan.
                    </p>
                    <button
                      onClick={() => { resetAssignFlow(); setIsAssignOpen(true); }}
                      disabled={availableComponents.length === 0}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white rounded-xl font-medium transition-all duration-200 shadow-lg shadow-indigo-500/25 disabled:shadow-none"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      {availableComponents.length > 0 ? 'Assign First Component' : 'No Components Available'}
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-100">
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Component</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Pricing</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Multiplier</th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {paginatedInclusions.map((inclusion) => (
                            <tr key={inclusion.id} className="hover:bg-gray-50/50 transition-colors">
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center flex-shrink-0">
                                    <span className="text-indigo-600 font-bold text-sm">
                                      {inclusion.component.name.charAt(0).toUpperCase()}
                                    </span>
                                  </div>
                                  <div>
                                    <div className="font-medium text-gray-900">{inclusion.component.name}</div>
                                    <div className="text-sm text-gray-500">{inclusion.component.unit_label}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                                  {formatComponentType(inclusion.component.component_type)}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2 text-sm">
                                    <span className="text-gray-400 w-10">Cost</span>
                                    <span className="font-medium text-gray-700">{formatUnitPrice(inclusion.component.cost_per_unit)}</span>
                                  </div>
                                  <div className="flex items-center gap-2 text-sm">
                                    <span className="text-gray-400 w-10">Price</span>
                                    <span className="font-semibold text-indigo-600">{formatUnitPrice(inclusion.component.price_per_unit)}</span>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <span className="inline-flex items-center px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm font-bold border border-blue-100">
                                  ×{inclusion.quantity_multiplier}
                                </span>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex flex-col gap-1.5">
                                  <span className={`inline-flex items-center gap-1.5 w-fit px-2.5 py-1 rounded-full text-xs font-semibold ${
                                    inclusion.component.is_active
                                      ? 'bg-emerald-50 text-emerald-700'
                                      : 'bg-red-50 text-red-700'
                                  }`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${inclusion.component.is_active ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                    {inclusion.component.is_active ? 'Active' : 'Inactive'}
                                  </span>
                                  {(inclusion.is_featured || inclusion.component.is_renewable || inclusion.component.is_promotion_valid) && (
                                    <div className="flex flex-wrap gap-1">
                                      {inclusion.is_featured && (
                                        <span className="inline-flex items-center px-2 py-0.5 bg-amber-50 text-amber-700 rounded text-xs font-medium border border-amber-100">
                                          Featured
                                        </span>
                                      )}
                                      {inclusion.component.is_renewable && (
                                        <span className="inline-flex items-center px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium border border-blue-100">
                                          Renewable
                                        </span>
                                      )}
                                      {inclusion.component.is_promotion_valid && (
                                        <span className="inline-flex items-center px-2 py-0.5 bg-purple-50 text-purple-700 rounded text-xs font-medium border border-purple-100">
                                          {inclusion.component.discount_percentage}% off
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    onClick={() => handleEdit(inclusion)}
                                    disabled={isUpdating}
                                    className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg disabled:opacity-40 transition-all"
                                    title="Edit"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => handleRemove(inclusion.id, inclusion.component.name)}
                                    disabled={removingId === inclusion.id}
                                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-40 transition-all"
                                    title="Remove"
                                  >
                                    {removingId === inclusion.id ? (
                                      <LoadingSpinner size="sm" className="text-red-500" />
                                    ) : (
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                    )}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <Pagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      totalItems={totalItems}
                      pageSize={pageSize}
                      onPageChange={setCurrentPage}
                      onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
                    />
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ============================================ */}
      {/* ASSIGN COMPONENTS (select + configure inline) */}
      {/* ============================================ */}
      {isAssignOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={closeAssignFlow} />

          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-100 rounded-xl">
                      <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">Assign Components</h2>
                      <p className="text-sm text-gray-500">
                        Plan: <span className="font-medium text-indigo-600">{selectedPlan?.name}</span>
                        <span className="mx-1.5 text-gray-300">•</span>
                        Select components and set quantity right on each card
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={closeAssignFlow}
                    disabled={isAdding}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all disabled:opacity-50"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* ---------- Search + bulk select ---------- */}
              <div className="px-6 pt-4 space-y-3">
                <div className="relative">
                  <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    value={componentSearch}
                    onChange={(e) => setComponentSearch(e.target.value)}
                    placeholder="Search components by name or type..."
                    className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-700 placeholder-gray-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                </div>

                {!(isLoadingComponents || isLoadingInclusions) && filteredAvailableComponents.length > 0 && (
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={toggleSelectAll}
                      disabled={isAdding}
                      className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-indigo-600 disabled:opacity-50 transition-all"
                    >
                      <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                        allFilteredSelected ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-gray-300'
                      }`}>
                        {allFilteredSelected && (
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </span>
                      {allFilteredSelected
                        ? 'Deselect all'
                        : `Select all (${filteredAvailableComponents.length})`}
                    </button>
                    {selectedComponentIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedComponentIds([])}
                        disabled={isAdding}
                        className="text-xs font-medium text-gray-400 hover:text-red-500 underline disabled:opacity-50 transition-all"
                      >
                        Clear selection
                      </button>
                    )}
                  </div>
                )}
              </div>

                  <div className="flex-1 overflow-y-auto px-6 py-4 min-h-[280px]">
                    {(isLoadingComponents || isLoadingInclusions) ? (
                      <div className="flex flex-col items-center justify-center py-16">
                        <LoadingSpinner size="lg" className="text-indigo-600" />
                        <p className="mt-4 text-gray-500 text-sm">Loading components...</p>
                      </div>
                    ) : availableComponents.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mb-4">
                          <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <h3 className="font-semibold text-gray-900">All components already assigned!</h3>
                        <p className="text-sm text-gray-500 mt-1 max-w-xs">
                          Every available component is already in this plan. Create new components first if you need more.
                        </p>
                      </div>
                    ) : filteredAvailableComponents.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 text-center">
                        <h3 className="font-semibold text-gray-900">No components match &quot;{componentSearch}&quot;</h3>
                        <button
                          onClick={() => setComponentSearch('')}
                          className="mt-3 text-sm font-medium text-indigo-600 hover:text-indigo-700"
                        >
                          Clear search
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {filteredAvailableComponents.map((comp) => (
                          <SelectableComponentCard
                            key={comp.id}
                            component={comp}
                            selected={selectedComponentIds.includes(comp.id)}
                            onToggle={() => toggleComponent(comp.id)}
                            multiplierValue={multipliers[comp.id] ?? '1'}
                            onMultiplierChange={(v) => setMultipliers(prev => ({ ...prev, [comp.id]: v }))}
                            disabled={isAdding}
                          />
                        ))}
                      </div>
                    )}
                  </div>

              {/* Footer */}
              <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
                <span className="text-sm text-gray-500">
                  {selectedComponentIds.length === 0
                    ? 'Tap the cards to select'
                    : <><span className="font-bold text-indigo-600">{selectedComponentIds.length}</span> selected</>}
                </span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={closeAssignFlow}
                    disabled={isAdding}
                    className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-xl font-medium hover:bg-gray-50 disabled:opacity-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAssignSubmit}
                    disabled={isAdding || selectedComponentIds.length === 0}
                    className="inline-flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl font-medium transition-all shadow-lg shadow-indigo-500/25 disabled:shadow-none"
                  >
                    {isAdding && <LoadingSpinner size="sm" />}
                    {isAdding
                      ? 'Assigning...'
                      : selectedComponentIds.length === 0
                        ? 'Assign Components'
                        : `Assign ${selectedComponentIds.length} Component${selectedComponentIds.length > 1 ? 's' : ''}`}
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ============================================ */}
      {/* EDIT INCLUSION MODAL                         */}
      {/* ============================================ */}
      {isEditModalOpen && selectedInclusion && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => !isUpdating && (setIsEditModalOpen(false), setSelectedInclusion(null))} />

          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl">
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 rounded-xl">
                    <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Edit Component Inclusion</h2>
                    <p className="text-sm text-gray-500">{selectedInclusion.component.name}</p>
                  </div>
                </div>
                <button
                  onClick={() => !isUpdating && (setIsEditModalOpen(false), setSelectedInclusion(null))}
                  disabled={isUpdating}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all disabled:opacity-50"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Modal Body */}
              <form onSubmit={handleEditSubmit}>
                <div className="px-6 py-5 space-y-5">
                  {/* Component Info (Read-only) */}
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="text-sm font-medium text-gray-700 mb-3">Component Details</div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Name</span>
                        <span className="font-medium text-gray-900">{selectedInclusion.component.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Type</span>
                        <span className="text-gray-700">{formatComponentType(selectedInclusion.component.component_type)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Unit Price</span>
                        <span className="text-gray-700">{formatUnitPrice(selectedInclusion.component.price_per_unit)}/{selectedInclusion.component.unit_label}</span>
                      </div>
                    </div>
                  </div>

                  {/* Multiplier Input */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Quantity Multiplier <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 font-medium">×</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={editForm.quantity_multiplier}
                        onChange={(e) => setEditForm(prev => ({ ...prev, quantity_multiplier: e.target.value }))}
                        disabled={isUpdating}
                        className="w-full pl-9 pr-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:opacity-50 transition-all"
                        placeholder="1"
                        required
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Multiplier applied to the component quantity</p>
                  </div>

                  {/* Featured Toggle */}
                  <div>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={editForm.is_featured}
                          onChange={(e) => setEditForm(prev => ({ ...prev, is_featured: e.target.checked }))}
                          disabled={isUpdating}
                          className="sr-only peer"
                        />
                        <div className="w-10 h-5 bg-gray-200 rounded-full peer-checked:bg-amber-500 peer-disabled:opacity-50 transition-colors" />
                        <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow peer-checked:translate-x-5 transition-transform" />
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-700">Featured Component</span>
                        <p className="text-xs text-gray-500">Highlight this component in the plan</p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
                  <button
                    type="button"
                    onClick={() => !isUpdating && (setIsEditModalOpen(false), setSelectedInclusion(null))}
                    disabled={isUpdating}
                    className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-xl font-medium hover:bg-gray-50 disabled:opacity-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdating}
                    className="inline-flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl font-medium transition-all shadow-lg shadow-indigo-500/25 disabled:shadow-none"
                  >
                    {isUpdating && <LoadingSpinner size="sm" />}
                    {isUpdating ? 'Updating...' : 'Update'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlanComponentInclusionManagement;
