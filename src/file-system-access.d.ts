export {};

declare global {
  interface Window {
    showOpenFilePicker?: (options?: {
      multiple?: boolean;
      types?: { description?: string; accept: Record<string, string[]> }[];
    }) => Promise<FileSystemFileHandle[]>;
  }

  interface DataTransferItem {
    getAsFileSystemHandle?: () => Promise<FileSystemFileHandle | FileSystemDirectoryHandle | null>;
  }
}
