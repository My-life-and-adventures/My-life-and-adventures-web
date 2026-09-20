import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  addTranslationLanguage,
  fetchPendingPublish,
  fetchPublishStatus,
  fetchTranslationCatalog,
  placeholderProblem,
  publishTranslations,
  saveTranslations,
  updateTranslationLanguage,
  type CatalogKey,
  type PendingPublish,
  type TranslationCatalog,
  type TranslationEdit,
} from '../../api/translations';
import { useToast } from '../../components/toast-context';
import './translations.css';

/**
 * Editing the mobile app's UI strings.
 *
 * Laid out as reference-and-target rather than one column per language: a translator works
 * on one language at a time against the English source, and 833 keys times every language
 * would be unreadable at any window width. Picking English as the target hides the
 * reference column, since comparing English to itself is noise.
 *
 * Nothing is written until Save. Edits live in `drafts` keyed by key id and language, so
 * switching language or filter mid-edit never silently drops work.
 */

/** Rows rendered before the "show more" button. Keeps the DOM small on an unfiltered grid. */
const PAGE_SIZE = 150;

type Drafts = Map<string, string>;

const draftKey = (keyId: string, language: string) => `${keyId}:${language}`;

/** The value currently showing for a cell: the unsaved edit if there is one, else what is stored. */
function cellValue(drafts: Drafts, row: CatalogKey, language: string): string {
  return drafts.get(draftKey(row.id, language)) ?? row.values[language] ?? '';
}

function isUntranslated(row: CatalogKey, language: string): boolean {
  return row.values[language] === undefined;
}

export function Translations() {
  const toast = useToast();
  const [catalog, setCatalog] = useState<TranslationCatalog | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Drafts>(new Map());
  const [search, setSearch] = useState('');
  const [group, setGroup] = useState('');
  const [missingOnly, setMissingOnly] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [publishConfigured, setPublishConfigured] = useState(false);
  const [pending, setPending] = useState<PendingPublish | null>(null);

  const applyCatalog = useCallback((data: TranslationCatalog) => {
    setCatalog(data);
    setLoadError(null);
    setTarget((current) => {
      if (current && data.languages.some((l) => l.code === current)) return current;
      // Open on the first language that is not the source: that is the one with work in it.
      return (
        data.languages.find((l) => l.code !== data.sourceLanguage)?.code ?? data.sourceLanguage
      );
    });
  }, []);

  /** Re-read what a build would contain. Cheap next to the catalog, so it runs after saves. */
  const refreshPending = useCallback(async () => {
    try {
      setPending(await fetchPendingPublish());
    } catch {
      // The banner is informational; losing it must not break editing.
    }
  }, []);

  /** Re-read the grid after a write. Called from handlers, never from render. */
  const load = useCallback(async () => {
    try {
      applyCatalog(await fetchTranslationCatalog());
    } catch (err) {
      setLoadError((err as Error).message);
    }
  }, [applyCatalog]);

  useEffect(() => {
    let cancelled = false;
    fetchTranslationCatalog()
      .then((data) => !cancelled && applyCatalog(data))
      .catch((err: unknown) => !cancelled && setLoadError((err as Error).message));
    // A build needs GitHub credentials the server may not have; ask once so the publish
    // dialog can say so up front instead of offering a button that fails.
    fetchPublishStatus()
      .then((s) => !cancelled && setPublishConfigured(s.configured))
      .catch(() => !cancelled && setPublishConfigured(false));
    fetchPendingPublish()
      .then((p) => !cancelled && setPending(p))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [applyCatalog]);

  const groups = useMemo(() => {
    if (!catalog) return [];
    return [...new Set(catalog.keys.map((k) => k.group))].sort();
  }, [catalog]);

  // Paging is tied to the filters that produced it, so changing a filter starts again at the
  // first page. Derived rather than reset in an effect: a narrow search must not land past a
  // stale cutoff and look like it matched nothing, not even for one render.
  const filterSignature = [search, group, String(missingOnly), target ?? ''].join('|');
  const [paging, setPaging] = useState({
    signature: filterSignature,
    limit: PAGE_SIZE,
  });
  const limit = paging.signature === filterSignature ? paging.limit : PAGE_SIZE;
  const showMore = () => setPaging({ signature: filterSignature, limit: limit + PAGE_SIZE });

  const rows = useMemo(() => {
    if (!catalog || !target) return [];
    const needle = search.trim().toLowerCase();
    return catalog.keys.filter((row) => {
      if (group && row.group !== group) return false;
      if (missingOnly && !isUntranslated(row, target)) return false;
      if (!needle) return true;
      return (
        row.key.toLowerCase().includes(needle) ||
        Object.values(row.values).some((v) => v.toLowerCase().includes(needle))
      );
    });
  }, [catalog, target, search, group, missingOnly]);

  const edits = useMemo<TranslationEdit[]>(() => {
    if (!catalog) return [];
    const byId = new Map(catalog.keys.map((k) => [k.id, k]));
    const out: TranslationEdit[] = [];
    for (const [composite, value] of drafts) {
      const separator = composite.lastIndexOf(':');
      const keyId = composite.slice(0, separator);
      const language = composite.slice(separator + 1);
      // A draft equal to what is stored is not an edit — typing and undoing leaves nothing.
      if (byId.get(keyId)?.values[language] === value) continue;
      out.push({ keyId, language, value });
    }
    return out;
  }, [drafts, catalog]);

  const problems = useMemo(() => {
    if (!catalog) return [];
    const byId = new Map(catalog.keys.map((k) => [k.id, k]));
    return edits.flatMap((edit) => {
      const row = byId.get(edit.keyId);
      if (!row) return [];
      const problem = placeholderProblem(row.placeholders, edit.value);
      return problem ? [{ key: row.key, language: edit.language, ...problem }] : [];
    });
  }, [edits, catalog]);

  const setDraft = (keyId: string, language: string, value: string) => {
    setDrafts((current) => new Map(current).set(draftKey(keyId, language), value));
  };

  async function handleSave() {
    if (edits.length === 0 || problems.length > 0) return;
    setSaving(true);
    try {
      const result = await saveTranslations(edits);
      setDrafts(new Map());
      setReviewOpen(false);
      await Promise.all([load(), refreshPending()]);
      // Deliberately does not open the publish dialog. Prompting after every save is what
      // pushes someone into firing off a build per edit; the banner keeps the running total
      // instead, and they publish once when they are finished.
      toast.success(
        `Saved ${result.saved} translation${result.saved === 1 ? '' : 's'}`,
        'Live in the app on its next launch.',
      );
    } catch (err) {
      toast.error('Could not save', (err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (loadError) {
    return (
      <div className="admin-panel">
        <h2>Translations</h2>
        <p className="admin-inline-error">{loadError}</p>
        <button type="button" className="admin-btn-quiet" onClick={() => void load()}>
          Try again
        </button>
      </div>
    );
  }

  if (!catalog || !target) return <p className="admin-muted">Loading translations…</p>;

  const source = catalog.sourceLanguage;
  const targetLanguage = catalog.languages.find((l) => l.code === target);
  const showReference = target !== source;
  const visible = rows.slice(0, limit);

  return (
    <div className="admin-stack">
      {pending && pending.changes.length > 0 && (
        <PendingBanner pending={pending} onPublish={() => setPublishOpen(true)} />
      )}

      <LanguageBar
        catalog={catalog}
        target={target}
        onTarget={setTarget}
        onChanged={load}
        dirty={edits.length > 0}
      />

      <div className="admin-panel">
        <div className="tr-toolbar">
          <input
            type="search"
            className="tr-search"
            placeholder="Search keys or text…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search translations"
          />
          <select value={group} onChange={(e) => setGroup(e.target.value)} aria-label="Section">
            <option value="">All sections</option>
            {groups.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
          <label className="admin-checkbox">
            <input
              type="checkbox"
              checked={missingOnly}
              onChange={(e) => setMissingOnly(e.target.checked)}
            />
            Untranslated only
          </label>
          <span className="admin-muted tr-count">
            {rows.length} of {catalog.keys.length}
          </span>
        </div>

        {problems.length > 0 && (
          <div className="admin-warning">
            <strong>
              {problems.length} translation{problems.length === 1 ? '' : 's'} would break at
              runtime.
            </strong>{' '}
            A value must use exactly the placeholders the English text uses.
            <ul>
              {problems.slice(0, 5).map((p) => (
                <li key={`${p.key}:${p.language}`}>
                  <code className="admin-code">{p.key}</code>{' '}
                  {p.missing.length > 0 && <>missing {p.missing.join(', ')}</>}
                  {p.missing.length > 0 && p.unexpected.length > 0 && '; '}
                  {p.unexpected.length > 0 && <>unexpected {p.unexpected.join(', ')}</>}
                </li>
              ))}
            </ul>
          </div>
        )}

        <table className="admin-table tr-table">
          <thead>
            <tr>
              <th className="tr-col-key">Key</th>
              {showReference && <th className="tr-col-text">{source} (reference)</th>}
              <th className="tr-col-text">{targetLanguage?.name ?? target}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => {
              const value = cellValue(drafts, row, target);
              const problem = placeholderProblem(row.placeholders, value);
              const missing = isUntranslated(row, target) && !drafts.has(draftKey(row.id, target));
              return (
                <tr key={row.id} className={missing ? 'tr-missing' : undefined}>
                  <td className="tr-col-key">
                    <code className="admin-code">{row.key}</code>
                    {row.pluralCategory && (
                      <span className="admin-pill tr-pill" title="Plural form">
                        {row.pluralCategory}
                      </span>
                    )}
                    {row.placeholders.map((p) => (
                      <span
                        key={p}
                        className="tr-placeholder"
                        title="Must appear in the translation"
                      >
                        {`{{${p}}}`}
                      </span>
                    ))}
                  </td>
                  {showReference && (
                    <td className="tr-col-text tr-reference">{row.values[source] ?? ''}</td>
                  )}
                  <td className="tr-col-text">
                    <textarea
                      className={problem ? 'tr-input tr-input-bad' : 'tr-input'}
                      value={value}
                      rows={1}
                      aria-invalid={problem ? true : undefined}
                      aria-label={`${row.key} in ${targetLanguage?.name ?? target}`}
                      placeholder={missing ? 'Not translated — falls back to English' : ''}
                      onChange={(e) => setDraft(row.id, target, e.target.value)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {rows.length === 0 && <p className="admin-muted">Nothing matches those filters.</p>}

        {rows.length > visible.length && (
          <button type="button" className="admin-btn-quiet" onClick={showMore}>
            Show {Math.min(PAGE_SIZE, rows.length - visible.length)} more
          </button>
        )}
      </div>

      <SaveBar
        count={edits.length}
        blocked={problems.length > 0}
        saving={saving}
        onSave={() => void handleSave()}
        onReview={() => setReviewOpen(true)}
        onDiscard={() => setDrafts(new Map())}
      />

      {reviewOpen && (
        <ReviewDialog
          catalog={catalog}
          edits={edits}
          blocked={problems.length > 0}
          saving={saving}
          onRevert={(keyId, language) =>
            setDrafts((current) => {
              const next = new Map(current);
              next.delete(draftKey(keyId, language));
              return next;
            })
          }
          onSave={() => void handleSave()}
          onClose={() => setReviewOpen(false)}
        />
      )}

      {publishOpen && (
        <PublishDialog
          configured={publishConfigured}
          pending={pending}
          onPublished={refreshPending}
          onClose={() => setPublishOpen(false)}
          toast={toast}
        />
      )}
    </div>
  );
}

// ── language picker and manager ─────────────────────────────────────────────

function LanguageBar({
  catalog,
  target,
  onTarget,
  onChanged,
  dirty,
}: {
  catalog: TranslationCatalog;
  target: string;
  onTarget: (code: string) => void;
  onChanged: () => Promise<void>;
  dirty: boolean;
}) {
  const toast = useToast();
  const [adding, setAdding] = useState(false);

  return (
    <div className="admin-panel">
      <div className="tr-languages">
        {catalog.languages.map((lang) => {
          const percent = lang.total === 0 ? 0 : Math.round((lang.translated / lang.total) * 100);
          const selected = lang.code === target;
          return (
            <button
              key={lang.code}
              type="button"
              className={selected ? 'tr-lang tr-lang-on' : 'tr-lang'}
              aria-pressed={selected}
              onClick={() => onTarget(lang.code)}
            >
              <span className="tr-lang-name">
                {lang.name}
                {!lang.isActive && <span className="admin-pill admin-pill-warn tr-pill">off</span>}
              </span>
              <span className="admin-muted tr-lang-meta">
                {lang.code} · {percent}% ({lang.translated}/{lang.total})
              </span>
            </button>
          );
        })}
        <button type="button" className="admin-btn-quiet" onClick={() => setAdding(true)}>
          Add a language
        </button>
      </div>

      {dirty && (
        <p className="admin-panel-note">
          You have unsaved edits. Switching language keeps them — they are saved together.
        </p>
      )}

      <LanguageToggles catalog={catalog} target={target} onChanged={onChanged} toast={toast} />

      {adding && (
        <AddLanguageForm
          catalog={catalog}
          onClose={() => setAdding(false)}
          onAdded={async (code) => {
            setAdding(false);
            await onChanged();
            onTarget(code);
          }}
          toast={toast}
        />
      )}
    </div>
  );
}

function LanguageToggles({
  catalog,
  target,
  onChanged,
  toast,
}: {
  catalog: TranslationCatalog;
  target: string;
  onChanged: () => Promise<void>;
  toast: ReturnType<typeof useToast>;
}) {
  const [busy, setBusy] = useState(false);
  const lang = catalog.languages.find((l) => l.code === target);
  if (!lang || lang.code === catalog.sourceLanguage) return null;

  async function toggle() {
    if (!lang) return;
    setBusy(true);
    try {
      await updateTranslationLanguage(lang.code, { isActive: !lang.isActive });
      await onChanged();
      toast.success(
        lang.isActive ? `${lang.name} switched off` : `${lang.name} switched on`,
        lang.isActive
          ? 'It disappears from the app’s language picker. Its translations are kept.'
          : 'It now appears in the app’s language picker.',
      );
    } catch (err) {
      toast.error('Could not update the language', (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <p className="admin-panel-note">
      {lang.isActive
        ? `${lang.name} is offered in the app.`
        : `${lang.name} is hidden from the app.`}{' '}
      <button
        type="button"
        className="admin-btn-quiet"
        disabled={busy}
        onClick={() => void toggle()}
      >
        {lang.isActive ? 'Switch off' : 'Switch on'}
      </button>
    </p>
  );
}

function AddLanguageForm({
  catalog,
  onClose,
  onAdded,
  toast,
}: {
  catalog: TranslationCatalog;
  onClose: () => void;
  onAdded: (code: string) => Promise<void>;
  toast: ReturnType<typeof useToast>;
}) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [copyFrom, setCopyFrom] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await addTranslationLanguage({
        code: code.trim(),
        name: name.trim(),
        ...(copyFrom ? { copyFrom } : {}),
      });
      toast.success(`${name.trim()} added`, 'It is in the app’s language picker now.');
      await onAdded(code.trim());
    } catch (err) {
      toast.error('Could not add the language', (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="admin-form tr-add" onSubmit={(e) => void submit(e)}>
      <label>
        Code
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="de"
          required
          aria-describedby="tr-code-hint"
        />
      </label>
      <label>
        Name as people will see it
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Deutsch"
          required
        />
      </label>
      <label>
        Start from
        <select value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)}>
          <option value="">Nothing — every key untranslated</option>
          {catalog.languages.map((l) => (
            <option key={l.code} value={l.code}>
              A copy of {l.name}
            </option>
          ))}
        </select>
      </label>
      <p id="tr-code-hint" className="admin-panel-note">
        Use the code the phone reports, like <code className="admin-code">de</code> or{' '}
        <code className="admin-code">pt-BR</code>. Starting from nothing is usually right:
        untranslated keys fall back to English, whereas a copy looks finished when it is not.
      </p>
      <div className="admin-form-actions">
        <button type="submit" disabled={busy}>
          {busy ? 'Adding…' : 'Add language'}
        </button>
        <button type="button" className="admin-btn-quiet" onClick={onClose} disabled={busy}>
          Cancel
        </button>
      </div>
    </form>
  );
}

// ── save and publish ────────────────────────────────────────────────────────

/**
 * Shows how much is staged and is the way into the review.
 *
 * "Save" stays enabled for a quick one-line fix, but anything larger should go through
 * Review first — with 833 keys behind a search box, an admin can easily forget a change
 * they made in a section they have since filtered away.
 */
function SaveBar({
  count,
  blocked,
  saving,
  onSave,
  onReview,
  onDiscard,
}: {
  count: number;
  blocked: boolean;
  saving: boolean;
  onSave: () => void;
  onReview: () => void;
  onDiscard: () => void;
}) {
  return (
    <div className="tr-savebar">
      <span className={count > 0 ? 'tr-savebar-count' : 'admin-muted'}>
        {count === 0 ? 'No unsaved changes.' : `${count} unsaved change${count === 1 ? '' : 's'}.`}
        {blocked && <span className="tr-savebar-blocked"> Fix the placeholders to save.</span>}
      </span>
      <div className="admin-form-actions">
        {count > 0 && (
          <button type="button" className="admin-btn-quiet" onClick={onDiscard} disabled={saving}>
            Discard
          </button>
        )}
        <button
          type="button"
          className="admin-btn-quiet"
          onClick={onReview}
          disabled={count === 0 || saving}
        >
          {count === 0 ? 'Review' : `Review ${count} change${count === 1 ? '' : 's'}`}
        </button>
        <button type="button" onClick={onSave} disabled={count === 0 || blocked || saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}

/**
 * Everything staged, before and after, with a way to undo any single one.
 *
 * This is the step the grid cannot give you: edits are made through a search box and a
 * section filter, so by the time someone is finished the changes are scattered across
 * places they can no longer see at once.
 */
function ReviewDialog({
  catalog,
  edits,
  blocked,
  saving,
  onRevert,
  onSave,
  onClose,
}: {
  catalog: TranslationCatalog;
  edits: TranslationEdit[];
  blocked: boolean;
  saving: boolean;
  onRevert: (keyId: string, language: string) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  const byId = new Map(catalog.keys.map((k) => [k.id, k]));
  const languageName = (code: string) =>
    catalog.languages.find((l) => l.code === code)?.name ?? code;

  // Grouped by language, then in key order, so the review reads like the files it produces
  // rather than like the order someone happened to click through.
  const byLanguage = new Map<string, TranslationEdit[]>();
  for (const edit of edits) {
    const list = byLanguage.get(edit.language) ?? [];
    list.push(edit);
    byLanguage.set(edit.language, list);
  }
  for (const list of byLanguage.values()) {
    list.sort((a, b) => (byId.get(a.keyId)?.key ?? '').localeCompare(byId.get(b.keyId)?.key ?? ''));
  }

  return (
    <div
      className="tr-dialog-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tr-review-title"
    >
      <div className="tr-dialog tr-dialog-wide admin-panel">
        <h2 id="tr-review-title">
          {edits.length} change{edits.length === 1 ? '' : 's'} ready to save
        </h2>
        <p className="admin-muted">
          Saving puts all of these live at once. Nothing goes to the App Store until you
          publish, which you do once at the end.
        </p>

        {[...byLanguage.entries()].map(([language, list]) => (
          <section key={language} className="tr-review-group">
            <h3>
              {languageName(language)}{' '}
              <span className="admin-muted">
                · {list.length} change{list.length === 1 ? '' : 's'}
              </span>
            </h3>
            <ul className="tr-review-list">
              {list.map((edit) => {
                const row = byId.get(edit.keyId);
                const before = row?.values[edit.language];
                return (
                  <li key={`${edit.keyId}:${edit.language}`}>
                    <div className="tr-review-head">
                      <code className="admin-code">{row?.key ?? edit.keyId}</code>
                      <button
                        type="button"
                        className="admin-btn-quiet"
                        onClick={() => onRevert(edit.keyId, edit.language)}
                        disabled={saving}
                      >
                        Undo
                      </button>
                    </div>
                    <p className="tr-review-before">
                      {before === undefined ? (
                        <em>Not translated</em>
                      ) : before === '' ? (
                        <em>Blank</em>
                      ) : (
                        before
                      )}
                    </p>
                    <p className="tr-review-after">
                      {edit.value === '' ? <em>Blank</em> : edit.value}
                    </p>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}

        <div className="admin-form-actions tr-review-actions">
          <button type="button" onClick={onSave} disabled={blocked || saving}>
            {saving ? 'Saving…' : `Save ${edits.length} change${edits.length === 1 ? '' : 's'}`}
          </button>
          <button type="button" className="admin-btn-quiet" onClick={onClose} disabled={saving}>
            Keep editing
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * The running tally of what a build would contain.
 *
 * Replaces prompting after every save. An admin can edit all afternoon and see the count
 * climb; the build happens once, when they say so.
 */
function PendingBanner({
  pending,
  onPublish,
}: {
  pending: PendingPublish;
  onPublish: () => void;
}) {
  const count = pending.changes.length;
  const when = pending.lastBuild
    ? new Date(pending.lastBuild.publishedAt).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null;

  return (
    <div className="admin-panel tr-pending">
      <div>
        <strong>
          {count} string{count === 1 ? '' : 's'} changed since{' '}
          {when ? `the last App Store build on ${when}` : 'the app was last built'}
        </strong>
        <p className="admin-muted">
          All of it is already live in the app. Publish once when you are finished editing —
          one build covers every change in this list.
          {pending.languages.length > 0 && ` Affects ${pending.languages.join(', ')}.`}
        </p>
      </div>
      <button type="button" onClick={onPublish}>
        Review and publish…
      </button>
    </div>
  );
}

/**
 * Offered after a save, and from the toolbar.
 *
 * The wording matters here: an admin who has just saved needs to know the change is already
 * live, or they will assume nothing shipped until Apple approves a build — and will sit on
 * a fix for a day waiting for a review it never needed.
 */
function PublishDialog({
  configured,
  pending,
  onPublished,
  onClose,
  toast,
}: {
  configured: boolean;
  pending: PendingPublish | null;
  onPublished: () => Promise<void>;
  onClose: () => void;
  toast: ReturnType<typeof useToast>;
}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Awaited<ReturnType<typeof publishTranslations>> | null>(
    null,
  );

  async function run(build: boolean) {
    setBusy(true);
    try {
      const data = await publishTranslations({
        reason: reason.trim() || undefined,
        build,
      });
      setResult(data);
      // Resets the pending count: these changes are now accounted for by a build.
      await onPublished();
      toast.success(
        build ? 'Build started' : data.committed ? 'Committed' : 'Already up to date',
        build
          ? 'Apple review usually takes a day or more. The strings are already live in the app.'
          : data.committed
            ? `${data.changedFiles.length} locale file(s) updated on the branch.`
            : 'The locale files on the branch already matched.',
      );
    } catch (err) {
      toast.error('Could not publish', (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="tr-dialog-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tr-pub-title"
    >
      <div className="tr-dialog admin-panel">
        <h2 id="tr-pub-title">Publish to the App Store</h2>

        <p>
          <strong>Your saved changes are already live.</strong> The app downloads its strings when
          it opens, so everyone who has it installed sees the new wording the next time they launch
          it — there is nothing to wait for.
        </p>
        <p className="admin-muted">
          Publishing is for the copy inside the app binary, which is what someone sees on a brand
          new install before it has fetched anything. It commits the regenerated locale files, and
          can start an App Store build — that one goes through Apple review, which usually takes a
          day or more.
        </p>

        {!configured && (
          <p className="admin-warning">
            This server has no GitHub credentials, so neither option will work yet. Set{' '}
            <code className="admin-code">GITHUB_TOKEN</code> and{' '}
            <code className="admin-code">GITHUB_REPO</code> on the backend.
          </p>
        )}

        {pending && pending.changes.length > 0 && (
          <details className="tr-manifest">
            <summary>
              This build carries {pending.changes.length} changed string
              {pending.changes.length === 1 ? '' : 's'}
              {pending.languages.length > 0 && ` in ${pending.languages.join(', ')}`}
            </summary>
            <ul className="tr-manifest-list">
              {pending.changes.slice(0, 50).map((change) => (
                <li key={`${change.keyId}:${change.language}`}>
                  <code className="admin-code">{change.key}</code>{' '}
                  <span className="admin-muted">({change.language})</span>
                  <span className="tr-manifest-value">{change.value || '—'}</span>
                </li>
              ))}
            </ul>
            {pending.changes.length > 50 && (
              <p className="admin-muted">
                …and {pending.changes.length - 50} more. All of them go in this one build.
              </p>
            )}
          </details>
        )}

        <label>
          What changed?
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reworded the recording screen"
            disabled={busy || result !== null}
          />
        </label>

        {result && (
          <ul className="tr-result">
            <li>
              {result.committed
                ? `Committed ${result.changedFiles.join(', ')}`
                : 'No commit needed — the branch already matched.'}
            </li>
            {result.commitUrl && (
              <li>
                <a href={result.commitUrl} target="_blank" rel="noreferrer">
                  View the commit
                </a>
              </li>
            )}
            {result.workflowUrl && (
              <li>
                <a href={result.workflowUrl} target="_blank" rel="noreferrer">
                  Watch the build
                </a>
              </li>
            )}
          </ul>
        )}

        <div className="admin-form-actions">
          {result === null && (
            <>
              <button type="button" disabled={busy || !configured} onClick={() => void run(true)}>
                {busy ? 'Working…' : 'Commit and build for the App Store'}
              </button>
              <button
                type="button"
                className="admin-btn-quiet"
                disabled={busy || !configured}
                onClick={() => void run(false)}
              >
                Just commit the files
              </button>
            </>
          )}
          <button type="button" className="admin-btn-quiet" onClick={onClose} disabled={busy}>
            {result === null ? 'Not now' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}
