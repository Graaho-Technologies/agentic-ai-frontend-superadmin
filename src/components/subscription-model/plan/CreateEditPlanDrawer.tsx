// components/subscription-model/plan/CreateEditPlanDrawer.tsx

import React, { useState, useEffect } from 'react';
import {
  useCreatePlanMutation,
  useUpdatePlanMutation,
  Plan,
  CreatePlanRequest,
} from '@/features/subscriptionModel/billing/billingApi';

interface CreateEditPlanDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  plan: Plan | null;
  isEditMode: boolean;
  onSuccess?: () => void;
}

interface ApiError {
  data?: Record<string, string | string[]>;
  status?: number;
  message?: string;
}

const CreateEditPlanDrawer: React.FC<CreateEditPlanDrawerProps> = ({
  isOpen,
  onClose,
  plan,
  isEditMode,
  onSuccess,
}) => {
  const [createPlan, { isLoading: isCreating }] = useCreatePlanMutation();
  const [updatePlan, { isLoading: isUpdating }] = useUpdatePlanMutation();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    plan_type: 'starter' as 'free' | 'starter' | 'professional' | 'enterprise' | 'custom',
    base_price: '',
    billing_period: 'monthly' as 'monthly' | 'quarterly' | 'yearly',
    billing_mode: 'prepaid' as 'prepaid' | 'postpaid',
    grace_period_days: '7',
    // Agent selection limits (0 = no minimum / unlimited)
    min_agents_required: '0',
    max_agents_allowed: '0',
    // NEW FIELDS
    cost_per_unit: '',
    promotion_code: '',
    promotion_valid_from: '',
    promotion_valid_until: '',
    discount_percentage: '',
    is_active: true,
    is_public: false,
    display_order: '',
    featured: false,
  });

  // Feature list as array (for interactive UI)
  const [features, setFeatures] = useState<string[]>([]);
  const [featureInput, setFeatureInput] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isEditMode && plan) {
      setFormData({
        name: plan.name,
        description: plan.description || '',
        plan_type: plan.plan_type,
        base_price: plan.base_price.toString(),
        billing_period: plan.billing_period,
        billing_mode: plan.billing_mode,
        grace_period_days: plan.grace_period_days?.toString() || '7',
        // Agent selection limits — 0 is a real value (no minimum / unlimited), not "missing"
        min_agents_required: (plan.min_agents_required ?? 0).toString(),
        max_agents_allowed: (plan.max_agents_allowed ?? 0).toString(),
        // NEW FIELDS
        cost_per_unit: plan.cost_per_unit?.toString() || '',
        promotion_code: plan.promotion_code || '',
        promotion_valid_from: plan.promotion_valid_from ? plan.promotion_valid_from.split('T')[0] : '',
        promotion_valid_until: plan.promotion_valid_until ? plan.promotion_valid_until.split('T')[0] : '',
        discount_percentage: plan.discount_percentage?.toString() || '',
        is_active: plan.is_active,
        is_public: plan.is_public,
        display_order: plan.display_order?.toString() || '',
        featured: plan.featured,
      });
      // Convert feature_list string to array
      const featureListStr = plan.feature_list || '';
      setFeatures(featureListStr.split('\n').filter(f => f.trim() !== ''));
    } else {
      setFormData({
        name: '',
        description: '',
        plan_type: 'starter',
        base_price: '',
        billing_period: 'monthly',
        billing_mode: 'prepaid',
        grace_period_days: '7',
        min_agents_required: '0',
        max_agents_allowed: '0',
        cost_per_unit: '',
        promotion_code: '',
        promotion_valid_from: '',
        promotion_valid_until: '',
        discount_percentage: '',
        is_active: true,
        is_public: false,
        display_order: '',
        featured: false,
      });
      setFeatures([]);
    }
    setFeatureInput('');
    setErrors({});
  }, [isEditMode, plan, isOpen]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Plan name is required';
    }

    if (!formData.base_price || parseFloat(formData.base_price) < 0) {
      newErrors.base_price = 'Valid price is required';
    }

    if (formData.grace_period_days && parseInt(formData.grace_period_days) < 0) {
      newErrors.grace_period_days = 'Grace period cannot be negative';
    }

    if (formData.min_agents_required !== '') {
      const minAgentsVal = parseFloat(formData.min_agents_required);
      if (!Number.isInteger(minAgentsVal) || minAgentsVal < 0) {
        newErrors.min_agents_required = 'Minimum agents required must be a whole number of 0 or more';
      }
    }

    if (formData.max_agents_allowed !== '') {
      const maxAgentsVal = parseFloat(formData.max_agents_allowed);
      if (!Number.isInteger(maxAgentsVal) || maxAgentsVal < 0) {
        newErrors.max_agents_allowed = 'Maximum agents allowed must be a whole number of 0 or more';
      }
    }

    if (!newErrors.min_agents_required && !newErrors.max_agents_allowed) {
      const minAgentsNum = formData.min_agents_required ? parseInt(formData.min_agents_required, 10) : 0;
      const maxAgentsNum = formData.max_agents_allowed ? parseInt(formData.max_agents_allowed, 10) : 0;
      if (minAgentsNum > 0 && maxAgentsNum > 0 && maxAgentsNum < minAgentsNum) {
        newErrors.max_agents_allowed = 'Maximum agents allowed must be greater than or equal to minimum agents required';
      }
    }

    if (formData.cost_per_unit && parseFloat(formData.cost_per_unit) < 0) {
      newErrors.cost_per_unit = 'Cost per unit cannot be negative';
    }

    if (formData.discount_percentage) {
      const discount = parseFloat(formData.discount_percentage);
      if (discount < 0 || discount > 100) {
        newErrors.discount_percentage = 'Discount must be between 0 and 100';
      }
    }

    if (formData.promotion_valid_from && formData.promotion_valid_until) {
      const startDate = new Date(formData.promotion_valid_from);
      const endDate = new Date(formData.promotion_valid_until);
      if (endDate < startDate) {
        newErrors.promotion_valid_until = 'End date must be after start date';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      // Convert features array to newline-separated string for API
      const featureListStr = features.length > 0 ? features.join('\n') : null;

      const planData: CreatePlanRequest = {
        name: formData.name,
        description: formData.description || undefined,
        plan_type: formData.plan_type,
        base_price: parseFloat(formData.base_price),
        billing_period: formData.billing_period,
        billing_mode: formData.billing_mode,
        grace_period_days: formData.grace_period_days ? parseInt(formData.grace_period_days) : 7,
        // Agent selection limits
        min_agents_required: formData.min_agents_required ? parseInt(formData.min_agents_required, 10) : 0,
        max_agents_allowed: formData.max_agents_allowed ? parseInt(formData.max_agents_allowed, 10) : 0,
        // NEW FIELDS
        cost_per_unit: formData.cost_per_unit ? parseFloat(formData.cost_per_unit) : null,
        promotion_code: formData.promotion_code || null,
        promotion_valid_from: formData.promotion_valid_from || null,
        promotion_valid_until: formData.promotion_valid_until || null,
        discount_percentage: formData.discount_percentage ? parseFloat(formData.discount_percentage) : null,
        is_active: formData.is_active,
        is_public: formData.is_public,
        display_order: formData.display_order ? parseInt(formData.display_order) : 0,
        featured: formData.featured,
        feature_list: featureListStr,
      };

      if (isEditMode && plan) {
        await updatePlan({ id: plan.id, data: planData }).unwrap();
      } else {
        await createPlan(planData).unwrap();
      }

      onSuccess?.();
      onClose();
    } catch (error: unknown) {
      console.error('Failed to save plan:', error);
      const apiError = error as ApiError;
      if (apiError.data) {
        const apiErrors: Record<string, string> = {};
        Object.keys(apiError.data).forEach((key) => {
          const errorValue = apiError.data![key];
          apiErrors[key] = Array.isArray(errorValue) ? errorValue[0] : errorValue;
        });
        setErrors(apiErrors);
      }
    }
  };

  const handleInputChange = (field: string, value: string | number | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  if (!isOpen) return null;

  const isLoading = isCreating || isUpdating;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full md:w-2/3 lg:w-1/2 xl:w-2/5 max-w-3xl bg-white shadow-2xl z-50">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-purple-50">
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-[#4318ff] to-[#7c75ff] bg-clip-text text-transparent">
                {isEditMode ? 'Edit Plan' : 'Create New Plan'}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                {isEditMode ? 'Update plan details and configuration' : 'Configure a new subscription plan'}
              </p>
            </div>
            <button
              onClick={onClose}
              disabled={isLoading}
              className="p-2.5 rounded-full hover:bg-white/80 transition-all duration-200 text-gray-600 hover:text-gray-900 disabled:opacity-50"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto bg-gray-50 p-6">
            <div className="space-y-6">
              {/* Plan Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Plan Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  disabled={isLoading}
                  className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-[#4318ff]/20 focus:border-[#4318ff] transition-all duration-200 disabled:bg-gray-100 disabled:cursor-not-allowed ${
                    errors.name ? 'border-red-300' : 'border-gray-200'
                  }`}
                  placeholder="e.g., Professional Plan"
                />
                {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  disabled={isLoading}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#4318ff]/20 focus:border-[#4318ff] transition-all duration-200 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  placeholder="Brief description of this plan..."
                />
              </div>

              {/* Feature List - Interactive UI */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  Feature List
                  {features.length > 0 && (
                    <span className="ml-auto text-xs font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                      {features.length} feature{features.length > 1 ? 's' : ''}
                    </span>
                  )}
                </label>

                {/* Existing features */}
                {features.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {features.map((feature, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border border-indigo-100 group"
                      >
                        <svg className="w-4 h-4 text-indigo-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="flex-1 text-sm text-gray-700">{feature}</span>
                        <button
                          type="button"
                          onClick={() => setFeatures(prev => prev.filter((_, i) => i !== idx))}
                          disabled={isLoading}
                          className="p-1 rounded-full hover:bg-red-100 text-gray-400 hover:text-red-500 transition-all disabled:opacity-50"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
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
                        setFeatures(prev => [...prev, featureInput.trim()]);
                        setFeatureInput('');
                      }
                    }}
                    placeholder="e.g., Up to 100 API calls per month"
                    disabled={isLoading}
                    className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm placeholder:text-gray-400 focus:ring-2 focus:ring-[#4318ff]/20 focus:border-[#4318ff] disabled:bg-gray-100 disabled:cursor-not-allowed transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (featureInput.trim()) {
                        setFeatures(prev => [...prev, featureInput.trim()]);
                        setFeatureInput('');
                      }
                    }}
                    disabled={isLoading || !featureInput.trim()}
                    className="px-4 py-2.5 bg-gradient-to-r from-[#4318ff] to-[#7c75ff] text-white text-sm font-semibold rounded-xl hover:from-[#3610d9] hover:to-[#6b63e6] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1.5"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add
                  </button>
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Press Enter or click Add to add each feature. These will be displayed on the pricing page.
                </p>
              </div>

              {/* Plan Type & Display Order */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Plan Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.plan_type}
                    onChange={(e) => handleInputChange('plan_type', e.target.value)}
                    disabled={isLoading}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#4318ff]/20 focus:border-[#4318ff] transition-all duration-200 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    <option value="free">Free</option>
                    <option value="starter">Starter</option>
                    <option value="professional">Professional</option>
                    <option value="enterprise">Enterprise</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Display Order
                  </label>
                  <input
                    type="number"
                    value={formData.display_order}
                    onChange={(e) => handleInputChange('display_order', e.target.value)}
                    disabled={isLoading}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#4318ff]/20 focus:border-[#4318ff] transition-all duration-200 disabled:bg-gray-100 disabled:cursor-not-allowed"
                    placeholder="0"
                    min="0"
                  />
                </div>
              </div>

              {/* Base Price & Billing Period */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Base Price (USD) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.base_price}
                      onChange={(e) => handleInputChange('base_price', e.target.value)}
                      disabled={isLoading}
                      className={`w-full pl-8 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-[#4318ff]/20 focus:border-[#4318ff] transition-all duration-200 disabled:bg-gray-100 disabled:cursor-not-allowed ${
                        errors.base_price ? 'border-red-300' : 'border-gray-200'
                      }`}
                      placeholder="0.00"
                      min="0"
                    />
                  </div>
                  {errors.base_price && <p className="mt-1 text-sm text-red-600">{errors.base_price}</p>}
                  <p className="mt-1 text-xs text-gray-500">Base price (components and agents add to this)</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Billing Period <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.billing_period}
                    onChange={(e) => handleInputChange('billing_period', e.target.value)}
                    disabled={isLoading}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#4318ff]/20 focus:border-[#4318ff] transition-all duration-200 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
              </div>

              {/* Billing Mode & Grace Period */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Billing Mode <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.billing_mode}
                    onChange={(e) => handleInputChange('billing_mode', e.target.value)}
                    disabled={isLoading}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#4318ff]/20 focus:border-[#4318ff] transition-all duration-200 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    <option value="prepaid">Prepaid (Pay first, use later)</option>
                    <option value="postpaid">Postpaid (Use first, pay later)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Grace Period (Days)
                  </label>
                  <input
                    type="number"
                    value={formData.grace_period_days}
                    onChange={(e) => handleInputChange('grace_period_days', e.target.value)}
                    disabled={isLoading}
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-[#4318ff]/20 focus:border-[#4318ff] transition-all duration-200 disabled:bg-gray-100 disabled:cursor-not-allowed ${
                      errors.grace_period_days ? 'border-red-300' : 'border-gray-200'
                    }`}
                    placeholder="7"
                    min="0"
                  />
                  {errors.grace_period_days && <p className="mt-1 text-sm text-red-600">{errors.grace_period_days}</p>}
                  <p className="mt-1 text-xs text-gray-500">Days before suspension (for postpaid)</p>
                </div>
              </div>

              {/* Agent Selection Limits */}
              <div className="bg-white rounded-xl p-5 border border-gray-200 space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Agent Selection Limits</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Controls how many of the plan&apos;s linked agents a subscriber may use. Agents are linked to the plan after it is created.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Minimum agents required
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={formData.min_agents_required}
                      onChange={(e) => handleInputChange('min_agents_required', e.target.value)}
                      disabled={isLoading}
                      className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-[#4318ff]/20 focus:border-[#4318ff] transition-all duration-200 disabled:bg-gray-100 disabled:cursor-not-allowed ${
                        errors.min_agents_required ? 'border-red-300' : 'border-gray-200'
                      }`}
                      placeholder="0"
                    />
                    {errors.min_agents_required && <p className="mt-1 text-sm text-red-600">{errors.min_agents_required}</p>}
                    <p className="mt-1 text-xs text-gray-500">0 = no minimum</p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Maximum agents allowed
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={formData.max_agents_allowed}
                      onChange={(e) => handleInputChange('max_agents_allowed', e.target.value)}
                      disabled={isLoading}
                      className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-[#4318ff]/20 focus:border-[#4318ff] transition-all duration-200 disabled:bg-gray-100 disabled:cursor-not-allowed ${
                        errors.max_agents_allowed ? 'border-red-300' : 'border-gray-200'
                      }`}
                      placeholder="0"
                    />
                    {errors.max_agents_allowed && <p className="mt-1 text-sm text-red-600">{errors.max_agents_allowed}</p>}
                    <p className="mt-1 text-xs text-gray-500">0 = unlimited</p>
                  </div>
                </div>
              </div>

              {/* NEW: Usage-Based Pricing */}
              {/* <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Cost Per Unit (Optional)
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    step="0.000001"
                    value={formData.cost_per_unit}
                    onChange={(e) => handleInputChange('cost_per_unit', e.target.value)}
                    disabled={isLoading}
                    className={`w-full pl-8 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-[#4318ff]/20 focus:border-[#4318ff] transition-all duration-200 disabled:bg-gray-100 disabled:cursor-not-allowed ${
                      errors.cost_per_unit ? 'border-red-300' : 'border-gray-200'
                    }`}
                    placeholder="0.002"
                    min="0"
                  />
                </div>
                {errors.cost_per_unit && <p className="mt-1 text-sm text-red-600">{errors.cost_per_unit}</p>}
                <p className="mt-1 text-xs text-gray-500">For usage-based billing (e.g., $0.002 per token)</p>
              </div> */}

              {/* NEW: Promotion Section */}
              {/* <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-5 border border-purple-200">
                <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                  </svg>
                  Promotional Pricing (Optional)
                </h3>

                <div className="space-y-4">
       
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Promotion Code
                      </label>
                      <input
                        type="text"
                        value={formData.promotion_code}
                        onChange={(e) => handleInputChange('promotion_code', e.target.value.toUpperCase())}
                        disabled={isLoading}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all duration-200 disabled:bg-gray-100 disabled:cursor-not-allowed"
                        placeholder="SUMMER2024"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Discount (%)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          value={formData.discount_percentage}
                          onChange={(e) => handleInputChange('discount_percentage', e.target.value)}
                          disabled={isLoading}
                          className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all duration-200 disabled:bg-gray-100 disabled:cursor-not-allowed ${
                            errors.discount_percentage ? 'border-red-300' : 'border-gray-200'
                          }`}
                          placeholder="20"
                          min="0"
                          max="100"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">%</span>
                      </div>
                      {errors.discount_percentage && <p className="mt-1 text-sm text-red-600">{errors.discount_percentage}</p>}
                    </div>
                  </div>

      
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Valid From
                      </label>
                      <input
                        type="date"
                        value={formData.promotion_valid_from}
                        onChange={(e) => handleInputChange('promotion_valid_from', e.target.value)}
                        disabled={isLoading}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all duration-200 disabled:bg-gray-100 disabled:cursor-not-allowed"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Valid Until
                      </label>
                      <input
                        type="date"
                        value={formData.promotion_valid_until}
                        onChange={(e) => handleInputChange('promotion_valid_until', e.target.value)}
                        disabled={isLoading}
                        className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all duration-200 disabled:bg-gray-100 disabled:cursor-not-allowed ${
                          errors.promotion_valid_until ? 'border-red-300' : 'border-gray-200'
                        }`}
                      />
                      {errors.promotion_valid_until && <p className="mt-1 text-sm text-red-600">{errors.promotion_valid_until}</p>}
                    </div>
                  </div>

                  {formData.discount_percentage && formData.base_price && (
                    <div className="bg-white rounded-lg p-4 border border-purple-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-600">Discounted Price</p>
                          <p className="text-2xl font-bold text-purple-600">
                            ${(parseFloat(formData.base_price) * (1 - parseFloat(formData.discount_percentage) / 100)).toFixed(2)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-500 line-through">${parseFloat(formData.base_price).toFixed(2)}</p>
                          <p className="text-sm font-semibold text-green-600">Save {formData.discount_percentage}%</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div> */}

              {/* Status Toggles */}
              <div className="bg-white rounded-xl p-5 border border-gray-200 space-y-4">
                <h3 className="text-sm font-bold text-gray-900 mb-4">Plan Status</h3>

                {/* Active Toggle */}
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">Active</p>
                    <p className="text-sm text-gray-500">Plan is available for subscription</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleInputChange('is_active', !formData.is_active)}
                    disabled={isLoading}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      formData.is_active ? 'bg-green-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        formData.is_active ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Public Toggle */}
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">Public</p>
                    <p className="text-sm text-gray-500">Visible to all users</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleInputChange('is_public', !formData.is_public)}
                    disabled={isLoading}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      formData.is_public ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        formData.is_public ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Featured Toggle */}
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">Featured</p>
                    <p className="text-sm text-gray-500">Highlight this plan in listings</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleInputChange('featured', !formData.featured)}
                    disabled={isLoading}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      formData.featured ? 'bg-yellow-600' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        formData.featured ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Info Card */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <div className="flex items-start space-x-3">
                  <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="flex-1">
                    <h4 className="font-semibold text-blue-900 mb-1">Next Steps</h4>
                    <p className="text-sm text-blue-800">
                      After creating the plan, you can add components (compute tokens, storage, etc.) and agents to build the complete offering.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </form>

          {/* Footer */}
          <div className="bg-white border-t border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isLoading}
                className="inline-flex items-center px-6 py-2.5 bg-gradient-to-r from-[#4318ff] to-[#7c75ff] hover:from-[#3610d9] hover:to-[#6b63e6] text-white rounded-lg font-medium transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                    {isEditMode ? 'Updating...' : 'Creating...'}
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {isEditMode ? 'Update Plan' : 'Create Plan'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default CreateEditPlanDrawer;