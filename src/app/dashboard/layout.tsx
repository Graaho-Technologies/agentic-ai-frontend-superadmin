'use client';
import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { User } from '@/types/auth';
import SuperAdminCreateAgentTemplateDrawer from '@/components/SuperAdminAgentManagement/SuperAdminCreateAgentTemplateDrawer';
import { AgentTemplate } from '@/features/agentTemplateApi/agentTemplateApi';

// ─── All routes use /dashboard (no /super-admin prefix) ──────────────────────
const BASE = '/dashboard';

const NAV_ROUTES = {
  agentTemplates: `${BASE}/agent-templates`,
  workspaces: `${BASE}/workspaces`,
  demoUsers: `${BASE}/demo-users`,
  moduleAccess: `${BASE}/module-access`,
  orgManagement: `${BASE}/org-management`,
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

  const linkCls = (href: string) =>
    `w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left cursor-pointer transition-colors ${
      isActive(href)
        ? 'bg-white text-[var(--color-primary-purple)] font-black shadow-md'
        : 'text-gray-700 hover:bg-white/60'
    }`;

  const groupBtnCls = (prefix: string) =>
    `w-full flex items-center justify-between px-4 py-3 rounded-lg text-left cursor-pointer transition-all duration-300 ${
      isGroupActive(prefix)
        ? 'bg-white text-[var(--color-primary-purple)] font-black shadow-md'
        : 'text-gray-700 hover:bg-white/60'
    }`;

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
              <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2M17 10H20C21.1 10 22 10.9 22 12V20C22 21.1 21.1 22 20 22H4C2.9 22 2 21.1 2 20V12C2 10.9 2.9 10 4 10H7V8C7 6.9 7.9 6 9 6H12.3C12.1 6.6 12 7.3 12 8V10H9C8.4 10 8 10.4 8 11V20H16V11C16 10.4 15.6 10 15 10H14V8C14 7.3 13.9 6.6 13.7 6H15C16.1 6 17 6.9 17 8V10M9.5 12C10.3 12 11 12.7 11 13.5C11 14.3 10.3 15 9.5 15C8.7 15 8 14.3 8 13.5C8 12.7 8.7 12 9.5 12M14.5 12C15.3 12 16 12.7 16 13.5C16 14.3 15.3 15 14.5 15C13.7 15 13 14.3 13 13.5C13 12.7 13.7 12 14.5 12M10 17H14C14 18.1 13.1 19 12 19C10.9 19 10 18.1 10 17Z"/>
              </svg>
              <span className="font-medium">Agent Templates</span>
            </Link>

            {/* Workspaces */}
            <Link href={NAV_ROUTES.workspaces} className={linkCls(NAV_ROUTES.workspaces)}>
              <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/>
              </svg>
              <span className="font-medium">Workspaces</span>
            </Link>

            {/* Demo Users */}
            <Link href={NAV_ROUTES.demoUsers} className={linkCls(NAV_ROUTES.demoUsers)}>
              <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
              </svg>
              <span className="font-medium">Demo Users</span>
            </Link>

            {/* Module Access */}
            <Link href={NAV_ROUTES.moduleAccess} className={linkCls(NAV_ROUTES.moduleAccess)}>
              <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 1L3 5V11C3 16.55 6.84 21.74 12 23C17.16 21.74 21 16.55 21 11V5L12 1M10 17L6 13L7.41 11.59L10 14.17L16.59 7.58L18 9L10 17Z"/>
              </svg>
              <span className="font-medium">Module Access</span>
            </Link>

            {/* Org Management */}
            <Link href={NAV_ROUTES.orgManagement} className={linkCls(NAV_ROUTES.orgManagement)}>
              <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z"/>
              </svg>
              <span className="font-medium">Org Management</span>
            </Link>

            {/* Performance Analytics */}
            <div>
              <button
                onClick={() => setPerformanceAnalyticsOpen((o) => !o)}
                className={groupBtnCls(`${BASE}/performance-analytics`)}
              >
                <div className="flex items-center space-x-3">
                  <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M3.5 18.49l6-6.01 4 4L22 6.92l-1.41-1.41-7.09 7.97-4-4L2 16.99z"/>
                    <path d="M21 14h-2v4h-4v2h6z"/>
                  </svg>
                  <span className="font-medium">Performance Analytics</span>
                </div>
                <svg
                  className={`w-4 h-4 flex-shrink-0 transition-transform duration-300 ${performanceAnalyticsOpen ? 'rotate-180' : ''}`}
                  fill="currentColor" viewBox="0 0 20 20"
                >
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>

              <div className={submenuContainerCls(performanceAnalyticsOpen)}>
                <div className="py-1 space-y-0.5">
                  {(
                    [
                      { href: NAV_ROUTES.performanceAnalytics.overview,        label: 'Overview Dashboard',     icon: '📊' },
                      { href: NAV_ROUTES.performanceAnalytics.responseTime,    label: 'Response Time Analysis', icon: '⚡' },
                      { href: NAV_ROUTES.performanceAnalytics.endpoints,       label: 'Endpoint Performance',   icon: '🔗' },
                      { href: NAV_ROUTES.performanceAnalytics.slowRequests,    label: 'Slow Requests',          icon: '🐌' },
                      { href: NAV_ROUTES.performanceAnalytics.statusCodes,     label: 'Status Codes',           icon: '📋' },
                      { href: NAV_ROUTES.performanceAnalytics.databaseQueries, label: 'Database Queries',       icon: '🗄️' },
                      { href: NAV_ROUTES.performanceAnalytics.organizations,   label: 'Organization Analytics', icon: '🏢' },
                      { href: NAV_ROUTES.performanceAnalytics.agents,          label: 'Agent Analytics',        icon: '🤖' },
                      { href: NAV_ROUTES.performanceAnalytics.mlAnalytics,     label: 'ML Server Analytics',    icon: '🧠' },
                    ] as const
                  ).map(({ href, label, icon }) => (
                    <Link
                      key={href}
                      href={href}
                      className={subLinkCls(href)}
                    >
                      <span className="text-sm">{icon}</span>
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
                  <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20 4H4C2.89 4 2.01 4.89 2.01 6L2 18C2 19.11 2.89 20 4 20H20C21.11 20 22 19.11 22 18V6C22 4.89 21.11 4 20 4M20 18H4V12H20V18M20 8H4V6H20V8M14 14V16H18V14H14Z"/>
                  </svg>
                  <span className="font-medium">Subscription Model</span>
                </div>
                <svg
                  className={`w-4 h-4 flex-shrink-0 transition-transform duration-300 ${subscriptionOpen ? 'rotate-180' : ''}`}
                  fill="currentColor" viewBox="0 0 20 20"
                >
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>

              <div className={submenuContainerCls(subscriptionOpen)}>
                <div className="py-1 space-y-0.5">
                  {(
                    [
                      { href: NAV_ROUTES.subscription.components,   label: 'Components',    icon: '🧩' },
                      { href: NAV_ROUTES.subscription.agentPricing, label: 'Agent Pricing', icon: '💰' },
                      { href: NAV_ROUTES.subscription.plans,        label: 'Plans',         icon: '📋' },
                      { href: NAV_ROUTES.subscription.planPreview,  label: 'Plan Preview',  icon: '👁️' },
                    ] as const
                  ).map(({ href, label, icon }) => (
                    <Link
                      key={href}
                      href={href}
                      className={subLinkCls(href)}
                    >
                      <span className="text-sm">{icon}</span>
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
                  <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM7 10h2v7H7zm4-3h2v10h-2zm4 6h2v4h-2z"/>
                  </svg>
                  <span className="font-medium">CMS Settings</span>
                </div>
                <svg
                  className={`w-4 h-4 flex-shrink-0 transition-transform duration-300 ${cmsSettingsOpen ? 'rotate-180' : ''}`}
                  fill="currentColor" viewBox="0 0 20 20"
                >
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>

              <div className={submenuContainerCls(cmsSettingsOpen)}>
                <div className="py-1 space-y-0.5">
                  {(
                    [
                      { href: NAV_ROUTES.cmsSettings.loginPage, label: 'Login Page', icon: '🔐' },
                    ] as const
                  ).map(({ href, label, icon }) => (
                    <Link
                      key={href}
                      href={href}
                      className={subLinkCls(href)}
                    >
                      <span className="text-sm">{icon}</span>
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
                  <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 15.5A3.5 3.5 0 018.5 12 3.5 3.5 0 0112 8.5a3.5 3.5 0 013.5 3.5 3.5 3.5 0 01-3.5 3.5m7.43-2.92c.04-.33.07-.67.07-1s-.03-.67-.07-1l2.13-1.63c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.58-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64L4.57 11c-.04.33-.07.67-.07 1s.03.67.07 1l-2.13 1.63c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.58 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.66z"/>
                  </svg>
                  <span className="font-medium">Settings</span>
                </div>
                <svg
                  className={`w-4 h-4 flex-shrink-0 transition-transform duration-300 ${settingsOpen ? 'rotate-180' : ''}`}
                  fill="currentColor" viewBox="0 0 20 20"
                >
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>

              <div className={submenuContainerCls(settingsOpen)}>
                <div className="py-1 space-y-0.5">
                  {(
                    [
                      { href: NAV_ROUTES.settings.manageUser, label: 'Manage User', icon: '👤' },
                      { href: NAV_ROUTES.settings.summary,    label: 'Summary',     icon: '📑' },
                    ] as const
                  ).map(({ href, label, icon }) => (
                    <Link
                      key={href}
                      href={href}
                      className={subLinkCls(href)}
                    >
                      <span className="text-sm">{icon}</span>
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
              <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                <path d="M10.09 15.59L11.5 17l5-5-5-5-1.41 1.41L12.67 11H3v2h9.67l-2.58 2.59zM19 3H5c-1.11 0-2 .9-2 2v4h2V5h14v14H5v-4H3v4c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/>
              </svg>
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