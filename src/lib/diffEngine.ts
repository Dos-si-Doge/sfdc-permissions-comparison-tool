import { CATEGORIES } from './types';
import type { Category, DiffResult, DiffRow, NormalizedFile, RowStatus } from './types';

function fieldsEqual(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

function computeStatus(values: (Record<string, unknown> | undefined)[]): RowStatus {
  const present = values.filter((v): v is Record<string, unknown> => v !== undefined);
  if (present.length < values.length) return 'missing';
  const [first, ...rest] = present;
  const allEqual = rest.every((v) => fieldsEqual(first, v));
  return allEqual ? 'identical' : 'different';
}

export function computeDiff(files: NormalizedFile[]): DiffResult {
  const categories = {} as Record<Category, DiffRow[]>;
  const summary = {} as Record<Category, { total: number; different: number; missing: number }>;

  for (const category of CATEGORIES) {
    const rowMap = new Map<
      string,
      { displayLabel: string; group?: string; values: Record<string, Record<string, unknown> | undefined> }
    >();

    for (const file of files) {
      for (const row of file.rows[category]) {
        if (!rowMap.has(row.key)) {
          rowMap.set(row.key, { displayLabel: row.displayLabel, group: row.group, values: {} });
        }
        rowMap.get(row.key)!.values[file.id] = row.fields;
      }
    }

    const diffRows: DiffRow[] = [];
    let different = 0;
    let missing = 0;

    for (const [key, { displayLabel, group, values }] of rowMap) {
      const orderedValues = files.map((f) => values[f.id]);
      const status = computeStatus(orderedValues);
      if (status === 'different') different++;
      if (status === 'missing') missing++;
      diffRows.push({ key, displayLabel, group, status, values });
    }

    diffRows.sort((a, b) => {
      const groupCompare = (a.group ?? '').localeCompare(b.group ?? '');
      if (groupCompare !== 0) return groupCompare;
      return a.displayLabel.localeCompare(b.displayLabel);
    });

    categories[category] = diffRows;
    summary[category] = { total: diffRows.length, different, missing };
  }

  return { categories, summary };
}
