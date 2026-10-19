'use client';
import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { User } from '@/types/auth';
import SuperAdminCreateAgentTemplateDrawer from '@/components/SuperAdminAgentManagement/SuperAdminCreateAgentTemplateDrawer';
import { AgentTemplate } from '@/features/agentTemplateApi/agentTemplateApi';
import { Activity, BadgeDollarSign, Bot, BrainCircuit, Building, BuildingComplex, ChevronDown, ClipboardList, CreditCard, Database, Eye, FileText, Hourglass, LayoutDashboard, LayoutGrid, LayoutPanelTop, LayoutTemplate, ListChecks, LogIn, LogOut, Puzzle, Route, Settings, ShieldCheck, SlidersHorizontal, Timer, UserCog, Users } from 'lucide-react';

// ─── All routes use /dashboard (no /super-admin prefix) ──────────────────────
const BASE = '/dashboard';

const NAV_ROUTES = {
  agentTemplates: `${BASE}/agent-templates`,
  demoUsers: `${BASE}/demo-users`,
  orgManagement: {
    agentConfig:  `${BASE}/org-management`,
    moduleAccess: `${BASE}/module-access`,
    workspaces:   `${BASE}/workspaces`,
  },
  performanceAnalytics: {
    overview: `${BASE}/performance-analytics`,
    responseTime: `${BASE}/performance-analytics/response-time`,
    endpoints: `${BASE}/performance-analytics/endpoints`,
    slowRequests: `${BASE}/performance-analytics/slow-requests`,
    statusCodes: `${BASE}/performance-analytics/status-codes`,
    databaseQueries: `${BASE}/performance-analytics/database-queries`,
    organizations: `${BASE}/performance-analytics/organizations`,
    agents: `${BASE}/performance-analytics/agents`,
    mlAnalytics: `${BASE}/performance-analytics/ml-analytics`,
  },
  subscription: {
    plans: `${BASE}/subscription/plans`,
    components: `${BASE}/subscription/components`,
    agentPricing: `${BASE}/subscription/agent-pricing`,
    planPreview: `${BASE}/subscription/plan-preview`,
  },
  cmsSettings: {
    loginPage: `${BASE}/cms-settings/login-page`,
  },
  settings: {
    manageUser: `${BASE}/settings/manage-user`,
    summary: `${BASE}/settings/summary`,
  },
} as const;

const ORG_MANAGEMENT_ROUTES = [
  NAV_ROUTES.orgManagement.agentConfig,
  NAV_ROUTES.orgManagement.moduleAccess,
  NAV_ROUTES.orgManagement.workspaces,
] as const;

// ─── Context so child pages can open the Create Template drawer ───────────────
export const DashboardContext = React.createContext<{
  openCreateTemplateDrawer: () => void;
  setEditTemplate: (t: AgentTemplate | null) => void;
}>({
  openCreateTemplateDrawer: () => {},
  setEditTemplate: () => {},
});

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [userData, setUserData] = useState<User | null>(null);
  const [subscriptionOpen, setSubscriptionOpen] = useState(false);
  const [cmsSettingsOpen, setCmsSettingsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [performanceAnalyticsOpen, setPerformanceAnalyticsOpen] = useState(false);
  const [orgManagementOpen, setOrgManagementOpen] = useState(false);
  const [isCreateTemplateDrawerOpen, setIsCreateTemplateDrawerOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<AgentTemplate | null>(null);

  // ── Auth guard ────────────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem('superAdminUser');
      const loggedIn = localStorage.getItem('isSuperAdminLoggedIn') === 'true';
      const token = localStorage.getItem('superAdminToken');

      // Check for user data, logged in flag, AND valid token
      if (!raw || !loggedIn || !token) { router.replace('/auth'); return; }

      const adminData = JSON.parse(raw);
      if (!adminData?.email || !adminData?.id) { router.replace('/auth'); return; }

      setUserData({
        id: adminData.id,
        sub_id: null,
        email: adminData.email,
        first_name: adminData.first_name ?? adminData.full_name?.split(' ')[0] ?? 'Admin',
        last_name: adminData.last_name ?? adminData.full_name?.split(' ')[1] ?? 'User',
        name: adminData.full_name ?? `${adminData.first_name ?? 'Admin'} ${adminData.last_name ?? 'User'}`,
        full_name: adminData.full_name ?? `${adminData.first_name ?? 'Admin'} ${adminData.last_name ?? 'User'}`,
        is_active: adminData.is_active ?? true,
        role: adminData.role ?? 'super_admin',
      });
    } catch {
      router.replace('/auth');
    }
  }, [router]);

  // ── Keep the active section's submenu expanded based on current URL ───────
  // The active group stays open (and highlighted); inactive groups collapse.
  useEffect(() => {
    setSubscriptionOpen(pathname.startsWith(`${BASE}/subscription`));
    setCmsSettingsOpen(pathname.startsWith(`${BASE}/cms-settings`));
    setSettingsOpen(pathname.startsWith(`${BASE}/settings`));
    setPerformanceAnalyticsOpen(pathname.startsWith(`${BASE}/performance-analytics`));
    setOrgManagementOpen(ORG_MANAGEMENT_ROUTES.some((href) => pathname === href));
  }, [pathname]);

  const handleLogout = () => {
    // Clear all auth-related localStorage items
    localStorage.removeItem('superAdminUser');
    localStorage.removeItem('superAdminToken');
    localStorage.removeItem('superAdminRefreshToken');
    localStorage.removeItem('isSuperAdminLoggedIn');
    localStorage.removeItem('adminUser');
    localStorage.removeItem('isAdminLoggedIn');
    router.replace('/auth');
  };

  // ── Styling helpers ───────────────────────────────────────────────────────
  const isActive = (href: string) => pathname === href;
  const isGroupActive = (prefix: string) => pathname.startsWith(prefix);
  const orgManagementActive = ORG_MANAGEMENT_ROUTES.some((href) => pathname === href);

  const linkCls = (href: string) =>
    `w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left cursor-pointer transition-colors ${
      isActive(href)
        ? 'bg-white text-[var(--color-primary-purple)] font-black shadow-md'
        : 'text-gray-700 hover:bg-white/60'
    }`;

  const groupBtnClsFor = (active: boolean) =>
    `w-full flex items-center justify-between px-4 py-3 rounded-lg text-left cursor-pointer transition-all duration-300 ${
      active
        ? 'bg-white text-[var(--color-primary-purple)] font-black shadow-md'
        : 'text-gray-700 hover:bg-white/60'
    }`;

  const groupBtnCls = (prefix: string) => groupBtnClsFor(isGroupActive(prefix));

  // Inline submenu styles (accordion style - not absolute positioned)
  const submenuContainerCls = (open: boolean) =>
    `overflow-hidden transition-all duration-300 ease-in-out ${
      open ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
    }`;

  const subLinkCls = (href: string) =>
    `w-full pl-10 pr-4 py-2.5 text-left transition-colors duration-200 flex items-center space-x-3 group rounded-lg ${
      isActive(href) ? 'bg-white/80 text-[var(--color-primary-purple)] font-semibold' : 'text-gray-600 hover:bg-white/50 hover:text-gray-900'
    }`;

  // Don't render until auth check completes
  if (!userData) return null;

  return (
    <DashboardContext.Provider
      value={{
        openCreateTemplateDrawer: () => setIsCreateTemplateDrawerOpen(true),
        setEditTemplate,
      }}
    >
      <div className="min-h-screen bg-gray-50">

        {/* ── Sidebar - Fixed Position ──────────────────────────────────────────────────────── */}
        <aside className="fixed top-0 left-0 w-75 h-screen bg-[linear-gradient(90deg,_#fff_-11.17%,_#c9c7ea_100%)] pl-3 pr-3 pt-6 pb-8 flex flex-col z-50 overflow-hidden">

          {/* Logo */}
          <div className="flex flex-col items-center justify-center space-y-3 mb-6 flex-shrink-0">
            <Image src="/graaho_logo.png" alt="Graaho Logo" width={180} height={60} className="object-cover" priority />
          </div>

          {/* User chip */}
          <div className="flex items-center space-x-3 mb-6 p-3 bg-white/50 rounded-lg flex-shrink-0">
            <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center bg-gray-200">
              <Image src="/man_place_holder.png" alt="Avatar" width={40} height={40} className="object-cover" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-gray-800 truncate">
                {userData.first_name} {userData.last_name}
                <span className="ml-2 px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded-full whitespace-nowrap">
                  Super Admin
                </span>
              </div>
              <div className="text-xs text-gray-600 truncate">{userData.email}</div>
            </div>
          </div>

          {/* Navigation - Scrollable */}
          <nav className="space-y-2 flex-1 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent hover:scrollbar-thumb-gray-400">

            {/* Agent Templates */}
            <Link href={NAV_ROUTES.agentTemplates} className={linkCls(NAV_ROUTES.agentTemplates)}>
              <LayoutTemplate className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
              <span className="font-medium">Agent Templates</span>
            </Link>

            {/* Demo Users */}
            <Link href={NAV_ROUTES.demoUsers} className={linkCls(NAV_ROUTES.demoUsers)}>
              <Users className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
              <span className="font-medium">Demo Users</span>
            </Link>

            {/* Org Management */}
            <div>
              <button
                onClick={() => setOrgManagementOpen((o) => !o)}
                className={groupBtnClsFor(orgManagementActive)}
              >
                <div className="flex items-center space-x-3">
                  <BuildingComplex className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                  <span className="font-medium">Org Management</span>
                </div>
                <ChevronDown
                  className={`w-4 h-4 flex-shrink-0 transition-transform duration-300 ${orgManagementOpen ? 'rotate-180' : ''}`}
                  aria-hidden="true"
                />
              </button>

              <div className={submenuContainerCls(orgManagementOpen)}>
                <div className="py-1 space-y-0.5">
                  {(
                    [
                      { href: NAV_ROUTES.orgManagement.agentConfig,  label: 'Agent Config',  Icon: SlidersHorizontal },
                      { href: NAV_ROUTES.orgManagement.moduleAccess, label: 'Module Access', Icon: ShieldCheck },
                      { href: NAV_ROUTES.orgManagement.workspaces,   label: 'Workspaces',    Icon: LayoutGrid },
                    ] as const
                  ).map(({ href, label, Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      className={subLinkCls(href)}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                      <span className="text-sm">{label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            {/* Performance Analytics */}
            <div>
              <button
                onClick={() => setPerformanceAnalyticsOpen((o) => !o)}
                className={groupBtnCls(`${BASE}/performance-analytics`)}
              >
                <div className="flex items-center space-x-3">
                  <Activity className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                  <span className="font-medium">Performance Analytics</span>
                </div>
                <ChevronDown
                  className={`w-4 h-4 flex-shrink-0 transition-transform duration-300 ${performanceAnalyticsOpen ? 'rotate-180' : ''}`}
                  aria-hidden="true"
                />
              </button>

              <div className={submenuContainerCls(performanceAnalyticsOpen)}>
                <div className="py-1 space-y-0.5">
                  {(
                    [
                      { href: NAV_ROUTES.performanceAnalytics.overview,        label: 'Overview Dashboard',     Icon: LayoutDashboard },
                      { href: NAV_ROUTES.performanceAnalytics.responseTime,    label: 'Response Time Analysis', Icon: Timer },
                      { href: NAV_ROUTES.performanceAnalytics.endpoints,       label: 'Endpoint Performance',   Icon: Route },
                      { href: NAV_ROUTES.performanceAnalytics.slowRequests,    label: 'Slow Requests',          Icon: Hourglass },
                      { href: NAV_ROUTES.performanceAnalytics.statusCodes,     label: 'Status Codes',           Icon: ListChecks },
                      { href: NAV_ROUTES.performanceAnalytics.databaseQueries, label: 'Database Queries',       Icon: Database },
                      { href: NAV_ROUTES.performanceAnalytics.organizations,   label: 'Organization Analytics', Icon: Building },
                      { href: NAV_ROUTES.performanceAnalytics.agents,          label: 'Agent Analytics',        Icon: Bot },
                      { href: NAV_ROUTES.performanceAnalytics.mlAnalytics,     label: 'ML Server Analytics',    Icon: BrainCircuit },
                    ] as const
                  ).map(({ href, label, Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      className={subLinkCls(href)}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                      <span className="text-sm">{label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            {/* Subscription Model */}
            <div>
              <button
                onClick={() => setSubscriptionOpen((o) => !o)}
                className={groupBtnCls(`${BASE}/subscription`)}
              >
                <div className="flex items-center space-x-3">
                  <CreditCard className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                  <span className="font-medium">Subscription Model</span>
                </div>
                <ChevronDown
                  className={`w-4 h-4 flex-shrink-0 transition-transform duration-300 ${subscriptionOpen ? 'rotate-180' : ''}`}
                  aria-hidden="true"
                />
              </button>

              <div className={submenuContainerCls(subscriptionOpen)}>
                <div className="py-1 space-y-0.5">
                  {(
                    [
                      { href: NAV_ROUTES.subscription.components,   label: 'Components',    Icon: Puzzle },
                      { href: NAV_ROUTES.subscription.agentPricing, label: 'Agent Pricing', Icon: BadgeDollarSign },
                      { href: NAV_ROUTES.subscription.plans,        label: 'Plans',         Icon: ClipboardList },
                      { href: NAV_ROUTES.subscription.planPreview,  label: 'Plan Preview',  Icon: Eye },
                    ] as const
                  ).map(({ href, label, Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      className={subLinkCls(href)}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                      <span className="text-sm">{label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            {/* CMS Settings */}
            <div>
              <button
                onClick={() => setCmsSettingsOpen((o) => !o)}
                className={groupBtnCls(`${BASE}/cms-settings`)}
              >
                <div className="flex items-center space-x-3">
                  <LayoutPanelTop className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                  <span className="font-medium">CMS Settings</span>
                </div>
                <ChevronDown
                  className={`w-4 h-4 flex-shrink-0 transition-transform duration-300 ${cmsSettingsOpen ? 'rotate-180' : ''}`}
                  aria-hidden="true"
                />
              </button>

              <div className={submenuContainerCls(cmsSettingsOpen)}>
                <div className="py-1 space-y-0.5">
                  {(
                    [
                      { href: NAV_ROUTES.cmsSettings.loginPage, label: 'Login Page', Icon: LogIn },
                    ] as const
                  ).map(({ href, label, Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      className={subLinkCls(href)}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                      <span className="text-sm">{label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            {/* Settings */}
            <div>
              <button
                onClick={() => setSettingsOpen((o) => !o)}
                className={groupBtnCls(`${BASE}/settings`)}
              >
                <div className="flex items-center space-x-3">
                  <Settings className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                  <span className="font-medium">Settings</span>
                </div>
                <ChevronDown
                  className={`w-4 h-4 flex-shrink-0 transition-transform duration-300 ${settingsOpen ? 'rotate-180' : ''}`}
                  aria-hidden="true"
                />
              </button>

              <div className={submenuContainerCls(settingsOpen)}>
                <div className="py-1 space-y-0.5">
                  {(
                    [
                      { href: NAV_ROUTES.settings.manageUser, label: 'Manage User', Icon: UserCog },
                      { href: NAV_ROUTES.settings.summary,    label: 'Summary',     Icon: FileText },
                    ] as const
                  ).map(({ href, label, Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      className={subLinkCls(href)}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
                      <span className="text-sm">{label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </nav>

          {/* Logout */}
          <div className="border-t border-gray-200 pt-4 mt-4 flex-shrink-0">
            <button
              onClick={handleLogout}
              className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left cursor-pointer transition-colors hover:bg-white/60 text-gray-700"
            >
              <LogOut className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
              <span className="font-medium">Logout</span>
            </button>
          </div>
        </aside>

        {/* ── Main content (children = current page) - With left margin for fixed sidebar ────────────────────────── */}
        <main className="ml-75 flex-1 flex flex-col min-w-0 min-h-screen pb-16">
          {children}
        </main>

        {/* ── Global Create Template Drawer ─────────────────────────────────── */}
        <SuperAdminCreateAgentTemplateDrawer
          isOpen={isCreateTemplateDrawerOpen}
          onClose={() => {
            setIsCreateTemplateDrawerOpen(false);
            setEditTemplate(null);
          }}
          onAgentCreated={() => {
            setIsCreateTemplateDrawerOpen(false);
            setEditTemplate(null);
          }}
          currentUser={userData}
          isEditMode={!!editTemplate}
          editTemplate={editTemplate}
        />

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        <footer className="fixed bottom-0 left-75 right-0 bg-gradient-to-r from-slate-50 to-gray-50 border-t border-slate-200/60 backdrop-blur-sm z-40">
          <div className="px-8 py-4 flex items-center justify-end">
            <p className="text-xs font-medium text-slate-700">© 2026 Graaho Technologies</p>
          </div>
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-300/50 to-transparent" />
        </footer>
      </div>
    </DashboardContext.Provider>
  );
}