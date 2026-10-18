// src/features/orgManagement/orgManagementApi.ts
import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQueryWithReauth } from "@/lib/api/baseQueryWithAuth";
import type {
  OrgAgentInstanceSummary,
  OrgManagementApiErrorBody,
  OrgWorkspaceSummary,
  UpdateDynamicConfigArgs,
  UpdateDynamicConfigResponse,
  WorkspaceMembersResponse,
} from "./orgManagementApi.types";

// Raw page shape shared by `workspaces/` and `agent-instances/` — both are
// `{count, next, previous, results[], ...}`, plus whatever extra fields
// (`admin_user`, `summary`) a given endpoint tacks on, which the walkers
// below ignore.
interface RawPaginatedPage<T> {
  next: string | null;
  results: T[];
}

const isRawPaginatedPage = <T>(value: unknown): value is RawPaginatedPage<T> =>
  typeof value === "object" &&
  value !== null &&
  "results" in value &&
  Array.isArray((value as { results?: unknown }).results);

// Hard backstop against a backend regression that stops paginating (e.g. a
// `next` link that never resolves to null) inflating a single UI call into
// an unbounded fetch loop.
const MAX_WORKSPACE_PAGES = 50;
const MAX_AGENT_INSTANCE_PAGES = 50;

export const orgManagementApi = createApi({
  reducerPath: "orgManagementApi",
  baseQuery: baseQueryWithReauth,
  tagTypes: ["OrgWorkspace", "OrgWorkspaceMembers", "OrgAgentInstance"],
  endpoints: (builder) => ({
    // `workspaces/` paginates 20/page with no `page_size` override, and the
    // org picker needs the complete list in one call, so this walks pages
    // by hand via `fetchWithBQ` until the backend reports `next: null`.
    getAllWorkspaces: builder.query<OrgWorkspaceSummary[], void>({
      queryFn: async (_arg, _api, _extraOptions, fetchWithBQ) => {
        const results: OrgWorkspaceSummary[] = [];
        let page = 1;

        while (page <= MAX_WORKSPACE_PAGES) {
          const pageResult = await fetchWithBQ({
            url: `workspaces/?page=${page}`,
            method: "GET",
          });

          if (pageResult.error) {
            return { error: pageResult.error };
          }

          if (!isRawPaginatedPage<OrgWorkspaceSummary>(pageResult.data)) {
            return {
              error: { status: "CUSTOM_ERROR", error: "Invalid response format from workspaces/" },
            };
          }

          results.push(...pageResult.data.results);

          if (!pageResult.data.next) {
            break;
          }
          page += 1;
        }

        return { data: results };
      },
      providesTags: ["OrgWorkspace"],
    }),

    getWorkspaceMembers: builder.query<WorkspaceMembersResponse, string>({
      query: (workspaceId) => ({
        url: `workspaces/${workspaceId}/members/`,
        method: "GET",
      }),
      providesTags: (result, error, id) => [{ type: "OrgWorkspaceMembers", id }],
    }),

    // The superadmin agent-instance list is unfiltered by organization —
    // the backend exposes no org filter on `agent-instances/` for a
    // superadmin, and `admin_sub_id` is accepted but ignored by this
    // endpoint family, so it is intentionally never sent here. Callers that
    // need an org's instances narrow client-side by matching `user_sub_id`
    // against that organization's workspace membership.
    getAllAgentInstances: builder.query<OrgAgentInstanceSummary[], void>({
      queryFn: async (_arg, _api, _extraOptions, fetchWithBQ) => {
        const results: OrgAgentInstanceSummary[] = [];
        let page = 1;

        while (page <= MAX_AGENT_INSTANCE_PAGES) {
          const pageResult = await fetchWithBQ({
            url: `agent-instances/?page=${page}&page_size=100`,
            method: "GET",
          });

          if (pageResult.error) {
            return { error: pageResult.error };
          }

          if (!isRawPaginatedPage<OrgAgentInstanceSummary>(pageResult.data)) {
            return {
              error: { status: "CUSTOM_ERROR", error: "Invalid response format from agent-instances/" },
            };
          }

          results.push(...pageResult.data.results);

          if (!pageResult.data.next) {
            break;
          }
          page += 1;
        }

        return { data: results };
      },
      providesTags: ["OrgAgentInstance"],
    }),

    // PATCH /agent-instances/<id>/update-config/ shallow-merges whatever
    // `dynamic_config` is sent into the stored one — see
    // `UpdateDynamicConfigArgs` in orgManagementApi.types.ts. No
    // `admin_sub_id` query param: the endpoint ignores it entirely.
    updateAgentInstanceDynamicConfig: builder.mutation<UpdateDynamicConfigResponse, UpdateDynamicConfigArgs>({
      query: ({ id, dynamic_config }) => ({
        url: `agent-instances/${id}/update-config/`,
        method: "PATCH",
        body: { dynamic_config },
      }),
      invalidatesTags: ["OrgAgentInstance"],
      transformErrorResponse: (response: unknown) => {
        if (
          typeof response === "object" &&
          response !== null &&
          "data" in response &&
          typeof (response as { data: unknown }).data === "object"
        ) {
          return (response as { data: OrgManagementApiErrorBody }).data;
        }
        return { detail: "An unexpected error occurred while updating the agent configuration" };
      },
    }),
  }),
});

export const {
  useGetAllWorkspacesQuery,
  useGetWorkspaceMembersQuery,
  useGetAllAgentInstancesQuery,
  useUpdateAgentInstanceDynamicConfigMutation,
} = orgManagementApi;
