import type { Category, NormalizedFile } from '../types';
import { upsertRow, removeRow } from './serializeEdit';

export interface ApplyFieldEditArgs {
  files: NormalizedFile[];
  docs: Map<string, Document>;
  targetFileId: string;
  category: Category;
  rowKey: string;
  group: string | undefined;
  displayLabel: string;
  fields: Record<string, unknown>;
}

/** Writes `fields` into the retained Document for targetFileId and mirrors the change into `files` (add-or-replace by key). */
export function applyFieldEdit(args: ApplyFieldEditArgs): NormalizedFile[] {
  const { files, docs, targetFileId, category, rowKey, group, displayLabel, fields } = args;
  const targetFile = files.find((f) => f.id === targetFileId);
  const doc = docs.get(targetFileId);
  if (!targetFile || !doc) return files;

  upsertRow(doc, targetFile.sourceType, category, rowKey, fields);

  const rows = targetFile.rows[category];
  const idx = rows.findIndex((r) => r.key === rowKey);
  const newRow = { key: rowKey, displayLabel, group, fields };
  const newRows = idx >= 0 ? rows.map((r, i) => (i === idx ? newRow : r)) : [...rows, newRow];
  const updatedFile: NormalizedFile = { ...targetFile, rows: { ...targetFile.rows, [category]: newRows } };
  return files.map((f) => (f.id === targetFileId ? updatedFile : f));
}

export interface ApplyFieldDeleteArgs {
  files: NormalizedFile[];
  docs: Map<string, Document>;
  targetFileId: string;
  category: Category;
  rowKey: string;
}

/** Removes the row for targetFileId from the retained Document and mirrors the removal into `files`. */
export function applyFieldDelete(args: ApplyFieldDeleteArgs): NormalizedFile[] {
  const { files, docs, targetFileId, category, rowKey } = args;
  const targetFile = files.find((f) => f.id === targetFileId);
  const doc = docs.get(targetFileId);
  if (!targetFile || !doc) return files;

  removeRow(doc, targetFile.sourceType, category, rowKey);

  const rows = targetFile.rows[category].filter((r) => r.key !== rowKey);
  const updatedFile: NormalizedFile = { ...targetFile, rows: { ...targetFile.rows, [category]: rows } };
  return files.map((f) => (f.id === targetFileId ? updatedFile : f));
}

export interface RevertRowArgs {
  files: NormalizedFile[];
  docs: Map<string, Document>;
  originalFiles: Map<string, NormalizedFile>;
  targetFileId: string;
  category: Category;
  rowKey: string;
}

/**
 * Restores a row to its last-loaded/last-saved state, covering all three staged states uniformly:
 * edited (restore original fields), newly-created (delete, since the original had no such row), and
 * pending-delete (restore original fields, undoing the pending removal).
 */
export function revertRow(args: RevertRowArgs): NormalizedFile[] {
  const { files, docs, originalFiles, targetFileId, category, rowKey } = args;
  const original = originalFiles.get(targetFileId);
  const originalRow = original?.rows[category].find((r) => r.key === rowKey);

  if (originalRow) {
    return applyFieldEdit({
      files,
      docs,
      targetFileId,
      category,
      rowKey,
      group: originalRow.group,
      displayLabel: originalRow.displayLabel,
      fields: originalRow.fields,
    });
  }
  return applyFieldDelete({ files, docs, targetFileId, category, rowKey });
}
