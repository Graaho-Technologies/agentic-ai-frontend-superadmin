---
name: plan-drawer-field-sync
description: CreateEditPlanDrawer.tsx's formData has 3 sync sites for any plan field (initial state, new-plan reset branch, edit-hydration branch) — same trap shape as [[agent-template-drawer]].
metadata:
  type: project
---

`src/components/subscription-model/plan/CreateEditPlanDrawer.tsx` builds its create/update
payload entirely from `formData`, and has a single `useEffect` keyed on
`[isEditMode, plan, isOpen]` (currently ~line 64-116) with two branches: `isEditMode && plan`
hydrates from the plan being edited, `else` resets to new-plan defaults. Any field added to
`formData` needs the key added in **three** places: the `useState` initializer, the
`else` (new-plan) branch, and the `isEditMode && plan` (edit-hydration) branch.

**Why this matters:** the drawer's `PATCH` payload is assembled from whatever is in
`formData` — a field present in `formData` but absent from the edit-hydration branch
silently submits a default (often `0`/`''`) on every edit of an existing plan, clobbering
whatever was set through another UI surface (e.g. the amber Selection Limits modal in
`PlanAgentInclusionManagement.tsx` sets `min_agents_required`/`max_agents_allowed` directly
via `updatePlan`, bypassing this drawer entirely).

**How to apply:** when a field can legitimately be `0` (a count/limit, not a flag), hydrate
with `plan.field ?? 0`, never `plan.field || 0` — `||` treats a real `0` as missing and
masks the exact clobber bug this trap causes. Verified 2026-10-19 while adding
`min_agents_required`/`max_agents_allowed` to the drawer and `PlanDetailsModal.tsx`
(`docs/changelogs/2026-10-19-plan-agent-limits-ui.md`).
