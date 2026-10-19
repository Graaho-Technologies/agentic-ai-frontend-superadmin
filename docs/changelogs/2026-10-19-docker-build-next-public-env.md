# 2026-10-19 — Docker build fails on missing `NEXT_PUBLIC_API_BASE_URL`: build-time args + non-throwing base-URL resolver

`docker build` failed in CI at `RUN npm run build` with:

```
NEXT_PUBLIC_API_BASE_URL environment variable is not set
Error occurred prerendering page "/dashboard/performance-analytics".
Error: API base URL not configured. Please set NEXT_PUBLIC_API_BASE_URL in your environment.
Export encountered an error on /dashboard/performance-analytics/page, exiting the build.
```

## Why

Two compounding problems:

1. `getBaseUrl()` (`src/lib/api/baseQueryWithAuth.ts`) throws when
   `NEXT_PUBLIC_API_BASE_URL` is unset, and it was being called **at module scope** — so merely
   *importing* a module that calls it during `next build`'s prerender pass killed the build.
2. `NEXT_PUBLIC_*` values are inlined into the client bundle by `next build`, so they must be
   present **during the Docker build**, not at container start. The Dockerfile accepted no
   build args and `.dockerignore` excludes `.env`/`.env.*` (correctly — kept as-is), so the
   build stage had no values at all.

## What changed

### Module-scope throw sites — all four, not just the one in the bug report

The initial diagnosis named only `src/lib/api/baseQueryWithAuth.ts`. Fixing just that file left
the build still failing — on a *different* page
(`/dashboard/performance-analytics/slow-requests` instead of `/dashboard/performance-analytics`)
— because **four separate modules** construct their own `fetchBaseQuery` at module scope using
the throwing `getBaseUrl()`, and `src/store.ts` imports every feature API unconditionally while
the dashboard layout wraps every page in the Redux `Provider`. That means prerendering **any**
dashboard page pulls in all four, regardless of which page is actually being rendered — which is
why the error can surface on a page that looks unrelated to auth, files, or CMS settings.

- **`src/lib/api/baseQueryWithAuth.ts`** — added `export const resolveBaseUrl()`: reads
  `process.env.NEXT_PUBLIC_API_BASE_URL`, logs and returns `''` instead of throwing when unset.
  Both of this file's own `fetchBaseQuery({ baseUrl: ... })` call sites (`baseQueryWithAuth`,
  `baseQueryWithoutAuth`) switched from `getBaseUrl()` to `resolveBaseUrl()`. `getBaseUrl()`
  itself is untouched — still exported, still throws — it remains the call-time accessor used
  elsewhere (e.g. the `src/components/subscription-model/plan/` components read
  `process.env` directly and are unaffected by any of this).
- **`src/features/auth/authApi.ts`** — `djangoBaseQuery`'s `baseUrl: getBaseUrl()` → `baseUrl:
  resolveBaseUrl()`; import swapped accordingly.
- **`src/features/fileApi.ts`** — `baseQueryForFileUpload`'s `baseUrl: getBaseUrl()` → `baseUrl:
  resolveBaseUrl()`; import swapped accordingly.
- **`src/features/cmsSettings/cmsSettingsApi.ts`** — `baseQueryForUpload`'s `baseUrl:
  getBaseUrl()` → `baseUrl: resolveBaseUrl()`; import swapped accordingly (`baseQueryWithReauth`
  and `getAccessToken` imports untouched).

No endpoint, tag type, `prepareHeaders`, or export shape changed in any of the three feature
files beyond this one swap.

### Docker build args

- **`Dockerfile`** (builder stage only, after `COPY . .`, before `RUN npm run build`) —
  declares `ARG`/`ENV` pairs for `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_ENV` (default `dev`),
  `NEXT_PUBLIC_DEV_ML_API_BASE_URL`, `NEXT_PUBLIC_PROD_ML_API_BASE_URL`,
  `NEXT_PUBLIC_DEV_AI_BASE_URL`, `NEXT_PUBLIC_DEMO_AI_BASE_URL`, `NEXT_PUBLIC_PROD_AI_BASE_URL`,
  then a `RUN test -n "$NEXT_PUBLIC_API_BASE_URL" || (... && exit 1)` guard so a missing
  required value fails the build immediately, with a readable message, instead of mid-prerender.
  Runner stage and `npm install --frozen-lockfile` untouched.

### CI workflow

- **`.github/workflows/deploy.yml`** — the `Resolve environment` step now also emits
  `api_url` (from `vars.NEXT_PUBLIC_API_BASE_URL_PROD` / `_DEV` depending on branch) and
  `app_env` (`prod` / `dev`) outputs, kept separate from the existing `overlay` output. The
  `Build & push image` step guards `API_URL` (fails with `::error::` if empty, naming the
  missing repo variable) and passes `--build-arg NEXT_PUBLIC_API_BASE_URL="$API_URL"` and
  `--build-arg NEXT_PUBLIC_ENV="${{ steps.env.outputs.app_env }}"` to `docker build`. The ML/AI `ARG`s stay available in
  the Dockerfile for later use; no GitHub repo variable was invented for them.

## Affected modules and behaviors

- **Auth, file upload, and CMS-settings API slices** (`authApi`, `fileApi`, `cmsSettingsApi`) —
  base URL resolution only; no change to token handling, 401/431 retry, endpoints, or tags.
- **Build/deploy pipeline** — the image build now requires two GitHub repository variables to
  exist (see Critical notes) or it fails fast by design.
- No migrations, webhooks, or analytics are touched.

## Intended outcome

`docker build` succeeds in CI with `NEXT_PUBLIC_API_BASE_URL` supplied as a build arg sourced
from a GitHub repository variable, and prerendering no longer crashes when that variable happens
to be absent at import time — a missing value now surfaces as a build-arg guard failure (clear,
early) or a failed API request at runtime, never a prerender crash.

## Verification

Run from the repo root unless noted:

- `npx tsc --noEmit` — **PASS**, exit 0, no output. Same as the pre-change baseline (also clean).
- `npm run lint` — **PASS**. Only the pre-existing warnings in `LoginPageSettings.tsx` (4×
  `no-img-element`) and `PlanComponentInclusionManagement.tsx` (3× `exhaustive-deps`), identical
  to the baseline run before any edits in this session. Zero new warnings.
- **The actual bug, reproduced and then fixed**, via an isolated copy rather than in place: this
  repo's own `.env` already defines `NEXT_PUBLIC_API_BASE_URL`, so running
  `env -u NEXT_PUBLIC_API_BASE_URL npx next build` *in the repo root* does not reproduce the
  missing-variable case — Next.js loads `.env` itself and the value comes back regardless of the
  shell's `env -u`. The packet's own fallback (temporarily rename `.env`, build, restore) could
  not be used either: this sandbox's permission layer denies every Bash and Read operation that
  references the literal path `.env`, including non-destructive ones (`wc -l .env`, a plain
  `Read` of the file) — confirmed by trying both and getting a permission denial, not a file-not-
  found. `.env` was never opened, moved, or modified.

  Instead: `rsync -a --exclude='.env' --exclude='.env.*' --exclude='node_modules'
  --exclude='.next' --exclude='.git' <repo>/ <scratchpad>/noenv-build-test/`, then
  `ln -s <repo>/node_modules ./node_modules` (reuse install, skip a second `npm install`), then
  `env -u NEXT_PUBLIC_API_BASE_URL npx next build` inside that copy — which has no `.env` at all,
  so the variable is genuinely absent.

  **Before the three-file fix** (only `baseQueryWithAuth.ts` patched): build still failed —
  ```
  NEXT_PUBLIC_API_BASE_URL environment variable is not set
  Error occurred prerendering page "/dashboard/performance-analytics/slow-requests".
  Error: API base URL not configured. Please set NEXT_PUBLIC_API_BASE_URL in your environment.
  Export encountered an error on /dashboard/performance-analytics/slow-requests/page, exiting the build.
   ⨯ Next.js build worker exited with code: 1 and signal: null
  ```
  — a different page than the bug report, because the page that fails first depends on static-
  generation batching order, not on which throw site is live.

  **After the three-file fix** (`authApi.ts`, `fileApi.ts`, `cmsSettingsApi.ts` also patched):
  ```
  NEXT_PUBLIC_API_BASE_URL is not set - API requests will fail   (×10, one per resolveBaseUrl() call)
     Generating static pages (8/32)
     Generating static pages (16/32)
     Generating static pages (24/32)
   ✓ Generating static pages (32/32)
     Finalizing page optimization ...
     Collecting build traces ...

  Route (app)                                               Size  First Load JS
  ...
  ├ ○ /dashboard/performance-analytics                   5.47 kB         250 kB
  ...
  ○  (Static)  prerendered as static content
  ```
  Re-run with output redirected to a file and `echo "EXIT CODE: $?"` immediately after: **exit
  code 0**. All 32 routes generated, no prerender error.

- `docker build` — **not run**; not runnable in this environment. Verified by reasoning over the
  Dockerfile instead: the `ARG`/`ENV` block runs after `COPY . .` and before `RUN npm run build`,
  so `next build` sees the values; the `test -n "$NEXT_PUBLIC_API_BASE_URL"` guard runs before
  `npm run build` and will `exit 1` with a named error if the build arg is empty or absent,
  before any prerendering is attempted. The container build itself remains unverified locally.

## Critical notes

- **`NEXT_PUBLIC_*` is build-time-inlined.** Setting these on the running container (Kubernetes
  env vars, ConfigMap, Secret) has **no effect** on an already-compiled bundle — the values must
  be present when `docker build` runs `next build`, which is why this fix is build args, not
  runtime env injection.
- **Two GitHub repository variables must exist** before this workflow can build successfully:
  `NEXT_PUBLIC_API_BASE_URL_DEV` and `NEXT_PUBLIC_API_BASE_URL_PROD` (Settings → Secrets and
  variables → Actions → Variables). Each value **must end with a trailing slash** — call sites
  concatenate directly, e.g. `` `${BASE_URL}agent-templates/...` `` in
  `src/components/subscription-model/plan/AgentComponentPricingManagement.tsx:119`. No real URL
  is recorded here; use `<your dev api base url>` / `<your prod api base url>` as the values when
  setting these up.
- **Until those two variables exist, the workflow now fails fast by design** — the `API_URL`
  guard in the `Build & push image` step raises a named `::error::` and exits before
  `docker build` runs, rather than letting the build fail opaquely 15 steps deep inside
  `next build`.
- **Any future RTK Query API in this repo that builds its own `fetchBaseQuery` must use
  `resolveBaseUrl`, never `getBaseUrl`, at module scope** — `getBaseUrl()` stays correct for
  call-time use (e.g. inside a function body that only runs client-side or server-side at
  request time), but using it to initialize a module-scope constant reintroduces exactly this
  class of prerender crash.
- No secrets, credentials, or real hostnames appear in this file, the Dockerfile, or the
  workflow — every URL comes from a GitHub repository variable supplied at build time.
