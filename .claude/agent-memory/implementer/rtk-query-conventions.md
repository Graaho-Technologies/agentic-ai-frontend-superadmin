---
name: rtk-query-conventions
description: How RTK Query feature slices (createApi) and store registration are structured in this repo
metadata:
  type: project
---

Verified against `src/features/performanceAnalytics/performanceAnalyticsApi.ts` and
`src/store.ts` on branch `cleanup/super-dev-20260825` (2026-09-07).

- Each feature is `src/features/<name>/<name>Api.ts` using
  `createApi({ reducerPath, baseQuery: baseQueryWithReauth, tagTypes, endpoints })`.
  `baseQueryWithReauth` lives in `src/lib/api/baseQueryWithAuth.ts` and handles token
  refresh, 401 retry, and 431 storage-clear-and-redirect — always reuse it, never a raw
  `fetchBaseQuery`.
- Request/response TypeScript interfaces are declared above the `createApi` call in the
  same file for smaller APIs (performanceAnalyticsApi does this). For a slice with several
  endpoints and reused shapes, a sibling `<name>Api.types.ts` also works (used for
  `src/features/rbac/rbacApi.ts` + `rbacApi.types.ts`) — both patterns exist, pick based on
  size.
- URLs passed to `query: () => ({ url: '...' })` are relative with **no leading slash**
  (e.g. `"rbac/organizations/"`), matching every existing feature.
- Every new API must be added in **both** places in `src/store.ts`: the `reducer` map
  (`[xApi.reducerPath]: xApi.reducer`) and `.concat(xApi.middleware)` in the middleware
  chain. Missing either breaks the store silently (no queries fire / no cache updates).
- Backend error convention across this codebase is inconsistent per-feature: some return
  DRF-style `{field: [messages]}` (see `ApiError` in
  `src/components/subscription-model/plan/CreateEditPlanDrawer.tsx`), others (RBAC/module
  access) return `{ error: string, detail: string }`. Always check the packet's documented
  contract rather than assuming DRF field-error shape; extract with a small
  `err.data?.detail || err.data?.error || fallback` helper against
  `unwrap()`'s thrown value, typed as `{ data?: Partial<YourErrorBody>; status?: number }`.
- Tag invalidation for a "list + single resource" pair: `providesTags` on the single-item
  query returns `[{ type, id }]`; the mutation's `invalidatesTags` returns both
  `[{ type, id }, type]` (bare string) so the list-level `providesTags: [type]` on the
  collection query also refetches. See `rbacApi.ts` (`OrganizationModules` tag) for a
  concrete example.
- For a `queryFn`-based endpoint that must call the raw base query directly (bypass another
  endpoint's own `query`/`transformResponse`), call `baseQueryWithReauth(args, api,
  extraOptions)` straight from inside `queryFn` — see `authApi.ts` login/logout and
  `cmsSettingsApi.ts` upload-image for that pattern. A second, equally valid pattern now
  also exists in this repo: use the 4th `queryFn` arg (`fetchWithBQ`, RTK Query's own name
  for the bound base query) instead of importing `baseQueryWithReauth` directly — see
  `orgManagementApi.ts`'s `getAllWorkspaces`/`getAllAgentInstances` (added 2026-10-18),
  which both walk `?page=N` until the backend returns `next: null`, capped at 50 pages as a
  backstop against a pagination regression. Either form works identically since the slice's
  `baseQuery` *is* `baseQueryWithReauth`; pick whichever the task packet specifies, don't
  "fix" one to match the other.
- Tolerant-parse pattern for a free-form/un-validated backend column read back into a typed
  shape: a `parse*` function that never throws — wrap `JSON.parse` in try/catch, validate
  the parsed shape by hand, and return `{ value, error: string | null }` rather than
  throwing on a malformed stored value. See `src/features/orgManagement/domainLexicon.ts`
  (`parseDomainLexicon`), added 2026-10-18 for an admin-edited JSON-string column with no
  backend validation.
- `mlAnalyticsApi.ts` (`src/features/mlAnalytics/`) is a deliberate exception to the
  "always reuse `baseQueryWithReauth`" rule above: it talks to a separate ML metrics host
  (`mlapi.koronik.ai` / `mlapi-dev.koronik.ai`, picked by `getMlApiBaseUrl()` off
  `NEXT_PUBLIC_ENV`), not the main backend, so it builds its own `fetchBaseQuery` and only
  borrows `getAccessToken()` for the bearer header. Don't "fix" this to use
  `baseQueryWithReauth` — it would silently point at the wrong host. Verified 2026-10-12.
- Forward-compatible field rollout pattern (verified on `mlAnalyticsApi.ts`'s
  `MLTokenBreakdown`, added 2026-10-12 for a token/cost block the ML API had only just
  started returning): declare the new fields as an `interface X { field?: T }` with every
  field optional, then `interface Existing extends X { ... }`. Lets the page read the new
  fields through `?.` without the whole response type changing shape, and the page cannot
  crash against a backend/env that hasn't rolled the fields out yet.
- `GET users/` (`UsersViewSet`) has no `pagination_class`, inherits the project-wide DRF
  default `PageNumberPagination` with `PAGE_SIZE=20`, and has **no**
  `page_size_query_param` — `limit`/`page_size` query params are silently ignored, 20 rows
  per page always. To read more than one page you must walk `page=1,2,3…` by hand; a
  `queryFn` endpoint is the right tool (see `userApi.ts`'s `getUserDirectorySnapshot`,
  added for SA-047 2026-10-05, which walks pages in concurrent batches of 4 and fails
  closed if any page errors). For a count-only need (no rows), a one-shot `page=1` request
  and reading just `response.count` is cheaper — see `getUserCohortCount` in the same file.
  `UsersViewSet.get_queryset()` also tenancy-scopes `list` (superadmin → everything,
  org-scoped actor → their org only) *after* query-param filtering, so two different pages
  hitting the same filtered `users/` endpoint as the same actor are guaranteed to agree —
  useful when a ticket requires two UIs to show a provably consistent number.
- `getBaseUrl()` in `src/lib/api/baseQueryWithAuth.ts` throws when
  `NEXT_PUBLIC_API_BASE_URL` is unset. As of 2026-10-19 it is called **only** at call time
  (components in `src/components/subscription-model/plan/` read `process.env` directly and
  separately). Every module-scope `fetchBaseQuery({ baseUrl: ... })` in the repo instead uses
  the sibling `resolveBaseUrl()` (also exported from `baseQueryWithAuth.ts`), which logs and
  returns `''` instead of throwing — required at **four** call sites:
  `baseQueryWithAuth.ts` itself (`baseQueryWithAuth`, `baseQueryWithoutAuth`), plus
  `src/features/auth/authApi.ts` (`djangoBaseQuery`), `src/features/fileApi.ts`
  (`baseQueryForFileUpload`), and `src/features/cmsSettings/cmsSettingsApi.ts`
  (`baseQueryForUpload`). Reason this matters beyond style: `src/store.ts` imports every
  feature API unconditionally and the dashboard layout wraps every page in the Redux
  `Provider`, so prerendering **any** dashboard page during `next build` pulls in all four
  call sites transitively — a single remaining `getBaseUrl()` at module scope anywhere in that
  import graph crashes the whole build, on whichever page happens to be processed first, which
  may look unrelated to the file actually at fault. Verified 2026-10-19 by reproducing
  `env -u NEXT_PUBLIC_API_BASE_URL npx next build` in an isolated `.env`-free copy: with only
  `baseQueryWithAuth.ts` patched the build still failed (on
  `/dashboard/performance-analytics/slow-requests`, not the originally-reported page); after
  all four call sites were switched to `resolveBaseUrl()` the build passed, exit 0, all 32
  routes generated. **Any new RTK Query file that builds its own `fetchBaseQuery` at module
  scope must import `resolveBaseUrl`, never `getBaseUrl`** — grep `getBaseUrl` across `src/`
  to confirm only the definition in `baseQueryWithAuth.ts` remains before trusting a "fixed"
  claim for this bug. Full history: `docs/changelogs/2026-10-19-docker-build-next-public-env.md`.
