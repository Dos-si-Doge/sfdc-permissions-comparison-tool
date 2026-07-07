import type { Category, NormalizedFile } from '../types';
import { applyFieldEdit, applyFieldDelete } from './applyEdit';

interface RowSnapshot {
  fields: Record<string, unknown>;
  group: string | undefined;
  displayLabel: string;
}

export interface HistoryStep {
  fileId: string;
  category: Category;
  rowKey: string;
  /** Row state before this step; undefined if the row didn't exist for this file beforehand. */
  before: RowSnapshot | undefined;
  /** Row state after this step; undefined if this step deleted the row. */
  after: RowSnapshot | undefined;
}

export interface HistoryEntry {
  id: string;
  label: string;
  steps: HistoryStep[];
}

/**
 * Applies the inverse of each step across `entries`, restoring every affected row to its
 * pre-entry state. `entries` must be ordered most-recent-first (the order a stack pops in) —
 * within each entry, steps are also undone in reverse so multi-step entries (e.g. a "move")
 * unwind cleanly regardless of which step was applied first.
 */
export function undoEntries(files: NormalizedFile[], docs: Map<string, Document>, entries: HistoryEntry[]): NormalizedFile[] {
  let next = files;
  for (const entry of entries) {
    for (const step of [...entry.steps].reverse()) {
      next = step.before
        ? applyFieldEdit({
            files: next,
            docs,
            targetFileId: step.fileId,
            category: step.category,
            rowKey: step.rowKey,
            group: step.before.group,
            displayLabel: step.before.displayLabel,
            fields: step.before.fields,
          })
        : applyFieldDelete({ files: next, docs, targetFileId: step.fileId, category: step.category, rowKey: step.rowKey });
    }
  }
  return next;
}
