import { useEffect, useMemo, useRef, useState } from 'react';
import FileDropZone from './components/FileDropZone';
import FileList from './components/FileList';
import SummaryDashboard from './components/SummaryDashboard';
import DiffTable from './components/DiffTable';
import ProfileOnlySection from './components/ProfileOnlySection';
import SfOrgPanel from './components/SfOrgPanel';
import DeployToolbar from './components/DeployToolbar';
import DeployResultPanel from './components/DeployResultPanel';
import { normalizeFileWithDocument } from './lib/normalize';
import { computeDiff, fieldsEqual } from './lib/diffEngine';
import { applyFieldEdit, applyFieldDelete, revertRow } from './lib/editing/applyEdit';
import { serializeDocument, saveViaHandle, downloadAsFile } from './lib/editing/saveFile';
import { undoEntries, type HistoryEntry, type HistoryStep } from './lib/editing/history';
import {
  detectSfCli,
  fetchOrgs,
  loginOrg as loginOrgApi,
  cancelLogin as cancelLoginApi,
  logoutOrg as logoutOrgApi,
  validateFiles as validateFilesApi,
  deployFiles as deployFilesApi,
} from './lib/sfApi';
import type { FileEntry } from './lib/fileEntry';
import { CATEGORIES, CATEGORY_LABELS, type Category, type NormalizedFile } from './lib/types';
import type { OrgSummary, DeployResponse } from '../server/apiTypes';

let nextId = 0;
let nextHistoryId = 0;

type Theme = 'light' | 'dark';
const THEME_STORAGE_KEY = 'permission-diff-theme';

function getInitialTheme(): Theme {
  const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(THEME_STORAGE_KEY) : null;
  const theme: Theme =
    stored === 'light' || stored === 'dark'
      ? stored
      : typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
  // Stamp the attribute here (during the lazy useState initializer, before first paint) rather than
  // waiting for the useEffect below, so there's no flash of the wrong theme on load.
  if (typeof document !== 'undefined') document.documentElement.setAttribute('data-theme', theme);
  return theme;
}

export default function App() {
  const [files, setFiles] = useState<NormalizedFile[]>([]);
  const [activeCategory, setActiveCategory] = useState<Category>('objectPermissions');
  const [showProfileOnly, setShowProfileOnly] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [fileErrors, setFileErrors] = useState<Record<string, string | undefined>>({});
  const [dragMode, setDragMode] = useState<'copy' | 'move'>('copy');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [sfCliAvailable, setSfCliAvailable] = useState<boolean | null>(null);
  const [orgs, setOrgs] = useState<OrgSummary[]>([]);
  const [orgsLoading, setOrgsLoading] = useState(false);
  const [selectedOrgUsername, setSelectedOrgUsername] = useState<string | null>(null);
  const [loginInFlight, setLoginInFlight] = useState(false);
  const [loginRequestId, setLoginRequestId] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | undefined>(undefined);
  const [removingOrgUsername, setRemovingOrgUsername] = useState<string | null>(null);
  const [selectedForDeploy, setSelectedForDeploy] = useState<Set<string>>(new Set());
  const [deployAction, setDeployAction] = useState<'validate' | 'deploy' | null>(null);
  const [deployResult, setDeployResult] = useState<DeployResponse | null>(null);
  const [deployError, setDeployError] = useState<string | undefined>(undefined);
  const handlesRef = useRef<Map<string, FileSystemFileHandle>>(new Map());
  const docsRef = useRef<Map<string, Document>>(new Map());
  const originalRawRef = useRef<Map<string, string>>(new Map());
  const originalFilesRef = useRef<Map<string, NormalizedFile>>(new Map());

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    detectSfCli().then((result) => {
      setSfCliAvailable(result.installed);
      if (result.installed) void refreshOrgs();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refreshOrgs() {
    setOrgsLoading(true);
    try {
      const { orgs: fetched, defaultUsername } = await fetchOrgs();
      setOrgs(fetched);
      setSelectedOrgUsername((prev) => {
        if (prev && fetched.some((o) => o.username === prev)) return prev;
        return defaultUsername ?? fetched[0]?.username ?? null;
      });
    } finally {
      setOrgsLoading(false);
    }
  }

  async function handleAddOrg() {
    const requestId = crypto.randomUUID();
    setLoginRequestId(requestId);
    setLoginInFlight(true);
    setLoginError(undefined);
    try {
      const result = await loginOrgApi({ requestId });
      if (result.success) {
        await refreshOrgs();
      } else if (!result.cancelled) {
        setLoginError(result.error ?? 'Login failed.');
      }
    } finally {
      setLoginInFlight(false);
      setLoginRequestId(null);
    }
  }

  async function handleCancelLogin() {
    if (!loginRequestId) return;
    await cancelLoginApi({ requestId: loginRequestId });
  }

  async function handleRemoveOrg(username: string) {
    if (!window.confirm('Log out of this org?')) return;
    setRemovingOrgUsername(username);
    try {
      const result = await logoutOrgApi({ username });
      if (result.success) {
        await refreshOrgs();
      } else {
        window.alert(result.error ?? 'Logout failed.');
      }
    } finally {
      setRemovingOrgUsername(null);
    }
  }

  function handleToggleSelectForDeploy(id: string) {
    setSelectedForDeploy((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /** Sends whatever is currently in memory (serializeDocument), dirty or not — the backend never touches the real file on disk anyway. */
  function gatherSelectedDeployFiles(): { name: string; sourceType: NormalizedFile['sourceType']; xml: string }[] {
    const result: { name: string; sourceType: NormalizedFile['sourceType']; xml: string }[] = [];
    for (const f of validFiles) {
      if (!selectedForDeploy.has(f.id)) continue;
      const doc = docsRef.current.get(f.id);
      if (!doc) continue;
      result.push({ name: f.name, sourceType: f.sourceType, xml: serializeDocument(doc) });
    }
    return result;
  }

  async function handleValidateSelected() {
    if (!selectedOrgUsername) return;
    const filesToSend = gatherSelectedDeployFiles();
    if (filesToSend.length === 0) return;
    setDeployAction('validate');
    setDeployError(undefined);
    setDeployResult(null);
    try {
      const result = await validateFilesApi({ requestId: crypto.randomUUID(), targetOrg: selectedOrgUsername, files: filesToSend });
      if (result.kind === 'success') setDeployResult(result.response);
      else setDeployError('Could not reach the local SF CLI backend.');
    } finally {
      setDeployAction(null);
    }
  }

  async function handleDeploySelected() {
    if (!selectedOrgUsername) return;
    const org = orgs.find((o) => o.username === selectedOrgUsername);
    if (org?.likelyProduction) {
      const confirmed = window.confirm('You are about to deploy to what looks like a PRODUCTION org. This makes real changes. Continue?');
      if (!confirmed) return;
    }
    const filesToSend = gatherSelectedDeployFiles();
    if (filesToSend.length === 0) return;
    setDeployAction('deploy');
    setDeployError(undefined);
    setDeployResult(null);
    try {
      const result = await deployFilesApi({
        requestId: crypto.randomUUID(),
        targetOrg: selectedOrgUsername,
        confirmedProduction: !!org?.likelyProduction,
        files: filesToSend,
      });
      if (result.kind === 'success') setDeployResult(result.response);
      else if (result.kind === 'productionConfirmationRequired') setDeployError('The server also flagged this as a production org — please retry.');
      else setDeployError('Could not reach the local SF CLI backend.');
    } finally {
      setDeployAction(null);
    }
  }

  function pushHistory(label: string, steps: HistoryStep[]) {
    setHistory((prev) => [...prev, { id: `h${nextHistoryId++}`, label, steps }]);
  }

  /** Drops any history entries touching fileId — used when a file's baseline is reset outside the tracked edit flow (discard/reload/remove). */
  function pruneHistoryForFile(fileId: string) {
    setHistory((prev) => prev.filter((entry) => !entry.steps.some((s) => s.fileId === fileId)));
  }

  /** Drops history entries touching one exact row — used after a per-row revert, so undo can't reintroduce a value the user just explicitly reverted. */
  function pruneHistoryForRow(fileId: string, category: Category, rowKey: string) {
    setHistory((prev) => prev.filter((entry) => !entry.steps.some((s) => s.fileId === fileId && s.category === category && s.rowKey === rowKey)));
  }

  /** Parses+normalizes a file, retaining its Document and original-state baseline for editing/dirty-tracking. */
  function registerLoadedFile(id: string, name: string, raw: string): NormalizedFile {
    const { normalized, doc } = normalizeFileWithDocument({ id, name, sourceType: 'profile', raw });
    if (doc) docsRef.current.set(id, doc);
    else docsRef.current.delete(id);
    originalRawRef.current.set(id, raw);
    originalFilesRef.current.set(id, normalized);
    return normalized;
  }

  async function handleFiles(incoming: FileEntry[]) {
    const loaded = await Promise.all(
      incoming
        .filter((entry) => entry.file.name.endsWith('.xml'))
        .map(async (entry) => {
          const raw = await entry.file.text();
          const id = `f${nextId++}`;
          if (entry.handle) handlesRef.current.set(id, entry.handle);
          return registerLoadedFile(id, entry.file.name, raw);
        }),
    );
    setFiles((prev) => [...prev, ...loaded]);
  }

  function handleRemove(id: string) {
    if (dirtyIds.has(id) && !window.confirm('This file has unsaved edits that will be lost. Remove it anyway?')) {
      return;
    }
    handlesRef.current.delete(id);
    docsRef.current.delete(id);
    originalRawRef.current.delete(id);
    originalFilesRef.current.delete(id);
    pruneHistoryForFile(id);
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }

  const reloadableCount = useMemo(
    () => files.filter((f) => handlesRef.current.has(f.id)).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [files],
  );

  /** Re-reads a single file from its live handle and refreshes its retained Document + baseline. Returns null if no handle. */
  async function reloadOneFile(id: string): Promise<NormalizedFile | null> {
    const handle = handlesRef.current.get(id);
    if (!handle) return null;
    const file = await handle.getFile();
    const raw = await file.text();
    return registerLoadedFile(id, file.name, raw);
  }

  async function handleReload() {
    if (dirtyIds.size > 0 && !window.confirm('You have unsaved edits that will be lost. Reload from disk anyway?')) {
      return;
    }
    setReloading(true);
    try {
      const updated = await Promise.all(
        files.map(async (f) => {
          const reloaded = await reloadOneFile(f.id);
          if (reloaded) pruneHistoryForFile(f.id);
          return reloaded ?? f;
        }),
      );
      setFiles(updated);
    } finally {
      setReloading(false);
    }
  }

  const validFiles = useMemo(() => files.filter((f) => !f.error), [files]);
  const diff = useMemo(() => (validFiles.length >= 2 ? computeDiff(validFiles) : null), [validFiles]);

  /** Rows edited/created/deleted relative to each file's last-loaded/last-saved baseline: fileId -> Set<"category::rowKey">. */
  const editedByFile = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const file of validFiles) {
      const original = originalFilesRef.current.get(file.id);
      if (!original) continue;
      const dirtyKeys = new Set<string>();
      for (const category of CATEGORIES) {
        const originalByKey = new Map(original.rows[category].map((r) => [r.key, r.fields]));
        const currentByKey = new Map(file.rows[category].map((r) => [r.key, r.fields]));
        const allKeys = new Set([...originalByKey.keys(), ...currentByKey.keys()]);
        for (const key of allKeys) {
          const before = originalByKey.get(key);
          const now = currentByKey.get(key);
          if (!before || !now || !fieldsEqual(before, now)) {
            dirtyKeys.add(`${category}::${key}`);
          }
        }
      }
      if (dirtyKeys.size > 0) map.set(file.id, dirtyKeys);
    }
    return map;
  }, [validFiles]);

  const dirtyIds = useMemo(() => new Set(editedByFile.keys()), [editedByFile]);

  function handleCopyValue(category: Category, rowKey: string, group: string | undefined, displayLabel: string, sourceFileId: string, targetFileId: string) {
    if (sourceFileId === targetFileId) return;
    const sourceFile = files.find((f) => f.id === sourceFileId);
    const sourceRow = sourceFile?.rows[category].find((r) => r.key === rowKey);
    if (!sourceRow) return;
    const targetFile = files.find((f) => f.id === targetFileId);
    const targetRowBefore = targetFile?.rows[category].find((r) => r.key === rowKey);

    const steps: HistoryStep[] = [
      {
        fileId: targetFileId,
        category,
        rowKey,
        before: targetRowBefore
          ? { fields: targetRowBefore.fields, group: targetRowBefore.group, displayLabel: targetRowBefore.displayLabel }
          : undefined,
        after: { fields: sourceRow.fields, group, displayLabel },
      },
    ];
    if (dragMode === 'move') {
      steps.push({
        fileId: sourceFileId,
        category,
        rowKey,
        before: { fields: sourceRow.fields, group: sourceRow.group, displayLabel: sourceRow.displayLabel },
        after: undefined,
      });
    }

    setFiles((prev) => {
      const withCopy = applyFieldEdit({ files: prev, docs: docsRef.current, targetFileId, category, rowKey, group, displayLabel, fields: sourceRow.fields });
      if (dragMode !== 'move') return withCopy;
      return applyFieldDelete({ files: withCopy, docs: docsRef.current, targetFileId: sourceFileId, category, rowKey });
    });

    const verb = dragMode === 'move' ? 'Moved' : 'Copied';
    const arrow = dragMode === 'move' ? '→' : '⇒';
    pushHistory(`${verb} ${displayLabel} (${CATEGORY_LABELS[category]}): ${sourceFile?.name ?? sourceFileId} ${arrow} ${targetFile?.name ?? targetFileId}`, steps);
  }

  function handleManualEdit(category: Category, rowKey: string, group: string | undefined, displayLabel: string, targetFileId: string, fields: Record<string, unknown>) {
    const targetFile = files.find((f) => f.id === targetFileId);
    const before = targetFile?.rows[category].find((r) => r.key === rowKey);
    setFiles((prev) => applyFieldEdit({ files: prev, docs: docsRef.current, targetFileId, category, rowKey, group, displayLabel, fields }));
    pushHistory(`Filled in ${displayLabel} (${CATEGORY_LABELS[category]}) on ${targetFile?.name ?? targetFileId}`, [
      {
        fileId: targetFileId,
        category,
        rowKey,
        before: before ? { fields: before.fields, group: before.group, displayLabel: before.displayLabel } : undefined,
        after: { fields, group, displayLabel },
      },
    ]);
  }

  function handleDeleteValue(category: Category, rowKey: string, targetFileId: string) {
    const targetFile = files.find((f) => f.id === targetFileId);
    const before = targetFile?.rows[category].find((r) => r.key === rowKey);
    if (!before) return;
    setFiles((prev) => applyFieldDelete({ files: prev, docs: docsRef.current, targetFileId, category, rowKey }));
    pushHistory(`Deleted ${before.displayLabel} (${CATEGORY_LABELS[category]}) from ${targetFile?.name ?? targetFileId}`, [
      {
        fileId: targetFileId,
        category,
        rowKey,
        before: { fields: before.fields, group: before.group, displayLabel: before.displayLabel },
        after: undefined,
      },
    ]);
  }

  function handleRevertRow(category: Category, rowKey: string, targetFileId: string) {
    setFiles((prev) => revertRow({ files: prev, docs: docsRef.current, originalFiles: originalFilesRef.current, targetFileId, category, rowKey }));
    pruneHistoryForRow(targetFileId, category, rowKey);
  }

  /** Undoes the most recent `history.length - index` entries, restoring state to right before the entry at `index`. */
  function handleUndoTo(index: number) {
    const toUndo = history.slice(index).slice().reverse();
    setFiles((prev) => undoEntries(prev, docsRef.current, toUndo));
    setHistory((prev) => prev.slice(0, index));
    setShowHistory(false);
  }

  function handleUndo() {
    if (history.length === 0) return;
    handleUndoTo(history.length - 1);
  }

  async function handleSaveAll() {
    for (const id of dirtyIds) {
      await handleSaveFile(id);
    }
  }

  async function handleSaveFile(id: string) {
    const file = files.find((f) => f.id === id);
    const doc = docsRef.current.get(id);
    if (!file || !doc) return;
    setSavingIds((prev) => new Set(prev).add(id));
    setFileErrors((prev) => ({ ...prev, [id]: undefined }));
    try {
      const contents = serializeDocument(doc);
      const handle = handlesRef.current.get(id);
      if (handle) {
        await saveViaHandle(handle, contents);
        const reloaded = await reloadOneFile(id);
        if (reloaded) setFiles((prev) => prev.map((f) => (f.id === id ? reloaded : f)));
      } else {
        downloadAsFile(file.name, contents);
        originalRawRef.current.set(id, contents);
        originalFilesRef.current.set(id, file);
        // Refs alone don't trigger a re-render: force one so editedByFile recomputes against the new baseline.
        setFiles((prev) => [...prev]);
      }
    } catch (e) {
      setFileErrors((prev) => ({ ...prev, [id]: e instanceof Error ? e.message : String(e) }));
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  function handleDiscardFile(id: string) {
    const raw = originalRawRef.current.get(id);
    const file = files.find((f) => f.id === id);
    if (raw === undefined || !file) return;
    const restored = registerLoadedFile(id, file.name, raw);
    pruneHistoryForFile(id);
    setFiles((prev) => prev.map((f) => (f.id === id ? restored : f)));
  }

  return (
    <div className="app">
      <header>
        <div className="header-row">
          <h1>Profile / Permission Set Diff</h1>
          <button
            className="theme-toggle"
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            aria-label="Toggle dark mode"
            title="Toggle dark mode"
          >
            {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
          </button>
        </div>
        <p className="subtitle">Local, browser-only comparison — nothing leaves your machine.</p>
      </header>

      <FileDropZone onFiles={handleFiles} />

      {files.length > 0 && (
        <div className="reload-bar">
          <button onClick={handleReload} disabled={reloading || reloadableCount === 0}>
            {reloading ? 'Reloading…' : `Reload from disk (${reloadableCount}/${files.length})`}
          </button>
          {reloadableCount < files.length && (
            <span className="reload-hint">
              {reloadableCount === 0
                ? "Your browser doesn't support re-reading local files — remove and re-add files to refresh (Chrome/Edge support live reload)."
                : 'Some files were added without a live handle and can only be refreshed by re-adding them.'}
            </span>
          )}
          {dirtyIds.size > 0 && (
            <button onClick={handleSaveAll}>Save All ({dirtyIds.size})</button>
          )}
          {history.length > 0 && (
            <span className="undo-controls">
              <button onClick={handleUndo} title={history[history.length - 1].label}>
                ↩ Undo ({history.length})
              </button>
              <span className="history-dropdown">
                <button onClick={() => setShowHistory((s) => !s)} aria-expanded={showHistory}>
                  History ▾
                </button>
                {showHistory && (
                  <ul className="history-list">
                    {[...history].reverse().map((entry, i) => {
                      const index = history.length - 1 - i;
                      return (
                        <li key={entry.id}>
                          <button onClick={() => handleUndoTo(index)}>Roll back to before: {entry.label}</button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </span>
            </span>
          )}
        </div>
      )}

      <FileList
        files={files}
        onRemove={handleRemove}
        dirtyIds={dirtyIds}
        savingIds={savingIds}
        fileErrors={fileErrors}
        canSaveDirectly={(id) => handlesRef.current.has(id)}
        onSave={handleSaveFile}
        onDiscard={handleDiscardFile}
        selectableForDeploy={sfCliAvailable === true}
        selectedForDeploy={selectedForDeploy}
        onToggleSelectForDeploy={handleToggleSelectForDeploy}
      />

      {sfCliAvailable === true && (
        <>
          <SfOrgPanel
            orgs={orgs}
            orgsLoading={orgsLoading}
            selectedOrgUsername={selectedOrgUsername}
            onSelectOrg={setSelectedOrgUsername}
            loginInFlight={loginInFlight}
            loginError={loginError}
            onAddOrg={handleAddOrg}
            onCancelLogin={handleCancelLogin}
            onRemoveOrg={handleRemoveOrg}
            removingUsername={removingOrgUsername}
          />
          <DeployToolbar
            selectedCount={selectedForDeploy.size}
            selectedOrgUsername={selectedOrgUsername}
            deployAction={deployAction}
            onValidate={handleValidateSelected}
            onDeploy={handleDeploySelected}
          />
          {deployError && <p className="file-error">{deployError}</p>}
          {deployResult && <DeployResultPanel result={deployResult} onDismiss={() => setDeployResult(null)} />}
        </>
      )}

      {validFiles.length < 2 && (
        <p className="hint">Load at least 2 files to see a comparison.</p>
      )}

      {diff && (
        <>
          <div className="view-toggle">
            <button className={!showProfileOnly ? 'active' : ''} onClick={() => setShowProfileOnly(false)}>
              Comparison
            </button>
            <button className={showProfileOnly ? 'active' : ''} onClick={() => setShowProfileOnly(true)}>
              Profile-only fields
            </button>
          </div>

          {!showProfileOnly ? (
            <>
              <SummaryDashboard diff={diff} activeCategory={activeCategory} onSelectCategory={setActiveCategory} />
              <DiffTable
                files={validFiles}
                rows={diff.categories[activeCategory]}
                category={activeCategory}
                editedByFile={editedByFile}
                onCopyValue={handleCopyValue}
                onManualEdit={handleManualEdit}
                onDeleteValue={handleDeleteValue}
                onRevertRow={handleRevertRow}
                dragMode={dragMode}
                onChangeDragMode={setDragMode}
              />
            </>
          ) : (
            <ProfileOnlySection files={validFiles} />
          )}
        </>
      )}
    </div>
  );
}
