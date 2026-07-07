import { useState } from 'react';
import { CATEGORY_SCHEMAS } from '../lib/editing/editSchema';
import type { Category } from '../lib/types';

interface Props {
  category: Category;
  onSubmit: (fields: Record<string, unknown>) => void;
  onCancel: () => void;
}

export default function InlineFieldEditor({ category, onSubmit, onCancel }: Props) {
  const schema = CATEGORY_SCHEMAS[category];
  const [values, setValues] = useState<Record<string, unknown>>(() =>
    Object.fromEntries(schema.fields.map((f) => [f.name, f.default])),
  );

  function setField(name: string, value: unknown) {
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  return (
    <div className="inline-field-editor" onClick={(e) => e.stopPropagation()} onDragStart={(e) => e.stopPropagation()}>
      {schema.fields.map((f) => (
        <label key={f.name} className="inline-field-editor-row">
          {f.editor.kind === 'boolean' && (
            <>
              <input type="checkbox" checked={!!values[f.name]} onChange={(e) => setField(f.name, e.target.checked)} />
              {f.label}
            </>
          )}
          {f.editor.kind === 'enum' && (
            <>
              <span>{f.label}</span>
              <select value={String(values[f.name])} onChange={(e) => setField(f.name, e.target.value)}>
                {f.editor.options.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </>
          )}
          {f.editor.kind === 'string' && (
            <>
              <span>{f.label}</span>
              <input type="text" value={String(values[f.name] ?? '')} onChange={(e) => setField(f.name, e.target.value)} />
            </>
          )}
        </label>
      ))}
      <div className="inline-field-editor-actions">
        <button onClick={() => onSubmit(values)}>Save</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
