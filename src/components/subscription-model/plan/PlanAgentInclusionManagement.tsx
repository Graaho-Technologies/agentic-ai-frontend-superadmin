// components/subscription-model/plan/PlanAgentInclusionManagement.tsx
"use client";
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  useGetPlansQuery,
  useGetAgentPricingQuery,
  useGetPlanAgentsInPlanQuery,
  useAddAgentToPlanMutation,
  useUpdatePlanAgentInclusionMutation,
  useRemoveAgentFromPlanMutation,
  useUpdatePlanMutation,
  useAddAgentFeatureMutation,
  useDeleteAgentFeatureMutation,
  Plan,
  AgentPricing,
  PlanAgentsResponse,
  PlanAgentFeature,
} from '@/features/subscriptionModel/billing/billingApi';

// ============================================
// TYPES
// ============================================
type PlanAgentItem = PlanAgentsResponse['agents'][number];

interface ApiErrorResponse {
  data?: {
    detail?: string;
    message?: string;
    error?: string;
  };
}

interface EditFormData {
  included_instances: number;
  override_price: string; // '' = no override (use agent base price)
  is_featured: boolean;
  display_order: number;
  feature_description: string;
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

const formatLabel = (value: string | null | undefined) =>
  (value || '').replace(/_/g, ' ');

// Parses an optional override price input.
// Returns: null (empty = no override) | number (valid) | 'invalid'
const parseOverridePrice = (value: string): number | null | 'invalid' => {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const num = parseFloat(trimmed);
  if (isNaN(num) || num < 0) return 'invalid';
  return Math.round(num * 100) / 100;
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            Assign Agents
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onView(); }}
            className="inline-flex items-center justify-center p-2.5 text-gray-500 hover:text-indigo-600 bg-gray-50 hover:bg-indigo-50 rounded-xl transition-all"
            title="View assigned agents"
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
// UNLIMITED / INSTANCES SWITCH
// ============================================
const UnlimitedToggle = ({
  isUnlimited,
  onToggle,
  disabled,
}: {
  isUnlimited: boolean;
  onToggle: () => void;
  disabled?: boolean;
}) => (
  <button
    type="button"
    onClick={onToggle}
    disabled={disabled}
    className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
      isUnlimited ? 'bg-indigo-600' : 'bg-gray-300'
    }`}
  >
    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
      isUnlimited ? 'translate-x-6' : 'translate-x-1'
    }`} />
  </button>
);

// ============================================
// SELECTABLE AGENT CARD (select + inline Instances & Pricing)
// ============================================
const SelectableAgentCard = ({
  pricing,
  selected,
  onToggle,
  instanceValue,
  onInstanceChange,
  overrideValue,
  onOverrideChange,
  features,
  onAddFeature,
  onRemoveFeature,
  disabled,
}: {
  pricing: AgentPricing;
  selected: boolean;
  onToggle: () => void;
  instanceValue: string;
  onInstanceChange: (value: string) => void;
  overrideValue: string;
  onOverrideChange: (value: string) => void;
  features: string[];
  onAddFeature: (feature: string) => void;
  onRemoveFeature: (index: number) => void;
  disabled?: boolean;
}) => {
  const [featureInput, setFeatureInput] = useState('');
  const isUnlimited = parseInt(instanceValue || '1') === 0;
  const overrideParsed = parseOverridePrice(overrideValue);
  const hasOverride = typeof overrideParsed === 'number';
  const overrideInvalid = overrideParsed === 'invalid';

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
            <svg className={`w-5 h-5 ${selected ? 'text-white' : 'text-indigo-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-gray-900 truncate">{pricing.agent_name}</div>
            <div className="text-xs text-gray-500 mt-0.5 truncate">
              {pricing.agent_category}{pricing.name ? ` • ${pricing.name}` : ''}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-md text-xs font-semibold border border-emerald-100">
                {formatMoney(pricing.price)} / {formatLabel(pricing.unit)}
              </span>
              <span className="inline-flex items-center px-2 py-0.5 bg-gray-50 text-gray-600 rounded-md text-xs font-medium border border-gray-100 capitalize">
                {formatLabel(pricing.billing_method)}
              </span>
              {pricing.discount_percentage && parseFloat(pricing.discount_percentage) > 0 && (
                <span className="inline-flex items-center px-2 py-0.5 bg-purple-50 text-purple-700 rounded-md text-xs font-medium border border-purple-100">
                  {pricing.discount_percentage}% off
                </span>
              )}
            </div>
          </div>
        </div>
      </button>

      {/* Inline Instances & Pricing (shown when selected) */}
      {selected && (
        <div className="px-4 pb-4 space-y-3">
          {/* Instances */}
          <div className="pt-3 border-t border-indigo-100 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide flex-shrink-0 sm:w-28">
              Instances
            </label>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <UnlimitedToggle
                  isUnlimited={isUnlimited}
                  onToggle={() => onInstanceChange(isUnlimited ? '1' : '0')}
                  disabled={disabled}
                />
                <span className={`text-xs font-semibold ${isUnlimited ? 'text-indigo-600' : 'text-gray-400'}`}>
                  Unlimited
                </span>
              </div>
              {!isUnlimited && (
                <input
                  type="number"
                  min="1"
                  value={instanceValue}
                  onChange={(e) => onInstanceChange(e.target.value)}
                  disabled={disabled}
                  className="w-24 px-3 py-2 bg-white border border-gray-200 rounded-xl text-gray-900 font-semibold text-center focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:opacity-50 transition-all"
                />
              )}
            </div>
          </div>

          {/* Plan-specific price override */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide flex-shrink-0 sm:w-28">
              Plan price
            </label>
            <div className="flex items-center gap-2 flex-1 flex-wrap">
              <div className="relative w-32">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={overrideValue}
                  onChange={(e) => onOverrideChange(e.target.value)}
                  disabled={disabled}
                  placeholder={parseFloat(pricing.price || '0').toFixed(2)}
                  className={`w-full pl-7 pr-3 py-2 bg-white border rounded-xl text-gray-900 font-semibold text-sm focus:ring-2 disabled:opacity-50 transition-all ${
                    overrideInvalid
                      ? 'border-red-300 focus:ring-red-500/20 focus:border-red-500'
                      : hasOverride
                        ? 'border-amber-300 focus:ring-amber-500/20 focus:border-amber-500'
                        : 'border-gray-200 focus:ring-indigo-500/20 focus:border-indigo-500'
                  }`}
                />
              </div>
              {hasOverride ? (
                <>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 text-amber-700 rounded-md text-xs font-semibold border border-amber-200">
                    Override
                  </span>
                  <span className="text-xs text-gray-400 line-through">{formatMoney(pricing.price)}</span>
                  <button
                    type="button"
                    onClick={() => onOverrideChange('')}
                    disabled={disabled}
                    className="text-xs font-medium text-gray-400 hover:text-gray-600 underline disabled:opacity-40"
                  >
                    Reset
                  </button>
                </>
              ) : overrideInvalid ? (
                <span className="text-xs text-red-500 font-medium">Enter a positive number</span>
              ) : (
                <span className="text-xs text-gray-400">Base price {formatMoney(pricing.price)} / {formatLabel(pricing.unit)}</span>
              )}
            </div>
          </div>

          {/* Features section */}
          <div className="pt-3 border-t border-indigo-100">
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide flex items-center gap-2 mb-2">
              <svg className="w-3.5 h-3.5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Features (shown in pricing card)
            </label>

            {/* Existing features list */}
            {features.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {features.map((feature, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-medium border border-indigo-100 group"
                  >
                    <svg className="w-3 h-3 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="max-w-[180px] truncate">{feature}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveFeature(idx);
                      }}
                      disabled={disabled}
                      className="ml-0.5 p-0.5 rounded-full hover:bg-indigo-200 transition-colors disabled:opacity-50"
                    >
                      <svg className="w-3 h-3 text-indigo-400 hover:text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Add feature input */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={featureInput}
                onChange={(e) => setFeatureInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && featureInput.trim()) {
                    e.preventDefault();
                    onAddFeature(featureInput.trim());
                    setFeatureInput('');
                  }
                }}
                placeholder="e.g., Up to 150 API calls"
                disabled={disabled}
                className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm placeholder:text-gray-400 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:opacity-50 transition-all"
              />
              <button
                type="button"
                onClick={() => {
                  if (featureInput.trim()) {
                    onAddFeature(featureInput.trim());
                    setFeatureInput('');
                  }
                }}
                disabled={disabled || !featureInput.trim()}
                className="px-3 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1.5">Press Enter or click Add to add each feature</p>
          </div>

          {/* Result preview */}
          <div className="pt-2 border-t border-indigo-100 flex flex-wrap items-center gap-2 text-xs">
            <svg className="w-3.5 h-3.5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
            <span className="text-gray-500">Customer gets:</span>
            <span className="font-bold text-indigo-600">
              {isUnlimited
                ? 'Unlimited instances'
                : `${Math.max(1, parseInt(instanceValue) || 1)} instance${(parseInt(instanceValue) || 1) > 1 ? 's' : ''}`}
            </span>
            <span className="text-gray-300">•</span>
            <span className="text-gray-500">at</span>
            <span className={`font-bold ${hasOverride ? 'text-amber-600' : 'text-indigo-600'}`}>
              {formatMoney(hasOverride ? overrideParsed : pricing.price)} / {formatLabel(pricing.unit)}
            </span>
            {features.length > 0 && (
              <>
                <span className="text-gray-300">•</span>
                <span className="font-medium text-indigo-600">{features.length} feature{features.length > 1 ? 's' : ''}</span>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================
interface PlanAgentInclusionManagementProps {
  /** When provided, the component is locked to this plan (no plan picker view). */
  planId?: string;
  /** Renders without page chrome (min-height/padding) so it fits inside a modal. */
  embedded?: boolean;
}

const PlanAgentInclusionManagement = ({ planId, embedded = false }: PlanAgentInclusionManagementProps) => {
  // Get plan from URL query params
  const searchParams = useSearchParams();
  const planFromUrl = planId || searchParams.get('plan');

  // ---- State ----
  const [selectedPlanId, setSelectedPlanId] = useState<string>(planId || '');
  const [planSearch, setPlanSearch] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Assign flow (single step: select + configure inline)
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [agentSearch, setAgentSearch] = useState('');
  const [selectedPricingIds, setSelectedPricingIds] = useState<string[]>([]);
  // Per pricing id: number of instances as string; '0' means unlimited
  const [instances, setInstances] = useState<Record<string, string>>({});
  // Per pricing id: optional plan-specific price override ('' = use base price)
  const [overridePrices, setOverridePrices] = useState<Record<string, string>>({});
  // Per pricing id: list of feature strings to be added during assignment
  const [pendingFeatures, setPendingFeatures] = useState<Record<string, string[]>>({});

  // Edit flow
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedInclusion, setSelectedInclusion] = useState<PlanAgentItem | null>(null);
  const [editForm, setEditForm] = useState<EditFormData>({ included_instances: 1, override_price: '', is_featured: false, display_order: 0, feature_description: '' });

  // Table
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // ---- API Hooks ----
  const { data: plansResponse, isLoading: isLoadingPlans, refetch: refetchPlans } = useGetPlansQuery({});
  const plans = useMemo<Plan[]>(() => plansResponse?.results || [], [plansResponse]);

  const { data: agentPricingData, isLoading: isLoadingAgentPricing } = useGetAgentPricingQuery({ is_active: true });
  const agentPricingOptions = useMemo<AgentPricing[]>(() => agentPricingData?.results || [], [agentPricingData]);

  const { data: planAgentsData, isLoading: isLoadingInclusions, isFetching, refetch } = useGetPlanAgentsInPlanQuery(selectedPlanId, {
    skip: !selectedPlanId,
  });

  const [addAgentToPlan, { isLoading: isAdding }] = useAddAgentToPlanMutation();
  const [updateInclusion, { isLoading: isUpdating }] = useUpdatePlanAgentInclusionMutation();
  const [removeAgent] = useRemoveAgentFromPlanMutation();
  const [updatePlan, { isLoading: isUpdatingPlan }] = useUpdatePlanMutation();
  const [addFeature] = useAddAgentFeatureMutation();
  const [deleteFeature] = useDeleteAgentFeatureMutation();

  // Feature management state
  const [newFeatureText, setNewFeatureText] = useState('');
  // Local pending features (not yet saved to server) - for instant UI updates
  const [pendingEditFeatures, setPendingEditFeatures] = useState<string[]>([]);
  // Features marked for deletion (will be deleted on save)
  const [featuresToDelete, setFeaturesToDelete] = useState<string[]>([]);

  // Agent selection limits state
  const [isLimitsModalOpen, setIsLimitsModalOpen] = useState(false);
  const [minAgents, setMinAgents] = useState<string>('0');
  const [maxAgents, setMaxAgents] = useState<string>('0');
  const [limitsError, setLimitsError] = useState<string | null>(null);

  // ---- Derived state ----
  const inclusions = useMemo<PlanAgentItem[]>(() => planAgentsData?.agents || [], [planAgentsData]);
  const selectedPlan = useMemo(() => plans.find(p => p.id === selectedPlanId), [plans, selectedPlanId]);
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

  // Available agents (not already in plan)
  const availableAgentPricing = useMemo(() => {
    const includedAgentIds = new Set(inclusions.map(i => i.agent_pricing?.agent_id));
    return agentPricingOptions.filter(ap => !includedAgentIds.has(ap.agent_id));
  }, [inclusions, agentPricingOptions]);

  const filteredAvailableAgents = useMemo(() => {
    const q = agentSearch.trim().toLowerCase();
    if (!q) return availableAgentPricing;
    return availableAgentPricing.filter(ap =>
      ap.agent_name.toLowerCase().includes(q) ||
      ap.agent_category.toLowerCase().includes(q) ||
      (ap.name || '').toLowerCase().includes(q) ||
      (ap.description || '').toLowerCase().includes(q)
    );
  }, [availableAgentPricing, agentSearch]);

  const allFilteredSelected = useMemo(
    () => filteredAvailableAgents.length > 0 && filteredAvailableAgents.every(ap => selectedPricingIds.includes(ap.id)),
    [filteredAvailableAgents, selectedPricingIds]
  );

  // Auto-select plan from URL when plans are loaded
  useEffect(() => {
    if (planFromUrl && plans.length > 0 && !selectedPlanId) {
      const planExists = plans.some(p => p.id === planFromUrl);
      if (planExists) {
        setSelectedPlanId(planFromUrl);
      }
    }
  }, [planFromUrl, plans, selectedPlanId]);

  // ---- Success toast auto-dismiss ----
  useEffect(() => {
    if (!successMessage) return;
    const t = setTimeout(() => setSuccessMessage(null), 4000);
    return () => clearTimeout(t);
  }, [successMessage]);

  // ---- Sync agent limits state when modal opens ----
  useEffect(() => {
    if (isLimitsModalOpen && selectedPlan) {
      setMinAgents(String(selectedPlan.min_agents_required ?? 0));
      setMaxAgents(String(selectedPlan.max_agents_allowed ?? 0));
      setLimitsError(null);
    }
  }, [isLimitsModalOpen, selectedPlan]);

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
    setAgentSearch('');
    setSelectedPricingIds([]);
    setInstances({});
    setOverridePrices({});
    setPendingFeatures({});
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

  // ---- Agent Selection Limits Handlers ----
  const openLimitsModal = useCallback(() => {
    setIsLimitsModalOpen(true);
  }, []);

  const closeLimitsModal = useCallback(() => {
    if (isUpdatingPlan) return;
    setIsLimitsModalOpen(false);
    setLimitsError(null);
  }, [isUpdatingPlan]);

  const handleSaveLimits = async () => {
    if (!selectedPlanId) return;

    const minVal = parseInt(minAgents, 10) || 0;
    const maxVal = parseInt(maxAgents, 10) || 0;

    // Validation
    if (minVal < 0) {
      setLimitsError('Minimum agents cannot be negative.');
      return;
    }
    if (maxVal < 0) {
      setLimitsError('Maximum agents cannot be negative.');
      return;
    }
    if (minVal > 0 && maxVal > 0 && maxVal < minVal) {
      setLimitsError('Maximum must be greater than or equal to minimum.');
      return;
    }
    // Validate against assigned agents count (only if there are assigned agents)
    // Note: max can be <= inclusions.length (user selects subset) or 0 (all agents)
    // min cannot exceed assigned agents count
    if (inclusions.length > 0) {
      if (minVal > inclusions.length) {
        setLimitsError(`Minimum (${minVal}) cannot exceed assigned agents count (${inclusions.length}).`);
        return;
      }
      // max=0 means unlimited (all agents), so only validate when max > 0
      if (maxVal > 0 && maxVal > inclusions.length) {
        setLimitsError(`Maximum (${maxVal}) cannot exceed assigned agents count (${inclusions.length}).`);
        return;
      }
    }

    try {
      await updatePlan({
        id: selectedPlanId,
        data: {
          min_agents_required: minVal,
          max_agents_allowed: maxVal,
        },
      }).unwrap();

      // Refetch plans to get updated values
      await refetchPlans();

      setSuccessMessage('Agent selection limits updated successfully!');
      setIsLimitsModalOpen(false);
      setLimitsError(null);
    } catch (err: unknown) {
      const apiError = err as ApiErrorResponse;
      const msg = apiError?.data?.detail || apiError?.data?.message || 'Failed to update limits.';
      setLimitsError(msg);
    }
  };

  const toggleAgent = useCallback((pricingId: string) => {
    setSelectedPricingIds(prev =>
      prev.includes(pricingId)
        ? prev.filter(id => id !== pricingId)
        : [...prev, pricingId]
    );
    setInstances(prev => (prev[pricingId] !== undefined ? prev : { ...prev, [pricingId]: '1' }));
  }, []);

  // Bulk select/deselect all currently visible (filtered) agents
  const toggleSelectAll = useCallback(() => {
    const filteredIds = filteredAvailableAgents.map(ap => ap.id);
    if (allFilteredSelected) {
      const idSet = new Set(filteredIds);
      setSelectedPricingIds(prev => prev.filter(id => !idSet.has(id)));
    } else {
      setSelectedPricingIds(prev => Array.from(new Set([...prev, ...filteredIds])));
      setInstances(prev => {
        const next = { ...prev };
        filteredIds.forEach(id => {
          if (next[id] === undefined) next[id] = '1';
        });
        return next;
      });
    }
  }, [filteredAvailableAgents, allFilteredSelected]);

  const handleAssignSubmit = async () => {
    if (!selectedPlanId || selectedPricingIds.length === 0) return;

    // Validate override prices before submitting
    for (const id of selectedPricingIds) {
      if (parseOverridePrice(overridePrices[id] ?? '') === 'invalid') {
        const agentName = agentPricingOptions.find(ap => ap.id === id)?.agent_name || 'an agent';
        alert(`Invalid override price for ${agentName}. Use a positive number or leave it empty.`);
        return;
      }
    }

    try {
      await addAgentToPlan({
        planId: selectedPlanId,
        data: {
          agents: selectedPricingIds.map(id => {
            const override = parseOverridePrice(overridePrices[id] ?? '');
            const features = pendingFeatures[id] || [];
            return {
              agent_pricing_id: id,
              included_instances: Math.max(0, parseInt(instances[id]) || 0),
              ...(typeof override === 'number' ? { override_price: override } : {}),
              ...(features.length > 0 ? { features } : {}),
            };
          }),
        },
      }).unwrap();

      const count = selectedPricingIds.length;
      setIsAssignOpen(false);
      resetAssignFlow();
      refetch();
      setSuccessMessage(`${count} agent${count > 1 ? 's' : ''} assigned to "${selectedPlan?.name}" successfully!`);
    } catch (error: unknown) {
      const apiError = error as ApiErrorResponse;
      alert(apiError?.data?.detail || apiError?.data?.message || 'Failed to assign agents');
    }
  };

  const handleEdit = useCallback((inclusion: PlanAgentItem) => {
    setSelectedInclusion(inclusion);
    setEditForm({
      included_instances: inclusion.included_instances,
      override_price: inclusion.override_price ?? '',
      is_featured: inclusion.is_featured,
      display_order: inclusion.display_order,
      feature_description: (inclusion as unknown as { feature_description?: string | null }).feature_description ?? '',
    });
    // Reset pending feature states when opening modal
    setPendingEditFeatures([]);
    setFeaturesToDelete([]);
    setIsEditModalOpen(true);
  }, []);

  const closeEditModal = useCallback(() => {
    if (isUpdating) return;
    setIsEditModalOpen(false);
    setSelectedInclusion(null);
    setNewFeatureText('');
    setPendingEditFeatures([]);
    setFeaturesToDelete([]);
  }, [isUpdating]);

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlanId || !selectedInclusion) return;

    const override = parseOverridePrice(editForm.override_price);
    if (override === 'invalid') {
      alert('Invalid override price. Use a positive number or leave it empty to use the base price.');
      return;
    }

    try {
      // 1. Update the inclusion first
      await updateInclusion({
        planId: selectedPlanId,
        inclusionId: selectedInclusion.id,
        data: {
          agent_pricing_id: selectedInclusion.agent_pricing?.id || '',
          included_instances: editForm.included_instances,
          override_price: override, // number sets it, null clears it
          is_featured: editForm.is_featured,
          display_order: editForm.display_order,
          feature_description: editForm.feature_description || null,
        },
      }).unwrap();

      // 2. Delete features marked for deletion
      for (const featureId of featuresToDelete) {
        try {
          await deleteFeature({
            planId: selectedPlanId,
            inclusionId: selectedInclusion.id,
            featureId,
          }).unwrap();
        } catch {
          // Continue with other deletions even if one fails
        }
      }

      // 3. Add pending features
      for (const featureText of pendingEditFeatures) {
        try {
          await addFeature({
            planId: selectedPlanId,
            inclusionId: selectedInclusion.id,
            data: { feature_text: featureText },
          }).unwrap();
        } catch {
          // Continue with other additions even if one fails
        }
      }

      setIsEditModalOpen(false);
      setSelectedInclusion(null);
      setPendingEditFeatures([]);
      setFeaturesToDelete([]);
      refetch();
      setSuccessMessage('Agent updated successfully!');
    } catch (error: unknown) {
      const apiError = error as ApiErrorResponse;
      alert(apiError?.data?.detail || apiError?.data?.error || apiError?.data?.message || 'Failed to update agent');
    }
  };

  const handleRemove = async (inclusion: PlanAgentItem) => {
    if (!selectedPlanId) return;
    const agentName = inclusion.agent_pricing?.agent_name || 'this agent';
    if (!window.confirm(`Remove "${agentName}" from this plan?`)) return;

    setRemovingId(inclusion.id);
    try {
      await removeAgent({
        planId: selectedPlanId,
        inclusionId: inclusion.id,
      }).unwrap();
      refetch();
      setSuccessMessage(`"${agentName}" removed from the plan.`);
    } catch (error: unknown) {
      const apiError = error as ApiErrorResponse;
      alert(apiError?.data?.detail || apiError?.data?.error || apiError?.data?.message || 'Failed to remove agent from plan');
    } finally {
      setRemovingId(null);
    }
  };

  // Feature management handlers - now updates local state for instant UI, saves on form submit
  const handleAddFeatureLocal = () => {
    if (!newFeatureText.trim()) return;
    setPendingEditFeatures(prev => [...prev, newFeatureText.trim()]);
    setNewFeatureText('');
  };

  const handleRemovePendingFeature = (index: number) => {
    setPendingEditFeatures(prev => prev.filter((_, i) => i !== index));
  };

  const handleMarkFeatureForDeletion = (featureId: string) => {
    setFeaturesToDelete(prev => [...prev, featureId]);
  };

  const handleUnmarkFeatureForDeletion = (featureId: string) => {
    setFeaturesToDelete(prev => prev.filter(id => id !== featureId));
  };

  const planStyle = selectedPlan ? getPlanStyle(selectedPlan.plan_type) : null;
  const isLoadingWizardData = isLoadingAgentPricing || isLoadingInclusions;

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
                  <h1 className="text-2xl font-bold text-gray-900">Link Agents to Plans</h1>
                  <p className="text-gray-500 mt-1">
                    Pick a plan below, then assign the AI agents customers get with it.
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
                  { n: 2, label: 'Click "Assign Agents"' },
                  { n: 3, label: 'Choose agents & set instances' },
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
                      : 'Create a plan first from the Plans page, then come back here to assign agents.'}
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

                  <div className="flex items-center gap-3 flex-shrink-0 flex-wrap">
                    <div className="text-center px-5 py-3 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border border-indigo-100">
                      <div className="text-3xl font-bold text-indigo-600">{isLoadingInclusions ? '—' : inclusions.length}</div>
                      <div className="text-xs font-medium text-gray-500 mt-0.5">Assigned Agents</div>
                    </div>

                    {/* Agent Selection Limits Card */}
                    <div
                      onClick={openLimitsModal}
                      className="text-center px-5 py-3 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-100 cursor-pointer hover:border-amber-300 hover:shadow-md transition-all group"
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        <span className="text-xl font-bold text-amber-600">
                          {selectedPlan?.min_agents_required || 0}
                        </span>
                        <span className="text-gray-400">-</span>
                        <span className="text-xl font-bold text-amber-600">
                          {selectedPlan?.max_agents_allowed === 0 ? 'All' : selectedPlan?.max_agents_allowed || 0}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-xs font-medium text-gray-500 mt-0.5">
                        <span>Selection Limits</span>
                        <svg className="w-3 h-3 text-gray-400 group-hover:text-amber-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </div>
                    </div>

                    <button
                      onClick={() => { resetAssignFlow(); setIsAssignOpen(true); }}
                      disabled={isLoadingWizardData}
                      className="inline-flex items-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl font-semibold transition-all shadow-lg shadow-indigo-500/25"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                      </svg>
                      Assign Agents
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Assigned agents table */}
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
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">No Agents Assigned Yet</h3>
                  <p className="text-gray-500 mb-6 text-center max-w-sm">
                    This plan has no agents. Click the button below to choose which AI agents customers will get with this plan.
                  </p>
                  <button
                    onClick={() => { resetAssignFlow(); setIsAssignOpen(true); }}
                    disabled={availableAgentPricing.length === 0}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white rounded-xl font-medium transition-all duration-200 shadow-lg shadow-indigo-500/25 disabled:shadow-none"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    {availableAgentPricing.length > 0 ? 'Assign First Agent' : 'No Agents Available'}
                  </button>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Agent</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Pricing Tier</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Instances</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Price</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Features</th>
                          <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Billing</th>
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
                                  <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                  </svg>
                                </div>
                                <div>
                                  <div className="font-medium text-gray-900">{inclusion.agent_pricing?.agent_name}</div>
                                  <div className="text-sm text-gray-500">{inclusion.agent_pricing?.agent_category}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-gray-900">{inclusion.agent_pricing?.name || 'Default'}</div>
                              {inclusion.agent_pricing?.description && (
                                <div className="text-xs text-gray-500 mt-0.5 line-clamp-1 max-w-xs">{inclusion.agent_pricing.description}</div>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              {inclusion.included_instances === 0 ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-bold border border-indigo-100">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                  </svg>
                                  Unlimited
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg text-sm font-bold border border-blue-100">
                                  {inclusion.included_instances} {inclusion.included_instances === 1 ? 'instance' : 'instances'}
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-1.5">
                                <span className={`text-sm font-bold ${inclusion.has_price_override ? 'text-amber-600' : 'text-gray-900'}`}>
                                  {formatMoney(inclusion.effective_price)}
                                </span>
                                {inclusion.has_price_override && (
                                  <span
                                    className="inline-flex items-center px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded text-[10px] font-semibold border border-amber-200 uppercase tracking-wide"
                                    title={`Plan-specific override. Base price: ${formatMoney(inclusion.base_price)}`}
                                  >
                                    Override
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-gray-500">
                                {inclusion.has_price_override ? (
                                  <>
                                    <span className="line-through text-gray-400">{formatMoney(inclusion.base_price)}</span>
                                    {' '}base / {formatLabel(inclusion.agent_pricing?.unit)}
                                  </>
                                ) : (
                                  <>{formatMoney(inclusion.agent_pricing?.price)} / {formatLabel(inclusion.agent_pricing?.unit)}</>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              {(() => {
                                const features = ((inclusion as unknown as { features?: PlanAgentFeature[] }).features || []).filter(f => f.is_active);
                                if (features.length === 0) {
                                  return <span className="text-xs text-gray-400">No features</span>;
                                }
                                return (
                                  <div className="space-y-1">
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-xs font-medium border border-emerald-100">
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                      </svg>
                                      {features.length} feature{features.length !== 1 ? 's' : ''}
                                    </span>
                                    {features.length > 0 && (
                                      <div className="text-xs text-gray-500 line-clamp-1 max-w-[150px]" title={features.map(f => f.feature_text).join('\n')}>
                                        {features[0].feature_text}
                                        {features.length > 1 && '...'}
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                            </td>
                            <td className="px-6 py-4">
                              <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-purple-50 text-purple-700 border border-purple-100 capitalize">
                                {formatLabel(inclusion.agent_pricing?.billing_method)}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col gap-1.5">
                                {inclusion.is_featured ? (
                                  <span className="inline-flex items-center gap-1 w-fit px-2 py-0.5 bg-amber-50 text-amber-700 rounded text-xs font-medium border border-amber-100">
                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                    </svg>
                                    Featured
                                  </span>
                                ) : (
                                  <span className="text-xs text-gray-400">—</span>
                                )}
                                <div className="text-xs text-gray-500">Order: {inclusion.display_order}</div>
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
                                  onClick={() => handleRemove(inclusion)}
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
          </>
        )}
      </div>

      {/* ============================================ */}
      {/* ASSIGN AGENTS (select + configure inline)    */}
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
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">Assign Agents</h2>
                      <p className="text-sm text-gray-500">
                        Plan: <span className="font-medium text-indigo-600">{selectedPlan?.name}</span>
                        <span className="mx-1.5 text-gray-300">•</span>
                        Select agents and set instances &amp; pricing right on each card
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
                    value={agentSearch}
                    onChange={(e) => setAgentSearch(e.target.value)}
                    placeholder="Search agents by name or category..."
                    className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-700 placeholder-gray-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  />
                </div>

                {!isLoadingWizardData && filteredAvailableAgents.length > 0 && (
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
                        : `Select all (${filteredAvailableAgents.length})`}
                    </button>
                    {selectedPricingIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSelectedPricingIds([])}
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
                    {isLoadingWizardData ? (
                      <div className="flex flex-col items-center justify-center py-16">
                        <LoadingSpinner size="lg" className="text-indigo-600" />
                        <p className="mt-4 text-gray-500 text-sm">Loading agents...</p>
                      </div>
                    ) : availableAgentPricing.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mb-4">
                          <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <h3 className="font-semibold text-gray-900">All agents already assigned!</h3>
                        <p className="text-sm text-gray-500 mt-1 max-w-xs">
                          Every available agent is already in this plan. Set up new agent pricing first if you need more.
                        </p>
                      </div>
                    ) : filteredAvailableAgents.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 text-center">
                        <h3 className="font-semibold text-gray-900">No agents match &quot;{agentSearch}&quot;</h3>
                        <button
                          onClick={() => setAgentSearch('')}
                          className="mt-3 text-sm font-medium text-indigo-600 hover:text-indigo-700"
                        >
                          Clear search
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {filteredAvailableAgents.map((pricing) => (
                          <SelectableAgentCard
                            key={pricing.id}
                            pricing={pricing}
                            selected={selectedPricingIds.includes(pricing.id)}
                            onToggle={() => toggleAgent(pricing.id)}
                            instanceValue={instances[pricing.id] ?? '1'}
                            onInstanceChange={(v) => setInstances(prev => ({ ...prev, [pricing.id]: v }))}
                            overrideValue={overridePrices[pricing.id] ?? ''}
                            onOverrideChange={(v) => setOverridePrices(prev => ({ ...prev, [pricing.id]: v }))}
                            features={pendingFeatures[pricing.id] ?? []}
                            onAddFeature={(f) => setPendingFeatures(prev => ({
                              ...prev,
                              [pricing.id]: [...(prev[pricing.id] ?? []), f]
                            }))}
                            onRemoveFeature={(idx) => setPendingFeatures(prev => ({
                              ...prev,
                              [pricing.id]: (prev[pricing.id] ?? []).filter((_, i) => i !== idx)
                            }))}
                            disabled={isAdding}
                          />
                        ))}
                      </div>
                    )}
                  </div>

              {/* Footer */}
              <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
                <span className="text-sm text-gray-500">
                  {selectedPricingIds.length === 0
                    ? 'Tap the cards to select'
                    : <><span className="font-bold text-indigo-600">{selectedPricingIds.length}</span> selected</>}
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
                    disabled={isAdding || selectedPricingIds.length === 0}
                    className="inline-flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl font-medium transition-all shadow-lg shadow-indigo-500/25 disabled:shadow-none"
                  >
                    {isAdding && <LoadingSpinner size="sm" />}
                    {isAdding
                      ? 'Assigning...'
                      : selectedPricingIds.length === 0
                        ? 'Assign Agents'
                        : `Assign ${selectedPricingIds.length} Agent${selectedPricingIds.length > 1 ? 's' : ''}`}
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
          <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={closeEditModal} />

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
                    <h2 className="text-lg font-semibold text-gray-900">Edit Agent Inclusion</h2>
                    <p className="text-sm text-gray-500">{selectedInclusion.agent_pricing?.agent_name}</p>
                  </div>
                </div>
                <button
                  onClick={closeEditModal}
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
                  {/* Agent Info (Read-only) */}
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="text-sm font-medium text-gray-700 mb-3">Agent Details</div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Name</span>
                        <span className="font-medium text-gray-900">{selectedInclusion.agent_pricing?.agent_name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Pricing Tier</span>
                        <span className="text-gray-700">{selectedInclusion.agent_pricing?.name || 'Default'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Base Price</span>
                        <span className="text-gray-700">
                          {formatMoney(selectedInclusion.agent_pricing?.price)} / {formatLabel(selectedInclusion.agent_pricing?.unit)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Included Instances */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Included Instances <span className="text-red-500">*</span>
                    </label>

                    {/* Unlimited Toggle */}
                    <div className="flex items-center gap-3 mb-3 p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                      <UnlimitedToggle
                        isUnlimited={editForm.included_instances === 0}
                        onToggle={() => setEditForm(prev => ({ ...prev, included_instances: prev.included_instances === 0 ? 1 : 0 }))}
                        disabled={isUpdating}
                      />
                      <div>
                        <p className="text-sm font-medium text-indigo-900">Unlimited Instances</p>
                        <p className="text-xs text-indigo-700">Customers can create as many instances as they need</p>
                      </div>
                    </div>

                    {editForm.included_instances !== 0 ? (
                      <input
                        type="number"
                        min="1"
                        value={editForm.included_instances}
                        onChange={(e) => setEditForm(prev => ({ ...prev, included_instances: Math.max(1, parseInt(e.target.value) || 1) }))}
                        disabled={isUpdating}
                        className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:opacity-50 transition-all"
                        required
                      />
                    ) : (
                      <div className="w-full px-3.5 py-2.5 bg-indigo-50 border border-indigo-100 rounded-xl text-indigo-700 text-sm font-medium flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Unlimited instances enabled
                      </div>
                    )}
                  </div>

                  {/* Plan-Specific Price Override */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Price Override for This Plan
                      <span className="ml-1.5 text-xs font-normal text-gray-400">(optional)</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={editForm.override_price}
                          onChange={(e) => setEditForm(prev => ({ ...prev, override_price: e.target.value }))}
                          disabled={isUpdating}
                          placeholder={`${parseFloat(selectedInclusion.agent_pricing?.price || '0').toFixed(2)} (base price)`}
                          className={`w-full pl-8 pr-3.5 py-2.5 bg-gray-50 border rounded-xl focus:bg-white focus:ring-2 disabled:opacity-50 transition-all ${
                            parseOverridePrice(editForm.override_price) === 'invalid'
                              ? 'border-red-300 focus:ring-red-500/20 focus:border-red-500'
                              : typeof parseOverridePrice(editForm.override_price) === 'number'
                                ? 'border-amber-300 focus:ring-amber-500/20 focus:border-amber-500'
                                : 'border-gray-200 focus:ring-indigo-500/20 focus:border-indigo-500'
                          }`}
                        />
                      </div>
                      {editForm.override_price.trim() !== '' && (
                        <button
                          type="button"
                          onClick={() => setEditForm(prev => ({ ...prev, override_price: '' }))}
                          disabled={isUpdating}
                          className="px-3 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl transition-all disabled:opacity-40"
                          title="Clear override and use base price"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    {parseOverridePrice(editForm.override_price) === 'invalid' ? (
                      <p className="text-xs text-red-500 mt-1">Enter a positive number or leave empty to use the base price.</p>
                    ) : typeof parseOverridePrice(editForm.override_price) === 'number' ? (
                      <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Customers on this plan pay {formatMoney(parseOverridePrice(editForm.override_price) as number)} instead of {formatMoney(selectedInclusion.agent_pricing?.price)}
                      </p>
                    ) : (
                      <p className="text-xs text-gray-500 mt-1">Leave empty to use the agent&apos;s base price ({formatMoney(selectedInclusion.agent_pricing?.price)}).</p>
                    )}
                  </div>

                  {/* Display Order */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Display Order</label>
                    <input
                      type="number"
                      value={editForm.display_order}
                      onChange={(e) => setEditForm(prev => ({ ...prev, display_order: parseInt(e.target.value) || 0 }))}
                      disabled={isUpdating}
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:opacity-50 transition-all"
                    />
                    <p className="text-xs text-gray-500 mt-1">Order in which this agent appears (lower numbers first)</p>
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
                        <span className="text-sm font-medium text-gray-700">Featured Agent</span>
                        <p className="text-xs text-gray-500">Highlight this agent in the plan</p>
                      </div>
                    </label>
                  </div>

                  {/* Feature List Management */}
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Feature List
                      <span className="ml-1.5 text-xs font-normal text-gray-400">
                        ({((selectedInclusion as unknown as { features?: PlanAgentFeature[] }).features?.filter(f => f.is_active && !featuresToDelete.includes(f.id)).length || 0) + pendingEditFeatures.length} features)
                      </span>
                    </label>

                    {/* Existing Features (from server) */}
                    <div className="space-y-2 mb-3">
                      {((selectedInclusion as unknown as { features?: PlanAgentFeature[] }).features || [])
                        .filter(f => f.is_active && !featuresToDelete.includes(f.id))
                        .map((feature) => (
                          <div
                            key={feature.id}
                            className="flex items-center gap-2 p-2.5 bg-gray-50 border border-gray-200 rounded-xl group hover:border-gray-300 transition-all"
                          >
                            <div className="flex-shrink-0 w-5 h-5 bg-indigo-100 rounded-full flex items-center justify-center">
                              <svg className="w-3 h-3 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </div>
                            <span className="flex-1 text-sm text-gray-700">{feature.feature_text}</span>
                            <button
                              type="button"
                              onClick={() => handleMarkFeatureForDeletion(feature.id)}
                              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                              title="Remove feature"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        ))}

                      {/* Features marked for deletion (shown with strikethrough) */}
                      {((selectedInclusion as unknown as { features?: PlanAgentFeature[] }).features || [])
                        .filter(f => f.is_active && featuresToDelete.includes(f.id))
                        .map((feature) => (
                          <div
                            key={feature.id}
                            className="flex items-center gap-2 p-2.5 bg-red-50 border border-red-200 rounded-xl group transition-all"
                          >
                            <div className="flex-shrink-0 w-5 h-5 bg-red-100 rounded-full flex items-center justify-center">
                              <svg className="w-3 h-3 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </div>
                            <span className="flex-1 text-sm text-red-400 line-through">{feature.feature_text}</span>
                            <button
                              type="button"
                              onClick={() => handleUnmarkFeatureForDeletion(feature.id)}
                              className="p-1.5 text-red-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-all"
                              title="Undo delete"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                              </svg>
                            </button>
                          </div>
                        ))}

                      {/* Pending Features (not yet saved - shown in green) */}
                      {pendingEditFeatures.map((featureText, index) => (
                        <div
                          key={`pending-${index}`}
                          className="flex items-center gap-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl group transition-all"
                        >
                          <div className="flex-shrink-0 w-5 h-5 bg-emerald-100 rounded-full flex items-center justify-center">
                            <svg className="w-3 h-3 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                          </div>
                          <span className="flex-1 text-sm text-emerald-700">{featureText}</span>
                          <span className="text-xs text-emerald-500 font-medium px-1.5 py-0.5 bg-emerald-100 rounded">New</span>
                          <button
                            type="button"
                            onClick={() => handleRemovePendingFeature(index)}
                            className="p-1.5 text-emerald-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                            title="Remove"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}

                      {/* Empty state */}
                      {((selectedInclusion as unknown as { features?: PlanAgentFeature[] }).features || []).filter(f => f.is_active && !featuresToDelete.includes(f.id)).length === 0 && pendingEditFeatures.length === 0 && (
                        <div className="p-4 bg-gray-50 border border-dashed border-gray-200 rounded-xl text-center">
                          <svg className="w-8 h-8 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                          </svg>
                          <p className="text-sm text-gray-500">No features added yet</p>
                          <p className="text-xs text-gray-400 mt-0.5">Add features that will be shown on the pricing page</p>
                        </div>
                      )}
                    </div>

                    {/* Add New Feature */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newFeatureText}
                        onChange={(e) => setNewFeatureText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddFeatureLocal();
                          }
                        }}
                        placeholder="e.g., Up to 150 API calls, Priority support..."
                        className="flex-1 px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
                      />
                      <button
                        type="button"
                        onClick={handleAddFeatureLocal}
                        disabled={!newFeatureText.trim()}
                        className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Add
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">Press Enter or click Add to add a feature. Changes will be saved when you click Update.</p>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
                  <button
                    type="button"
                    onClick={closeEditModal}
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

      {/* ============================================ */}
      {/* AGENT SELECTION LIMITS MODAL                */}
      {/* ============================================ */}
      {isLimitsModalOpen && selectedPlan && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-xl">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">Agent Selection Limits</h2>
                    <p className="text-sm text-white/80">{selectedPlan.name}</p>
                  </div>
                </div>
                <button
                  onClick={closeLimitsModal}
                  disabled={isUpdatingPlan}
                  className="p-1.5 hover:bg-white/20 rounded-lg transition-colors disabled:opacity-50"
                >
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-5">
              {/* Info Box */}
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                <div className="flex gap-3">
                  <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-sm text-amber-800">
                    <p className="font-medium mb-1">How Selection Limits Work</p>
                    <p className="text-amber-700">
                      When a user subscribes to this plan, they can choose between the minimum and maximum number of agents from the {inclusions.length} assigned agents.
                    </p>
                  </div>
                </div>
              </div>

              {/* Current Status */}
              <div className="flex items-center justify-between text-sm bg-gray-50 rounded-xl px-4 py-3">
                <span className="text-gray-600">Assigned Agents in Plan:</span>
                <span className="font-bold text-indigo-600">{inclusions.length}</span>
              </div>

              {/* Min Agents Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Minimum Agents Required
                  <span className="ml-1 text-xs font-normal text-gray-400">(0 = no minimum)</span>
                </label>
                <input
                  type="number"
                  min="0"
                  max={inclusions.length || 100}
                  value={minAgents}
                  onChange={(e) => {
                    setMinAgents(e.target.value);
                    setLimitsError(null);
                  }}
                  disabled={isUpdatingPlan}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 disabled:opacity-50 transition-all text-lg font-semibold"
                  placeholder="0"
                />
                <p className="text-xs text-gray-500 mt-1">User must select at least this many agents to subscribe.</p>
              </div>

              {/* Max Agents Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Maximum Agents Allowed
                  <span className="ml-1 text-xs font-normal text-gray-400">(0 = all agents)</span>
                </label>
                <input
                  type="number"
                  min="0"
                  max={inclusions.length || 100}
                  value={maxAgents}
                  onChange={(e) => {
                    setMaxAgents(e.target.value);
                    setLimitsError(null);
                  }}
                  disabled={isUpdatingPlan}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 disabled:opacity-50 transition-all text-lg font-semibold"
                  placeholder="0"
                />
                <p className="text-xs text-gray-500 mt-1">User can select up to this many agents. 0 means they get all {inclusions.length} agents.</p>
              </div>

              {/* Preview */}
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-200">
                <p className="text-sm font-medium text-gray-700 mb-2">Preview</p>
                <p className="text-sm text-gray-600">
                  {parseInt(minAgents) === 0 && parseInt(maxAgents) === 0 ? (
                    <span className="text-emerald-600 font-medium">Users will automatically get all {inclusions.length} agents with this plan.</span>
                  ) : parseInt(minAgents) === 0 && parseInt(maxAgents) > 0 ? (
                    <span>Users can select <span className="font-bold text-amber-600">up to {maxAgents}</span> agents from the {inclusions.length} available.</span>
                  ) : parseInt(maxAgents) === 0 ? (
                    <span>Users must select <span className="font-bold text-amber-600">at least {minAgents}</span> agents (can select all {inclusions.length}).</span>
                  ) : parseInt(minAgents) === parseInt(maxAgents) ? (
                    <span>Users must select <span className="font-bold text-amber-600">exactly {minAgents}</span> agents from the {inclusions.length} available.</span>
                  ) : (
                    <span>Users must select between <span className="font-bold text-amber-600">{minAgents}</span> and <span className="font-bold text-amber-600">{maxAgents}</span> agents from the {inclusions.length} available.</span>
                  )}
                </p>
              </div>

              {/* Error Message */}
              {limitsError && (
                <div className="bg-red-50 border border-red-100 rounded-xl p-3 flex items-center gap-2">
                  <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-red-600">{limitsError}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeLimitsModal}
                disabled={isUpdatingPlan}
                className="px-4 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-xl font-medium hover:bg-gray-50 disabled:opacity-50 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveLimits}
                disabled={isUpdatingPlan}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-400 text-white rounded-xl font-medium transition-all shadow-lg shadow-amber-500/25 disabled:shadow-none"
              >
                {isUpdatingPlan && <LoadingSpinner size="sm" />}
                {isUpdatingPlan ? 'Saving...' : 'Save Limits'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlanAgentInclusionManagement;
