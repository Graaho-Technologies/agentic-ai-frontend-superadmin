---
name: sidebar-layout
description: How to add a top-level nav entry to src/app/dashboard/layout.tsx without disturbing the rest of the file
metadata:
  type: project
---

Verified against `src/app/dashboard/layout.tsx` on branch `eks_dev` (2026-10-19). Updated
after the Org Management/Module Access/Workspaces accordion merge (2026-10-19) — Workspaces
and Module Access are no longer standalone top-level items; see below. Updated again
(2026-10-19) after every inline `<svg>` and emoji icon was replaced with named
`lucide-react` components — see [[lucide-icon-replacement]].

- All routes are declared once in a `NAV_ROUTES` const near the top of the file. Grouped
  sections (Performance Analytics, Subscription Model, CMS Settings, Settings, Org
  Management) are nested objects; standalone top-level items (Agent Templates, Demo Users)
  are flat string keys built from `${BASE}/...`.
- **Groups whose routes share no common URL prefix** (e.g. Org Management:
  `/dashboard/org-management`, `/dashboard/module-access`, `/dashboard/workspaces` — no
  shared prefix) cannot use `groupBtnCls(prefix)` / `isGroupActive(prefix)` (which is
  `pathname.startsWith(prefix)`). The fix used: `groupBtnCls` is split into
  `groupBtnClsFor(active: boolean)` (the one copy of the class string) plus
  `groupBtnCls(prefix) = groupBtnClsFor(isGroupActive(prefix))` as a thin wrapper for the
  prefix-based groups. A non-prefix group computes its own boolean (e.g.
  `ORG_MANAGEMENT_ROUTES.some((href) => pathname === href)`, exact equality since those
  routes are flat single pages with no nested sub-routes) and calls `groupBtnClsFor(bool)`
  directly. Reuse this split rather than re-deriving a new class string.
- A top-level nav item is exactly this shape — no wrapper div needed, just a `<Link>`
  directly inside `<nav>`:
  ```tsx
  <Link href={NAV_ROUTES.x} className={linkCls(NAV_ROUTES.x)}>
    <IconName className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
    <span className="font-medium">Label</span>
  </Link>
  ```
  `linkCls(href)` (defined once, ~line 118) handles the active/inactive styling — don't
  redefine it per item. Icons are `lucide-react` components (no more inline `<svg>` or
  emoji) — never pass `fill`/`stroke`/`color`/`viewBox`; they inherit `currentColor` from
  the surrounding text class, which is how active/inactive recolouring still works.
  Sub-item arrays (inside a group's `.map()`) use an `Icon:` field (capital I) holding the
  component reference, not a JSX element — destructure as `{ href, label, Icon }` and
  render `<Icon className="w-4 h-4 flex-shrink-0" aria-hidden="true" />`.
  A collapsible group (used for Performance Analytics/Subscription/CMS/Settings) is a much
  bigger pattern (button + `useState` open flag + `submenuContainerCls`) — only reach for
  it if the packet actually asks for a group with sub-items.
- When a packet says "add the nav entry and nothing else," the two-part edit is: (1) one
  new line in `NAV_ROUTES`, (2) one new `<Link>` block placed by name relative to an
  existing item (e.g. "after Demo Users, before Performance Analytics" — find the existing
  `{/* Demo Users */}` and `{/* Performance Analytics */}` comments as anchors). Do not
  touch `useEffect`/`useState` blocks tracking group-open state unless the new item is
  itself a group.
