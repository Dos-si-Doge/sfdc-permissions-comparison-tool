import { useMemo, useRef, useState } from 'react';
import FileDropZone from './components/FileDropZone';
import FileList from './components/FileList';
import SummaryDashboard from './components/SummaryDashboard';
import DiffTable from './components/DiffTable';
import ProfileOnlySection from './components/ProfileOnlySection';
import { normalizeFileWithDocument } from './lib/normalize';
import { computeDiff, fieldsEqual } from './lib/diffEngine';
import { applyFieldEdit, applyFieldDelete, revertRow } from './lib/editing/applyEdit';
import { serializeDocument, saveViaHandle, downloadAsFile } from './lib/editing/saveFile';
import type { FileEntry } from './lib/fileEntry';
import { CATEGORIES, type Category, type NormalizedFile } from './lib/types';

let nextId = 0;

export default function App() {
  const [files, setFiles] = useState<NormalizedFile[]>([]);
  const [activeCategory, setActiveCategory] = useState<Category>('objectPermissions');
  const [showProfileOnly, setShowProfileOnly] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [fileErrors, setFileErrors] = useState<Record<string, string | undefined>>({});
  const [dragMode, setDragMode] = useState<'copy' | 'move'>('copy');
  const handlesRef = useRef<Map<string, FileSystemFileHandle>>(new Map());
  const docsRef = useRef<Map<string, Document>>(new Map());
  const originalRawRef = useRef<Map<string, string>>(new Map());
  const originalFilesRef = useRef<Map<string, NormalizedFile>>(new Map());

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
        files.map(async (f) => (await reloadOneFile(f.id)) ?? f),
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
    setFiles((prev) => {
      const withCopy = applyFieldEdit({ files: prev, docs: docsRef.current, targetFileId, category, rowKey, group, displayLabel, fields: sourceRow.fields });
      if (dragMode !== 'move') return withCopy;
      return applyFieldDelete({ files: withCopy, docs: docsRef.current, targetFileId: sourceFileId, category, rowKey });
    });
  }

  function handleManualEdit(category: Category, rowKey: string, group: string | undefined, displayLabel: string, targetFileId: string, fields: Record<string, unknown>) {
    setFiles((prev) => applyFieldEdit({ files: prev, docs: docsRef.current, targetFileId, category, rowKey, group, displayLabel, fields }));
  }

  function handleDeleteValue(category: Category, rowKey: string, targetFileId: string) {
    setFiles((prev) => applyFieldDelete({ files: prev, docs: docsRef.current, targetFileId, category, rowKey }));
  }

  function handleRevertRow(category: Category, rowKey: string, targetFileId: string) {
    setFiles((prev) => revertRow({ files: prev, docs: docsRef.current, originalFiles: originalFilesRef.current, targetFileId, category, rowKey }));
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
    setFiles((prev) => prev.map((f) => (f.id === id ? restored : f)));
  }

  return (
    <div className="app">
      <header>
        <h1>Profile / Permission Set Diff</h1>
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
      />

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
