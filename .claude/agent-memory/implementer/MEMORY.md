# Implementer Memory Index

- [Backend RBAC repo notes](backend_rbac_repo.md) — the Django backend lives in a sibling repo, not this frontend checkout; test/migration commands and traps.
- [Frontend RBAC sibling repo](frontend_rbac_sibling_repo.md) — org-admin module-access UI lives in another sibling repo (graaho-ai-agent-frontend); assignable-gate pattern, test/lint traps.
- [Dashboard UI idioms](dashboard-ui-idioms.md) — this repo's page/card/table conventions.
- [Sidebar layout](sidebar-layout.md) — how a nav entry is added in src/app/dashboard/layout.tsx.
- [RTK Query conventions](rtk-query-conventions.md) — createApi slice shape and store registration.
- [Agent template drawer](agent-template-drawer.md) — SuperAdminCreateAgentTemplateDrawer.tsx's 4-site FormData sync trap and agentTemplateApi.ts's duplicated template-shape surface.
- [Progressive loading pattern](progressive-loading-pattern.md) — split cheap-query gating from expensive-query per-section pending/error notes; collapsed `<details>` for audit text on non-technical pages.
- [Org management UI](org-management-ui.md) — three-pane org/instance/config picker, comma-list input trap, org-by-sub_id inference + escape hatch.
