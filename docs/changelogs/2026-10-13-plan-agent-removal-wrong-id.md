# 2026-10-13 — Plan Agents: the Remove button sent the wrong id

On `/dashboard/subscription/plans`, opening a plan's **Agents** modal and pressing the trash
button on an assigned agent did nothing — the row stayed. The DELETE was being sent to a URL
built from the wrong entity's id, so the server never found the row to delete.

## Why

Reported against the running super admin app: "in this modal the agents that are linked or
assigned — pressing the delete button doesn't work."

## Root cause

The backend route (`graaho-ai-agent-backend`,
`apps/subscriptions/views/subscription_views.py:1047`) is

```python
@action(detail=True, methods=['get', 'put', 'delete'], url_path='agents/(?P<inclusion_id>[^/.]+)')
def manage_agent(self, request, pk=None, inclusion_id=None):
    ...
    inclusion = PlanAgentInclusion.objects.get(id=inclusion_id, plan=plan)
```

The final URL segment is a **`PlanAgentInclusion.id`** — the join row. The frontend sent
`inclusion.agent_pricing?.agent_id` instead, a different entity's id, so the lookup raised
`DoesNotExist` and the endpoint returned `404 {'error': 'Agent inclusion not found in this plan'}`.

Two things kept it invisible:

- `handleRemove`'s catch read only `apiError?.data?.detail`. This endpoint puts its message
  under `error`, so the real reason was swallowed and the generic fallback string showed
  instead — and `ApiErrorResponse` (`:26-32`) already declared `error`, so nothing in the
  types flagged it.
- The call site ended in `?? ''`, which would have sent `/plans/<id>/agents//` for a missing
  id rather than failing loudly.

**The backend is correct and was not changed.** Both working siblings already did this
right, which is what confirmed the diagnosis: `updatePlanAgentInclusion`
(`billingApi.ts:970`) uses the same URL shape with `inclusionId`, and the components version
of this very operation passes `componentId: inclusionId`
(`PlanComponentInclusionManagement.tsx:779`). Only the agent *removal* path was wrong.

## What changed

- **`src/features/subscriptionModel/billing/billingApi.ts`** — `removeAgentFromPlan`
  (`:999`): argument `agentId` → `inclusionId` in the mutation type, the `query`
  destructure, and the URL template. Added `{ type: 'PlanAgentInclusion', id: inclusionId }`
  to `invalidatesTags`, matching `updatePlanAgentInclusion`. Method, `admin_id` param and
  the three existing tags unchanged.
- **`src/components/subscription-model/plan/PlanAgentInclusionManagement.tsx`** —
  `handleRemove` (`:1015`) now passes `inclusionId: inclusion.id`; the `?? ''` fallback is
  gone, since `id` is a required `string` on `PlanAgentsResponse['agents'][number]`. Both
  `handleRemove`'s catch and the update handler's catch (`:1004`) now read
  `detail || error || message` before the fallback string.

The rename is load-bearing, not cosmetic: calling the field `agentId` is what made the wrong
value look right at the call site.

## Affected modules and behaviors

The Agents modal on the Plans page (`PlansManagement.tsx:1415` renders
`PlanAgentInclusionManagement` embedded), and the same component's standalone page. No
backend change, no other endpoint, no store or tag-type change. Plan agent counts on the
Plans list refresh through the existing `Plan` / `PlanSummary` invalidations, which already
fired — they just had nothing to refresh before.

## Intended outcome

Pressing Remove on an assigned agent deletes the inclusion, the row disappears, and the
success message names the agent. Signal it did not work: the row stays, or the alert now
names a real server reason instead of the generic string.

## Verification

- `npx tsc --noEmit -p tsconfig.json` — exit 0, zero output. The `agentId` → `inclusionId`
  rename would have failed the type check at any missed call site.
- `npm run lint` — 0 errors; the same 7 pre-existing warnings as the other entries today,
  none in either edited file.
- `grep -rn "removeAgent(\|agentId:" src/.../PlanAgentInclusionManagement.tsx src/features/.../billingApi.ts`
  — one `removeAgent(` call site, already on `inclusionId`. The remaining `agentId:` hits are
  `addComponentToAgent` / `updateAgentComponent` / `removeComponentFromAgent`, where the
  value genuinely is an agent id.

**Not verified:** no browser run and no live API call — the delete was not exercised against
a real plan. Confidence rests on the backend route reading `inclusion_id` and on the two
working siblings using the same shape.

## Critical notes

- Deploys independently of the per-unit precision work also done today; no migration, no
  ordering constraint between them.
- Rollback is reverting the two files; no data implication. Note that until this ships, the
  only way to remove an agent from a plan is outside the UI.
