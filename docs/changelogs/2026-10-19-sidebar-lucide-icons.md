# 2026-10-19 — Sidebar: replace inline SVGs and emoji with lucide-react icons

## Why

The super-admin sidebar (`src/app/dashboard/layout.tsx`) mixed two icon styles: hand-rolled
inline `<svg>` paths for every top-level entry, group-header button, and the five chevrons, and
raw emoji characters (`🤖`, `🔐`, `🗂️`, `📊`, `⚡`, `🔗`, `🐌`, `📋`, `🗄️`, `🏢`, `🧠`, `🧩`, `💰`,
`👁️`, `👤`, `📑`) for every sub-item in the five accordion groups. This is visually
inconsistent across operating systems/browsers (emoji render differently per platform) and
each inline `<svg>` carries its own hand-copied path data with no single source of truth.
Replacing both with named icons from one library (`lucide-react`) gives the whole nav a single,
professional, consistently-stroked icon set.

## What changed

**Only `src/app/dashboard/layout.tsx`.** No routes, state, accordion logic, auth guard, styling
helpers (`linkCls`, `groupBtnCls`, `groupBtnClsFor`, `submenuContainerCls`, `subLinkCls`), or the
create-template drawer were touched. Every label's wording and every item's order is unchanged.
The brand logo (`/graaho_logo.png`) and the avatar (`/man_place_holder.png`) are untouched
`next/image` images, not icons — left exactly as they were, `Image` import kept.

- Added one alphabetised named import of 27 icon components from `lucide-react` at the top of
  the file.
- Replaced every inline `<svg>` — 2 top-level links, 5 group-header icons, 5 chevrons, 1
  logout icon (13 total) — with the matching lucide component, each at
  `className="w-5 h-5 flex-shrink-0"` (or `w-4 h-4` for the chevrons), `aria-hidden="true"`, no
  `fill`/`stroke`/`color`/`viewBox` props.
- In each of the five sub-item `as const` arrays, renamed the `icon: '<emoji>'` field to
  `Icon: <Component>` (capital `I`, so JSX treats it as a component reference), updated each
  `.map()` destructure from `({ href, label, icon })` to `({ href, label, Icon })`, and replaced
  the `<span className="text-sm">{icon}</span>` emoji wrapper with
  `<Icon className="w-4 h-4 flex-shrink-0" aria-hidden="true" />`. The label `<span>` is
  unchanged. Column alignment of `label:` / `Icon:` in the array literals was preserved.
- No naming collision: the file already has a `settings` key in `NAV_ROUTES` and a
  `settingsOpen` state variable, but neither is the capitalized `Settings` import, and no other
  module-scope identifier named `Route`, `Settings`, `Users`, or `Activity` existed before this
  change (checked by grepping the file for those four identifiers before editing). No import
  alias was needed.

### Full label → icon mapping

**Top-level entries**

| Sidebar entry | Icon |
|---|---|
| Agent Templates | `LayoutTemplate` |
| Demo Users | `Users` |
| Org Management (group) | `BuildingComplex` |
| Performance Analytics (group) | `Activity` |
| Subscription Model (group) | `CreditCard` |
| CMS Settings (group) | `LayoutPanelTop` |
| Settings (group) | `Settings` |
| Logout | `LogOut` |
| All five chevrons | `ChevronDown` |

**Org Management sub-items**

| Label | Icon |
|---|---|
| Agent Config | `SlidersHorizontal` |
| Module Access | `ShieldCheck` |
| Workspaces | `LayoutGrid` |

**Performance Analytics sub-items**

| Label | Icon |
|---|---|
| Overview Dashboard | `LayoutDashboard` |
| Response Time Analysis | `Timer` |
| Endpoint Performance | `Route` |
| Slow Requests | `Hourglass` |
| Status Codes | `ListChecks` |
| Database Queries | `Database` |
| Organization Analytics | `Building` |
| Agent Analytics | `Bot` |
| ML Server Analytics | `BrainCircuit` |

**Subscription Model sub-items**

| Label | Icon |
|---|---|
| Components | `Puzzle` |
| Agent Pricing | `BadgeDollarSign` |
| Plans | `ClipboardList` |
| Plan Preview | `Eye` |

**CMS Settings sub-items**

| Label | Icon |
|---|---|
| Login Page | `LogIn` |

**Settings sub-items**

| Label | Icon |
|---|---|
| Manage User | `UserCog` |
| Summary | `FileText` |

## Affected modules and behaviors

- Only `src/app/dashboard/layout.tsx`. No API slice, Redux store, auth guard, or page component
  touched.
- **`lucide-react@1.59.0` is a new runtime dependency.** It was installed prior to this session
  (`package.json` / `package-lock.json` already reflected `"lucide-react": "^1.59.0"` in the
  working tree before this edit began); this session only consumes it. No other dependency was
  added or changed.
- Lucide icons are **stroke-based** and render using `currentColor` by default (no `fill`,
  `stroke`, `color`, or `viewBox` props were passed to any icon in this change). This is why the
  existing active/inactive text-colour states (`text-[var(--color-primary-purple)]` when active,
  `text-gray-700` / `text-gray-600` when inactive, set by `linkCls`, `groupBtnClsFor`, and
  `subLinkCls`) continue to colour the icons correctly with zero icon-level colour props — the
  icon just inherits whatever `color` the surrounding `<Link>`/`<button>` text is rendered in.
- **`Building2` does not exist in `lucide-react@1.x`** — this version's building icon is named
  `BuildingComplex` instead. Anyone copying an icon-name snippet from newer lucide docs/examples
  (which reference `Building2`) will get a build-time "has no exported member" error against this
  pinned version. Confirmed by grepping
  `node_modules/lucide-react/dist/lucide-react.d.ts` for `declare const Building`: only `Building`
  and `BuildingComplex` are declared, not `Building2`.

## Intended outcome

The sidebar renders with zero `<svg>` elements and zero emoji characters — every icon is a
lucide-react component — with no visual regression in layout, spacing, sizing, or colour
behavior (icons still recolour on hover/active the same way the old `<svg fill="currentColor">`
and emoji text did). Signal that it worked: `grep -c "<svg" src/app/dashboard/layout.tsx` prints
`0`, the emoji-field/emoji-span grep finds nothing, and the production build still generates all
32 static pages.

## Verification

Run from the repo root (`/Users/golamkibriaanik/Desktop/graaho-ai/graaho-ai-agent-frontend-super-admin`):

- `npx tsc --noEmit` — **PASS**, exit 0, no output.
- `npm run lint` — **PASS**, exit 0. Only the same 7 pre-existing warnings as baseline:
  `LoginPageSettings.tsx` 4× `no-img-element`, `PlanComponentInclusionManagement.tsx` 3×
  `react-hooks/exhaustive-deps`. Zero new warnings — no unused-import warnings, confirming all
  27 imported icons are referenced.
- `npx next build` — **PASS**, exit 0. `✓ Generating static pages (32/32)` and the full route
  table printed, unchanged shape from before this change (same 29 `/dashboard/...` routes plus
  `/`, `/_not-found`, `/auth`, `/dashboard`).
- `grep -c "<svg" src/app/dashboard/layout.tsx` → `0`.
- `grep -nE "icon: '|text-sm\">\{icon\}" src/app/dashboard/layout.tsx` → no output (nothing
  found).
- Import-usage check: counted occurrences of each of the 27 imported names as either a direct
  JSX tag (`<Name `) or as an `Icon: Name` array-literal value — every one of the 27 names
  appears exactly once in one of those two forms (`ChevronDown` appears as `<ChevronDown ` 5
  times, once per group), confirming the import list is exactly the set of icons actually
  rendered, with none unused and none missing.

## Critical notes

- No secrets, tokens, or PII recorded here.
- No rollback concerns beyond reverting `src/app/dashboard/layout.tsx` and, if desired,
  `lucide-react` from `package.json`/`package-lock.json` — no migration, no data change, no API
  contract change, no route change.
- `lucide-react@1.59.0` is now an actual runtime dependency of the shipped bundle (not just a
  devDependency) — it is imported into the dashboard layout that wraps every protected page, so
  it is in the bundle for every authenticated route.
- Working tree left uncommitted per the task packet; nothing staged or pushed.
