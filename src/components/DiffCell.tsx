import type { Category } from '../lib/types';

interface Props {
  value: Record<string, unknown> | undefined;
  category: Category;
}

function formatLines(value: Record<string, unknown>): string[] {
  const entries = Object.entries(value);
  if (entries.length === 1) {
    return [String(entries[0][1])];
  }
  return entries.map(([k, v]) => `${k}: ${v}`);
}

function fieldPermissionClass(value: Record<string, unknown>): string {
  if (value.readable && value.editable) return 'cell-fp-full';
  if (value.readable && !value.editable) return 'cell-fp-readonly';
  return 'cell-fp-none';
}

export default function DiffCell({ value, category }: Props) {
  if (value === undefined) {
    return <td className="cell cell-missing">—</td>;
  }
  const extraClass = category === 'fieldPermissions' ? fieldPermissionClass(value) : '';
  const lines = formatLines(value);
  return (
    <td className={`cell ${extraClass}`.trim()}>
      {lines.map((line, i) => (
        <div key={i} className="cell-line">
          {line}
        </div>
      ))}
    </td>
  );
}
