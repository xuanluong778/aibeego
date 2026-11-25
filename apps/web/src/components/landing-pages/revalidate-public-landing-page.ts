import { apiClient } from '@/lib/api-client';

/** Làm mới cache khi trang còn trong DB (publish/unpublish). */
export async function revalidatePublicLandingPage(pageId: string): Promise<boolean> {
  const id = pageId.trim();
  if (!id) return false;
  try {
    const res = await apiClient<{ cache?: { ok?: boolean } }>(
      `/landing-pages/${encodeURIComponent(id)}/refresh-public-cache`,
      { method: 'POST', body: '{}' },
    );
    return res?.cache?.ok === true;
  } catch {
    return false;
  }
}

/** Retry sau xóa — chỉ token ngắn hạn server cấp lúc xóa (không gửi scope). */
export async function retryPublicLandingPageCache(cacheRetryToken: string): Promise<boolean> {
  const token = cacheRetryToken.trim();
  if (!token) return false;
  try {
    const res = await apiClient<{ cache?: { ok?: boolean } }>(
      '/landing-pages/actions/retry-public-cache',
      { method: 'POST', body: JSON.stringify({ cacheRetryToken: token }) },
    );
    return res?.cache?.ok === true;
  } catch {
    return false;
  }
}