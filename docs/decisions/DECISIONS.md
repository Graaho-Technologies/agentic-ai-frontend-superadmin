# Decisions

Append-only. Newest at the bottom. Three or four lines each: date, decision, why, what it rules
out. Rejected alternatives matter as much as the choice.

---

## 2026-09-08 — Per-organization module access lives in the super-admin app, not the org app

**Decision.** The "Module Access" sidebar entry and its page
(`/dashboard/module-access`) belong to this super-admin dashboard. The org-facing frontend keeps
only its existing **per-user** module flow (`ManageModuleAccessModal` / `ModuleAccessPicker`).

**Why.** The grant is per-organization and cascades to the admins and users that organization
creates. Only a superadmin may set it, and the endpoints backing it are `IsSuperAdmin`. Putting
it in the org app would put a control there that no org user can legitimately operate.

**Rules out.** Extending the org app's per-user picker to carry an org-level mode, and any
org-admin-visible surface for organization-level grants.

---

## 2026-09-08 — The module picker renders the server's list; it never filters modules client-side

**Decision.** The checkbox list comes verbatim from `GET rbac/organizations/<id>/modules/`, which
returns `ASSIGNABLE_PERMISSION_MODULES` (the catalogue minus `SUPERADMIN_ONLY_MODULE_KEYS`). No
module key, and no role name, is hardcoded in this repo.

**Why.** The set is one definition in `rbac/constants.py`
(`ORG_GRANTABLE_PERMISSION_MODULES`). If the client also filtered, the two could drift, and
"changing what this page manages is a config change" would stop being true. Handover appears
here because the server sends it; the 14 directly-assignable modules are absent because it does
not.

**Rules out.** A client-side allowlist or denylist of module keys. A `role === 'superadmin'`
check in this repo as the mechanism for showing or hiding a module. Rendering the full
`PERMISSION_MODULES` catalogue and relying on the server to reject a bad save.

---

## 2026-09-08 — No "Managed / Unmanaged" state in this UI; the org grant is additive

**Decision.** The organization list shows an "N granted" badge only when an organization has
grants, and the page carries one callout saying a checked module reaches every user in the
organization and that nothing else about their access changes. There is no managed/unmanaged
badge and no `is_configured` field.

**Why.** The first build treated the org grant as a cap, so an organization with no rows was
labelled "Unmanaged" in amber, implying a problem to fix. It is the normal state and costs
nothing. The backend layer was inverted to additive the same day — see the backend's
`DECISIONS.md` — after it became clear that cap semantics plus a page managing only Handover
would have stripped every other module from an organization on save.

**Rules out.** Any UI copy telling a Super Admin that saving "starts managing" an organization,
or that checked modules "replace whatever the user's role would normally allow". Both were true
of the cap design and are false now. Also rules out reintroducing an amber warning state for an
organization that simply has no grant.

---

## 2026-09-08 — The org grant is a **delegable pool**, not a blanket switch (supersedes the two entries above)

**Decision.** A Super Admin checking a module for an organization creates a *pool*: the module
becomes available to that organization. Its **admins hold it immediately**; its **users hold
nothing** from the pool until an org admin grants it to them individually, from the org app's
existing per-user module flow. An org admin may also withhold it from a sub-admin it created.
Unchecking withdraws it from everyone in the organization on their next request, including
anyone an admin had delegated it to. An organization with no grant has an empty pool, and the
whole step is a no-op — nothing is added and nothing is capped.

**Why.** The requirement stated with the ticket is that an org admin decides who among the
members it created actually gets the module. A blanket cascade cannot express that: it gives
the module to every member at once and leaves the admin no way to withhold it from one person.

**What this corrects in the entries above.** "Cascades to the admins and users that organization
creates" (2026-09-08, first entry) and "a checked module reaches every user in the organization"
(2026-09-08, previous entry) both describe the blanket design and are **false** as of this entry.
The pool callout in `ModuleAccessManager.tsx` is the accurate wording; keep it in step with the
backend resolver's layering rather than with those two lines.

**Rules out.** Any UI copy in this repo promising that a checked module reaches every member of
the organization. Re-deriving delegation rules client-side: this page writes the org-level pool
only, and who inside the organization receives it is decided by the backend resolver and the org
app's per-user flow, never here.

---

## 2026-10-05 — Summary's headline counts come from server `count`, never from a client-side filter

**Decision.** Total / Active / Inactive on `/dashboard/settings/summary` are read from DRF's
`count` on three filtered `GET users/` requests (`?`, `?is_active=true`, `?is_active=false`) via
`getUserCohortCount`. No headline figure is ever computed by filtering a page of `results`.

**Why.** SA-047's root cause was exactly that: `Summary.tsx` filtered page-1 rows for "Active
Users" and displayed the result against the global `count`, so the two could never agree. Reading
`count` makes Summary and Manage User agree *by construction* — same endpoint, same actor, so
the same tenancy scope (`UsersViewSet.get_queryset()` scopes `list` by organization unless the
actor holds `Permissions.ALL`) and the same number.

**Rules out.** Deriving any displayed total, or any cohort count, from `results.length` or a
`.filter()` over a page. Presenting a figure from the paged scan as a directory total without the
truncation note.

---

## 2026-10-05 — The client may not choose the `users/` page size; `USERS_PAGE_SIZE` is the single source

**Decision.** `USERS_PAGE_SIZE = 20` is exported from `src/features/user/userApi.ts` and is the
only page-size number any caller of `users/` may use in pagination arithmetic.

**Why.** `UsersViewSet` declares no `pagination_class`, so it inherits the project default
(`config/settings/base.py`: `PageNumberPagination`, `PAGE_SIZE: 20`) and exposes **no**
`page_size_query_param`. The `limit` the frontend had been sending was silently ignored, and
`ManageUser.tsx` computed `totalPages` and "Showing X to Y" against an invented 10 — producing a
pager with roughly twice the real page count and row ranges that never matched what was on screen.

**Rules out.** Any literal page-size number in pagination maths. Expecting `?limit=` or
`?page_size=` to work against `users/` — changing the page size requires a backend
`pagination_class`, not a client parameter.

---

## 2026-10-05 — A paged scan of `users/` must order deterministically and dedupe by id

**Decision.** `getUserDirectorySnapshot` pages with `ordering=-customer_used_token,-created_at`
and enforces identity with a `Set` of seen ids while accumulating rows.

**Why.** `customer_used_token` defaults to 0, so most rows tie on it. LIMIT/OFFSET paging over a
non-unique ORDER BY lets the database return rows in a different order per page, silently skipping
and duplicating users — which would corrupt the token total, every breakdown, and
`scannedCount`/`truncated`. The tiebreaker must be `created_at` specifically: DRF's
`OrderingFilter` silently drops terms outside `ordering_fields`, and `id` is not in that list on
`UsersViewSet`, so ordering by it would be a no-op that merely looks correct.

**Rules out.** Paging any `users/` scan on a single non-unique sort key. Assuming the server's
paging guarantees each row is seen exactly once.

---

## 2026-10-12 — A null `cost_usd` from the ML metrics API is never presented as a total cost

**Decision.** On `/dashboard/performance-analytics/ml-analytics`, when the ML API returns
top-level `cost_usd: null`, the UI shows the sum of `models[].cost_usd` but labels it
"Sum of priced models · partial" and renders an amber notice naming the untracked tokens.
`cost_usd` is typed `string | null` and always read through `parseCost`, never as a number.

**Why.** `total_tokens = input_tokens + output_tokens + untracked_tokens`, and the models array
accounts for only `input + output`. On the prod payload that is 576.6M of 698.3M tokens with no
model attribution — the backend returns `null` precisely because it cannot price them. Showing
the $13.35 model sum unqualified would read as the agent's full spend when it covers 17% of its
tokens.

**Rules out.** Treating the derived model sum as the agent's cost. Coercing `cost_usd` with
`Number()` at the call site, or typing it as a number — the API sends a decimal string to keep
precision.

---

## 2026-10-12 — `cached_input_tokens` is a subset of `input_tokens`, not a fourth token bucket

**Decision.** Any token composition view sums only input + output + untracked. Cached input is
rendered as a nested figure under input with its share of input, never as its own bar segment and
never added into a total.

**Why.** Verified against the prod payload: `models[].total_tokens` sums to
`input_tokens + output_tokens` exactly, and `total_tokens - untracked_tokens` equals the same
number — so the 71.1M cached tokens are already inside the 120.7M input tokens. Counting them
separately would overstate total usage by 59% of input.

**Rules out.** A four-segment token bar. Any `input + cached + output` arithmetic.

---

## 2026-10-13 — Per-unit money values are sent to the API as exact strings, never `parseFloat`

**Decision.** In the Plan Components form, `cost_per_unit` and `price_per_unit` leave
`buildSubmitData` as the trimmed string the user typed. Their `<input type="number">` carry
`step="any"`, and `formatCurrency` renders up to 10 decimal places with a 2-dp floor.
`quantity` and `discount_percentage` keep `parseFloat` — they are 2-dp fields.

**Why.** `parseFloat('0.000000155')` is `1.55e-7`, and `JSON.stringify` writes that as
`1.55e-7`; a fixed `step` also makes the browser silently refuse to submit the whole form,
which is how this surfaced (Create appeared dead, because Cost Per Unit was the first
step-mismatched field). The request payload types already accepted `number | string | null`,
so the string costs nothing.

**Rules out.** Putting a fixed `step` back on a money input to get spinner granularity.
Routing per-unit values through `parseFloat`/`Number()` on the way out. Formatting them
with a fixed `toFixed(n)` for display — anything finer than `n` renders as `$0.000000`,
which reads as free. Storage precision is the backend's
`docs/decisions/DECISIONS.md` 2026-10-13 entry; this repo must not assume 6 dp.

**Addendum, 2026-10-13.** The same rule was applied to the **Override Price** field on
`AgentComponentPricingManagement.tsx` (it overrides a component's `price_per_unit` per
agent): `step="any"`, exact-string payload, no fixed-precision display. That file keeps a
**4-decimal minimum** in `formatPrice` rather than `formatCurrency`'s 2, because 4 was its
established look — the minimum is per-file; the *maximum* (10, exponent-free) is the rule.
Deliberately not extracted into a shared util: three local helpers in three components is
this codebase's existing idiom, and a shared one would have forced a single minimum.

Anything displaying a per-unit price must also tolerate **exponent-form input**:
`effective_price_per_unit` is serialized from a Python `float`, so `1.55e-07` arrives over
the wire where the `DecimalField`-backed fields arrive as `"0.0000001550"`.

---

## 2026-10-13 — Plan child routes are addressed by the **inclusion** id, not the child entity's id

**Decision.** Every call to `/plans/{plan_id}/agents/{...}/` and
`/plans/{plan_id}/components/{...}/` puts the **join row's** id in the final segment —
`PlanAgentInclusion.id` / `PlanComponentInclusion.id` — never `agent_id`, `agent_pricing.id`,
or `component.id`. RTK Query arguments for these endpoints are named `inclusionId` so the
call site cannot read as correct while being wrong.

**Why.** The backend resolves them that way
(`subscriptions/views/subscription_views.py:1047` and `:828`, both
`Inclusion.objects.get(id=<segment>, plan=plan)`). `removeAgentFromPlan` named its argument
`agentId` and was duly handed `agent_pricing.agent_id`; every request 404'd and the Remove
button silently did nothing for however long it had shipped. The sibling endpoints on the
same URL shape had it right, so nothing but the name made the wrong value plausible.

**Rules out.** Naming one of these arguments after the child entity. Reaching for
`agent_pricing.agent_id` / `component.id` when building one of these URLs. Swallowing the
response body on failure: these endpoints return their message under `error`, not `detail`,
so a `detail`-only fallback turns a precise 404 into "something went wrong" — read
`detail || error || message`.

---

## 2026-10-18 — Org Management narrows instances to an organization **client-side**, via `user_sub_id`

**Decision.** `/dashboard/org-management` lists every agent instance (`GET agent-instances/`,
which for a superadmin is unfiltered) and decides which belong to the selected organization in
the browser: an instance is in-org when its `user_sub_id` is the `sub_id` of a member returned
by `GET workspaces/<id>/members/`. The pane carries a permanent **"All instances"** toggle and
an explicit escape hatch when the match set is empty.

**Why.** The backend offers no server-side alternative today. `AgentInstancesViewSet`
(`agent_management/views/agent_instance_views.py:337`) has `filterset_fields = ["is_active",
"template", "instance_created_by", "user_sub_id", "created_at"]` — no `organization`. Org scope
is derived from the **JWT actor** in `get_queryset` (`:468-480`), and for a superadmin that
branch is `pass` — all instances, every org. `admin_sub_id` is accepted but inert (`:496-498`);
it is **not** a filter, so `getAgentInstancesByAdminId` in `agentTemplateApi.ts:949` does not
narrow anything for a superadmin. The real link, `instance_created_by → Users.organization`, is
absent from `AgentInstanceListSerializer` (`agent_instances.py:685-710`), so it cannot be used
client-side either.

**Rules out.** Believing `?admin_sub_id=` or `?organization=` filters the instance list. Treating
the `user_sub_id` match as authoritative — it is an inference (`user_sub_id` is nullable, and
workspace membership may be incomplete), which is why the escape hatch is load-bearing and must
not be removed. The clean fix is a backend change — add `organization` to `filterset_fields` and
filter on `instance_created_by__organization_id` — after which this page should switch to it.

---

## 2026-10-18 — "Organization" in Org Management means **Workspace**, not the RBAC `Organization`

**Decision.** The org picker on `/dashboard/org-management` is fed by `GET workspaces/`, not by
`GET rbac/organizations/` which backs the Module Access page.

**Why.** They are two different models. `Organization` (`apps/organizations/models.py:27`) is
`id` + `name` only, and **no endpoint exposes its members**, so it cannot be walked to a set of
`sub_id`s. `Workspace` (`apps/agents/models/workspaces.py:11`) has `GET workspaces/<id>/members/`,
which returns users with `sub_id` — the only field that joins to an agent instance. Picking the
RBAC `Organization` would have forced a fuzzy match on the denormalized `Users.organization_name`.

**Rules out.** Assuming the two pages' org ids are interchangeable — a `rbac/organizations/` id
will not resolve against `workspaces/`, and vice versa. Reaching for `rbac/organizations/` here
without first adding a members endpoint to it.

---

## 2026-10-18 — `dynamic_config` writes send only the keys they own

**Decision.** `PATCH agent-instances/<id>/update-config/` is called with
`{ dynamic_config: { domain_lexicon, directory_enabled } }` and **no `admin_sub_id`**.
`domain_lexicon` is written as a JSON **string**; readers go through `parseDomainLexicon`, which
accepts a string or an array.

**Why.** The view top-level **shallow-merges** (`existing_dynamic.update(dynamic_config)`,
`agent_instance_views.py:1223-1226`), so omitted keys survive but any key sent replaces its value
wholesale — there is no deep merge. `admin_sub_id` is never read by this action. The string
encoding matches the reference Postman request; `domain_lexicon` and `directory_enabled` appear
**nowhere** in the Django source, so the column is free-form, un-validated, and whatever shape we
write is the shape its downstream consumer gets.

**Rules out.** Sending a whole reconstructed `dynamic_config` (it would clobber sibling keys such
as the IDP feature's `field_mappings` / `sample_pdf_url`). Expecting the backend to validate,
coerce, or deep-merge these keys. Assuming a nested key can be patched on its own.

---

## 2026-10-19 — `NEXT_PUBLIC_*` reaches the Docker image via build args, not runtime injection; module-scope base-URL resolution must never throw

**Decision.** `docker build` now accepts `NEXT_PUBLIC_API_BASE_URL` (required) and six other
`NEXT_PUBLIC_*` values (optional) as Docker build args, promoted to `ENV` before `npm run build`
in the builder stage only, with a `RUN test -n "$NEXT_PUBLIC_API_BASE_URL" || exit 1` guard.
`.github/workflows/deploy.yml` sources the required value from a per-environment GitHub
repository variable (`NEXT_PUBLIC_API_BASE_URL_DEV` / `_PROD`) and passes it with
`--build-arg`. Separately, every module-scope `fetchBaseQuery({ baseUrl: ... })` in this repo
must resolve the base URL through a non-throwing accessor (`resolveBaseUrl()` in
`src/lib/api/baseQueryWithAuth.ts`), never the throwing `getBaseUrl()` — that rule applies to
**any** file that builds its own `fetchBaseQuery` at module scope, not just the one the bug was
first reported against.

**Why.** `next build` inlines `NEXT_PUBLIC_*` values into the client bundle at build time;
setting them on the running container has no effect on an already-compiled bundle, so runtime
injection cannot fix a missing value after the fact. Separately, `getBaseUrl()` threw when the
var was unset, and it was being called at module scope in **four** places
(`baseQueryWithAuth.ts` ×2, `authApi.ts`, `fileApi.ts`, `cmsSettingsApi.ts`) — `store.ts` imports
every feature API unconditionally and the dashboard layout wraps every page in the Redux
`Provider`, so prerendering *any* dashboard page pulled in all four throw sites regardless of
which page was actually being rendered. Fixing only the first-reported file left the build
failing on a different, seemingly unrelated page.

**Rules out.** Runtime env injection (ConfigMap/Secret/k8s env) as a fix for missing
`NEXT_PUBLIC_*` values — it cannot work, by how Next.js inlines these at build time. Committing
`.env`/`.env.*` into the image to work around the missing build args — `.dockerignore` correctly
excludes them and that exclusion was not touched. Treating the bug as fixed after patching a
single file without grepping for every other module-scope `getBaseUrl()` call site.

---

## 2026-10-19 — The per-environment API base URL lives in `deploy.yml`, not in a GitHub repository variable

**Supersedes** the sourcing clause of the entry above (same day). The build-arg mechanism,
the Dockerfile guard, and the `resolveBaseUrl()` rule all stand unchanged — only *where the
value comes from* changed.

**Decision.** `.github/workflows/deploy.yml` resolves `api_url` as
`${{ vars.NEXT_PUBLIC_API_BASE_URL_<ENV> || '<literal default>' }}`: the per-branch default is
committed in the workflow, and a repository variable of the same name overrides it if one is
ever set. No GitHub configuration is required for a green build.

**Why.** The variable-only version failed on first push (run #5) with the `API_URL` guard
firing correctly — nobody on this team has admin access to create repository variables, so a
settings-only mechanism is unusable here regardless of its merits. `NEXT_PUBLIC_*` values are
inlined into the client bundle and served to every browser, so they are public by construction;
committing them leaks nothing the shipped JS does not already expose. The values themselves were
taken from this repo's own prior approved-command history and confirmed live before use
(prod → HTTP 401 auth-required, dev → HTTP 503 backend down but DNS/TLS valid), not guessed.

**Rules out.** Blocking a deploy on a GitHub settings change this team cannot make. Treating
`NEXT_PUBLIC_*` values as secrets — they are not, and a `secrets.*` reference for them would be
security theatre over a value already readable in the bundle. Removing the `vars.*` override or
the `API_URL` guard: the override keeps the door open for an admin to externalize these later,
and the guard still catches a broken default. Note the trade accepted: pointing an environment
at a different backend is now a reviewed code change rather than an invisible settings edit —
chosen deliberately, and it is the better audit story anyway.
