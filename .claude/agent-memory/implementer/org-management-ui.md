---
name: org-management-ui
description: OrgAgentConfigManager.tsx three-pane picker pattern, comma-separated alias input trap, and the org-filter-by-sub_id inference
metadata:
  type: project
---

Verified building `src/components/org-management/OrgAgentConfigManager.tsx` +
`src/app/dashboard/org-management/page.tsx` (2026-10-18), consuming
`src/features/orgManagement/{orgManagementApi,orgManagementApi.types,domainLexicon}.ts`
(landed by a parallel worker in the same session — contract matched exactly, `npx tsc
--noEmit` was clean end-to-end, not just "missing module" clean).

- **Comma-separated alias input trap.** A row editor whose "aliases" field is a comma-list
  must NOT store the array and derive the input's `value` from `aliases.join(', ')` on every
  keystroke — split/trim/filter-empty on each `onChange` eats a trailing `", "` the instant
  it's typed, so the admin can never start a second alias. Store the raw comma string as its
  own piece of row state (e.g. `{ canonical, aliasesText }`) and only derive the committed
  `string[]` at commit points (tab switch, save, dirty-check), never on every keystroke.
- **Org-to-instance linking is inference, not a join.** When an instances endpoint has no
  org filter and only exposes a creator's `user_sub_id`, narrow client-side via `new
  Set(members.map(m => m.sub_id))` and filter instances where `user_sub_id` is non-null and
  in that set — then always provide an escape hatch (a one-click "show all instead" toggle)
  for when the inference comes up empty, rather than a dead-end empty state. See
  [[dashboard-ui-idioms]] for the loading/error/empty shells this nests inside.
- **Dual-representation tab editor (rows vs raw JSON).** Keep one canonical pure
  module-level seed function (`seedConfigFromInstance`, not a component closure) so both the
  re-seed `useEffect` and a "Reset" button call the identical logic without the function
  itself becoming a `useEffect` dependency problem — mirrors `extractErrorMessage`/
  `setsAreEqual` being module-level in `ModuleAccessManager.tsx`. Tab-switch handlers convert
  between representations only at the switch boundary (Raw→Rows blocked and left on Raw tab
  if invalid JSON; Rows→Raw always succeeds via `JSON.stringify(entries, null, 2)`).
- `module-access/page.tsx`'s content wrapper `max-w-[1100px]` is sized for its 2-column
  layout; a 3-pane (org/instance/config) page needs more room — used `max-w-[1600px]`
  instead. Note this as a deliberate deviation if the orchestrator diffs against the anchor
  literally.
