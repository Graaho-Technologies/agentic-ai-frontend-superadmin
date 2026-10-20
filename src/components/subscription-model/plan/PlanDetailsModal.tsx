// components/subscription-model/plan/PlanDetailsModal.tsx
import React from 'react';
import { Plan } from '@/features/subscriptionModel/billing/billingApi';

interface PlanDetailsModalProps {
  plan: Plan;
  onClose: () => void;
  onEdit: () => void;
}

const PlanDetailsModal: React.FC<PlanDetailsModalProps> = ({ plan, onClose, onEdit }) => {
  const getBadgeColor = (planType: string) => {
    const colors: Record<string, string> = {
      free: 'bg-gray-100 text-gray-800',
      starter: 'bg-blue-100 text-blue-800',
      professional: 'bg-purple-100 text-purple-800',
      enterprise: 'bg-indigo-100 text-indigo-800',
      custom: 'bg-pink-100 text-pink-800',
    };
    return colors[planType] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between mb-6 pb-4 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{plan.name}</h2>
            <div className="flex items-center gap-2 mt-2">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getBadgeColor(plan.plan_type)}`}>
                {plan.plan_type.charAt(0).toUpperCase() + plan.plan_type.slice(1)}
              </span>
              {plan.featured && (
                <span className="px-2.5 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                  ⭐ Featured
                </span>
              )}
              <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${
                plan.billing_mode === 'prepaid' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
              }`}>
                {plan.billing_mode.charAt(0).toUpperCase() + plan.billing_mode.slice(1)}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
          >
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="space-y-6">
          {/* Pricing Summary */}
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-6 border border-indigo-100">
            <h3 className="text-sm font-bold text-gray-900 mb-4">Pricing Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-gray-600 mb-1">Base Price</p>
                <p className="text-2xl font-bold text-indigo-600">${parseFloat(plan.base_price).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1">Components</p>
                <p className="text-2xl font-bold text-purple-600">${parseFloat(plan.total_components_value || '0').toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1">Agents</p>
                <p className="text-2xl font-bold text-pink-600">${parseFloat(plan.total_agents_value || '0').toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1">Total Value</p>
                <p className="text-2xl font-bold text-gray-900">${parseFloat(plan.total_plan_value || '0').toFixed(2)}</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mt-4">
              Billed {plan.billing_period} • Grace period: {plan.grace_period_days} days
            </p>
          </div>

          {/* Description */}
          {plan.description && (
            <div>
              <h3 className="text-sm font-bold text-gray-900 mb-2">Description</h3>
              <p className="text-gray-700">{plan.description}</p>
            </div>
          )}

          {/* Included Components */}
          {plan.included_components && plan.included_components.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-gray-900 mb-3">Included Components ({plan.included_components.length})</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {plan.included_components.map((inclusion) => (
                  <div key={inclusion.id} className="bg-white rounded-lg p-4 border border-gray-200">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">{inclusion.component.name}</p>
                        <p className="text-sm text-gray-600 mt-1">
                          {parseFloat(inclusion.total_quantity).toLocaleString()} {inclusion.component.unit_label}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-indigo-600">${parseFloat(inclusion.total_price).toFixed(2)}</p>
                        {inclusion.is_featured && (
                          <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 rounded">
                            Featured
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Included Agents */}
          {plan.included_agents && plan.included_agents.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-gray-900 mb-3">Included Agents ({plan.included_agents.length})</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {plan.included_agents.map((inclusion) => (
                  <div key={inclusion.id} className="bg-white rounded-lg p-4 border border-gray-200">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">{inclusion.agent_name}</p>
                        <p className="text-sm text-gray-600 mt-1">
                          {inclusion.included_instances} {inclusion.included_instances === 1 ? 'instance' : 'instances'}
                        </p>
                        {inclusion.agent_pricing_name && (
                          <p className="text-xs text-gray-500 mt-1">{inclusion.agent_pricing_name}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-purple-600">${parseFloat(inclusion.effective_price).toFixed(2)}</p>
                        {inclusion.is_featured && (
                          <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 rounded">
                            Featured
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Agent Selection Limits */}
          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-3">Agent Selection Limits</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <p className="text-xs text-gray-600 mb-1">Minimum Agents Required</p>
                <p className="text-lg font-semibold text-gray-900">
                  {plan.min_agents_required > 0 ? plan.min_agents_required : 'None'}
                </p>
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <p className="text-xs text-gray-600 mb-1">Maximum Agents Allowed</p>
                <p className="text-lg font-semibold text-gray-900">
                  {plan.max_agents_allowed > 0 ? plan.max_agents_allowed : 'Unlimited'}
                </p>
              </div>
            </div>
          </div>

          {/* Status */}
          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-3">Status</h3>
            <div className="flex flex-wrap gap-2">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                plan.is_active
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }`}>
                {plan.is_active ? '✓ Active' : '✗ Inactive'}
              </span>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                plan.is_public
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {plan.is_public ? '🌐 Public' : '🔒 Private'}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-gray-200 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
          <button
            onClick={onEdit}
            className="px-6 py-2.5 bg-gradient-to-r from-[#4318ff] to-[#7c75ff] text-white rounded-lg font-medium hover:from-[#3610d9] hover:to-[#6b63e6] transition-all shadow-sm hover:shadow-md"
          >
            Edit Plan
          </button>
        </div>
      </div>
    </div>
  );
};

export default PlanDetailsModal;