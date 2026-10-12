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
