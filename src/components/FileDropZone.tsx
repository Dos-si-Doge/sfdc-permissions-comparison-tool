import { useRef, type DragEvent } from 'react';
import { supportsFileSystemAccess, type FileEntry } from '../lib/fileEntry';

interface Props {
  onFiles: (entries: FileEntry[]) => void;
}

export default function FileDropZone({ onFiles }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const items = Array.from(e.dataTransfer.items ?? []);

    if (items.length > 0) {
      const entries = await Promise.all(
        items
          .filter((item) => item.kind === 'file')
          .map(async (item): Promise<FileEntry | null> => {
            const handle = (await item.getAsFileSystemHandle?.()) ?? null;
            if (handle && handle.kind === 'file') {
              const file = await (handle as FileSystemFileHandle).getFile();
              return { file, handle: handle as FileSystemFileHandle };
            }
            const file = item.getAsFile();
            return file ? { file } : null;
          }),
      );
      onFiles(entries.filter((e): e is FileEntry => e !== null));
      return;
    }

    onFiles(Array.from(e.dataTransfer.files).map((file) => ({ file })));
  }

  async function handleClick() {
    if (supportsFileSystemAccess()) {
      try {
        const handles = await window.showOpenFilePicker!({
          multiple: true,
          types: [{ description: 'Salesforce metadata XML', accept: { 'text/xml': ['.xml'] } }],
        });
        const entries = await Promise.all(
          handles.map(async (handle) => ({ file: await handle.getFile(), handle })),
        );
        onFiles(entries);
        return;
      } catch (err) {
        // User cancelled the picker, or the API rejected — fall back to the plain input.
        if (err instanceof DOMException && err.name === 'AbortError') return;
      }
    }
    inputRef.current?.click();
  }

  return (
    <div className="drop-zone" onDrop={handleDrop} onDragOver={(e) => e.preventDefault()} onClick={handleClick}>
      <p>Drag &amp; drop .profile-meta.xml / .permissionset-meta.xml files here, or click to browse</p>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".xml"
        style={{ display: 'none' }}
        onChange={(e) => {
          if (e.target.files) onFiles(Array.from(e.target.files).map((file) => ({ file })));
          e.target.value = '';
        }}
      />
    </div>
  );
}
