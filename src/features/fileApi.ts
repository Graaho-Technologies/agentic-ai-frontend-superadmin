// src/features/files/fileApi.ts
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { getBaseUrl, getAccessToken } from '@/lib/api/baseQueryWithAuth';

export interface FileExtractResponse {
  text: string;
  file_type: string;
  filename: string;
  file_size: number;
  success: boolean;
}

// Custom base query for file uploads (FormData)
const baseQueryForFileUpload = fetchBaseQuery({
  baseUrl: getBaseUrl(),
  mode: 'cors',
  credentials: 'include',
  prepareHeaders: (headers) => {
    // Don't set Content-Type for FormData - browser will set it with boundary
    const token = getAccessToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  },
});

export const fileApi = createApi({
  reducerPath: 'fileApi',
  baseQuery: baseQueryForFileUpload,
  tagTypes: ['File'],
  endpoints: (builder) => ({
    extractFile: builder.mutation<FileExtractResponse, FormData>({
      query: (formData) => ({
        url: `files/extract-text/`, // always call this
        method: 'POST',
        body: formData,
      }),
    }),
  }),
});

export const { useExtractFileMutation } = fileApi;
