const STORAGE_KEY = 'viewer_session_token';

let cachedToken: string | null = null;

export function getSessionToken(): string | null {
  if (cachedToken) return cachedToken;
  try {
    cachedToken = localStorage.getItem(STORAGE_KEY);
  } catch {
    cachedToken = null;
  }
  return cachedToken;
}

export function setSessionToken(token: string): void {
  cachedToken = token;
  try {
    localStorage.setItem(STORAGE_KEY, token);
  } catch {
    // Ignore storage failures (e.g. private mode); keep in-memory token.
  }
}

export function clearSessionToken(): void {
  cachedToken = null;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
}
