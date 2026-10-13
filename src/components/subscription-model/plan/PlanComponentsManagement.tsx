// components/subscription-model/plan/PlanComponentsManagement.tsx
"use client";
import React, { useState, useMemo, useCallback } from 'react';
import {
  useGetPlanComponentsQuery,
  useCreatePlanComponentMutation,
  useUpdatePlanComponentMutation,
  useDeletePlanComponentMutation,
  useGetComponentTypesQuery,
  PlanComponent,
  StorageUnit,
} from '@/features/subscriptionModel/billing/billingApi';
import ComboboxWithSuggestions from '@/components/ui/ComboboxWithSuggestions';
import {
  STORAGE_UNIT_OPTIONS,
  isStorageComponentType,
  calculateStoragePrice,
  getConversionPreview,
  getUnitAbbreviation,
} from '@/lib/utils/storageConversion';

// ============================================
// TYPES
// ============================================
interface FormData {
  name: string;
  component_type: string;
  description: string;
  quantity: string;
  unit_label: string;
  cost_per_unit: string;
  price_per_unit: string;
  promotion_code: string;
  promotion_valid_from: string;
  promotion_valid_until: string;
  discount_percentage: string;
  is_active: boolean;
  is_renewable: boolean;
  // Storage unit fields
  storage_unit: StorageUnit | '';
  pricing_unit: StorageUnit | '';
}

interface QueryParams {
  search?: string;
  component_type?: string;
  is_active?: boolean;
  ordering?: string;
  limit?: number;
  offset?: number;
}

// ============================================
// CONSTANTS
// ============================================
const DEFAULT_FORM_DATA: FormData = {
  name: '',
  component_type: '',
  description: '',
  quantity: '',
  unit_label: '',
  cost_per_unit: '',
  price_per_unit: '',
  promotion_code: '',
  promotion_valid_from: '',
  promotion_valid_until: '',
  discount_percentage: '',
  is_active: true,
  is_renewable: false,
  storage_unit: '',
  pricing_unit: '',
};

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const DEFAULT_PAGE_SIZE = 10;

// ============================================
// VALIDATION
// ============================================
const validateSnakeCaseField = (value: string, fieldName: string): { isValid: boolean; error: string } => {
  if (!value.trim()) return { isValid: false, error: `${fieldName} is required` };
  if (!/^[a-z]/.test(value)) return { isValid: false, error: 'Must start with a lowercase letter' };
  if (!/^[a-z][a-z0-9_]*$/.test(value)) return { isValid: false, error: 'Only lowercase letters, numbers, and underscores allowed' };
  if (/__/.test(value)) return { isValid: false, error: 'Consecutive underscores not allowed' };
  if (/_$/.test(value)) return { isValid: false, error: 'Cannot end with underscore' };
  if (value.length < 2) return { isValid: false, error: 'Minimum 2 characters required' };
  if (value.length > 50) return { isValid: false, error: 'Maximum 50 characters allowed' };
  return { isValid: true, error: '' };
};

const validateComponentType = (value: string) => validateSnakeCaseField(value, 'Component type');
const validateUnitLabel = (value: string) => validateSnakeCaseField(value, 'Unit label');

// Format input to snake_case
const formatToSnakeCase = (value: string): string => {
  return value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
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

const TableSkeleton = ({ rows = 5 }: { rows?: number }) => (
  <div className="animate-pulse">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-gray-100">
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-200 rounded w-1/3" />
          <div className="h-3 bg-gray-100 rounded w-1/2" />
        </div>
        <div className="h-6 bg-gray-200 rounded-full w-20" />
        <div className="h-4 bg-gray-100 rounded w-16" />
        <div className="h-4 bg-gray-100 rounded w-24" />
        <div className="h-6 bg-gray-200 rounded-full w-16" />
        <div className="flex gap-2">
          <div className="h-8 w-8 bg-gray-100 rounded-lg" />
          <div className="h-8 w-8 bg-gray-100 rounded-lg" />
        </div>
      </div>
    ))}
  </div>
);

const EmptyState = ({ onCreateClick }: { onCreateClick: () => void }) => (
  <div className="flex flex-col items-center justify-center py-16">
    <div className="w-20 h-20 bg-gradient-to-br from-indigo-100 to-purple-100 rounded-2xl flex items-center justify-center mb-6">
      <svg className="w-10 h-10 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    </div>
    <h3 className="text-xl font-semibold text-gray-900 mb-2">No components found</h3>
    <p className="text-gray-500 mb-6 text-center max-w-sm">Get started by creating your first plan component to build subscription plans.</p>
    <button
      onClick={onCreateClick}
      className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-all duration-200 shadow-lg shadow-indigo-500/25"
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
      </svg>
      Create First Component
    </button>
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
  isLoading,
}: {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  isLoading: boolean;
}) => {
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');

      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) pages.push(i);

      if (currentPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  if (totalItems === 0) return null;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 bg-gray-50/50 border-t border-gray-100">
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-600">
          Showing <span className="font-semibold text-gray-900">{startItem}</span> to{' '}
          <span className="font-semibold text-gray-900">{endItem}</span> of{' '}
          <span className="font-semibold text-gray-900">{totalItems}</span> results
        </span>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500">Per page:</label>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            disabled={isLoading}
            className="px-2 py-1 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:opacity-50"
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
          disabled={currentPage === 1 || isLoading}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          title="Previous"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {getPageNumbers().map((page, idx) => (
          <button
            key={idx}
            onClick={() => typeof page === 'number' && onPageChange(page)}
            disabled={page === '...' || page === currentPage || isLoading}
            className={`min-w-[36px] h-9 px-3 text-sm font-medium rounded-lg transition-all ${
              page === currentPage
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/30'
                : page === '...'
                ? 'text-gray-400 cursor-default'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-40'
            }`}
          >
            {page}
          </button>
        ))}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages || isLoading}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          title="Next"
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
// MAIN COMPONENT
// ============================================
const PlanComponentsManagement = () => {
  // State
  const [searchTerm, setSearchTerm] = useState('');
  const [componentTypeFilter, setComponentTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedComponent, setSelectedComponent] = useState<PlanComponent | null>(null);
  const [formData, setFormData] = useState<FormData>(DEFAULT_FORM_DATA);
  const [componentTypeError, setComponentTypeError] = useState('');
  const [unitLabelError, setUnitLabelError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Build query params
  const queryParams = useMemo((): QueryParams => {
    const params: QueryParams = {
      ordering: '-created_at',
      limit: pageSize,
      offset: (currentPage - 1) * pageSize,
    };
    if (searchTerm) params.search = searchTerm;
    if (componentTypeFilter !== 'all') params.component_type = componentTypeFilter;
    if (statusFilter === 'active') params.is_active = true;
    if (statusFilter === 'inactive') params.is_active = false;
    return params;
  }, [searchTerm, componentTypeFilter, statusFilter, currentPage, pageSize]);

  // RTK Query hooks
  const { data: componentsResponse, isLoading, isFetching } = useGetPlanComponentsQuery(queryParams);
  const { data: allComponentsResponse } = useGetPlanComponentsQuery({ ordering: '-created_at', limit: 1000 });
  const { data: componentTypesResponse, isLoading: isLoadingTypes } = useGetComponentTypesQuery();
  const [createComponent, { isLoading: isCreating }] = useCreatePlanComponentMutation();
  const [updateComponent, { isLoading: isUpdating }] = useUpdatePlanComponentMutation();
  const [deleteComponent] = useDeletePlanComponentMutation();

  // Component type options for dropdown
  const componentTypeOptions = useMemo(() => {
    return componentTypesResponse?.types || [];
  }, [componentTypesResponse]);

  // Derived state
  const components = componentsResponse?.results || [];
  const totalItems = componentsResponse?.count || 0;
  const totalPages = Math.ceil(totalItems / pageSize);
  const isProcessing = isCreating || isUpdating;
  const showOverlay = isFetching && !isLoading;

  // Get unique component types for filter
  const uniqueComponentTypes = useMemo(() => {
    if (!allComponentsResponse?.results) return [];
    const types = new Set(allComponentsResponse.results.map(c => c.component_type));
    return Array.from(types).sort();
  }, [allComponentsResponse?.results]);

  // Handlers
  const handleComponentTypeChange = useCallback((value: string) => {
    const sanitized = value.toLowerCase().replace(/\s+/g, '_');
    setFormData(prev => ({ ...prev, component_type: sanitized }));
    setComponentTypeError(sanitized ? validateComponentType(sanitized).error : '');
  }, []);

  const handleUnitLabelChange = useCallback((value: string) => {
    const sanitized = value.toLowerCase().replace(/\s+/g, '_');
    setFormData(prev => ({ ...prev, unit_label: sanitized }));
    setUnitLabelError(sanitized ? validateUnitLabel(sanitized).error : '');
  }, []);

  const resetForm = useCallback(() => {
    setFormData(DEFAULT_FORM_DATA);
    setSelectedComponent(null);
    setComponentTypeError('');
    setUnitLabelError('');
  }, []);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  }, []);

  const handleFilterChange = useCallback((type: 'search' | 'componentType' | 'status', value: string) => {
    setCurrentPage(1);
    if (type === 'search') setSearchTerm(value);
    else if (type === 'componentType') setComponentTypeFilter(value);
    else setStatusFilter(value);
  }, []);

  const buildSubmitData = useCallback((data: FormData) => {
    const isStorage = isStorageComponentType(data.component_type);

    return {
      name: data.name,
      component_type: data.component_type,
      description: data.description || null,
      quantity: data.quantity ? parseFloat(data.quantity) : null,
      unit_label: data.unit_label,
      cost_per_unit: data.cost_per_unit.trim() ? data.cost_per_unit.trim() : null,
      price_per_unit: data.price_per_unit.trim() ? data.price_per_unit.trim() : null,
      discount_percentage: data.discount_percentage ? parseFloat(data.discount_percentage) : null,
      promotion_valid_from: data.promotion_valid_from || null,
      promotion_valid_until: data.promotion_valid_until || null,
      promotion_code: data.promotion_code || null,
      is_active: data.is_active,
      is_renewable: data.is_renewable,
      // Storage unit fields (only for storage components)
      storage_unit: isStorage && data.storage_unit ? data.storage_unit : null,
      pricing_unit: isStorage && data.pricing_unit ? data.pricing_unit : null,
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const typeValidation = validateComponentType(formData.component_type);
    const unitValidation = validateUnitLabel(formData.unit_label);

    if (!typeValidation.isValid) { setComponentTypeError(typeValidation.error); return; }
    if (!unitValidation.isValid) { setUnitLabelError(unitValidation.error); return; }

    try {
      if (isEditModalOpen && selectedComponent) {
        await updateComponent({ id: selectedComponent.id, data: buildSubmitData(formData) }).unwrap();
      } else {
        await createComponent(buildSubmitData(formData)).unwrap();
      }
      setIsCreateModalOpen(false);
      setIsEditModalOpen(false);
      resetForm();
    } catch (error) {
      console.error('Failed to save component:', error);
      alert(`Failed to ${isEditModalOpen ? 'update' : 'create'} component. Please try again.`);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete "${name}"? This action cannot be undone.`)) return;
    setDeletingId(id);
    try {
      await deleteComponent(id).unwrap();
    } catch (error) {
      console.error('Failed to delete component:', error);
      alert('Failed to delete component. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleEdit = useCallback((component: PlanComponent) => {
    setSelectedComponent(component);
    setFormData({
      name: component.name,
      component_type: component.component_type,
      description: component.description || '',
      quantity: component.quantity ? String(component.quantity) : '',
      unit_label: component.unit_label,
      cost_per_unit: component.cost_per_unit ? String(component.cost_per_unit) : '',
      price_per_unit: component.price_per_unit ? String(component.price_per_unit) : '',
      promotion_code: component.promotion_code || '',
      promotion_valid_from: component.promotion_valid_from || '',
      promotion_valid_until: component.promotion_valid_until || '',
      discount_percentage: component.discount_percentage ? String(component.discount_percentage) : '',
      is_active: component.is_active,
      is_renewable: component.is_renewable,
      storage_unit: component.storage_unit || '',
      pricing_unit: component.pricing_unit || '',
    });
    setIsEditModalOpen(true);
  }, []);

  const formatCurrency = (value: string | number | null | undefined) => {
    if (value === null || value === undefined || value === '') return '$0.00';
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (!Number.isFinite(num)) return '$0.00';
    const [whole, fraction = ''] = num.toFixed(10).split('.');
    const trimmed = fraction.replace(/0+$/, '').padEnd(2, '0');
    return `$${whole}.${trimmed}`;
  };

  const formatComponentType = (type: string) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  const isPromotionActive = (component: PlanComponent) => {
    if (!component.promotion_code) return false;
    const now = new Date();
    const from = component.promotion_valid_from ? new Date(component.promotion_valid_from) : null;
    const until = component.promotion_valid_until ? new Date(component.promotion_valid_until) : null;
    return (!from || now >= from) && (!until || now <= until);
  };

  return (
    <div className="min-h-screen bg-gray-50/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Plan Components</h1>
              <p className="text-gray-500 mt-1">
                Manage building blocks for subscription plans
                {totalItems > 0 && <span className="ml-1">• {totalItems} component{totalItems !== 1 ? 's' : ''}</span>}
              </p>
            </div>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              disabled={isProcessing}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl font-medium transition-all duration-200 shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <span>Create Component</span>
            </button>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            <div className="lg:col-span-2">
              <div className="relative">
                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search components..."
                  value={searchTerm}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                  className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>
            </div>
            <select
              value={componentTypeFilter}
              onChange={(e) => handleFilterChange('componentType', e.target.value)}
              className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-700 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            >
              <option value="all">All Types ({uniqueComponentTypes.length})</option>
              {uniqueComponentTypes.map((type) => (
                <option key={type} value={type}>{formatComponentType(type)}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-700 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden relative">
          {/* Loading Overlay for refetch */}
          {showOverlay && (
            <div className="absolute inset-0 bg-white/70 backdrop-blur-[1px] z-10 flex items-center justify-center">
              <div className="flex items-center gap-3 bg-white px-5 py-3 rounded-xl shadow-lg border border-gray-100">
                <LoadingSpinner size="sm" className="text-indigo-600" />
                <span className="text-sm font-medium text-gray-700">Updating...</span>
              </div>
            </div>
          )}

          {isLoading ? (
            <TableSkeleton rows={pageSize} />
          ) : components.length === 0 ? (
            <EmptyState onCreateClick={() => setIsCreateModalOpen(true)} />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Component</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Quantity / Unit</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Pricing</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Cost</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Promotion</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {components.map((component) => {
                      const promoActive = isPromotionActive(component);
                      return (
                        <tr key={component.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-medium text-gray-900">{component.name}</div>
                            {component.description && (
                              <div className="text-sm text-gray-500 mt-0.5 line-clamp-1 max-w-xs">{component.description}</div>
                            )}
                            <div className="text-xs text-gray-400 mt-1">
                              {new Date(component.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
                              {formatComponentType(component.component_type)}
                            </span>
                            {component.is_renewable && (
                              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700">
                                Renewable
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <div className="space-y-1">
                              {component.quantity && (
                                <div className="text-sm font-semibold text-gray-900">
                                  {Number(component.quantity).toLocaleString()}
                                </div>
                              )}
                              <span className="text-sm text-gray-600 font-mono bg-gray-100 px-2 py-0.5 rounded">
                                {component.unit_label}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 text-sm">
                                <span className="text-gray-400 w-10">Cost</span>
                                <span className="font-medium text-gray-700">{formatCurrency(component.cost_per_unit)}</span>
                              </div>
                              <div className="flex items-center gap-2 text-sm">
                                <span className="text-gray-400 w-10">Price</span>
                                <span className="font-semibold text-indigo-600">{formatCurrency(component.price_per_unit)}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {(() => {
                              const costPerUnit = component.cost_per_unit ? parseFloat(component.cost_per_unit) : 0;
                              const quantity = component.quantity ? parseFloat(component.quantity) : 0;
                              const totalCost = component.total_cost ? parseFloat(component.total_cost) : (costPerUnit * quantity);
                              return totalCost > 0 ? (
                                <div>
                                  <span className="text-sm font-bold text-emerald-700">${totalCost.toFixed(2)}</span>
                                  <div className="text-xs text-gray-400 mt-0.5">
                                    {formatCurrency(component.cost_per_unit)} × {Number(component.quantity || 0).toLocaleString()}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-sm text-gray-400">—</span>
                              );
                            })()}
                          </td>
                          <td className="px-6 py-4">
                            {component.promotion_code ? (
                              <div>
                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${
                                  promoActive ? 'bg-purple-50 text-purple-700 border border-purple-100' : 'bg-gray-100 text-gray-500'
                                }`}>
                                  {promoActive && <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-pulse" />}
                                  {component.promotion_code}
                                </span>
                                {component.discount_percentage && (
                                  <div className="text-xs text-gray-500 mt-1">{component.discount_percentage}% off</div>
                                )}
                              </div>
                            ) : (
                              <span className="text-sm text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                              component.is_active
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-red-50 text-red-700'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${component.is_active ? 'bg-emerald-500' : 'bg-red-500'}`} />
                              {component.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleEdit(component)}
                                disabled={isProcessing}
                                className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg disabled:opacity-40 transition-all"
                                title="Edit"
                              >
                                <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleDelete(component.id, component.name)}
                                disabled={deletingId === component.id}
                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-40 transition-all"
                                title="Delete"
                              >
                                {deletingId === component.id ? (
                                  <LoadingSpinner size="sm" className="text-red-500" />
                                ) : (
                                  <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalItems}
                pageSize={pageSize}
                onPageChange={handlePageChange}
                onPageSizeChange={handlePageSizeChange}
                isLoading={isFetching}
              />
            </>
          )}
        </div>
      </div>

      {/* Modal */}
      {(isCreateModalOpen || isEditModalOpen) && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => !isProcessing && (setIsCreateModalOpen(false), setIsEditModalOpen(false), resetForm())} />

          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl">
              {/* Modal Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${isEditModalOpen ? 'bg-amber-100' : 'bg-indigo-100'}`}>
                    {isEditModalOpen ? (
                      <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      {isEditModalOpen ? 'Edit Component' : 'Create Component'}
                    </h2>
                    <p className="text-sm text-gray-500">
                      {isEditModalOpen ? 'Update component details' : 'Add a new plan component'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => !isProcessing && (setIsCreateModalOpen(false), setIsEditModalOpen(false), resetForm())}
                  disabled={isProcessing}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-all disabled:opacity-50"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Modal Body */}
              <form onSubmit={handleSubmit}>
                <div className="px-6 py-5 max-h-[calc(100vh-280px)] overflow-y-auto space-y-6">
                  {/* Basic Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        disabled={isProcessing}
                        className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:opacity-50 transition-all"
                        placeholder="e.g., API Calls"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Component Type <span className="text-red-500">*</span>
                      </label>
                      <ComboboxWithSuggestions
                        value={formData.component_type}
                        onChange={handleComponentTypeChange}
                        options={componentTypeOptions}
                        placeholder="Select or type (e.g., api_calls)"
                        disabled={isProcessing}
                        error={componentTypeError}
                        isLoading={isLoadingTypes}
                        allowCustom={true}
                        formatValue={formatToSnakeCase}
                        validateValue={validateComponentType}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      disabled={isProcessing}
                      rows={2}
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:opacity-50 transition-all resize-none"
                      placeholder="Brief description..."
                    />
                  </div>

                  {/* Quantity & Unit Label */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Total Units (Quantity)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.quantity}
                        onChange={(e) => setFormData(prev => ({ ...prev, quantity: e.target.value }))}
                        disabled={isProcessing}
                        className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:opacity-50 transition-all"
                        placeholder="e.g., 1000000"
                      />
                      <p className="text-xs text-gray-500 mt-1">Amount of resource (e.g., 1M tokens, 10 GB)</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Unit Label <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.unit_label}
                        onChange={(e) => handleUnitLabelChange(e.target.value)}
                        disabled={isProcessing}
                        className={`w-full px-3.5 py-2.5 bg-gray-50 border rounded-xl focus:bg-white focus:ring-2 disabled:opacity-50 transition-all ${
                          unitLabelError ? 'border-red-300 focus:ring-red-500/20 focus:border-red-500' : 'border-gray-200 focus:ring-indigo-500/20 focus:border-indigo-500'
                        }`}
                        placeholder="e.g., tokens, gb"
                        required
                      />
                      {unitLabelError && <p className="text-xs text-red-500 mt-1">{unitLabelError}</p>}
                    </div>
                  </div>

                  {/* Storage Unit Configuration - Only for storage type components */}
                  {isStorageComponentType(formData.component_type) && (
                    <div className="bg-blue-50/50 rounded-xl p-4 border border-blue-100">
                      <div className="flex items-center gap-2 mb-3">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                        </svg>
                        <h4 className="text-sm font-semibold text-blue-900">Storage Unit Configuration</h4>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Display Unit <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={formData.storage_unit}
                            onChange={(e) => setFormData(prev => ({ ...prev, storage_unit: e.target.value as StorageUnit | '' }))}
                            disabled={isProcessing}
                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:opacity-50 transition-all"
                          >
                            <option value="">Select unit...</option>
                            {STORAGE_UNIT_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label} ({opt.abbreviation})
                              </option>
                            ))}
                          </select>
                          <p className="text-xs text-gray-500 mt-1">Unit for quantity display (e.g., GB)</p>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Pricing Unit <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={formData.pricing_unit}
                            onChange={(e) => setFormData(prev => ({ ...prev, pricing_unit: e.target.value as StorageUnit | '' }))}
                            disabled={isProcessing}
                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 disabled:opacity-50 transition-all"
                          >
                            <option value="">Select unit...</option>
                            {STORAGE_UNIT_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label} ({opt.abbreviation})
                              </option>
                            ))}
                          </select>
                          <p className="text-xs text-gray-500 mt-1">Unit for cost calculation (e.g., per MB)</p>
                        </div>
                      </div>

                      {/* Conversion Preview */}
                      {formData.quantity && formData.storage_unit && formData.pricing_unit && formData.storage_unit !== formData.pricing_unit && (
                        <div className="mt-3 p-3 bg-blue-100/50 rounded-lg">
                          <div className="flex items-center gap-2 text-sm text-blue-800">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="font-medium">
                              {getConversionPreview(
                                parseFloat(formData.quantity) || 0,
                                formData.storage_unit as StorageUnit,
                                formData.pricing_unit as StorageUnit
                              )}
                            </span>
                          </div>
                          {formData.cost_per_unit && (
                            <div className="mt-2 text-sm text-blue-700">
                              Total Cost: <span className="font-bold">
                                ${calculateStoragePrice(
                                  parseFloat(formData.quantity) || 0,
                                  formData.storage_unit as StorageUnit,
                                  parseFloat(formData.cost_per_unit) || 0,
                                  formData.pricing_unit as StorageUnit
                                ).toFixed(2)}
                              </span>
                              <span className="text-xs ml-1">
                                ({getUnitAbbreviation(formData.pricing_unit as StorageUnit)} × ${formData.cost_per_unit})
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Pricing */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Cost Per Unit</label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={formData.cost_per_unit}
                          onChange={(e) => setFormData(prev => ({ ...prev, cost_per_unit: e.target.value }))}
                          disabled={isProcessing}
                          className="w-full pl-8 pr-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:opacity-50 transition-all"
                          placeholder="0.000000"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Price Per Unit</label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-indigo-500">$</span>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={formData.price_per_unit}
                          onChange={(e) => setFormData(prev => ({ ...prev, price_per_unit: e.target.value }))}
                          disabled={isProcessing}
                          className="w-full pl-8 pr-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 disabled:opacity-50 transition-all"
                          placeholder="0.000000"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Total Cost - Auto-calculated */}
                  <div className="bg-emerald-50/50 rounded-xl p-4 border border-emerald-100">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="block text-sm font-medium text-emerald-800">Total Cost</label>
                        <p className="text-xs text-emerald-600 mt-0.5">Auto-calculated: Price Per Unit × Total Units</p>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl font-bold text-emerald-700">
                          ${(() => {
                            const pricePerUnit = parseFloat(formData.price_per_unit) || 0;
                            const quantity = parseFloat(formData.quantity) || 0;
                            const totalCost = pricePerUnit * quantity;
                            return totalCost.toFixed(2);
                          })()}
                        </span>
                        {formData.price_per_unit && formData.quantity && (
                          <p className="text-xs text-emerald-600 mt-1">
                            {formatCurrency(formData.price_per_unit)} × {parseFloat(formData.quantity).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Promotion */}
                  <div className="bg-purple-50/50 rounded-xl p-4 border border-purple-100">
                    <h4 className="text-sm font-medium text-purple-900 mb-3">Promotion (Optional)</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Code</label>
                        <input
                          type="text"
                          value={formData.promotion_code}
                          onChange={(e) => setFormData(prev => ({ ...prev, promotion_code: e.target.value.toUpperCase() }))}
                          disabled={isProcessing}
                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 disabled:opacity-50 transition-all uppercase"
                          placeholder="PROMO2024"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Discount %</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={formData.discount_percentage}
                          onChange={(e) => setFormData(prev => ({ ...prev, discount_percentage: e.target.value }))}
                          disabled={isProcessing}
                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 disabled:opacity-50 transition-all"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Valid From</label>
                        <input
                          type="datetime-local"
                          value={formData.promotion_valid_from}
                          onChange={(e) => setFormData(prev => ({ ...prev, promotion_valid_from: e.target.value }))}
                          disabled={isProcessing}
                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 disabled:opacity-50 transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Valid Until</label>
                        <input
                          type="datetime-local"
                          value={formData.promotion_valid_until}
                          onChange={(e) => setFormData(prev => ({ ...prev, promotion_valid_until: e.target.value }))}
                          disabled={isProcessing}
                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 disabled:opacity-50 transition-all"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Toggles */}
                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={formData.is_active}
                          onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                          disabled={isProcessing}
                          className="sr-only peer"
                        />
                        <div className="w-10 h-5 bg-gray-200 rounded-full peer-checked:bg-emerald-500 peer-disabled:opacity-50 transition-colors" />
                        <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow peer-checked:translate-x-5 transition-transform" />
                      </div>
                      <span className="text-sm font-medium text-gray-700">Active</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={formData.is_renewable}
                          onChange={(e) => setFormData(prev => ({ ...prev, is_renewable: e.target.checked }))}
                          disabled={isProcessing}
                          className="sr-only peer"
                        />
                        <div className="w-10 h-5 bg-gray-200 rounded-full peer-checked:bg-blue-500 peer-disabled:opacity-50 transition-colors" />
                        <div className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow peer-checked:translate-x-5 transition-transform" />
                      </div>
                      <span className="text-sm font-medium text-gray-700">Renewable</span>
                    </label>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
                  <button
                    type="button"
                    onClick={() => !isProcessing && (setIsCreateModalOpen(false), setIsEditModalOpen(false), resetForm())}
                    disabled={isProcessing}
                    className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-xl font-medium hover:bg-gray-50 disabled:opacity-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isProcessing || !!componentTypeError || !!unitLabelError}
                    className="inline-flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl font-medium transition-all shadow-lg shadow-indigo-500/25 disabled:shadow-none"
                  >
                    {isProcessing && <LoadingSpinner size="sm" />}
                    {isProcessing ? (isEditModalOpen ? 'Updating...' : 'Creating...') : (isEditModalOpen ? 'Update' : 'Create')}
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

export default PlanComponentsManagement;
