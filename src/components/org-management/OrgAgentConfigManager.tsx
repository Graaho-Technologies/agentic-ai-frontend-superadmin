"use client";
import React, { useEffect, useMemo, useState } from 'react';
import {
  useGetAllWorkspacesQuery,
  useGetWorkspaceMembersQuery,
  useGetAllAgentInstancesQuery,
  useUpdateAgentInstanceDynamicConfigMutation,
} from '@/features/orgManagement/orgManagementApi';
import type {
  OrgWorkspaceSummary,
  OrgAgentInstanceSummary,
  DomainLexiconEntry,
  OrgManagementApiErrorBody,
} from '@/features/orgManagement/orgManagementApi.types';
import {
  DEFAULT_DOMAIN_LEXICON,
  serializeDomainLexicon,
  parseDomainLexicon,
} from '@/features/orgManagement/domainLexicon';

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface OrgMutationError {
  data?: Partial<OrgManagementApiErrorBody>;
  status?: number | string;
}

const extractErrorMessage = (err: unknown, fallback: string): string => {
  const apiErr = err as OrgMutationError;
  return apiErr?.data?.detail || apiErr?.data?.error || apiErr?.data?.message || fallback;
};

// The row editor keeps aliases as the raw comma-separated string the admin is
// typing, not as a derived array — round-tripping through split/join on every
// keystroke would eat a trailing ", " the moment it's typed and make it
// impossible to start a second alias. The array is only ever derived at
// commit points (tab switch, save, dirty-check), via `rowsToEntries`.
interface LexiconRow {
  canonical: string;
  aliasesText: string;
}

const entriesToRows = (entries: DomainLexiconEntry[]): LexiconRow[] =>
  entries.map((e) => ({ canonical: e.canonical, aliasesText: e.aliases.join(', ') }));

const rowsToEntries = (rows: LexiconRow[]): DomainLexiconEntry[] =>
  rows.map((r) => ({
    canonical: r.canonical,
    aliases: r.aliasesText
      .split(',')
      .map((a) => a.trim())
      .filter((a) => a.length > 0),
  }));

interface SeededConfig {
  directoryEnabled: boolean;
  rows: LexiconRow[];
  rawJsonText: string;
  parseError: string | null;
}

// Pure (module-level) so it can be called both from the re-seed effect and
// from the Reset handler without becoming an effect dependency itself.
const seedConfigFromInstance = (instance: OrgAgentInstanceSummary | null): SeededConfig => {
  if (!instance) {
    return { directoryEnabled: false, rows: [], rawJsonText: '[]', parseError: null };
  }
  const { entries, error } = parseDomainLexicon(instance.dynamic_config?.domain_lexicon);
  return {
    directoryEnabled: instance.dynamic_config?.directory_enabled === true,
    rows: entriesToRows(entries),
    rawJsonText: JSON.stringify(entries, null, 2),
    parseError: error,
  };
};

// ─── Small shared pieces ───────────────────────────────────────────────────────

const Spinner = ({ size = 'w-8 h-8', border = 'border-4' }: { size?: string; border?: string }) => (
  <div className={`relative ${size}`}>
    <div className={`absolute inset-0 rounded-full ${border} border-[#eeeefa]`} />
    <div className={`absolute inset-0 rounded-full ${border} border-[var(--color-primary-purple)] border-t-transparent animate-spin`} />
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const OrgAgentConfigManager = () => {
  // Org picker
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [orgSearch, setOrgSearch] = useState('');

  // Instance picker
  const [instanceScope, setInstanceScope] = useState<'org' | 'all'>('org');
  const [instanceSearch, setInstanceSearch] = useState('');
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);

  // Configuration pane
  const [directoryEnabled, setDirectoryEnabled] = useState(false);
  const [rows, setRows] = useState<LexiconRow[]>([]);
  const [lexiconTab, setLexiconTab] = useState<'rows' | 'raw'>('rows');
  const [rawJsonText, setRawJsonText] = useState('[]');
  const [rawJsonError, setRawJsonError] = useState<string | null>(null);
  const [seedParseError, setSeedParseError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // ── Data ──────────────────────────────────────────────────────────────────
  const {
    data: workspacesData,
    isLoading: isLoadingOrgs,
    error: orgsError,
    refetch: refetchOrgs,
  } = useGetAllWorkspacesQuery();
  const workspaces = useMemo(() => workspacesData ?? [], [workspacesData]);

  const orgQuery = orgSearch.trim().toLowerCase();
  const filteredOrganizations = useMemo(
    () =>
      orgQuery
        ? workspaces.filter(
            (org) => org.name.toLowerCase().includes(orgQuery) || org.domain.toLowerCase().includes(orgQuery)
          )
        : workspaces,
    [workspaces, orgQuery]
  );

  const selectedOrg = useMemo(
    () => workspaces.find((o) => o.id === selectedOrgId) ?? null,
    [workspaces, selectedOrgId]
  );

  const {
    data: membersData,
    isLoading: isLoadingMembers,
    error: membersError,
    refetch: refetchMembers,
  } = useGetWorkspaceMembersQuery(selectedOrgId ?? '', { skip: !selectedOrgId });

  const memberSubIds = useMemo(
    () => new Set((membersData?.members ?? []).map((m) => m.sub_id)),
    [membersData]
  );

  const {
    data: allInstancesData,
    isLoading: isLoadingInstances,
    error: instancesError,
    refetch: refetchInstances,
  } = useGetAllAgentInstancesQuery();
  const allInstances = useMemo(() => allInstancesData ?? [], [allInstancesData]);

  // An instance belongs to the selected org only through an inference: its
  // creator's user_sub_id matches a member of that org's workspace. There is
  // no org filter on the instances endpoint (verified against the backend) —
  // see the "All instances" escape hatch below for when this inference comes
  // up empty.
  const orgScopedInstances = useMemo(
    () => allInstances.filter((inst) => inst.user_sub_id !== null && memberSubIds.has(inst.user_sub_id)),
    [allInstances, memberSubIds]
  );

  const instanceScopePool = instanceScope === 'org' ? orgScopedInstances : allInstances;

  const instanceQuery = instanceSearch.trim().toLowerCase();
  const filteredInstances = useMemo(
    () =>
      instanceQuery
        ? instanceScopePool.filter(
            (inst) => inst.name.toLowerCase().includes(instanceQuery) || inst.agent_id.toLowerCase().includes(instanceQuery)
          )
        : instanceScopePool,
    [instanceScopePool, instanceQuery]
  );

  const selectedInstance = useMemo(
    () => allInstances.find((inst) => inst.id === selectedInstanceId) ?? null,
    [allInstances, selectedInstanceId]
  );

  const [updateDynamicConfig, { isLoading: isSaving }] = useUpdateAgentInstanceDynamicConfigMutation();

  // Re-seed local config state whenever the selected instance changes, so one
  // instance's unsaved edits never leak into the next (same discipline as the
  // module-access anchor's `modulesData`/`selectedOrgId` effect).
  useEffect(() => {
    const seeded = seedConfigFromInstance(selectedInstance);
    setDirectoryEnabled(seeded.directoryEnabled);
    setRows(seeded.rows);
    setRawJsonText(seeded.rawJsonText);
    setRawJsonError(null);
    setLexiconTab('rows');
    setSeedParseError(seeded.parseError);
    setSaveError(null);
    setSaveSuccess(false);
  }, [selectedInstance]);

  const seededForDirtyCheck = useMemo(() => seedConfigFromInstance(selectedInstance), [selectedInstance]);

  const isLexiconValid = lexiconTab === 'rows' || rawJsonError === null;

  const effectiveEntries: DomainLexiconEntry[] = useMemo(() => {
    if (lexiconTab === 'raw' && rawJsonError === null) {
      return parseDomainLexicon(rawJsonText).entries;
    }
    return rowsToEntries(rows);
  }, [lexiconTab, rawJsonError, rawJsonText, rows]);

  const isDirty =
    Boolean(selectedInstance) &&
    (directoryEnabled !== seededForDirtyCheck.directoryEnabled ||
      serializeDomainLexicon(effectiveEntries) !== serializeDomainLexicon(rowsToEntries(seededForDirtyCheck.rows)));

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSelectOrg = (orgId: string) => {
    if (orgId === selectedOrgId) return;
    setSelectedOrgId(orgId);
    setSelectedInstanceId(null);
    setInstanceScope('org');
    setInstanceSearch('');
  };

  const handleSelectInstance = (id: string) => {
    if (id === selectedInstanceId) return;
    setSelectedInstanceId(id);
  };

  const handleRowChange = (idx: number, patch: Partial<LexiconRow>) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
    setSaveError(null);
    setSaveSuccess(false);
  };

  const handleAddRow = () => {
    setRows((prev) => [...prev, { canonical: '', aliasesText: '' }]);
    setSaveError(null);
    setSaveSuccess(false);
  };

  const handleRemoveRow = (idx: number) => {
    setRows((prev) => prev.filter((_, i) => i !== idx));
    setSaveError(null);
    setSaveSuccess(false);
  };

  const handleRawJsonChange = (text: string) => {
    setRawJsonText(text);
    const { error } = parseDomainLexicon(text);
    setRawJsonError(error);
    setSaveError(null);
    setSaveSuccess(false);
  };

  const handleSwitchToRaw = () => {
    setRawJsonText(JSON.stringify(rowsToEntries(rows), null, 2));
    setRawJsonError(null);
    setLexiconTab('raw');
  };

  const handleSwitchToRows = () => {
    const { entries, error } = parseDomainLexicon(rawJsonText);
    if (error) {
      // Invalid JSON: stay on the Raw tab and keep showing the error rather
      // than silently discarding what the admin typed.
      setRawJsonError(error);
      return;
    }
    setRows(entriesToRows(entries));
    setLexiconTab('rows');
  };

  const handleLoadDefault = () => {
    setRows(entriesToRows(DEFAULT_DOMAIN_LEXICON));
    setRawJsonText(JSON.stringify(DEFAULT_DOMAIN_LEXICON, null, 2));
    setRawJsonError(null);
    setSaveError(null);
    setSaveSuccess(false);
  };

  const handleReset = () => {
    const seeded = seedConfigFromInstance(selectedInstance);
    setDirectoryEnabled(seeded.directoryEnabled);
    setRows(seeded.rows);
    setRawJsonText(seeded.rawJsonText);
    setRawJsonError(null);
    setLexiconTab('rows');
    setSaveError(null);
    setSaveSuccess(false);
  };

  const handleSave = async () => {
    if (!selectedInstance || !isLexiconValid) return;
    setSaveError(null);
    try {
      await updateDynamicConfig({
        id: selectedInstance.id,
        dynamic_config: {
          domain_lexicon: serializeDomainLexicon(effectiveEntries),
          directory_enabled: directoryEnabled,
        },
      }).unwrap();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: unknown) {
      setSaveError(extractErrorMessage(err, 'Failed to save the instance configuration. Please try again.'));
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      {/* ── Pane 1: Organizations ───────────────────────────────────────────── */}
      <div className="xl:col-span-3 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3.5 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-900">Organizations</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {orgQuery
              ? `${filteredOrganizations.length} of ${workspaces.length} ${workspaces.length === 1 ? 'organization' : 'organizations'}`
              : 'Select an organization'}
          </p>

          {workspaces.length > 0 && (
            <div className="relative mt-3">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={orgSearch}
                onChange={(e) => setOrgSearch(e.target.value)}
                placeholder="Search organizations…"
                aria-label="Search organizations"
                className="w-full pl-9 pr-9 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#262782]/30 focus:border-[#262782] bg-white transition-all"
              />
              {orgSearch && (
                <button
                  type="button"
                  onClick={() => setOrgSearch('')}
                  aria-label="Clear organization search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          )}
        </div>

        {isLoadingOrgs ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Spinner />
            <p className="text-gray-500 text-xs font-medium">Loading organizations…</p>
          </div>
        ) : orgsError ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 px-4">
            <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center">
              <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-gray-800 text-sm font-semibold">Failed to load organizations</p>
              <p className="text-gray-500 text-xs mt-1">Something went wrong. Please try again.</p>
            </div>
            <button
              onClick={() => refetchOrgs()}
              className="px-4 py-1.5 text-xs font-semibold text-white rounded-lg transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(135deg,#262782,#7071AB)' }}
            >
              Try Again
            </button>
          </div>
        ) : workspaces.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 px-4">
            <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center">
              <svg className="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-gray-800 text-sm font-semibold">No organizations found</p>
              <p className="text-gray-500 text-xs mt-1">There are no organizations yet.</p>
            </div>
          </div>
        ) : filteredOrganizations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 px-4">
            <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-gray-800 text-sm font-semibold">No matching organizations</p>
              <p className="text-gray-500 text-xs mt-1 break-words">Nothing matches &ldquo;{orgSearch.trim()}&rdquo;.</p>
            </div>
            <button
              onClick={() => setOrgSearch('')}
              className="px-4 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all"
            >
              Clear search
            </button>
          </div>
        ) : (
          <ul className="max-h-[560px] overflow-y-auto divide-y divide-gray-50">
            {filteredOrganizations.map((org: OrgWorkspaceSummary) => {
              const isRowActive = org.id === selectedOrgId;
              return (
                <li key={org.id}>
                  <button
                    onClick={() => handleSelectOrg(org.id)}
                    className={`w-full text-left px-4 py-3 transition-colors ${
                      isRowActive ? 'bg-[var(--color-primary-purple)]/5' : 'hover:bg-gray-50'
                    }`}
                  >
                    <p
                      className={`text-sm font-semibold truncate ${
                        isRowActive ? 'text-[var(--color-primary-purple)]' : 'text-gray-900'
                      }`}
                    >
                      {org.name}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">
                      {org.domain} · {org.members_count} {org.members_count === 1 ? 'member' : 'members'}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* ── Pane 2: Agent Instances ─────────────────────────────────────────── */}
      <div className="xl:col-span-4 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {!selectedOrg ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 px-6 opacity-60">
            <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2M17 10H20C21.1 10 22 10.9 22 12V20C22 21.1 21.1 22 20 22H4C2.9 22 2 21.1 2 20V12C2 10.9 2.9 10 4 10H7V8C7 6.9 7.9 6 9 6H12.3C12.1 6.6 12 7.3 12 8V10H9C8.4 10 8 10.4 8 11V20H16V11C16 10.4 15.6 10 15 10H14V8C14 7.3 13.9 6.6 13.7 6H15C16.1 6 17 6.9 17 8V10M9.5 12C10.3 12 11 12.7 11 13.5C11 14.3 10.3 15 9.5 15C8.7 15 8 14.3 8 13.5C8 12.7 8.7 12 9.5 12M14.5 12C15.3 12 16 12.7 16 13.5C16 14.3 15.3 15 14.5 15C13.7 15 13 14.3 13 13.5C13 12.7 13.7 12 14.5 12M10 17H14C14 18.1 13.1 19 12 19C10.9 19 10 18.1 10 17Z" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-gray-800 font-semibold">No organization selected</p>
              <p className="text-gray-500 text-sm mt-1">Choose an organization on the left first.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="px-4 py-3.5 border-b border-gray-100 space-y-3">
              <div>
                <h2 className="text-sm font-bold text-gray-900">Agent Instances</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {instanceQuery
                    ? `${filteredInstances.length} of ${instanceScopePool.length} instance${instanceScopePool.length === 1 ? '' : 's'}`
                    : 'Select an agent instance to configure'}
                </p>
              </div>

              <div role="group" aria-label="Instance scope" className="inline-flex rounded-xl border border-gray-200 p-0.5 bg-gray-50 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setInstanceScope('org')}
                  aria-pressed={instanceScope === 'org'}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    instanceScope === 'org' ? 'bg-white text-[var(--color-primary-purple)] shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  This organization
                </button>
                <button
                  type="button"
                  onClick={() => setInstanceScope('all')}
                  aria-pressed={instanceScope === 'all'}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    instanceScope === 'all' ? 'bg-white text-[var(--color-primary-purple)] shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  All instances
                </button>
              </div>

              {instanceScopePool.length > 0 && (
                <div className="relative">
                  <svg
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    value={instanceSearch}
                    onChange={(e) => setInstanceSearch(e.target.value)}
                    placeholder="Search by name or agent id…"
                    aria-label="Search agent instances"
                    className="w-full pl-9 pr-9 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#262782]/30 focus:border-[#262782] bg-white transition-all"
                  />
                  {instanceSearch && (
                    <button
                      type="button"
                      onClick={() => setInstanceSearch('')}
                      aria-label="Clear instance search"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              )}
            </div>

            {isLoadingInstances || (instanceScope === 'org' && isLoadingMembers) ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <Spinner />
                <p className="text-gray-500 text-xs font-medium">Loading instances…</p>
              </div>
            ) : instancesError || (instanceScope === 'org' && membersError) ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 px-4">
                <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-gray-800 text-sm font-semibold">Failed to load instances</p>
                  <p className="text-gray-500 text-xs mt-1">Something went wrong. Please try again.</p>
                </div>
                <button
                  onClick={() => {
                    refetchInstances();
                    refetchMembers();
                  }}
                  className="px-4 py-1.5 text-xs font-semibold text-white rounded-lg transition-all hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg,#262782,#7071AB)' }}
                >
                  Try Again
                </button>
              </div>
            ) : instanceScopePool.length === 0 ? (
              instanceScope === 'org' && allInstances.length > 0 ? (
                <div className="p-4 border-b border-gray-100 bg-amber-50/60 text-xs text-amber-800 flex flex-col gap-2">
                  <p>
                    Instances are matched to an organization through the creator&apos;s identity (<code>user_sub_id</code>),
                    and none of the {allInstances.length} instance{allInstances.length === 1 ? '' : 's'} in the system
                    currently matches a member of <span className="font-semibold">{selectedOrg.name}</span>.
                  </p>
                  <button
                    type="button"
                    onClick={() => setInstanceScope('all')}
                    className="self-start px-3 py-1.5 text-xs font-semibold rounded-lg border border-amber-300 text-amber-800 hover:bg-amber-100 transition-all"
                  >
                    Show all instances instead
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 gap-3 px-4">
                  <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center">
                    <svg className="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2M17 10H20C21.1 10 22 10.9 22 12V20C22 21.1 21.1 22 20 22H4C2.9 22 2 21.1 2 20V12C2 10.9 2.9 10 4 10H7V8C7 6.9 7.9 6 9 6H12.3C12.1 6.6 12 7.3 12 8V10H9C8.4 10 8 10.4 8 11V20H16V11C16 10.4 15.6 10 15 10H14V8C14 7.3 13.9 6.6 13.7 6H15C16.1 6 17 6.9 17 8V10M9.5 12C10.3 12 11 12.7 11 13.5C11 14.3 10.3 15 9.5 15C8.7 15 8 14.3 8 13.5C8 12.7 8.7 12 9.5 12M14.5 12C15.3 12 16 12.7 16 13.5C16 14.3 15.3 15 14.5 15C13.7 15 13 14.3 13 13.5C13 12.7 13.7 12 14.5 12M10 17H14C14 18.1 13.1 19 12 19C10.9 19 10 18.1 10 17Z" />
                    </svg>
                  </div>
                  <div className="text-center">
                    <p className="text-gray-800 text-sm font-semibold">No agent instances found</p>
                    <p className="text-gray-500 text-xs mt-1">There are no agent instances in the system yet.</p>
                  </div>
                </div>
              )
            ) : filteredInstances.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 px-4">
                <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center">
                  <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-gray-800 text-sm font-semibold">No matching instances</p>
                  <p className="text-gray-500 text-xs mt-1 break-words">Nothing matches &ldquo;{instanceSearch.trim()}&rdquo;.</p>
                </div>
                <button
                  onClick={() => setInstanceSearch('')}
                  className="px-4 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all"
                >
                  Clear search
                </button>
              </div>
            ) : (
              <ul className="max-h-[560px] overflow-y-auto divide-y divide-gray-50">
                {filteredInstances.map((inst: OrgAgentInstanceSummary) => {
                  const isRowActive = inst.id === selectedInstanceId;
                  const { entries: rowEntries } = parseDomainLexicon(inst.dynamic_config?.domain_lexicon);
                  const directoryOn = inst.dynamic_config?.directory_enabled === true;
                  const inSelectedOrg = inst.user_sub_id !== null && memberSubIds.has(inst.user_sub_id);
                  return (
                    <li key={inst.id}>
                      <button
                        onClick={() => handleSelectInstance(inst.id)}
                        className={`w-full text-left px-4 py-3 transition-colors ${
                          isRowActive ? 'bg-[var(--color-primary-purple)]/5' : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p
                            className={`text-sm font-semibold truncate ${
                              isRowActive ? 'text-[var(--color-primary-purple)]' : 'text-gray-900'
                            }`}
                          >
                            {inst.name}
                          </p>
                          <span
                            className={`flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${
                              inst.is_active
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-gray-50 text-gray-500 border-gray-200'
                            }`}
                          >
                            {inst.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 font-mono truncate">{inst.agent_id}</p>
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                              directoryOn ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-500'
                            }`}
                          >
                            Directory {directoryOn ? 'On' : 'Off'}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-500">
                            {rowEntries.length} {rowEntries.length === 1 ? 'term' : 'terms'}
                          </span>
                          {instanceScope === 'all' && (
                            <span className="text-[10px] text-gray-400 truncate">
                              {inst.creator_name ?? 'Unknown creator'}
                              {inSelectedOrg ? ` · ${selectedOrg.name}` : ''}
                            </span>
                          )}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </div>

      {/* ── Pane 3: Configuration ───────────────────────────────────────────── */}
      <div className="xl:col-span-5 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {!selectedInstance ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 px-6 opacity-60">
            <div className="w-16 h-16 rounded-2xl bg-gray-50 flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-gray-800 font-semibold">No instance selected</p>
              <p className="text-gray-500 text-sm mt-1">Choose an agent instance in the middle to configure it.</p>
            </div>
          </div>
        ) : (
          <div className="p-6 space-y-5">
            {/* Header */}
            <div>
              <h2 className="text-lg font-bold text-gray-900">{selectedInstance.name}</h2>
              <p className="text-xs text-gray-500 font-mono mt-0.5">{selectedInstance.agent_id}</p>
            </div>

            {seedParseError && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
                The stored domain lexicon on this instance could not be read ({seedParseError}). Saving now will overwrite it
                with whatever is in the editor below.
              </div>
            )}

            {saveError && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{saveError}</div>}
            {saveSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700 flex items-center gap-2">
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Configuration saved.
              </div>
            )}

            {/* Directory toggle */}
            <div className="flex items-center justify-between gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
              <div>
                <p className="text-sm font-semibold text-gray-900">Directory enabled</p>
                <p className="text-xs text-gray-500 mt-0.5">Turns this instance&apos;s directory lookup feature on or off.</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={directoryEnabled}
                aria-label="Directory enabled"
                onClick={() => {
                  setDirectoryEnabled((v) => !v);
                  setSaveError(null);
                  setSaveSuccess(false);
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
                  directoryEnabled ? 'bg-[var(--color-primary-purple)]' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    directoryEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Domain lexicon editor */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-semibold text-gray-900">Domain lexicon</p>
                <button
                  type="button"
                  onClick={handleLoadDefault}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all"
                >
                  Load default lexicon
                </button>
              </div>
              <p className="text-xs text-gray-400 mb-3">
                The default lexicon is a starting-point preset, transcribed by hand — review and edit terms before relying on it.
              </p>

              <div className="flex items-center gap-1 border-b border-gray-100 mb-3" role="tablist" aria-label="Domain lexicon editor mode">
                <button
                  type="button"
                  role="tab"
                  aria-selected={lexiconTab === 'rows'}
                  onClick={() => lexiconTab !== 'rows' && handleSwitchToRows()}
                  className={`px-3 py-2 text-sm font-semibold border-b-2 transition-all ${
                    lexiconTab === 'rows'
                      ? 'border-[var(--color-primary-purple)] text-[var(--color-primary-purple)]'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Row editor
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={lexiconTab === 'raw'}
                  onClick={() => lexiconTab !== 'raw' && handleSwitchToRaw()}
                  className={`px-3 py-2 text-sm font-semibold border-b-2 transition-all ${
                    lexiconTab === 'raw'
                      ? 'border-[var(--color-primary-purple)] text-[var(--color-primary-purple)]'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Raw JSON
                </button>
              </div>

              {lexiconTab === 'rows' ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {rows.length} {rows.length === 1 ? 'term' : 'terms'}
                    </p>
                    <button
                      type="button"
                      onClick={handleAddRow}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all"
                    >
                      + Add term
                    </button>
                  </div>

                  {rows.length === 0 ? (
                    <p className="text-sm text-gray-500 py-6 text-center">
                      No lexicon terms yet. Add one, or load the default lexicon above.
                    </p>
                  ) : (
                    <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                      {rows.map((row, idx) => (
                        <div key={idx} className="flex items-start gap-2 p-2 rounded-lg border border-gray-100">
                          <div className="flex-1 min-w-0 space-y-1">
                            <input
                              type="text"
                              value={row.canonical}
                              onChange={(e) => handleRowChange(idx, { canonical: e.target.value })}
                              placeholder="Canonical term"
                              aria-label={`Canonical term for row ${idx + 1}`}
                              className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#262782]/30 focus:border-[#262782]"
                            />
                            <input
                              type="text"
                              value={row.aliasesText}
                              onChange={(e) => handleRowChange(idx, { aliasesText: e.target.value })}
                              placeholder="Aliases, comma separated"
                              aria-label={`Aliases for row ${idx + 1}`}
                              className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#262782]/30 focus:border-[#262782]"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveRow(idx)}
                            aria-label={`Delete row ${idx + 1}`}
                            className="mt-1 p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all flex-shrink-0"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M4 7h16M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3"
                              />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor="domain-lexicon-raw-json" className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Lexicon JSON array
                    </label>
                    {rawJsonError ? (
                      <span className="text-[10px] font-bold uppercase tracking-wide text-red-600">Invalid</span>
                    ) : (
                      <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-600">Valid</span>
                    )}
                  </div>
                  <textarea
                    id="domain-lexicon-raw-json"
                    value={rawJsonText}
                    onChange={(e) => handleRawJsonChange(e.target.value)}
                    rows={12}
                    spellCheck={false}
                    aria-invalid={rawJsonError !== null}
                    className={`w-full px-3 py-2 text-xs font-mono border rounded-lg focus:outline-none focus:ring-2 bg-gray-50 ${
                      rawJsonError ? 'border-red-300 focus:ring-red-200' : 'border-gray-200 focus:ring-[#262782]/30 focus:border-[#262782]'
                    }`}
                  />
                  {rawJsonError && <p className="text-xs text-red-600">{rawJsonError}</p>}
                </div>
              )}
            </div>

            {/* Save bar */}
            <div className="flex flex-col gap-2 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-400">
                Saving sends only <code>domain_lexicon</code> and <code>directory_enabled</code> — every other configuration
                key already on this instance is left untouched.
              </p>
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-gray-500">{isDirty ? 'You have unsaved changes.' : 'No changes to save.'}</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleReset}
                    disabled={!isDirty}
                    className="px-4 py-2 text-sm font-semibold rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    Reset
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={!isDirty || !isLexiconValid || isSaving}
                    className="px-5 py-2 text-sm font-semibold text-white rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    style={{ background: 'linear-gradient(135deg,#262782,#7071AB)' }}
                  >
                    {isSaving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        Saving…
                      </>
                    ) : (
                      'Save Configuration'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrgAgentConfigManager;
