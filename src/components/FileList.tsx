import type { NormalizedFile } from '../lib/types';

interface Props {
  files: NormalizedFile[];
  onRemove: (id: string) => void;
  dirtyIds: Set<string>;
  savingIds: Set<string>;
  fileErrors: Record<string, string | undefined>;
  canSaveDirectly: (id: string) => boolean;
  onSave: (id: string) => void;
  onDiscard: (id: string) => void;
}

export default function FileList({ files, onRemove, dirtyIds, savingIds, fileErrors, canSaveDirectly, onSave, onDiscard }: Props) {
  if (files.length === 0) return null;

  return (
    <ul className="file-list">
      {files.map((f) => {
        const dirty = dirtyIds.has(f.id);
        const saving = savingIds.has(f.id);
        const error = fileErrors[f.id];
        return (
          <li key={f.id} className={f.error ? 'file-item file-item-error' : 'file-item'}>
            <span className={`badge badge-${f.sourceType}`}>{f.sourceType === 'profile' ? 'Profile' : 'PermSet'}</span>
            <span className="file-name">{f.name}</span>
            {f.error && <span className="file-error">{f.error}</span>}
            {dirty && (
              <span className="file-edit-actions">
                <span className="file-dirty-hint">
                  {canSaveDirectly(f.id) ? 'Unsaved edits — will save directly to disk' : 'Unsaved edits — will download an edited copy'}
                </span>
                <button onClick={() => onSave(f.id)} disabled={saving}>
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
                <button onClick={() => onDiscard(f.id)} disabled={saving}>
                  Discard
                </button>
              </span>
            )}
            {error && <span className="file-error">{error}</span>}
            <button onClick={() => onRemove(f.id)} aria-label={`Remove ${f.name}`}>
              ✕
            </button>
          </li>
        );
      })}
    </ul>
  );
}
