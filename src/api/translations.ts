import { adminFetch } from './admin';

/**
 * UI strings for the mobile app.
 *
 * Saving is immediate and live: the app fetches these on launch, so an edit reaches every
 * installed copy without a release. Publishing is the separate, slower step that commits
 * the regenerated locale files and optionally starts an App Store build.
 */

export interface LanguageSummary {
  code: string;
  name: string;
  isActive: boolean;
  /** Keys with a value in this language. */
  translated: number;
  /** Keys in total — the same for every language. */
  total: number;
  revision: string | null;
}

export interface CatalogKey {
  id: string;
  /** Dotted i18next path, e.g. `settings.rows.language`. */
  key: string;
  group: string;
  pluralBase: string | null;
  pluralCategory: string | null;
  /** Interpolation names the English source uses; a translation must keep exactly these. */
  placeholders: string[];
  description: string | null;
  /** Keyed by language code. A language absent from this map is untranslated for this key. */
  values: Record<string, string>;
}

export interface TranslationCatalog {
  sourceLanguage: string;
  languages: LanguageSummary[];
  keys: CatalogKey[];
}

export interface TranslationEdit {
  keyId: string;
  language: string;
  value: string;
}

export interface SaveResult {
  saved: number;
  languages: LanguageSummary[];
}

export interface PublishResult {
  /** False when the locale files on the branch already matched — nothing needed committing. */
  committed: boolean;
  commitUrl: string | null;
  workflowUrl: string | null;
  changedFiles: string[];
}

export function fetchTranslationCatalog(): Promise<TranslationCatalog> {
  return adminFetch('/admin/translations');
}

export function saveTranslations(edits: TranslationEdit[]): Promise<SaveResult> {
  return adminFetch('/admin/translations', {
    method: 'PATCH',
    body: JSON.stringify({ edits }),
  });
}

export function fetchTranslationLanguages(): Promise<LanguageSummary[]> {
  return adminFetch('/admin/translations/languages');
}

export function addTranslationLanguage(body: {
  code: string;
  name: string;
  copyFrom?: string;
}): Promise<LanguageSummary[]> {
  return adminFetch('/admin/translations/languages', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateTranslationLanguage(
  code: string,
  body: { name?: string; isActive?: boolean },
): Promise<LanguageSummary[]> {
  return adminFetch(`/admin/translations/languages/${encodeURIComponent(code)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

/** One string edited since the last build — a line in the pre-build review. */
export interface PendingChange {
  keyId: string;
  key: string;
  group: string;
  language: string;
  value: string;
  updatedAt: string;
  updatedBy: string | null;
}

/** A past publish. */
export interface PublishRecord {
  id: string;
  publishedAt: string;
  publishedBy: string | null;
  reason: string | null;
  commitUrl: string | null;
  changedFiles: string[];
  buildDispatched: boolean;
}

/** Everything saved but not yet shipped in an App Store build. */
export interface PendingPublish {
  lastBuild: PublishRecord | null;
  lastPublish: PublishRecord | null;
  changes: PendingChange[];
  languages: string[];
}

export function fetchPendingPublish(): Promise<PendingPublish> {
  return adminFetch('/admin/translations/pending');
}

export function fetchPublishHistory(): Promise<PublishRecord[]> {
  return adminFetch('/admin/translations/history');
}

/** Whether the server has the GitHub credentials a build needs. */
export function fetchPublishStatus(): Promise<{ configured: boolean }> {
  return adminFetch('/admin/translations/publish');
}

export function publishTranslations(body: {
  reason?: string;
  build: boolean;
}): Promise<PublishResult> {
  return adminFetch('/admin/translations/publish', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * Interpolation names in a string. Mirrors the server's parser so the grid can flag a broken
 * translation as it is typed rather than at save time.
 */
export function placeholdersIn(value: string): string[] {
  const found = new Set<string>();
  for (const match of value.matchAll(/\{\{\s*-?\s*([\w.]+)/g)) found.add(match[1]);
  return [...found].sort();
}

/** What a translation gets wrong about its placeholders, or null when it is fine. */
export function placeholderProblem(
  expected: readonly string[],
  value: string,
): { missing: string[]; unexpected: string[] } | null {
  // An empty value is a deliberate blank, not a broken translation.
  if (value === '') return null;
  const actual = new Set(placeholdersIn(value));
  const missing = expected.filter((p) => !actual.has(p));
  const unexpected = [...actual].filter((p) => !expected.includes(p));
  return missing.length > 0 || unexpected.length > 0 ? { missing, unexpected } : null;
}
