# 2026-10-13 — Plan Components: per-unit prices accept more than 6 decimal places

A super-admin could type `0.000000155` into **Cost Per Unit** on the Create/Edit Component
modal (`/dashboard/subscription-model` → Plan Components) and the value would never reach
the server. Four separate things were dropping it; all four are fixed, plus the matching
backend precision cap (see the companion entry in `graaho-ai-agent-backend`,
`docs/changelogs/2026-10-13-plan-component-unit-price-precision.md`).

## Why

Reported against the running super admin app, with a screenshot of the Create Component
modal: Cost Per Unit `0.000000155`, Price Per Unit `0.00000031`, 1,000,000 compute tokens —
"this value is not being taken, it has to take this value."

Token-level unit economics genuinely need sub-micro-dollar precision. $0.155 per 1M tokens
is `0.000000155` per token — 9 decimal places. The old 6-dp ceiling could only express
`0.000000`, i.e. free.

## What changed

- **`src/components/subscription-model/plan/PlanComponentsManagement.tsx`**
  - **`step="0.000001"` → `step="any"`** on both per-unit `<input type="number">`
    (`:920` Cost Per Unit, `:936` Price Per Unit). **This was the primary defect.** The
    modal's `<form onSubmit>` (`:740`) has no `noValidate` and its Create button (`:1069`)
    is `type="submit"`, so a step-mismatched value makes the browser refuse to submit at
    all. Cost Per Unit is the first invalid field in document order, which is exactly why
    the user saw it fail there and nowhere else — Price Per Unit was equally invalid but
    never got reached.
  - **`buildSubmitData` (`:370-371`) now sends the trimmed string, not `parseFloat`.**
    `parseFloat('0.000000155')` is `1.55e-7`, which `JSON.stringify` writes as `1.55e-7`.
    `CreatePlanComponentRequest.cost_per_unit` / `.price_per_unit` were already typed
    `number | string | null`, so no API-type change was needed. `quantity` and
    `discount_percentage` still go through `parseFloat` — unchanged.
  - **`formatCurrency` (`:444`) no longer truncates at `toFixed(6)`.** It now renders every
    significant decimal up to 10, with a 2-dp minimum and no exponent fallback:
    `0.000000155 → $0.000000155`, `20 → $20.00`, `0.5 → $0.50`, `null`/`''`/`NaN → $0.00`.
    A `Number.isFinite` guard was added (the old body would emit `$NaN`).
  - **Total Cost caption (`:966`)** now calls `formatCurrency(formData.price_per_unit)`
    instead of `.toFixed(6)`. It used to read `$0.000000 × 1,000,000` beside a `$0.31`
    total, which looked broken even when the arithmetic was right.
- **`src/components/subscription-model/plan/PlanComponentInclusionManagement.tsx`** — only
  the small-value branch of `formatUnitPrice` (`:109`, `Math.abs(num) < 0.01`), which had
  the same `toFixed(6)` truncation and renders the same `component.cost_per_unit` /
  `.price_per_unit` at `:405`, `:1081`, `:1085`, `:1396`. Left alone otherwise:
  `formatMoney` and the `>= 0.01` branch.

## Affected modules and behaviors

Plan Components create/edit/list, and the component cost/price readouts on the Plan
Component Inclusion page. No RTK Query endpoint, hook, tag, cache or baseQuery change; no
store change. Nothing in auth, migrations-on-this-side, async tasks, webhooks or analytics
is touched.

Existing saved components re-render through the widened `formatCurrency`, so a value stored
as `20.000000` still reads `$20.00`, but one stored as `0.000001` now reads `$0.000001`
instead of `$0.000001` — unchanged — while anything finer than 6 dp (only possible after
the backend migration lands) becomes visible for the first time.

## Intended outcome

Entering `0.000000155` in Cost Per Unit and clicking Create saves a component whose Cost
column reads `$0.000000155`. Signal it did not work: the Create button does nothing on
click (step still rejecting), or the server returns 400 `"Ensure that there are no more
than N decimal places"` (backend migration not applied).

## Verification

Run in this repo on `super-dev`:

- `npx tsc --noEmit -p tsconfig.json` — exit 0, zero output.
- `npm run lint` — 0 errors. 7 warnings, all pre-existing and unrelated: 4
  `@next/next/no-img-element` in `cms-settings/LoginPageSettings.tsx`, 3
  `react-hooks/exhaustive-deps` in `PlanComponentInclusionManagement.tsx` at `:584`/`:597`
  (hook dependency arrays, far from the `formatUnitPrice` helper at `:105-114`).
- `formatCurrency` logic run directly under `node` against
  `0.000000155 / 0.0000001550 / 0.00000031 / 20 / "20.000000" / 0.5 / 0 / null / "" /
  "abc" / 1234.5678901234` — all outputs as specified above.

**Not verified:** no browser run and no live API call. The end-to-end save depends on the
backend migration below being applied, which did not happen in this session.

## Critical notes

- **Blocked on a backend migration.** `apps/agents/migrations/0081_widen_plan_component_unit_precision.py`
  is written but **unapplied**. Until `python manage.py migrate agents` runs, posting
  `0.000000155` still returns 400. Deploy the backend first or the frontend fix looks like
  it did nothing.
- **`PlanComponent.total_cost` is still `decimal_places=2`.** The server auto-calculates it
  as `cost_per_unit × quantity` on save (`agents/models/pricing.py:392`) into a 2-dp column,
  so `0.000000155 × 1,000,000` stores as `$0.16`, and small quantities round to `$0.00`.
  Deliberately out of scope — raise separately if cent-level rollups are not good enough.
- **Known inconsistency, left alone:** the modal's live Total Cost preview computes
  `price_per_unit × quantity` (`:960`) while the server stores `cost_per_unit × quantity`.
  The preview can therefore disagree with the table after save ($0.31 vs $0.16 for the
  reported component). Reported to the user and explicitly deferred, not fixed here.
- No breaking change, no rollback hazard on this side — reverting the two files restores
  the old behaviour with no data implication.

---

## Addendum, same session — Agent Component Pricing: Override Price

Follow-up report: "Price Per Unit same here too." Price Per Unit on the Create Component
modal was already covered above (`step="any"` at `:936`, exact string at `:371`, widened
`formatCurrency`, backend `PlanComponent.price_per_unit` → `numeric(20,10)`). But a sweep
for the same defect found it intact on a second page, plus a regression the first slice
introduced.

### What changed

- **`src/components/subscription-model/plan/AgentComponentPricingManagement.tsx`** — the
  **Override Price** field, which overrides a component's `price_per_unit` per agent:
  - `step="0.000001"` → `step="any"` on both of its inputs (`:597` in
    `SelectableAddComponentCard`, `:1029` in the edit modal). Both sit in a
    `<form onSubmit>` (`:738`, `:917`) with a `type="submit"` button and no `noValidate`,
    so this was the same silent submit block as the Plan Components form.
  - Both submit paths send the trimmed exact string instead of `parseFloat`: `:700`
    (add-components modal) and `:1323` (the `PATCH` `JSON.stringify` body).
    `AddComponentItem.override_price` (`:465`) widened `number | null` →
    `number | string | null`.
  - `formatPrice` (`:80`) was `toFixed(4)` — it rendered `0.000000155` as `$0.0000`. Now
    trims to significant digits up to 10 dp. **This file keeps a 4-dp minimum and its
    `'$0.0000'` null return**, unlike `formatCurrency`'s 2-dp minimum, so ordinary prices
    on this page look exactly as before (`20 → $20.0000`, `0.5 → $0.5000`). It also handles
    exponent-form input, which matters here: `effective_price_per_unit` is serialized by
    `get_effective_price_per_unit` as a Python `float`, so `1.55e-7` arrives over the wire.
- **Backend `apps/billing/serializers/pricing.py`, `AgentComponentPricingSerializer`:**
  - **`base_price_per_unit` (`:395`) — regression fix.** It is a read-only
    `DecimalField(source='component.price_per_unit', max_digits=10, decimal_places=6)`.
    Once the first slice widened `component.price_per_unit` to 10 dp, this declaration
    truncated it **back to 6 dp on output**, so this endpoint would have reported
    `"0.000000"` for a component the Plan Components page displayed correctly. Widened to
    `(20, 10)`.
  - `override_price` (`:411`) widened to `(20, 10)` to match its model.
- **Backend `apps/agents/models/billing.py`** — `AgentComponentPricing.override_price`
  `(10, 6)` → `(20, 10)`, plus migration
  `apps/agents/migrations/0082_widen_agent_component_override_price.py` (depends on `0081`).

### Verification

- `npx tsc --noEmit -p tsconfig.json` — exit 0, zero output.
- `npm run lint` — 0 errors, nothing in `AgentComponentPricingManagement.tsx`; the same 7
  pre-existing warnings as above.
- `formatPrice` run under `node`: `0.000000155 → $0.000000155`, `1.55e-7 → $0.000000155`,
  `"0.0000001550" → $0.000000155`, `0.00000031 → $0.00000031`, `20 → $20.0000`,
  `0.5 → $0.5000`, `0`/`null`/`undefined`/`"abc"` → `$0.0000`.
- `python3 -m py_compile` on the two backend files and the new migration — exit 0.
- Migration graph re-checked by script: `0082` is the sole leaf of `agents` (`0077` and
  `0028` only *look* like leaves to a single-quote regex — their dependents declare them
  with double quotes).

**Still not verified:** no browser run, no live API call, no `migrate`.

### Critical notes

- **Two migrations now, in order: `0081` then `0082`.** Both unapplied.
- **Not fixed, reported only:** `apps/subscriptions/views/subscription_views.py`
  (`:497-499`, `:1391-1397`) and `apps/agent_management/views/agent_template_views.py`
  (`:592-594`) build raw dicts with `float(component.price_per_unit)`. Those are org-facing
  endpoints, outside the super-admin surface. A float round-trips the value but serializes
  tiny ones in exponent form (`1.55e-07`); any consumer doing a fixed `toFixed(n)` on them
  has the same display bug this session fixed three times.
