---
name: agent-limit-modal-wording
description: Org-facing frontend's two 402 upgrade modals (AgentInstanceDrawer, agents/page.tsx UpgradeRequiredModal) switch wording on backend limit_type === 'agents'; backend's instance-limit message text does not match the frontend's hardcoded fallback sentence.
metadata:
  type: project
---

In `graaho-ai-agent-frontend` (org-facing, not this super-admin repo — see
[[frontend-rbac-sibling-repo]]), `Plan.max_agents_allowed` added a second 402 shape from
`POST /agent-instances/` alongside the pre-existing per-agent instance-limit 402. Both share
`limit_reached`/`upgrade_required`/`created_instances_count`/`included_instances`/
`max_allowed`, but only the new agent-cap response sends `limit_type: "agents"`. As of
2026-10-19, `src/components/dashboard/AgentInstanceDrawer.tsx`'s limit modal and
`src/app/dashboard/agents/page.tsx`'s `UpgradeRequiredModal` both derive
`isAgentLimit = limitData.limit_type === 'agents'` and switch heading/paragraph/row-label
text on it.

**Trap for the next person touching this area:** the backend
(`apps/agent_management/views/agent_instance_views.py`, in
`graaho-ai-agent-backend`) sends a non-empty `message` field on **every** 402, including the
pre-existing instance-limit one — but that message's text
(`"You have reached your plan limit of {n} instance{s} for this agent. Please upgrade your
plan to create more instances."`) does not match the frontend's hardcoded fallback sentence
(`"Your plan includes {n} instance{s} for this agent. Upgrade your plan to create more
instances."`). If a future change renders `message` whenever it's present (the literal, more
obvious reading of "show the backend's message"), it silently changes the instance-limit
modal's text — a real regression, not a hypothetical one. Both files gate the
`message`-rendering branch on `isAgentLimit && message-present`, not just
`message-present`, specifically to avoid this. Keep that double gate if touching this code
again; verify the current backend message text by grepping that file directly rather than
trusting this note, since it can drift.
