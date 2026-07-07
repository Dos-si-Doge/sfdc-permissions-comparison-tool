import { useMemo, useRef, useState } from 'react';
import FileDropZone from './components/FileDropZone';
import FileList from './components/FileList';
import SummaryDashboard from './components/SummaryDashboard';
import DiffTable from './components/DiffTable';
import ProfileOnlySection from './components/ProfileOnlySection';
import { normalizeFile } from './lib/normalize';
import { computeDiff } from './lib/diffEngine';
import type { FileEntry } from './lib/fileEntry';
import type { Category, NormalizedFile } from './lib/types';

let nextId = 0;

export default function App() {
  const [files, setFiles] = useState<NormalizedFile[]>([]);
  const [activeCategory, setActiveCategory] = useState<Category>('objectPermissions');
  const [showProfileOnly, setShowProfileOnly] = useState(false);
  const [reloading, setReloading] = useState(false);
  const handlesRef = useRef<Map<string, FileSystemFileHandle>>(new Map());

  async function handleFiles(incoming: FileEntry[]) {
    const loaded = await Promise.all(
      incoming
        .filter((entry) => entry.file.name.endsWith('.xml'))
        .map(async (entry) => {
          const raw = await entry.file.text();
          const id = `f${nextId++}`;
          if (entry.handle) handlesRef.current.set(id, entry.handle);
          return normalizeFile({ id, name: entry.file.name, sourceType: 'profile', raw });
        }),
    );
    setFiles((prev) => [...prev, ...loaded]);
  }

  function handleRemove(id: string) {
    handlesRef.current.delete(id);
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }

  const reloadableCount = useMemo(
    () => files.filter((f) => handlesRef.current.has(f.id)).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [files],
  );

  async function handleReload() {
    setReloading(true);
    try {
      const updated = await Promise.all(
        files.map(async (f) => {
          const handle = handlesRef.current.get(f.id);
          if (!handle) return f;
          const file = await handle.getFile();
          const raw = await file.text();
          return normalizeFile({ id: f.id, name: file.name, sourceType: 'profile', raw });
        }),
      );
      setFiles(updated);
    } finally {
      setReloading(false);
    }
  }

  const validFiles = useMemo(() => files.filter((f) => !f.error), [files]);
  const diff = useMemo(() => (validFiles.length >= 2 ? computeDiff(validFiles) : null), [validFiles]);

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

      <FileList files={files} onRemove={handleRemove} />

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
              <DiffTable files={validFiles} rows={diff.categories[activeCategory]} category={activeCategory} />
            </>
          ) : (
            <ProfileOnlySection files={validFiles} />
          )}
        </>
      )}
    </div>
  );
}
