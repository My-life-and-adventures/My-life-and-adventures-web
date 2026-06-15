import { apiFetch } from './client';
import { setSessionToken } from './session';
import type { ViewerInvitePreview, ViewerProfile, ViewerStory } from './types';

export function getInvitePreview(token: string) {
  return apiFetch<ViewerInvitePreview>(`/viewer/invite?token=${encodeURIComponent(token)}`);
}

export function requestLoginCode(token: string) {
  return apiFetch<{ sent: boolean; masked_email: string }>('/viewer/request-code', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}

export async function verifyLoginCode(token: string, code: string) {
  const result = await apiFetch<{ verified: boolean; session_token: string }>(
    '/viewer/verify-code',
    {
      method: 'POST',
      body: JSON.stringify({ token, code }),
    },
  );
  if (result.session_token) {
    setSessionToken(result.session_token);
  }
  return result;
}

export function getViewerMe() {
  return apiFetch<ViewerProfile>('/viewer/me');
}

export function listViewerStories() {
  return apiFetch<ViewerStory[]>('/viewer/stories');
}
