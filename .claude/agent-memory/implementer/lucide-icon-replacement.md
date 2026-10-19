---
name: lucide-icon-replacement
description: lucide-react is pinned to 1.59.0 in this project; icon names differ from newer lucide docs — verify against the installed .d.ts, not memory or docs.
metadata:
  type: project
---

`lucide-react@1.59.0` is a real pinned runtime dependency (not a devDependency), first
consumed in `src/app/dashboard/layout.tsx` (2026-10-19, replacing all inline `<svg>` icons and
emoji in the sidebar — see [[sidebar-layout]] and
`docs/changelogs/2026-10-19-sidebar-lucide-icons.md`).

- **`Building2` does not exist in this version** — the building icon here is `BuildingComplex`.
  Newer lucide docs/examples reference `Building2`; copying that name against this pin fails at
  build time ("has no exported member").
- Before using any icon name, verify it is actually exported by this installed version:
  `grep "declare const <Name>:" node_modules/lucide-react/dist/lucide-react.d.ts`. Do not trust
  icon names from memory, from online docs, or from a different project — the API surface
  shifts between lucide major/minor versions.
- Icons are stroke-based, inherit `currentColor` — never pass `fill`/`stroke`/`color`/`viewBox`
  props; size/color is controlled entirely via `className` (`w-5 h-5`, `w-4 h-4`, etc.) and the
  surrounding text-colour class.
