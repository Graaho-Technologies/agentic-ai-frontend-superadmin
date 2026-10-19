# 2026-10-19 — Sidebar: collapse Org Management, Module Access, and Workspaces into one accordion group

## Why

The super-admin sidebar had `Module Access` and `Workspaces` as standalone top-level entries,
separate from `Org Management`, even though all three manage different facets of the same org.
`Performance Analytics` and `Subscription Model` already use a collapsible accordion group for
related pages; this change brings the org-related entries into the same pattern for consistency
and to shorten the flat top-level list.

## What changed

**Navigation only — no route moved, no page file moved, no URL changed.**
`/dashboard/org-management`, `/dashboard/module-access`, and `/dashboard/workspaces` all resolve
exactly as before; only `src/app/dashboard/layout.tsx` was edited.

- `NAV_ROUTES.workspaces`, `NAV_ROUTES.moduleAccess`, and the flat `NAV_ROUTES.orgManagement`
  string were replaced with a nested `NAV_ROUTES.orgManagement` object
  (`.agentConfig` / `.moduleAccess` / `.workspaces`), matching how `subscription` and
  `performanceAnalytics` are already nested.
- Added a module-scope `ORG_MANAGEMENT_ROUTES` array (the three hrefs) next to `NAV_ROUTES`,
  reused by both the auto-expand effect and the active-group check.
- Added `orgManagementOpen` state alongside the other four `*Open` states, and one line in the
  existing pathname-driven `useEffect` to auto-expand the group when any of its three routes is
  the current page.
- Replaced the three standalone `<Link>` blocks (Workspaces, Module Access, Org Management) with
  one accordion group, built like the Performance Analytics / Subscription Model groups: a
  `<button>` header (icon + "Org Management" label + chevron) and a `submenuContainerCls`-wrapped
  list of three sub-links (`subLinkCls`), mapped from an `as const` array. The group sits in the
  position the old `Org Management` link occupied: after Demo Users, before Performance
  Analytics. `Agent Templates` and `Demo Users` are untouched.
- The sub-item for `/dashboard/org-management` is labeled **"Agent Config"**, not "Org
  Management" — the group header already says "Org Management", so reusing the name for the
  child would read as "Org Management → Org Management". The page's own `<h1>` is unchanged; only
  the sidebar label differs from the page title.
- The existing building/org-management `<svg>` icon that used to sit on the standalone link was
  moved as-is onto the new group button (not redrawn).

### The one structural wrinkle: no shared URL prefix

Every other accordion group's routes share a path prefix (`/dashboard/subscription/...`,
`/dashboard/performance-analytics/...`), so the existing `groupBtnCls(prefix)` — built on
`isGroupActive(prefix) = pathname.startsWith(prefix)` — was sufficient to decide whether the
group button should render in its "active" (highlighted) state. This group's three routes
(`/dashboard/org-management`, `/dashboard/module-access`, `/dashboard/workspaces`) share no
common prefix, so a prefix-based check cannot express "is this group active" for it.

Resolved by splitting `groupBtnCls` into a boolean-taking core, `groupBtnClsFor(active: boolean)`,
holding the one copy of the class string, with `groupBtnCls(prefix)` now a thin wrapper
(`groupBtnClsFor(isGroupActive(prefix))`). The three existing groups call `groupBtnCls(prefix)`
unchanged. The new Org Management group instead computes
`orgManagementActive = ORG_MANAGEMENT_ROUTES.some((href) => pathname === href)` — **exact
equality, not `startsWith`** — and calls `groupBtnClsFor(orgManagementActive)` directly. Exact
equality was used (rather than, say, three `startsWith` prefixes) because all three routes are
flat single pages (`page.tsx` only, no nested sub-routes under them today); `startsWith` would be
a latent trap if a sibling route like `/dashboard/workspaces-archive` were ever added later, since
it would then also light up the Org Management group as "active".

## Affected modules and behaviors

- Only `src/app/dashboard/layout.tsx`. No API slice, Redux store, auth guard, or page component
  touched. No other file in `src/` referenced the old flat `NAV_ROUTES.workspaces` /
  `.moduleAccess` keys (confirmed by grep, see Verification), so nothing else needed updating.

## Intended outcome

Visiting `/dashboard/org-management`, `/dashboard/module-access`, or `/dashboard/workspaces`
auto-expands and highlights a single "Org Management" sidebar group containing three sub-links
(Agent Config, Module Access, Workspaces); no other page's URL or sidebar entry changes.

## Verification

Run from the repo root:

- `npx tsc --noEmit` — **PASS**, exit 0, no output.
- `npm run lint` — **PASS**. Only pre-existing warnings: `LoginPageSettings.tsx` (4×
  `no-img-element`) and `PlanComponentInclusionManagement.tsx` (3× `exhaustive-deps`), identical
  to baseline. Zero new warnings.
- `npx next build` — **PASS**, exit 0. `Generating static pages (32/32)` and the route table
  both confirm all three routes are still generated:
  ```
  ├ ○ /dashboard/module-access                           5.32 kB         130 kB
  ├ ○ /dashboard/org-management                          8.62 kB         134 kB
  ...
  ├ ○ /dashboard/workspaces                              5.61 kB         133 kB
  ```
- `grep -n "NAV_ROUTES.workspaces\|NAV_ROUTES.moduleAccess\|NAV_ROUTES.orgManagement" src/app/dashboard/layout.tsx`
  — only the new nested-path references remain (lines in `ORG_MANAGEMENT_ROUTES` and the
  sub-item array); no stale flat-key usage. A repo-wide `grep -rn` of the same pattern across
  `src/` turned up no hits outside `layout.tsx`.

## Critical notes

- No secrets, tokens, or URLs recorded here.
- No rollback concerns beyond reverting `src/app/dashboard/layout.tsx` — no migration, no data
  change, no API contract change.
- Working tree left uncommitted per the task packet; nothing staged or pushed.
