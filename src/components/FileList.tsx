import type { NormalizedFile } from '../lib/types';

interface Props {
  files: NormalizedFile[];
  onRemove: (id: string) => void;
}

export default function FileList({ files, onRemove }: Props) {
  if (files.length === 0) return null;

  return (
    <ul className="file-list">
      {files.map((f) => (
        <li key={f.id} className={f.error ? 'file-item file-item-error' : 'file-item'}>
          <span className={`badge badge-${f.sourceType}`}>{f.sourceType === 'profile' ? 'Profile' : 'PermSet'}</span>
          <span className="file-name">{f.name}</span>
          {f.error && <span className="file-error">{f.error}</span>}
          <button onClick={() => onRemove(f.id)} aria-label={`Remove ${f.name}`}>
            ✕
          </button>
        </li>
      ))}
    </ul>
  );
}
