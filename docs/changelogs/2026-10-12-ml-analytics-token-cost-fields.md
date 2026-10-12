# 2026-10-12 — ML Analytics: surface the token accounting and cost fields

The ML metrics API (`/api/metrics/<agent_id>/overview` and `/summary` on
`mlapi.koronik.ai`) returns a token-accounting + cost block that existed in neither our
TypeScript types nor the `/dashboard/performance-analytics/ml-analytics` page. Those
fields — `input_tokens`, `cached_input_tokens`, `output_tokens`, `cost_usd`,
`unpriced_requests`, `untracked_tokens`, `total_tokens`, `models[]` — are now typed and
displayed, at the agent level and per endpoint.

## Why

Requested against the running super admin app: the two API responses carry extra fields,
show them in the UI. Three overview fields already in the type were also unsurfaced
(`total_errors`, `error_rate`, `last_request_at`) and are now displayed.

## What changed

- **`src/features/mlAnalytics/mlAnalyticsApi.ts`** — types only; no endpoint, hook, tag or
  baseQuery change.
  - New `MLModelUsage` (`model`, `input_tokens`, `cached_input_tokens`, `output_tokens`,
    `total_tokens`, `cost_usd: string | null`).
  - New `MLTokenBreakdown` carrying the shared block. `MLMetricsOverview`,
    `MLMetricsSummary` and `MLEndpointItem` now `extends` it; the first two also gained
    `total_tokens?`. `MLEndpointItem.total_tokens` stays required, as before.
  - **All new fields are optional.** The dev host (`mlapi-dev.koronik.ai`) is not confirmed
    to send them, and a required field that arrives `undefined` would crash the page on the
    first `.toLocaleString()`.
  - `MLDailyDataPoint` and the `/endpoint` timeseries shape are untouched — the daily
    payload was not provided and was not guessed at.

- **`src/app/dashboard/performance-analytics/ml-analytics/page.tsx`** (single file, as before)
  - Module helpers `formatNumber`, `parseCost`, `formatCost`, `sumModelCost`, `percent` —
    every numeric read tolerates `undefined`, and `cost_usd` is only ever read through
    `parseCost`.
  - Derived: `usage` (`overview ?? summary` — both carry identical blocks),
    `totalTokens` (`overview.total_tokens ?? summary.total_tokens ?? the pre-existing
    endpoint sum`), `modelCostTotal`, `reportedCost`, `displayCost`, `models`,
    `costNotices`. The old endpoint-sum became `endpointTokenSum` and survives as the
    last-resort fallback.
  - Purple date banner now also shows `last_request_at`.
  - Stat row 1: the Total Tokens card was replaced by an **Errors** card (`total_errors`,
    with `error_rate × 100` as its description, red above zero else green).
  - **New stat row 2**: Total Tokens, Input Tokens (cached count + cache share as
    description), Output Tokens, Est. Cost.
  - **New "Token & Cost Breakdown" `ChartCard`** between the Top Endpoint banner and the
    endpoint table: a three-segment composition bar (Input / Output / Untracked), a figure
    list with cached input nested under input, total, cost, unpriced requests, and an amber
    notice.
  - **New "Model Usage" table**: model, input, cached input, output, total, cost, plus a
    totals footer. Empty-state row when `models` is absent or empty.
  - **Endpoint Performance table**: new leftmost expand-chevron column (own `expandedKeys`
    Set state; the button calls `stopPropagation` so expanding does not also change
    `selectedEndpoint`, which still drives the timeseries charts), a new **Cost** column,
    the error rate folded in under the error count, and a per-row detail `<tr>` showing that
    endpoint's input / cached / output / untracked / total tokens, unpriced requests, last
    status code, and its own model table. Placeholder `colSpan` went 9 → 11.

## Decisions worth knowing (both logged in `docs/decisions/DECISIONS.md`)

1. **A null `cost_usd` is never shown as a total.** The prod payload returns
   `cost_usd: null` at the top level while `models[]` price out to $13.35. The UI shows that
   sum but labels it "Sum of priced models · partial" and explains why, because 576.6M of
   698.3M tokens have no model attribution — the $13.35 covers ~17% of the agent's tokens.
2. **`cached_input_tokens` is a subset of `input_tokens`.** Verified arithmetically before
   building: `total_tokens = input + output + untracked` (698,323,023 = 120,736,469 +
   954,609 + 576,631,945) and `Σ models[].total_tokens = input + output = 121,691,078`. So
   the composition bar has exactly three segments and cached input is never summed into a
   total. `error_rate` is likewise a fraction, not a percent (1/2688 → `0.0004`).

## Affected modules and behaviors

Scoped to the ML Analytics page and its RTK Query types. No change to `store.ts`, to
`src/components/performance-analytics/shared/*`, to auth, to the existing timeseries and
"Request Distribution by Endpoint" charts, or to any other feature slice. No new
dependency. `mlAnalyticsApi` keeps its own `fetchBaseQuery` against the ML host rather than
`baseQueryWithReauth` — pre-existing and deliberate, left alone.

## Intended outcome

Opening the page for an agent should now account for every field the two endpoints return:
token split, cache share, untracked volume, per-model spend, and per-endpoint cost — with
the partial-cost caveat visible rather than implied. Signal of failure: a stat card reading
`0` or `—` where the network tab shows a value, or a cost figure presented without the
amber notice while `cost_usd` is null.

## Verification

Run by the orchestrator after reading the full `git diff`, and again after the amber-notice
edit:

- `npx tsc --noEmit` — exit 0, no output.
- `npx eslint src/features/mlAnalytics/mlAnalyticsApi.ts src/app/dashboard/performance-analytics/ml-analytics/page.tsx` — exit 0, no output.
- `npm run lint` (full project) — clean apart from two pre-existing warnings in untouched
  files (`src/components/cms-settings/LoginPageSettings.tsx` `no-img-element`;
  `src/components/subscription-model/plan/PlanComponentInclusionManagement.tsx`
  `react-hooks/exhaustive-deps`).
- `npm run build` — `✓ Compiled successfully in 4.1min`; route
  `/dashboard/performance-analytics/ml-analytics` at 11.6 kB / 246 kB First Load JS.

**Not verified:** the page was not opened against a live ML API in this session, so the
rendering was not observed in a browser — only type-checked, linted and built. The field
semantics were confirmed arithmetically against the payloads supplied in the request, not
by reading the ML backend source.

## Critical notes

- No security, auth or migration surface. Purely additive, read-only display; rollback is
  a revert of the two files.
- Not breaking: because every new field is optional, the page degrades to zeros and `—`
  against an ML API that does not send them, rather than throwing.
- Follow-up: if `/api/metrics/<agent_id>/endpoint` gains the same per-day token block,
  `MLDailyDataPoint` and the three timeseries charts should be extended to match. Needs the
  real daily payload first.
