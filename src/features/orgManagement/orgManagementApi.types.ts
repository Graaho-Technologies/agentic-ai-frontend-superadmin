// src/features/orgManagement/orgManagementApi.types.ts
// Types for the Org Management (super-admin) API.
// See CLAUDE.md "RTK Query Pattern" — request/response types live above the slice.

// ─── Domain lexicon ────────────────────────────────────────────────────────────

export interface DomainLexiconEntry {
  canonical: string;
  aliases: string[];
}

export interface AgentDynamicConfig {
  /**
   * The app writes this field as a JSON-stringified `DomainLexiconEntry[]`
   * (see `serializeDomainLexicon` in `./domainLexicon.ts`), matching the
   * reference Postman request this feature was specified from. The column
   * itself is free-form JSON with no backend validation though, so a value
   * written by another client (or edited directly) may come back already
   * parsed into an array rather than a string. Callers must go through
   * `parseDomainLexicon`, which accepts either shape.
   */
  domain_lexicon?: string | DomainLexiconEntry[] | null;
  directory_enabled?: boolean | null;
  [key: string]: unknown;
}

// ─── Workspaces (organizations) ───────────────────────────────────────────────

export interface OrgWorkspaceSummary {
  id: string;
  name: string;
  domain: string;
  members_count: number;
  created_at: string;
  created_by_details: {
    id: string;
    email: string;
    full_name: string;
  };
}

// ─── Workspace members ─────────────────────────────────────────────────────────

export interface OrgMember {
  id: string;
  sub_id: string;
  full_name: string;
  email: string;
  role: string;
  is_active: boolean;
}

export interface WorkspaceMembersResponse {
  workspace: {
    id: string;
    name: string;
    domain: string;
  };
  members_count: number;
  members: OrgMember[];
}

// ─── Agent instances ────────────────────────────────────────────────────────────

export interface OrgAgentInstanceSummary {
  id: string;
  agent_id: string;
  name: string;
  description: string;
  icon: string | null;
  agent_type: string;
  agent_variant: string;
  user_sub_id: string | null;
  creator_name: string | null;
  is_active: boolean;
  dynamic_config: AgentDynamicConfig | null;
  created_at: string;
  updated_at: string;
}

/**
 * Args for `PATCH /agent-instances/<id>/update-config/`. The backend
 * shallow-merges the `dynamic_config` object you send into the one already
 * stored (`existing.update(sent)`): sending only these two keys replaces
 * their old values wholesale but leaves every other `dynamic_config` key on
 * the instance untouched. There is no deep merge, and no `admin_sub_id`
 * query param — the endpoint ignores it, so it must not be sent.
 */
export interface UpdateDynamicConfigArgs {
  id: string;
  dynamic_config: {
    domain_lexicon: string;
    directory_enabled: boolean;
  };
}

export interface UpdateDynamicConfigResponse {
  message: string;
  instance: {
    id: string;
    dynamic_config: AgentDynamicConfig | null;
  };
  updated_fields: {
    context: boolean;
    agent_roles: boolean;
    additional_config: boolean;
    dynamic_config: boolean;
  };
}

// ─── Backend error convention ─────────────────────────────────────────────────

export interface OrgManagementApiErrorBody {
  error?: string;
  detail?: string;
  message?: string;
}
