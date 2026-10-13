// components/subscription-model/plan/AgentComponentPricingManagement.tsx
"use client";
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  useGetAgentTemplatesByAdminIdQuery,
  AgentTemplate,
} from '@/features/agentTemplateApi/agentTemplateApi';
import {
  useGetPlanComponentsQuery,
  PlanComponent,
} from '@/features/subscriptionModel/billing/billingApi';

// ============================================
// TYPES
// ============================================
interface AgentComponentPricing {
  id: string;
  component_id: string;
  component_name: string;
  component_type: string;
  component_type_display?: string;
  total_quantity: number | string | null;
  base_price_per_unit: number | string;
  override_price: number | string | null;
  effective_price_per_unit: number;
  unit_label: string;
  is_unlimited: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface AgentComponentsResponse {
  agent_id: string;
  agent_name: string;
  components: AgentComponentPricing[];
  count: number;
}

interface FormData {
  component_id: string;
  total_quantity: string;
  override_price: string;
  is_unlimited: boolean;
}

// ============================================
// CONSTANTS
// ============================================
const PAGE_SIZE_OPTIONS = [10, 25, 50];
const DEFAULT_PAGE_SIZE = 10;

const CARD_GRADIENTS = [
  'from-indigo-500 to-purple-500',
  'from-sky-500 to-blue-500',
  'from-emerald-500 to-teal-500',
  'from-amber-500 to-orange-500',
  'from-pink-500 to-rose-500',
];

const getAgentGradient = (key: string) =>
  CARD_GRADIENTS[(key?.charCodeAt(0) || 0) % CARD_GRADIENTS.length];

// ============================================
// HELPERS
// ============================================
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

const formatPrice = (price: string | number | null | undefined) => {
  if (price === null || price === undefined) return '$0.0000';
  const num = typeof price === 'string' ? parseFloat(price) : price;
  if (!Number.isFinite(num)) return '$0.0000';
  const [whole, fraction = ''] = num.toFixed(10).split('.');
  const trimmed = fraction.replace(/0+$/, '').padEnd(4, '0');
  return `$${whole}.${trimmed}`;
};

// ============================================
// CUSTOM HOOK: fetch agent components
// ============================================
const useGetAgentComponents = (agentId: string) => {
  const [data, setData] = useState<AgentComponentsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (isRefetch = false) => {
    if (!agentId) return;

    if (isRefetch) {
      setIsFetching(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const adminId = getAdminId();
      if (!adminId) {
        throw new Error('Admin ID not found');
      }

      const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
      if (!BASE_URL) {
        throw new Error('API base URL not configured');
      }
      const response = await fetch(
        `${BASE_URL}agent-templates/${agentId}/components/?admin_id=${adminId}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('superAdminToken')}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: AgentComponentsResponse = await response.json();
      setData(result);
    } catch (err) {
      console.error('Failed to fetch agent components:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch components');
    } finally {
      setIsLoading(false);
      setIsFetching(false);
    }
  }, [agentId]);

  useEffect(() => {
    if (agentId) {
      fetchData(false);
    } else {
      setData(null);
    }
  }, [agentId, fetchData]);

  const refetch = () => {
    if (agentId) {
      fetchData(true);
    }
  };

  return { data, isLoading, isFetching, error, refetch };
};

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

const AgentCardSkeleton = () => (
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
        <div className="h-6 bg-gray-200 rounded-lg w-16" />
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
// AGENT CARD (Step A: pick an agent visually)
// ============================================
const AgentCard = ({
  agent,
  onView,
  onConfigure,
}: {
  agent: AgentTemplate;
  onView: () => void;
  onConfigure: () => void;
}) => {
  const gradient = getAgentGradient(agent.agent_type);

  return (
    <div
      onClick={onView}
      className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:border-indigo-200 hover:-translate-y-0.5 transition-all duration-200 overflow-hidden cursor-pointer flex flex-col"
    >
      {/* Top color strip by agent type */}
      <div className={`h-1.5 bg-gradient-to-r ${gradient}`} />

      <div className="p-6 flex flex-col flex-1">
        {/* Name + type */}
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-bold text-gray-900 truncate group-hover:text-indigo-700 transition-colors">
              {agent.name}
            </h3>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-semibold border bg-indigo-50 text-indigo-700 border-indigo-200">
                {agent.agent_type.toUpperCase()}
              </span>
              {agent.agent_variant && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-semibold border bg-purple-50 text-purple-700 border-purple-200">
                  {agent.agent_variant}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Description */}
        <p className="mt-3 text-sm text-gray-500 line-clamp-2 min-h-[2.5rem]">
          {agent.description || 'No description provided for this agent.'}
        </p>

        {/* Meta badges */}
        <div className="mt-4 flex flex-wrap gap-2">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${
            agent.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${agent.is_active ? 'bg-emerald-500' : 'bg-red-500'}`} />
            {agent.is_active ? 'Active' : 'Inactive'}
          </span>
          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-50 text-gray-600 border border-gray-100">
            {agent.agent_category}
          </span>
          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-blue-50 text-blue-700">
            {agent.instances_count} instance{agent.instances_count === 1 ? '' : 's'}
          </span>
        </div>

        {/* Actions */}
        <div className="mt-auto pt-4 border-t border-gray-100 flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onConfigure(); }}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-indigo-500/20 group-hover:shadow-indigo-500/30"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Configure Components
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onView(); }}
            className="inline-flex items-center justify-center p-2.5 text-gray-500 hover:text-indigo-600 bg-gray-50 hover:bg-indigo-50 rounded-xl transition-all"
            title="View components"
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
// DELETE CONFIRMATION MODAL
// ============================================
const DeleteConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  componentName,
  isDeleting,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  componentName: string;
  isDeleting: boolean;
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={isDeleting ? undefined : onClose} />

      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-xl">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Remove Component</h2>
            </div>
            <button
              onClick={onClose}
              disabled={isDeleting}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all disabled:opacity-50"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-5">
            <p className="text-gray-700">
              Are you sure you want to remove <span className="font-semibold text-gray-900">&quot;{componentName}&quot;</span> from this agent?
            </p>
            <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3">
              <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-sm text-red-700">
                This action cannot be undone. The component pricing configuration will be permanently removed.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
            <button
              onClick={onClose}
              disabled={isDeleting}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-xl font-medium hover:bg-gray-50 disabled:opacity-50 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isDeleting}
              className="inline-flex items-center gap-2 px-5 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-xl font-medium transition-all shadow-lg shadow-red-500/25 disabled:shadow-none"
            >
              {isDeleting && <LoadingSpinner size="sm" />}
              {isDeleting ? 'Removing...' : 'Remove'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================
// ADD COMPONENT MODAL (single-step: select + configure inline)
// ============================================
export interface AddComponentItem {
  component_id: string;
  total_quantity: number | null;
  override_price: number | string | null;
  is_unlimited: boolean;
}

const SelectableAddComponentCard = ({
  component,
  selected,
  onToggle,
  quantityValue,
  onQuantityChange,
  overrideValue,
  onOverrideChange,
  isUnlimited,
  onUnlimitedToggle,
  disabled,
}: {
  component: PlanComponent;
  selected: boolean;
  onToggle: () => void;
  quantityValue: string;
  onQuantityChange: (value: string) => void;
  overrideValue: string;
  onOverrideChange: (value: string) => void;
  isUnlimited: boolean;
  onUnlimitedToggle: () => void;
  disabled?: boolean;
}) => {
  const basePrice = parseFloat(component.price_per_unit);
  const effectivePrice = overrideValue ? parseFloat(overrideValue) : basePrice;

  return (
    <div
      className={`rounded-xl border transition-all ${
        selected
          ? 'border-indigo-500 bg-indigo-50/40 ring-2 ring-indigo-500/20'
          : 'border-gray-200 bg-white hover:border-indigo-200 hover:bg-indigo-50/40'
      } ${disabled ? 'opacity-50' : ''}`}
    >
      {/* Selector row */}
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        className="w-full flex items-center gap-3 p-3 text-left disabled:cursor-not-allowed"
      >
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
          selected ? 'bg-indigo-600 text-white' : 'bg-gradient-to-br from-indigo-100 to-purple-100 text-indigo-600'
        }`}>
          <span className="font-bold text-sm">{component.component_type.charAt(0).toUpperCase()}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-900 truncate">{component.name}</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-gray-100 text-gray-600">
              {component.component_type}
            </span>
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            {formatPrice(basePrice)}/{component.unit_label}
          </div>
        </div>
        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
          selected ? 'border-indigo-600 bg-indigo-600' : 'border-gray-300'
        }`}>
          {selected && (
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
      </button>

      {/* Inline configuration (visible when selected) */}
      {selected && (
        <div className="px-3 pb-3 pt-1 border-t border-indigo-100 space-y-3">
          {/* Unlimited toggle */}
          <div className="flex items-center gap-2.5 pt-2">
            <button
              type="button"
              onClick={onUnlimitedToggle}
              disabled={disabled}
              className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
                isUnlimited ? 'bg-indigo-600' : 'bg-gray-300'
              }`}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                isUnlimited ? 'translate-x-[18px]' : 'translate-x-1'
              }`} />
            </button>
            <span className="text-xs font-medium text-indigo-900">Unlimited usage</span>
            {isUnlimited && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-700">
                ∞ Unlimited
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Total Quantity */}
            {!isUnlimited && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Total Quantity <span className="text-gray-400 font-normal">(Optional)</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={quantityValue}
                    onChange={(e) => onQuantityChange(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    disabled={disabled}
                    placeholder="e.g. 1000"
                    className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all disabled:opacity-50"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
                    {component.unit_label}
                  </div>
                </div>
              </div>
            )}

            {/* Override Price */}
            <div className={isUnlimited ? 'sm:col-span-2' : ''}>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Override Price <span className="text-gray-400 font-normal">(Optional)</span>
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">$</div>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={overrideValue}
                  onChange={(e) => onOverrideChange(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  disabled={disabled}
                  placeholder="Default price"
                  className="w-full pl-7 pr-3 py-2 text-sm bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all disabled:opacity-50"
                />
              </div>
            </div>
          </div>

          {/* Effective price preview */}
          <div className="flex items-center justify-between px-3 py-2 bg-white rounded-lg border border-indigo-100 text-xs">
            <span className="text-gray-500">
              {isUnlimited
                ? 'Users get unrestricted consumption'
                : quantityValue
                  ? `${Number(quantityValue).toLocaleString()} ${component.unit_label} allocated`
                  : 'No quantity allocated'}
            </span>
            <span className={`font-bold ${overrideValue ? 'text-orange-600' : 'text-indigo-700'}`}>
              {formatPrice(isNaN(effectivePrice) ? basePrice : effectivePrice)}/{component.unit_label}
              {overrideValue && <span className="ml-1 font-semibold text-[10px] uppercase">(override)</span>}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

const AddComponentModal = ({
  isOpen,
  onClose,
  onSubmit,
  availableComponents,
  agentName,
  isAdding,
  isLoadingComponents,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (items: AddComponentItem[]) => void;
  availableComponents: PlanComponent[];
  agentName: string;
  isAdding: boolean;
  isLoadingComponents: boolean;
}) => {
  const [componentSearch, setComponentSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [overridePrices, setOverridePrices] = useState<Record<string, string>>({});
  const [unlimitedFlags, setUnlimitedFlags] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!isOpen) {
      setComponentSearch('');
      setSelectedIds([]);
      setQuantities({});
      setOverridePrices({});
      setUnlimitedFlags({});
    }
  }, [isOpen]);

  const searchedComponents = useMemo(() => {
    const q = componentSearch.trim().toLowerCase();
    if (!q) return availableComponents;
    return availableComponents.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.component_type.toLowerCase().includes(q)
    );
  }, [availableComponents, componentSearch]);

  const allFilteredSelected = useMemo(
    () => searchedComponents.length > 0 && searchedComponents.every(c => selectedIds.includes(c.id)),
    [searchedComponents, selectedIds]
  );

  const toggleComponent = useCallback((id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }, []);

  const toggleSelectAll = useCallback(() => {
    const filteredIds = searchedComponents.map(c => c.id);
    if (allFilteredSelected) {
      const idSet = new Set(filteredIds);
      setSelectedIds(prev => prev.filter(id => !idSet.has(id)));
    } else {
      setSelectedIds(prev => Array.from(new Set([...prev, ...filteredIds])));
    }
  }, [searchedComponents, allFilteredSelected]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.length === 0) return;
    onSubmit(selectedIds.map(id => ({
      component_id: id,
      total_quantity: unlimitedFlags[id] ? null : (quantities[id] ? parseFloat(quantities[id]) : null),
      override_price: overridePrices[id]?.trim() ? overridePrices[id].trim() : null,
      is_unlimited: !!unlimitedFlags[id],
    })));
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={isAdding ? undefined : onClose} />

      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-xl">
                <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Add Components</h2>
                <p className="text-sm text-gray-500">
                  Agent: <span className="font-medium text-indigo-600">{agentName}</span> · Select components and configure each right on its card
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={isAdding}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all disabled:opacity-50"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {availableComponents.length === 0 ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                  <svg className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p className="text-sm text-amber-700">
                    All available components are already configured for this agent.
                  </p>
                </div>
              ) : isLoadingComponents ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : (
                <>
                  {/* Search */}
                  <div className="relative mb-3">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      placeholder="Search components..."
                      value={componentSearch}
                      onChange={(e) => setComponentSearch(e.target.value)}
                      disabled={isAdding}
                      className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    />
                  </div>

                  {/* Bulk select row */}
                  {searchedComponents.length > 0 && (
                    <div className="flex items-center justify-between mb-3">
                      <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={allFilteredSelected}
                          onChange={toggleSelectAll}
                          disabled={isAdding}
                          className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        />
                        <span className="text-sm font-medium text-gray-700">
                          Select all ({searchedComponents.length})
                        </span>
                      </label>
                      {selectedIds.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelectedIds([])}
                          disabled={isAdding}
                          className="text-sm font-medium text-gray-500 hover:text-red-600 transition-colors disabled:opacity-50"
                        >
                          Clear selection
                        </button>
                      )}
                    </div>
                  )}

                  {/* Component list */}
                  <div className="space-y-3">
                    {searchedComponents.length === 0 ? (
                      <div className="py-6 text-center text-sm text-gray-500">
                        No components match &quot;{componentSearch}&quot;
                      </div>
                    ) : (
                      searchedComponents.map((comp) => (
                        <SelectableAddComponentCard
                          key={comp.id}
                          component={comp}
                          selected={selectedIds.includes(comp.id)}
                          onToggle={() => toggleComponent(comp.id)}
                          quantityValue={quantities[comp.id] ?? ''}
                          onQuantityChange={(v) => setQuantities(prev => ({ ...prev, [comp.id]: v }))}
                          overrideValue={overridePrices[comp.id] ?? ''}
                          onOverrideChange={(v) => setOverridePrices(prev => ({ ...prev, [comp.id]: v }))}
                          isUnlimited={!!unlimitedFlags[comp.id]}
                          onUnlimitedToggle={() => setUnlimitedFlags(prev => ({ ...prev, [comp.id]: !prev[comp.id] }))}
                          disabled={isAdding}
                        />
                      ))
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
              <span className="text-sm text-gray-500">
                {selectedIds.length > 0
                  ? `${selectedIds.length} component${selectedIds.length === 1 ? '' : 's'} selected`
                  : 'No components selected'}
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isAdding}
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-xl font-medium hover:bg-gray-50 disabled:opacity-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAdding || selectedIds.length === 0 || availableComponents.length === 0}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl font-medium transition-all shadow-lg shadow-indigo-500/25 disabled:shadow-none"
                >
                  {isAdding && <LoadingSpinner size="sm" />}
                  {isAdding
                    ? 'Adding...'
                    : selectedIds.length > 0
                      ? `Add ${selectedIds.length} Component${selectedIds.length === 1 ? '' : 's'}`
                      : 'Add Components'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// ============================================
// EDIT COMPONENT MODAL
// ============================================
const EditComponentModal = ({
  isOpen,
  onClose,
  onSubmit,
  formData,
  setFormData,
  selectedComponent,
  isUpdating,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  selectedComponent: AgentComponentPricing | null;
  isUpdating: boolean;
}) => {
  if (!isOpen || !selectedComponent) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={isUpdating ? undefined : onClose} />

      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-xl">
                <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Edit Component</h2>
                <p className="text-sm text-gray-500">{selectedComponent.component_name}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={isUpdating}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all disabled:opacity-50"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={onSubmit} className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {/* Current Configuration & Live Preview */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Current Configuration</div>
                  <div className="text-sm text-gray-600 space-y-2">
                    <div className="flex justify-between">
                      <span>Type</span>
                      <span className="font-medium text-gray-900">{selectedComponent.component_type_display}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Quantity</span>
                      <span className="font-medium text-gray-900">
                        {selectedComponent.is_unlimited ? 'Unlimited' : `${selectedComponent.total_quantity ? Number(selectedComponent.total_quantity).toLocaleString() : '—'} ${selectedComponent.unit_label}`}
                      </span>
                    </div>
                    <div className="flex justify-between text-indigo-600">
                      <span>Base Price</span>
                      <span className="font-medium">{formatPrice(selectedComponent.base_price_per_unit)}/{selectedComponent.unit_label}</span>
                    </div>
                    {selectedComponent.override_price && (
                      <div className="flex justify-between text-orange-600">
                        <span>Current Override</span>
                        <span className="font-medium">{formatPrice(selectedComponent.override_price)}/{selectedComponent.unit_label}</span>
                      </div>
                    )}
                    <div className="pt-2 border-t border-gray-200 flex justify-between text-emerald-600">
                      <span className="font-semibold">Effective Price</span>
                      <span className="font-bold">{formatPrice(selectedComponent.effective_price_per_unit)}/{selectedComponent.unit_label}</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-indigo-50/60 rounded-xl border border-indigo-100">
                  <div className="text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-3">Updated Preview</div>
                  <div className="text-sm text-gray-700 space-y-2">
                    <div className="flex justify-between">
                      <span>Total Quantity</span>
                      <span className="font-medium text-gray-900">
                        {formData.is_unlimited ? 'Unlimited' : `${formData.total_quantity ? Number(formData.total_quantity).toLocaleString() : '—'} ${selectedComponent.unit_label}`}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Override Price</span>
                      <span className="font-medium text-gray-900">
                        {formData.override_price ? `${formatPrice(parseFloat(formData.override_price))}/${selectedComponent.unit_label}` : '—'}
                      </span>
                    </div>
                    <div className="pt-2 border-t border-indigo-100 flex justify-between text-indigo-700">
                      <span className="font-semibold">Effective Price</span>
                      <span className="font-bold">
                        {formatPrice(formData.override_price ? parseFloat(formData.override_price) : parseFloat(String(selectedComponent.base_price_per_unit)))}/{selectedComponent.unit_label}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Unlimited Toggle */}
              <div className="flex items-center gap-3 p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, is_unlimited: !formData.is_unlimited, total_quantity: !formData.is_unlimited ? '' : formData.total_quantity })}
                  disabled={isUpdating}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
                    formData.is_unlimited ? 'bg-indigo-600' : 'bg-gray-300'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    formData.is_unlimited ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
                <div>
                  <p className="text-sm font-medium text-indigo-900">Unlimited Usage</p>
                  <p className="text-xs text-indigo-700">Allow unrestricted consumption of this component</p>
                </div>
              </div>

              {/* Quantity & Override inputs */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {!formData.is_unlimited && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Total Quantity <span className="text-gray-400 font-normal">(Optional)</span>
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="1"
                        min="0"
                        value={formData.total_quantity}
                        onChange={(e) => setFormData({ ...formData, total_quantity: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        placeholder="Total quantity to allocate"
                        disabled={isUpdating}
                      />
                      <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
                        {selectedComponent.unit_label}
                      </div>
                    </div>
                  </div>
                )}

                <div className={formData.is_unlimited ? 'md:col-span-2' : ''}>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Override Price <span className="text-gray-400 font-normal">(Optional)</span>
                  </label>
                  <div className="relative">
                    <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 font-medium">$</div>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={formData.override_price}
                      onChange={(e) => setFormData({ ...formData, override_price: e.target.value })}
                      className="w-full pl-8 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      placeholder="Leave empty for default price"
                      disabled={isUpdating}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Leave empty to remove override and use base price</p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
              <button
                type="button"
                onClick={onClose}
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
                {isUpdating ? 'Updating...' : 'Update Component'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================
interface AgentComponentPricingManagementProps {
  agentId?: string;
  embedded?: boolean;
}

const AgentComponentPricingManagement = ({ agentId, embedded = false }: AgentComponentPricingManagementProps) => {
  // ---- State ----
  const [selectedAgentId, setSelectedAgentId] = useState<string>(agentId || '');
  const [agentSearch, setAgentSearch] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedComponent, setSelectedComponent] = useState<AgentComponentPricing | null>(null);
  const [componentToDelete, setComponentToDelete] = useState<{ id: string; name: string } | null>(null);

  // Mutations state
  const [isAdding, setIsAdding] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    component_id: '',
    total_quantity: '',
    override_price: '',
    is_unlimited: false,
  });

  // Table
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  const adminId = getAdminId();

  // ---- API Hooks ----
  const { data: agentTemplatesResponse, isLoading: isLoadingAgents } = useGetAgentTemplatesByAdminIdQuery(
    adminId!,
    { skip: !adminId }
  );
  const agentTemplates = useMemo<AgentTemplate[]>(
    () => agentTemplatesResponse?.results || [],
    [agentTemplatesResponse]
  );

  const { data: componentsResponse, isLoading: isLoadingComponents } = useGetPlanComponentsQuery({ is_active: true });
  const components = useMemo<PlanComponent[]>(
    () => (componentsResponse?.results || []) as PlanComponent[],
    [componentsResponse]
  );

  const {
    data: agentComponentsData,
    isLoading: isLoadingAgentComponents,
    isFetching: isFetchingAgentComponents,
    error: agentComponentsError,
    refetch: refetchAgentComponents,
  } = useGetAgentComponents(selectedAgentId);

  // ---- Derived state ----
  const agentComponents = useMemo<AgentComponentPricing[]>(
    () => agentComponentsData?.components || [],
    [agentComponentsData]
  );
  const selectedAgent = useMemo(
    () => agentTemplates.find(a => a.id === selectedAgentId),
    [agentTemplates, selectedAgentId]
  );
  const showOverlay = isFetchingAgentComponents && !isLoadingAgentComponents;

  const filteredAgents = useMemo(() => {
    const q = agentSearch.trim().toLowerCase();
    if (!q) return agentTemplates;
    return agentTemplates.filter(a =>
      a.name.toLowerCase().includes(q) ||
      a.agent_type.toLowerCase().includes(q) ||
      (a.agent_variant || '').toLowerCase().includes(q) ||
      (a.description || '').toLowerCase().includes(q)
    );
  }, [agentTemplates, agentSearch]);

  const componentTypes = useMemo(() => {
    const types = new Set<string>();
    agentComponents.forEach(c => types.add(c.component_type));
    return Array.from(types);
  }, [agentComponents]);

  const filteredComponents = useMemo(() => {
    return agentComponents.filter(comp => {
      const matchesType = !typeFilter || comp.component_type === typeFilter;
      const matchesSearch = !searchQuery ||
        comp.component_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (comp.component_type_display || '').toLowerCase().includes(searchQuery.toLowerCase());
      return matchesType && matchesSearch;
    });
  }, [agentComponents, typeFilter, searchQuery]);

  // Pagination
  const totalItems = filteredComponents.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const paginatedComponents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredComponents.slice(start, start + pageSize);
  }, [filteredComponents, currentPage, pageSize]);

  // Totals
  const totalQuantityAllocated = useMemo(() => {
    return agentComponents.reduce((sum, comp) => {
      if (comp.is_unlimited) return sum;
      const qty = typeof comp.total_quantity === 'string'
        ? parseFloat(comp.total_quantity) || 0
        : comp.total_quantity || 0;
      return sum + qty;
    }, 0);
  }, [agentComponents]);

  const hasUnlimitedComponents = useMemo(
    () => agentComponents.some(comp => comp.is_unlimited),
    [agentComponents]
  );

  const unlimitedComponents = useMemo(
    () => agentComponents.filter(c => c.is_unlimited),
    [agentComponents]
  );

  // Available components (not already configured on agent)
  const availableComponents = useMemo(() => {
    const includedComponentIds = new Set(agentComponents.map(c => c.component_id));
    return components.filter(c => !includedComponentIds.has(c.id));
  }, [agentComponents, components]);

  // ---- Success toast auto-dismiss ----
  useEffect(() => {
    if (!successMessage) return;
    const t = setTimeout(() => setSuccessMessage(null), 4000);
    return () => clearTimeout(t);
  }, [successMessage]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [typeFilter, searchQuery, pageSize]);

  // ---- Handlers ----
  const resetForm = useCallback(() => {
    setFormData({
      component_id: '',
      total_quantity: '',
      override_price: '',
      is_unlimited: false,
    });
    setSelectedComponent(null);
  }, []);

  const openAgent = useCallback((agentId: string) => {
    setSelectedAgentId(agentId);
    setCurrentPage(1);
    setTypeFilter('');
    setSearchQuery('');
    resetForm();
  }, [resetForm]);

  const backToAgents = useCallback(() => {
    setSelectedAgentId('');
    setAgentSearch('');
    setCurrentPage(1);
    setTypeFilter('');
    setSearchQuery('');
  }, []);

  const openConfigureFlow = useCallback((agentId: string) => {
    openAgent(agentId);
    setIsAddModalOpen(true);
  }, [openAgent]);

  const handleAddSubmit = async (items: AddComponentItem[]) => {
    if (!selectedAgentId || items.length === 0) return;

    setIsAdding(true);

    try {
      const currentAdminId = getAdminId();
      if (!currentAdminId) throw new Error('Admin ID not found');

      const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
      if (!BASE_URL) {
        throw new Error('API base URL not configured');
      }
      const response = await fetch(
        `${BASE_URL}agent-templates/${selectedAgentId}/components/?admin_id=${currentAdminId}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('superAdminToken')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ components: items }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || 'Failed to add components');
      }

      setIsAddModalOpen(false);
      resetForm();
      refetchAgentComponents();
      setSuccessMessage(
        items.length === 1
          ? 'Component added successfully!'
          : `${items.length} components added successfully!`
      );
    } catch (error: unknown) {
      console.error('Failed to add components to agent:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to add components';
      alert(errorMessage);
    } finally {
      setIsAdding(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgentId || !selectedComponent) return;

    setIsUpdating(true);

    try {
      const currentAdminId = getAdminId();
      if (!currentAdminId) throw new Error('Admin ID not found');

      const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
      if (!BASE_URL) {
        throw new Error('API base URL not configured');
      }
      const response = await fetch(
        `${BASE_URL}agent-templates/${selectedAgentId}/update_component/?admin_id=${currentAdminId}`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('superAdminToken')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            component_id: selectedComponent.component_id,
            total_quantity: formData.is_unlimited ? null : (formData.total_quantity ? parseFloat(formData.total_quantity) : null),
            override_price: formData.override_price.trim() ? formData.override_price.trim() : null,
            is_unlimited: formData.is_unlimited,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || 'Failed to update component');
      }

      setIsEditModalOpen(false);
      resetForm();
      refetchAgentComponents();
      setSuccessMessage('Component updated successfully!');
    } catch (error: unknown) {
      console.error('Failed to update component:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to update component';
      alert(errorMessage);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRemoveConfirm = async () => {
    if (!selectedAgentId || !componentToDelete) return;

    setIsRemoving(true);

    try {
      const currentAdminId = getAdminId();
      if (!currentAdminId) throw new Error('Admin ID not found');

      const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
      if (!BASE_URL) {
        throw new Error('API base URL not configured');
      }
      const response = await fetch(
        `${BASE_URL}agent-templates/${selectedAgentId}/remove_component/?component_id=${componentToDelete.id}&admin_id=${currentAdminId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('superAdminToken')}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || errorData.message || 'Failed to remove component');
      }

      const removedName = componentToDelete.name;
      setIsDeleteModalOpen(false);
      setComponentToDelete(null);
      refetchAgentComponents();
      setSuccessMessage(`"${removedName}" removed from the agent.`);
    } catch (error: unknown) {
      console.error('Failed to remove component:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to remove component from agent';
      alert(errorMessage);
    } finally {
      setIsRemoving(false);
    }
  };

  const handleEdit = useCallback((component: AgentComponentPricing) => {
    setSelectedComponent(component);
    setFormData({
      component_id: component.component_id,
      total_quantity: component.total_quantity ? component.total_quantity.toString() : '',
      override_price: component.override_price ? component.override_price.toString() : '',
      is_unlimited: component.is_unlimited || false,
    });
    setIsEditModalOpen(true);
  }, []);

  const handleDeleteClick = useCallback((componentId: string, componentName: string) => {
    setComponentToDelete({ id: componentId, name: componentName });
    setIsDeleteModalOpen(true);
  }, []);

  const agentGradient = selectedAgent ? getAgentGradient(selectedAgent.agent_type) : null;

  return (
    <div className={embedded ? 'w-full' : 'w-full min-h-screen p-4 sm:p-6 lg:p-8 bg-gray-50/50'}>
      <div className={embedded ? '' : 'max-w-7xl mx-auto'}>
        {/* Success Toast */}
        {successMessage && (
          <div className="fixed top-6 right-6 z-[60] flex items-center gap-3 px-5 py-3.5 bg-white border border-emerald-200 rounded-2xl shadow-xl shadow-emerald-500/10">
            <div className="p-1.5 bg-emerald-100 rounded-full">
              <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="text-sm font-medium text-gray-800">{successMessage}</span>
            <button onClick={() => setSuccessMessage(null)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* ============================== */}
        {/* VIEW A: AGENT CARDS GRID       */}
        {/* ============================== */}
        {!selectedAgentId && (
          <>
            {/* Header */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8 mb-6">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                    Agent Component Pricing
                  </h1>
                  <p className="text-gray-600 mt-1 sm:mt-2 text-sm sm:text-base">
                    Pick an agent template to configure its components and pricing
                  </p>
                </div>
                <div className="relative w-full lg:w-80">
                  <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search agents..."
                    value={agentSearch}
                    onChange={(e) => setAgentSearch(e.target.value)}
                    className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                </div>
              </div>

              {/* How it works strip */}
              <div className="mt-5 p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl border border-indigo-100">
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-6 text-sm text-gray-700">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">1</span>
                    <span>Select an agent template card</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">2</span>
                    <span>Add components with quantity &amp; pricing</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">3</span>
                    <span>Mark unlimited components to enable free tier</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Agent Cards */}
            {isLoadingAgents ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {Array.from({ length: 6 }).map((_, i) => <AgentCardSkeleton key={i} />)}
              </div>
            ) : filteredAgents.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
                <div className="mx-auto h-16 w-16 text-gray-300 mb-4">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {agentSearch ? 'No agents match your search' : 'No agent templates found'}
                </h3>
                <p className="mt-2 text-gray-500">
                  {agentSearch
                    ? `Try a different keyword than "${agentSearch}".`
                    : 'Create an agent template first, then configure its component pricing here.'}
                </p>
                {agentSearch && (
                  <button
                    onClick={() => setAgentSearch('')}
                    className="mt-4 px-4 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-xl transition-all"
                  >
                    Clear search
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {filteredAgents.map((agent) => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    onView={() => openAgent(agent.id)}
                    onConfigure={() => openConfigureFlow(agent.id)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* ============================== */}
        {/* VIEW B: AGENT DETAIL           */}
        {/* ============================== */}
        {selectedAgentId && (
          <>
            {/* Back button */}
            {!embedded && (
              <button
                onClick={backToAgents}
                className="inline-flex items-center gap-2 px-3 py-2 mb-4 text-sm font-medium text-gray-600 hover:text-indigo-600 hover:bg-white rounded-xl transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                All Agents
              </button>
            )}

            {/* Agent Banner */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6">
              {agentGradient && <div className={`h-1.5 bg-gradient-to-r ${agentGradient}`} />}
              <div className="p-6 sm:p-8">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <h1 className="text-2xl font-bold text-gray-900 truncate">
                        {selectedAgent?.name || agentComponentsData?.agent_name || 'Agent'}
                      </h1>
                      {selectedAgent && (
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${
                          selectedAgent.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${selectedAgent.is_active ? 'bg-emerald-500' : 'bg-red-500'}`} />
                          {selectedAgent.is_active ? 'Active' : 'Inactive'}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedAgent && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-semibold border bg-indigo-50 text-indigo-700 border-indigo-200">
                          {selectedAgent.agent_type.toUpperCase()}
                        </span>
                      )}
                      {selectedAgent?.agent_variant && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-lg text-xs font-semibold border bg-purple-50 text-purple-700 border-purple-200">
                          {selectedAgent.agent_variant}
                        </span>
                      )}
                    </div>
                    {selectedAgent?.description && (
                      <p className="mt-3 text-sm text-gray-500 max-w-2xl line-clamp-2">{selectedAgent.description}</p>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                    {/* Stats */}
                    <div className="flex items-center gap-3">
                      <div className="px-4 py-3 bg-indigo-50 rounded-xl text-center min-w-[100px]">
                        <div className="text-2xl font-bold text-indigo-600">{agentComponents.length}</div>
                        <div className="text-xs text-gray-600 font-medium">Components</div>
                      </div>
                      <div className="px-4 py-3 bg-emerald-50 rounded-xl text-center min-w-[100px]">
                        {hasUnlimitedComponents ? (
                          <>
                            <div className="text-2xl font-bold text-emerald-600">∞</div>
                            <div className="text-xs text-gray-600 font-medium">Has Unlimited</div>
                          </>
                        ) : (
                          <>
                            <div className="text-2xl font-bold text-emerald-600">{totalQuantityAllocated.toLocaleString()}</div>
                            <div className="text-xs text-gray-600 font-medium">Total Allocated</div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Add button */}
                    <button
                      onClick={() => setIsAddModalOpen(true)}
                      disabled={availableComponents.length === 0 || isLoadingAgentComponents}
                      className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold transition-all shadow-lg shadow-indigo-500/25 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      Add Component
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Error State */}
            {agentComponentsError && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 text-center">
                <div className="mx-auto h-14 w-14 text-red-400 mb-4">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Error Loading Components</h3>
                <p className="mt-2 text-gray-600">{agentComponentsError}</p>
                <button
                  onClick={() => refetchAgentComponents()}
                  className="mt-4 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-all"
                >
                  Try Again
                </button>
              </div>
            )}

            {/* Loading skeleton */}
            {isLoadingAgentComponents && !agentComponentsError && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <TableSkeleton rows={5} />
              </div>
            )}

            {/* Components Table */}
            {!isLoadingAgentComponents && !agentComponentsError && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden relative">
                {showOverlay && (
                  <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-10 rounded-2xl">
                    <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl shadow-lg border border-gray-100">
                      <LoadingSpinner size="sm" className="text-indigo-600" />
                      <span className="text-sm text-gray-600">Updating...</span>
                    </div>
                  </div>
                )}

                {agentComponents.length === 0 ? (
                  <div className="flex items-center justify-center py-16 sm:py-20">
                    <div className="text-center max-w-md px-4">
                      <div className="mx-auto h-16 w-16 text-gray-300 mb-4">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900">No Components Configured</h3>
                      <p className="mt-2 text-gray-500">
                        This agent doesn&apos;t have any component pricing configured yet.
                      </p>
                      <button
                        onClick={() => setIsAddModalOpen(true)}
                        disabled={availableComponents.length === 0}
                        className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-all shadow-lg shadow-indigo-500/25 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                      >
                        {availableComponents.length === 0 ? (
                          'No Components Available'
                        ) : (
                          <>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                            Add First Component
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Filters */}
                    <div className="px-4 sm:px-6 py-4 border-b border-gray-100 bg-gray-50/50">
                      <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex-1 relative">
                          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                          <input
                            type="text"
                            placeholder="Search components..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-11 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                          />
                        </div>
                        <select
                          value={typeFilter}
                          onChange={(e) => setTypeFilter(e.target.value)}
                          className="w-full sm:w-48 px-4 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        >
                          <option value="">All Types</option>
                          {componentTypes.map(type => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50/80">
                          <tr>
                            <th className="px-4 sm:px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Component</th>
                            <th className="px-4 sm:px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Total Quantity</th>
                            <th className="px-4 sm:px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Base Price</th>
                            <th className="px-4 sm:px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Override</th>
                            <th className="px-4 sm:px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Effective Price</th>
                            <th className="px-4 sm:px-6 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {paginatedComponents.map((component) => (
                            <tr key={component.id} className="hover:bg-gray-50/50 transition-colors">
                              <td className="px-4 sm:px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                    component.is_unlimited
                                      ? 'bg-gradient-to-br from-emerald-100 to-green-100'
                                      : 'bg-gradient-to-br from-indigo-100 to-purple-100'
                                  }`}>
                                    {component.is_unlimited ? (
                                      <span className="text-emerald-600 font-bold text-base">∞</span>
                                    ) : (
                                      <span className="text-indigo-600 font-bold text-sm">
                                        {component.component_type.charAt(0).toUpperCase()}
                                      </span>
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-semibold text-gray-900 truncate">{component.component_name}</span>
                                      {component.is_unlimited && (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                                          Unlimited
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-xs text-gray-500 mt-0.5">{component.component_type_display}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 sm:px-6 py-4 hidden md:table-cell">
                                {component.is_unlimited ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-semibold">
                                    ∞ Unlimited
                                  </span>
                                ) : (
                                  <span className="inline-flex px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg text-sm font-semibold">
                                    {component.total_quantity ? Number(component.total_quantity).toLocaleString() : '—'} {component.unit_label}
                                  </span>
                                )}
                              </td>
                              <td className="px-4 sm:px-6 py-4">
                                <span className="text-sm text-gray-600">
                                  {formatPrice(component.base_price_per_unit)}/{component.unit_label}
                                </span>
                              </td>
                              <td className="px-4 sm:px-6 py-4 hidden lg:table-cell">
                                {component.override_price ? (
                                  <span className="inline-flex px-2.5 py-1 bg-orange-50 text-orange-700 rounded-lg text-sm font-medium">
                                    {formatPrice(component.override_price)}
                                  </span>
                                ) : (
                                  <span className="text-sm text-gray-400">—</span>
                                )}
                              </td>
                              <td className="px-4 sm:px-6 py-4">
                                <span className="text-sm font-bold text-emerald-600">
                                  {formatPrice(component.effective_price_per_unit)}/{component.unit_label}
                                </span>
                              </td>
                              <td className="px-4 sm:px-6 py-4">
                                <div className="flex items-center justify-end gap-1 sm:gap-2">
                                  <button
                                    onClick={() => handleEdit(component)}
                                    disabled={isUpdating || isRemoving}
                                    className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all disabled:opacity-50"
                                    title="Edit pricing"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => handleDeleteClick(component.component_id, component.component_name)}
                                    disabled={isUpdating || isRemoving}
                                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all disabled:opacity-50"
                                    title="Remove component"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* No filter matches */}
                    {filteredComponents.length === 0 && (
                      <div className="py-12 text-center">
                        <p className="text-gray-500">No components match your filters.</p>
                        <button
                          onClick={() => { setSearchQuery(''); setTypeFilter(''); }}
                          className="mt-3 px-4 py-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 rounded-xl transition-all"
                        >
                          Clear filters
                        </button>
                      </div>
                    )}

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <Pagination
                        currentPage={currentPage}
                        totalPages={totalPages}
                        totalItems={totalItems}
                        pageSize={pageSize}
                        onPageChange={setCurrentPage}
                        onPageSizeChange={setPageSize}
                      />
                    )}
                  </>
                )}
              </div>
            )}

            {/* Free Tier Banner */}
            {!isLoadingAgentComponents && !agentComponentsError && hasUnlimitedComponents && (
              <div className="mt-6 bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 rounded-2xl border border-emerald-200 p-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center text-white flex-shrink-0 shadow-lg shadow-emerald-500/25">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="text-lg font-bold text-emerald-900">Free Tier Enabled</h4>
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-full border border-emerald-200">
                        Active
                      </span>
                    </div>
                    <p className="text-sm text-emerald-800 mb-3">
                      This agent qualifies for the free tier because it has unlimited components configured.
                      Users without a subscription can access this agent with 1 instance limit.
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-emerald-700 font-medium">Unlimited Components:</span>
                      {unlimitedComponents.map((comp) => (
                        <span
                          key={comp.id}
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-white rounded-lg text-xs text-emerald-700 border border-emerald-200 font-medium"
                        >
                          <svg className="w-3 h-3 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          {comp.component_name}
                        </span>
                      ))}
                    </div>
                    <div className="mt-4 p-3 bg-white/80 rounded-xl border border-emerald-100">
                      <div className="flex items-center gap-2 text-sm text-emerald-800">
                        <svg className="w-4 h-4 text-emerald-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>
                          <strong>User Benefits:</strong> Users can create 1 instance of this agent without any subscription.
                          If they try to create more, they&apos;ll be prompted to upgrade.
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      <AddComponentModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          resetForm();
        }}
        onSubmit={handleAddSubmit}
        availableComponents={availableComponents}
        agentName={selectedAgent?.name || agentComponentsData?.agent_name || ''}
        isAdding={isAdding}
        isLoadingComponents={isLoadingComponents}
      />

      <EditComponentModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          resetForm();
        }}
        onSubmit={handleEditSubmit}
        formData={formData}
        setFormData={setFormData}
        selectedComponent={selectedComponent}
        isUpdating={isUpdating}
      />

      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setComponentToDelete(null);
        }}
        onConfirm={handleRemoveConfirm}
        componentName={componentToDelete?.name || ''}
        isDeleting={isRemoving}
      />
    </div>
  );
};

export default AgentComponentPricingManagement;
