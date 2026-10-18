// app/dashboard/org-management/page.tsx
import OrgAgentConfigManager from '@/components/org-management/OrgAgentConfigManager';

export default function Page() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Page Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-[var(--color-primary-purple)]/10 rounded-xl flex items-center justify-center">
            <svg className="w-6 h-6 text-[var(--color-primary-purple)]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Org Management</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Configure agent instances across all organizations
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 max-w-[1600px]">
        <OrgAgentConfigManager />
      </div>
    </div>
  );
}
