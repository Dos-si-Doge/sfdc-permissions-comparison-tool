import { useMemo, useState } from 'react';
import type { Category, DiffRow, NormalizedFile } from '../lib/types';
import { formatFileHeaderLabel } from '../lib/formatFileLabel';
import DiffCell from './DiffCell';

interface Props {
  files: NormalizedFile[];
  rows: DiffRow[];
  category: Category;
}

type DisplayItem = { kind: 'group'; group: string } | { kind: 'row'; row: DiffRow };

export default function DiffTable({ files, rows, category }: Props) {
  const [onlyDifferences, setOnlyDifferences] = useState(false);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(false);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (onlyDifferences && row.status === 'identical') return false;
      if (search && !row.displayLabel.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [rows, onlyDifferences, search]);

  const displayItems = useMemo<DisplayItem[]>(() => {
    const items: DisplayItem[] = [];
    let currentGroup: string | undefined;
    for (const row of filteredRows) {
      if (row.group !== undefined && row.group !== currentGroup) {
        currentGroup = row.group;
        items.push({ kind: 'group', group: row.group });
      }
      items.push({ kind: 'row', row });
    }
    return items;
  }, [filteredRows]);

  return (
    <div className={expanded ? 'diff-table-wrapper expanded' : 'diff-table-wrapper'}>
      <div className="diff-table-controls">
        <label>
          <input type="checkbox" checked={onlyDifferences} onChange={(e) => setOnlyDifferences(e.target.checked)} />
          Show only differences
        </label>
        <input
          type="text"
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <label>
          <input type="checkbox" checked={expanded} onChange={(e) => setExpanded(e.target.checked)} />
          Expand table to full width
        </label>
        <span className="row-count">
          {filteredRows.length} of {rows.length} rows
        </span>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th className="col-name">Name</th>
              {files.map((f) => (
                <th key={f.id} title={f.name}>
                  {formatFileHeaderLabel(f)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayItems.map((item) =>
              item.kind === 'group' ? (
                <tr key={`group-${item.group}`} className="group-row">
                  <td className="col-name group-header">{item.group}</td>
                  <td className="group-header-filler" colSpan={files.length} />
                </tr>
              ) : (
                <tr key={item.row.key} className={`row-${item.row.status}`}>
                  <td className="col-name row-label">{item.row.displayLabel}</td>
                  {files.map((f) => (
                    <DiffCell key={f.id} value={item.row.values[f.id]} category={category} />
                  ))}
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
