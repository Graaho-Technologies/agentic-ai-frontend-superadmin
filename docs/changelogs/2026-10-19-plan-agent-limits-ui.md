# 2026-10-19 — Surface agent selection limits in the plan drawer and details modal

A plan's `min_agents_required` / `max_agents_allowed` (`0` = no minimum / unlimited)
already existed end to end — Django model, API, and the `Plan` / `CreatePlanRequest`
TypeScript types (`src/features/subscriptionModel/billing/billingApi.ts:151-152`,
`:220-221`) — and were already settable in one place: the amber **Selection Limits**
modal inside `PlanAgentInclusionManagement.tsx`. A super admin creating or editing a plan
in `CreateEditPlanDrawer` had no way to see or set them, and `PlanDetailsModal` never
displayed them. This is a UI-surfacing change only; no type, API, or backend change was
needed or made.

## Why

Backend enforcement of `max_agents_allowed` is being added in parallel in the sibling
backend repo. The super-admin UI needed to (1) let the limits be set while creating or
editing a plan, and (2) show them wherever a plan's details are displayed, without
touching the existing, working Selection Limits surface.

## What changed

- **`src/components/subscription-model/plan/CreateEditPlanDrawer.tsx`**
  - Added `min_agents_required` / `max_agents_allowed` (string-backed, default `'0'`) to
    `formData` (:44-45), to the new-plan reset branch (:100-101), and to the
    edit-hydration path (:75-76) — see **Clobber hazard** below.
  - Added a new "Agent Selection Limits" section (bordered card, same grouping style as
    the existing "Status Toggles" card) directly after the "Billing Mode & Grace Period"
    grid: two `number` inputs ("Minimum agents required" / "Maximum agents allowed"),
    each `min="0" step="1"`, with helper text `0 = no minimum` / `0 = unlimited` —
    reusing the Selection Limits modal's vocabulary so the two surfaces agree — plus one
    explanatory line that the limits control how many of the plan's linked agents a
    subscriber may use.
  - Added validation in the existing `validateForm` block's style: both fields must be
    non-negative integers; if both are `> 0`, `max_agents_allowed >= min_agents_required`
    is required (same rule as the backend serializer and the existing modal). Deliberately
    does **not** cross-check against the number of linked agents — see **Non-goal** below.
  - Added both keys to the `CreatePlanRequest` submit payload (parsed with `parseInt`,
    defaulting to `0`).

- **`src/components/subscription-model/plan/PlanDetailsModal.tsx`**
  - Added a read-only "Agent Selection Limits" section (same field/row card style as the
    existing Pricing Summary / Included Components sections) showing
    `min_agents_required` as **"None"** when `0`, and `max_agents_allowed` as
    **"Unlimited"** when `0`, rather than printing a bare `0` (which would read as "zero
    agents allowed" — the opposite of the truth). No editing controls added.

No changes to `billingApi.ts`, `PlanAgentInclusionManagement.tsx`, `PlansManagement.tsx`,
or `PlanSummary.tsx`.

## Clobber hazard and how it was avoided

`CreateEditPlanDrawer` builds its `PATCH` payload entirely from `formData`. Before this
change the two limit fields were absent from `formData`, so they were silently absent
from the `PATCH` body on edit — which is exactly why editing a plan today does not
clobber limits set via the Selection Limits modal. Adding the fields to `formData` means
they are now transmitted on **every** edit, so if the drawer did not hydrate them from
the plan being edited, opening any plan and pressing Save would silently reset both
limits to `0`.

**Hydration path:** the single `useEffect` keyed on `[isEditMode, plan, isOpen]` at
`CreateEditPlanDrawer.tsx:64-116` is the only place `formData` is populated from an
existing `Plan` object (the `else` branch of the same effect, :92 onward, is reserved for
the "new plan" reset and sets hardcoded defaults instead). The two new fields are
populated inside the `isEditMode && plan` branch at lines 75-76:

```tsx
min_agents_required: (plan.min_agents_required ?? 0).toString(),
max_agents_allowed: (plan.max_agents_allowed ?? 0).toString(),
```

`??` (not `||`) is used deliberately, per the task packet: a genuine `0` on the plan
(no minimum / unlimited) is a real value and must hydrate as `'0'`, not be treated as
"missing" and silently coerced by a falsy check. `Plan.min_agents_required` and
`Plan.max_agents_allowed` are non-optional `number` fields in
`billingApi.ts:151-152`, so they are always present on a fetched plan; `??` is still the
correct operator because it is the one that cannot misbehave if that ever changes.

Verified by: reading the full `useEffect` (now :64-116) end to end to confirm there is no
second hydration path, confirming the two new lines land inside the `isEditMode && plan`
branch (not the `else`/new-plan branch), and confirming via the `Plan` type definition
that both fields are non-optional numbers so a real API response always carries a value
for `??` to read.

## Non-goal: linked-agent cross-check stays in the Selection Limits modal

The drawer's validation deliberately does not check the limits against the plan's
number of linked agents. At create time a plan has no agents yet and the drawer has no
inclusion list to check against; at edit time duplicating that check in the drawer would
create two sources of truth for the same rule. `PlanAgentInclusionManagement.tsx`'s
`handleSaveLimits` (`:798-847`) already performs this check against `inclusions.length`
and remains the only place it is enforced.

## Affected modules and behaviors

`src/components/subscription-model/plan/CreateEditPlanDrawer.tsx` (create + edit plan
drawer, used from `PlansManagement.tsx`) and `PlanDetailsModal.tsx` (plan details view).
No change to routing, auth, migrations, async tasks, webhooks, or analytics. No backend
file touched (backend enforcement of `max_agents_allowed` is a separate, parallel
workstream).

## Intended outcome

A super admin can set `min_agents_required` / `max_agents_allowed` while creating or
editing a plan in the drawer, and can see both values (with `None` / `Unlimited` for `0`)
in the plan details modal, without the existing Selection Limits modal or its validation
being touched. Signal this did not work: opening an existing plan with non-zero limits
set via the Selection Limits modal, then pressing Save in the drawer without touching the
new fields, resets those limits to `0`.

## Verification

- `npx tsc --noEmit` — exit 0, no output.
- `npm run lint` — same 7 pre-existing warnings as before this change (4×
  `no-img-element` in `LoginPageSettings.tsx`, 3× `exhaustive-deps` in
  `PlanComponentInclusionManagement.tsx`); zero warnings in either edited file.
- `npx next build` — exit 0, `✓ Generating static pages (32/32)`.

**Not verified:** no browser/manual run against a live plan — did not exercise opening an
existing plan with non-zero limits in the running app to visually confirm the inputs
populate and that Save does not clobber them. Confidence rests on the static read of the
hydration `useEffect` above and the type check passing with the new fields wired through
`CreatePlanRequest`.

## Critical notes

- No migration, no API shape change, no new dependency.
- Rollback is reverting the two files; no data implication, since the backend fields and
  the Selection Limits modal are unchanged and remain the authoritative write path if this
  is reverted.
- Follow-up (not in scope here): once backend enforcement of `max_agents_allowed` lands,
  a subscriber-facing surface will need equivalent display work — not part of this slice,
  which is super-admin only.
