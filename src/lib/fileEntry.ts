/** A loaded file plus (when the browser supports it) a live handle we can re-read from disk. */
export interface FileEntry {
  file: File;
  handle?: FileSystemFileHandle;
}

export function supportsFileSystemAccess(): boolean {
  return typeof window.showOpenFilePicker === 'function';
}
