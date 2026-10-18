# 2026-10-18 — Org Management: set `domain_lexicon` + `directory_enabled` per agent instance

A new **Org Management** sidebar tab at `/dashboard/org-management` lets a super admin pick an
organization, pick an agent instance created under it, and set two keys inside that instance's
`dynamic_config` — `domain_lexicon` and `directory_enabled` — then save via
`PATCH /api/v1/agent-instances/<id>/update-config/`.

## Why

Requested against the running super admin app, with a Postman screenshot of the reference call:

```
PATCH https://prod-api.koronik.ai/api/v1/agent-instances/<uuid>/update-config/
{
  "dynamic_config": {
    "domain_lexicon": "[{\"canonical\": \"CellFin\", \"aliases\": [...]}, ...]",
    "directory_enabled": true
  }
}
```

The requirement: *"for any org's created agent instances, set these two inside `dynamic_config`
— the instance id comes from whichever org the user picks and whichever instance under that org
they choose."* No surface for this existed; the update endpoint already did.

## What changed

### New — data layer

- **`src/features/orgManagement/orgManagementApi.types.ts`** — `DomainLexiconEntry`,
  `AgentDynamicConfig`, `OrgWorkspaceSummary`, `OrgMember`, `WorkspaceMembersResponse`,
  `OrgAgentInstanceSummary`, `UpdateDynamicConfigArgs`, `UpdateDynamicConfigResponse`,
  `OrgManagementApiErrorBody`.
- **`src/features/orgManagement/orgManagementApi.ts`** — new `orgManagementApi` slice on
  `baseQueryWithReauth`:
  - `getAllWorkspaces` — `queryFn` walks `workspaces/?page=N` until `next` is null (capped at 50
    pages). That endpoint paginates 20/page with **no** `page_size` param, and the picker needs
    the whole list.
  - `getWorkspaceMembers` — `workspaces/<id>/members/`.
  - `getAllAgentInstances` — same page-walk over `agent-instances/?page=N&page_size=100`
    (`page_size` max is 100; the default is **5**).
  - `updateAgentInstanceDynamicConfig` — `PATCH agent-instances/<id>/update-config/` with body
    `{ dynamic_config }` only. Invalidates `OrgAgentInstance`.
- **`src/features/orgManagement/domainLexicon.ts`** — `DEFAULT_DOMAIN_LEXICON` (12 entries),
  `serializeDomainLexicon` (`JSON.stringify`), and `parseDomainLexicon`, a **non-throwing**
  reader that accepts a string or an already-parsed array and returns
  `{ entries, error }`.
- **`src/store.ts`** — reducer + middleware registered after `rbacApi`.

### New — UI

- **`src/components/org-management/OrgAgentConfigManager.tsx`** (903 lines) — three panes:
  1. **Organizations** — searchable list (name + domain), modelled on `ModuleAccessManager`.
  2. **Agent instances** — org-scoped by default with a **"This organization" / "All instances"**
     toggle and a search over name + `agent_id`. Each row shows an Active/Inactive pill and, read
     straight off the row's own `dynamic_config`, a `Directory On/Off` + `N terms` badge pair —
     the at-a-glance "which instances are already configured" signal, with no extra fetch.
  3. **Configuration** — a `directory_enabled` toggle, plus a `domain_lexicon` editor with
     **Row editor** / **Raw JSON** tabs, a "Load default lexicon" button, live JSON validation,
     and dirty-tracked Save/Reset.
- **`src/app/dashboard/org-management/page.tsx`** — page shell mirroring `module-access/page.tsx`.
- **`src/app/dashboard/layout.tsx`** — `NAV_ROUTES.orgManagement` + a sidebar `<Link>` directly
  after Module Access. Nothing else in the file was touched.

## How — decisions and tradeoffs

Three constraints were established by reading the Django source, not the screenshot. All three
are in `docs/decisions/DECISIONS.md` under today's date.

1. **Org → instance narrowing is client-side, by inference.** `GET agent-instances/` exposes no
   `organization` filter; for a superadmin `get_queryset` falls through to `pass`
   (`agent_instance_views.py:468-480`) and returns every instance in the system. `admin_sub_id`
   is accepted but **inert** (`:496-498`). The real link
   (`instance_created_by → Users.organization`) is not in `AgentInstanceListSerializer`. So the
   page matches an instance's `user_sub_id` against the `sub_id`s from
   `workspaces/<id>/members/`.
   **Tradeoff, and the reason the escape hatch exists:** `user_sub_id` is nullable and membership
   rows may be incomplete, so this match can under-report. The "All instances" toggle — and the
   explicit amber prompt shown when the org-scoped list is empty while instances exist — keep a
   mismatch from ever making an instance unreachable. **Do not remove them** without a
   server-side org filter in place.

2. **"Organization" here means `Workspace`, not the RBAC `Organization`.** Only `Workspace` has a
   members endpoint exposing `sub_id`. The RBAC `Organization` used by Module Access is `id` +
   `name` with no member listing, so it could only have been joined by fuzzy-matching the
   denormalized `Users.organization_name`. The two ids are **not** interchangeable.

3. **Writes send only the two owned keys.** The view shallow-merges at the top level
   (`existing_dynamic.update(dynamic_config)`, `:1223-1226`) — omitted keys survive, sent keys are
   replaced wholesale, and there is no deep merge. Sending a reconstructed whole `dynamic_config`
   would clobber siblings such as the IDP feature's `field_mappings` / `sample_pdf_url`. The UI
   states this next to the Save button.

`domain_lexicon` is written as a JSON **string**, matching the reference request.
`domain_lexicon` and `directory_enabled` appear **nowhere** in the Django source — `dynamic_config`
is a free-form, un-validated `JSONField` — so the shape we write is exactly the shape the
downstream consumer receives. `parseDomainLexicon` nonetheless reads both string and array, since
nothing server-side guarantees which one is stored.

### Known gap — the default lexicon is a transcription

`DEFAULT_DOMAIN_LEXICON` was transcribed by hand from the Postman screenshot, whose lines were
cut off at the right edge. Some Bangla aliases are best-effort reconstructions. The user chose
this over blocking on the exact JSON. It is a **seed preset**, labelled as such in the UI and in
the module's file header, and is fully editable — it is not an authoritative lexicon. Replacing
it is a one-constant edit in `src/features/orgManagement/domainLexicon.ts`.

## Affected modules and behaviors

- **New Redux store key** `orgManagementApi`. No existing slice, reducer, or endpoint was
  modified; `agentTemplateApi` and `rbacApi` were left untouched.
- **Auth** — unchanged. Reuses `baseQueryWithReauth`. The endpoint's row-level gate
  (`authorize_instance_action(..., "manage")`) admits a superadmin for an instance in **any**
  organization with no ownership check, which is what makes this page possible.
- **No** migrations, async tasks, webhooks, or analytics are touched.
- Saving invalidates `OrgAgentInstance`, which re-walks the full instance list. Correct, but it is
  a full refetch — worth revisiting if instance counts grow large.

## Intended outcome

A super admin can set `domain_lexicon` and `directory_enabled` on any organization's agent
instance without Postman. **Signal it worked:** after saving, the instance row's `Directory On/Off`
and `N terms` badges reflect the new values on the refetched list, and a `GET` of that instance
shows the two keys inside `dynamic_config` with all other keys intact.

## Verification

Run in the project root after both changes landed:

- `npx tsc --noEmit` — **PASS**, exit 0, no output.
- `npm run lint` — **PASS**. Only pre-existing warnings, all in files untouched here
  (`cms-settings/LoginPageSettings.tsx` `<img>` ×4;
  `subscription-model/plan/PlanComponentInclusionManagement.tsx` exhaustive-deps ×3). Zero from
  the new files.
- `npm run build` — **PASS**. `/dashboard/org-management` appears in the route manifest as a
  static route, 8.65 kB / 134 kB first load.

**Not verified:** no request was made against a live API — the save path, the page-walk
pagination, and the `user_sub_id` → workspace-member match have **not** been exercised against
real data. The backend contract was read from the Django source in the sibling
`graaho-ai-agent-backend` checkout, not observed over the wire. No browser smoke test was run.

## Critical notes

- **The `user_sub_id` match is an inference, not a join.** First thing to check if an org looks
  empty or an instance looks misfiled. The "All instances" toggle is the user-facing workaround
  and the diagnostic.
- **Follow-up worth taking:** add `organization` to `AgentInstancesViewSet.filterset_fields` and
  filter on `instance_created_by__organization_id`. That makes the scoping exact and lets this
  page drop both the full-list fetch and the client-side match. Out of scope here — it is a
  change to the other repo.
- **Pre-existing, not fixed:** `getAgentInstancesByAdminId`
  (`agentTemplateApi.ts:949`) passes `?admin_sub_id=` expecting it to filter. It does not — for a
  superadmin that call returns every instance in the system. Left alone to keep this change
  scoped; worth a look where that hook is consumed.
- Page-walk loops are capped at 50 pages. Beyond that the list is silently truncated (~1,000
  workspaces / ~5,000 instances) — a deliberate backstop against an unbounded fetch loop.
- **Rollback** is clean: the feature is additive. Delete the three new directories and revert the
  two registration edits (`src/store.ts`, `src/app/dashboard/layout.tsx`). No data migration, no
  breaking change.
