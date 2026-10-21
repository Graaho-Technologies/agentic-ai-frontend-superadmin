# 2026-10-22 — Port the Org Management sidebar group from `eks_dev` to `super-dev`

The Oct 19 sidebar rework — **Org Management** as a collapsible group holding **Agent Config**,
**Module Access** and **Workspaces**, with lucide-react icons replacing the inline SVGs — had
only ever been committed on `eks_dev`. `super-dev` still carried the older flat sidebar, so on
`super-dev` those entries appeared "missing" even though every page and API file was present.
This ports the UI half of that work, and nothing else.

## Why

Reported against the running super admin app: "it seems some code has been lost — Module Access
under Org Management, and Workspaces and Org Management itself were there but I don't see them
now; did a merge lose it?"

Nothing was lost. `git diff super-dev origin/eks_dev` showed `src/app/dashboard/layout.tsx`
(191 lines) and the four Oct 19 changelogs living only on `eks_dev`. The suspected culprit,
merge `96a8c10` (`koronikai-prod` → `super-dev`), touched exactly one file,
`src/features/fileApi.ts`. The commits never reached `super-dev` because the Oct 19 session
worked on `eks_dev` while the later `super-dev` commits (`ff58186`, `1757b00`) ran on the other
branch in parallel.

## What changed

- **`src/app/dashboard/layout.tsx`** — taken verbatim from `origin/eks_dev` (98 insertions,
  93 deletions). `NAV_ROUTES.workspaces` / `.moduleAccess` / `.orgManagement` collapse into a
  nested `NAV_ROUTES.orgManagement = { agentConfig, moduleAccess, workspaces }`; a new
  `ORG_MANAGEMENT_ROUTES` tuple drives both the accordion's open state and its active styling.
  `groupBtnCls(prefix)` is refactored to delegate to a new `groupBtnClsFor(active: boolean)`,
  because this group's three routes share no common path prefix — `/dashboard/org-management`,
  `/dashboard/module-access` and `/dashboard/workspaces` — so the existing
  `pathname.startsWith(prefix)` test could not express it. All inline `<svg>` nav icons become
  lucide components.
- **`package.json` / `package-lock.json`** — adds `lucide-react@^1.59.0`, pinned to the same
  range `eks_dev` carries. `npm install lucide-react@^1.59.0` resolved to 1.61.0 and rewrote the
  range, so it was re-installed as `1.59.0` to keep the two branches identical.

## Deliberately NOT ported

`eks_dev` has its own deployment structure; per the request, only the UI came across. Left on
`eks_dev`: `Dockerfile`, `.dockerignore`, `.github/workflows/deploy.yml`, and the build-time env
work that introduces `resolveBaseUrl()` as a non-throwing variant of `getBaseUrl()`
(`src/lib/api/baseQueryWithAuth.ts`, `src/features/auth/authApi.ts`,
`src/features/cmsSettings/cmsSettingsApi.ts`, `src/features/fileApi.ts`, `src/app/layout.tsx`).
Also not ported: the `.claude/` agent-memory and worker-ledger churn, and the four Oct 19
changelogs.

**Consequence:** `super-dev` keeps `getBaseUrl()`, which throws at module scope when
`NEXT_PUBLIC_API_BASE_URL` is unset. The build here passes because a local `.env` supplies it.
Any future `super-dev` build in an environment without that variable will still fail at
prerender — that is the pre-existing `super-dev` behavior, unchanged by this port.

## Affected modules and behaviors

Sidebar navigation only. No route, page component, API slice, store wiring, or auth path was
touched; `/dashboard/org-management`, `/dashboard/module-access` and `/dashboard/workspaces` keep
their existing URLs, so no bookmark or deep link breaks. First render of the sidebar now shows
Org Management collapsed unless the current path is one of its three children.

## Intended outcome

On `super-dev`, the sidebar shows an Org Management group that expands to Agent Config, Module
Access and Workspaces. Signal it worked: all three are reachable from the sidebar on `super-dev`
and the group auto-expands when one of them is the active route.

## Verification

- `npm run lint` — passes. Warnings only, all pre-existing and all in other files
  (`LoginPageSettings.tsx` `no-img-element`, `PlanComponentInclusionManagement.tsx`
  `react-hooks/exhaustive-deps`). None in `layout.tsx`.
- `npm run build` — succeeds. `/dashboard/module-access` (5.36 kB), `/dashboard/org-management`
  (8.65 kB) and `/dashboard/workspaces` (5.65 kB) all prerender.
- `git diff origin/eks_dev -- package.json src/app/dashboard/layout.tsx` — empty; both files are
  byte-identical to `eks_dev`.
- `BuildingComplex`, the one import worth doubting, is confirmed exported by lucide-react 1.59.0
  (`node_modules/lucide-react/dist/lucide-react.d.ts:3409`).
- **Not verified:** the sidebar was not exercised in a running browser this session; the
  accordion's open/close behavior rests on it being the same file `eks_dev` has been running.

## Critical notes

- No security, auth, migration, or rollback surface. Rollback is
  `git checkout HEAD -- src/app/dashboard/layout.tsx package.json package-lock.json`
  followed by `npm install`.
- **Changes are left uncommitted in the working tree** — no commit was requested.
- **Follow-up:** `super-dev` and `eks_dev` have now both committed the plan-agent-limits feature
  independently (`ff58186` and `996586f`, same title, separate commits). A future merge between
  the branches will have to reconcile that duplication.
