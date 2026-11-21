import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, apiDownload, apiUpload } from '@/lib/api-client';

export interface RagKbStats {
  documentCount: number;
  chunkCount: number;
  embeddingCount: number;
  embeddingTotal: number;
  tokenCount: number;
  tokenLabel: string;
  retrievalMode?: 'text';
}

export interface RagKbDocument {
  id: string;
  title: string;
  sourceType: string;
  url?: string | null;
  chunkCount: number;
  tokenCount: number;
  embeddingCount: number;
  status: string;
  preview: string;
  createdAt: string;
}

export interface RagKnowledgeBase {
  id: string;
  name: string;
  description?: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  stats: RagKbStats;
  documents: RagKbDocument[];
  linkedBots?: Array<{ id: string; name: string; status: string }>;
}

const KEY = ['rag-kb'];

export function useExportRagKbMarkdown() {
  return useMutation({ mutationFn: async (kbId: string) => {
    const { blob, filename } = await apiDownload(`/rag-kb/${kbId}/export.md`);
    const url = URL.createObjectURL(blob), anchor = document.createElement('a');
    anchor.href = url; anchor.download = filename; document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
  } });
}

function invalidateKnowledge(qc: ReturnType<typeof useQueryClient>) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: KEY }),
    qc.invalidateQueries({ queryKey: ['chatbot-cskh', 'knowledge'] }),
  ]);
}


export function useRagKnowledgeBases() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => apiClient<RagKnowledgeBase[]>('/rag-kb'),
  });
}

export function useCreateRagKb() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; description?: string; isDefault?: boolean }) =>
      apiClient<RagKnowledgeBase>('/rag-kb', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => invalidateKnowledge(qc),
  });
}

export function useUpdateRagKb() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: string;
      name?: string;
      description?: string;
      isDefault?: boolean;
    }) =>
      apiClient<RagKnowledgeBase>(`/rag-kb/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    onSuccess: () => invalidateKnowledge(qc),
  });
}

export function useDeleteRagKb() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient(`/rag-kb/${id}`, { method: 'DELETE' }),
    onSuccess: () => invalidateKnowledge(qc),
  });
}

export function useReindexRagKb() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient<RagKnowledgeBase>(`/rag-kb/${id}/reindex`, { method: 'POST' }),
    onSuccess: () => invalidateKnowledge(qc),
  });
}

export function useImportRagKbFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => {
      const fd = new FormData();
      fd.append('file', file);
      return apiUpload<RagKnowledgeBase>(`/rag-kb/${id}/import/file`, fd);
    },
    onSuccess: () => invalidateKnowledge(qc),
  });
}

export function useImportRagKbUrl() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, url, title }: { id: string; url: string; title?: string }) =>
      apiClient<RagKnowledgeBase>(`/rag-kb/${id}/import/url`, {
        method: 'POST',
        body: JSON.stringify({ url, title }),
      }),
    onSuccess: () => invalidateKnowledge(qc),
  });
}

export function useImportRagKbText() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, title, content }: { id: string; title: string; content: string }) =>
      apiClient<RagKnowledgeBase>(`/rag-kb/${id}/import/text`, {
        method: 'POST',
        body: JSON.stringify({ title, content }),
      }),
    onSuccess: () => invalidateKnowledge(qc),
  });
}

export interface RagKbDocumentDetail extends RagKbDocument {
  content: string;
  contentLength: number;
  chunks: Array<{
    index: number;
    text: string;
    charCount: number;
    tokenEstimate: number;
  }>;
  updatedAt?: string;
}

export function useRagKbDocument(kbId: string | null, docId: string | null, enabled = true) {
  return useQuery({
    queryKey: [...KEY, 'document', kbId, docId],
    queryFn: () =>
      apiClient<RagKbDocumentDetail>(`/rag-kb/${kbId}/documents/${docId}`),
    enabled: Boolean(kbId && docId && enabled),
  });
}

export function useDownloadRagKbDocument() {
  return useMutation({
    mutationFn: async ({ kbId, docId }: { kbId: string; docId: string }) => {
      const { blob, filename } = await apiDownload(
        `/rag-kb/${kbId}/documents/${docId}/download`,
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      return filename;
    },
  });
}

export function useDeleteRagKbDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ kbId, docId }: { kbId: string; docId: string }) =>
      apiClient(`/rag-kb/${kbId}/documents/${docId}`, { method: 'DELETE' }),
    onSuccess: () => invalidateKnowledge(qc),
  });
}

export function useRagKbSearch() {
  return useMutation({
    mutationFn: (body: { query: string; knowledgeBaseId?: string }) =>
      apiClient<{
        query: string;
        results: Array<{
          knowledgeBaseId: string;
          knowledgeBaseName: string;
          documentId: string;
          chunkId?: string;
          url?: string | null;
          updatedAt?: string;
          title: string;
          score: number;
          excerpt: string;
        }>;
      }>('/rag-kb/search', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  });
}

export interface SharedKnowledgeBot {
  id: string;
  botName: string;
  status: string;
  knowledgeBaseId: string | null;
  knowledgeBaseName: string | null;
  existingSourceCount: number;
  zaloConnected: boolean;
  zaloAutoReply: boolean;
}

export function useSharedKnowledgeBots() {
  return useQuery({ queryKey: [...KEY, 'chatbots'], queryFn: () => apiClient<SharedKnowledgeBot[]>('/rag-kb/chatbots'), refetchOnWindowFocus: 'always' });
}

export function useConnectSharedKnowledge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ botId, knowledgeBaseId, zaloAutoReply }: { botId: string; knowledgeBaseId: string; zaloAutoReply?: boolean }) =>
      apiClient<{ botId: string; knowledgeBaseId: string; importedSourceCount: number }>(`/rag-kb/chatbots/${botId}`, { method: 'PATCH', body: JSON.stringify({ knowledgeBaseId, ...(typeof zaloAutoReply === 'boolean' ? { zaloAutoReply } : {}) }) }),
    onSuccess: () => invalidateKnowledge(qc),
  });
}

export function useConsolidateChatbotKnowledge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (botId: string) => apiClient<{ botId: string; knowledgeBaseId: string; importedSourceCount: number }>(`/rag-kb/chatbots/${botId}/consolidate`, { method: 'POST' }),
    onSuccess: () => invalidateKnowledge(qc),
  });
}

export function useUpdateRagDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ kbId, docId, title, content }: { kbId: string; docId: string; title: string; content: string }) =>
      apiClient<RagKbDocumentDetail>(`/rag-kb/${kbId}/documents/${docId}`, { method: 'PATCH', body: JSON.stringify({ title, content }) }),
    onSuccess: () => invalidateKnowledge(qc),
  });
}

export function useKnowledgeZaloOas() {
  return useQuery({ queryKey: [...KEY, 'zalo-oas'], queryFn: () => apiClient<Array<{ id: string; name: string; status: string; isPaused: boolean; botId: string | null }>>('/rag-kb/zalo-oas'), refetchOnWindowFocus: 'always' });
}

export function useConnectKnowledgeZaloOa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ connectionId, botId }: { connectionId: string; botId: string | null }) => apiClient(`/rag-kb/zalo-oas/${connectionId}`, { method: 'PATCH', body: JSON.stringify({ botId }) }),
    onSuccess: () => invalidateKnowledge(qc),
  });
}
