import { useState, type DragEvent } from 'react';
import type { Category } from '../lib/types';
import InlineFieldEditor from './InlineFieldEditor';

interface Props {
  value: Record<string, unknown> | undefined;
  category: Category;
  fileId: string;
  isEdited: boolean;
  dragMode: 'copy' | 'move';
  onCopyFrom: (sourceFileId: string) => void;
  onManualEdit: (fields: Record<string, unknown>) => void;
  onDelete: () => void;
  onRevert: () => void;
}

const DRAG_MIME = 'application/x-permdiff-cell';

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

export default function DiffCell({ value, category, fileId, isEdited, dragMode, onCopyFrom, onManualEdit, onDelete, onRevert }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [editing, setEditing] = useState(false);

  function handleDragStart(e: DragEvent<HTMLTableCellElement>) {
    e.dataTransfer.setData(DRAG_MIME, JSON.stringify({ sourceFileId: fileId }));
    e.dataTransfer.effectAllowed = dragMode;
  }

  function handleDragOver(e: DragEvent<HTMLTableCellElement>) {
    if (!e.dataTransfer.types.includes(DRAG_MIME)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = dragMode;
  }

  function handleDrop(e: DragEvent<HTMLTableCellElement>) {
    if (!e.dataTransfer.types.includes(DRAG_MIME)) return;
    e.preventDefault();
    setDragOver(false);
    const raw = e.dataTransfer.getData(DRAG_MIME);
    if (!raw) return;
    const { sourceFileId } = JSON.parse(raw) as { sourceFileId: string };
    if (sourceFileId === fileId) return;
    onCopyFrom(sourceFileId);
  }

  const cellClass = ['cell', dragOver ? 'cell-drop-target' : '', isEdited ? 'cell-edited' : ''].filter(Boolean).join(' ');

  if (value === undefined) {
    if (editing) {
      return (
        <td className={cellClass}>
          <InlineFieldEditor
            category={category}
            onSubmit={(fields) => {
              setEditing(false);
              onManualEdit(fields);
            }}
            onCancel={() => setEditing(false)}
          />
        </td>
      );
    }
    return (
      <td
        className={`${cellClass} cell-missing`}
        onDragOver={handleDragOver}
        onDragEnter={() => setDragOver(true)}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => setEditing(true)}
      >
        {isEdited && (
          <button
            className="cell-revert-btn"
            title="Revert to last saved value"
            onClick={(e) => {
              e.stopPropagation();
              onRevert();
            }}
          >
            ↩
          </button>
        )}
        —
      </td>
    );
  }

  const extraClass = category === 'fieldPermissions' ? fieldPermissionClass(value) : '';
  const lines = formatLines(value);
  return (
    <td
      className={`${cellClass} ${extraClass}`.trim()}
      draggable
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnter={() => setDragOver(true)}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      <span className="cell-actions">
        <button
          className="cell-delete-btn"
          title="Delete this permission"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          ×
        </button>
        {isEdited && (
          <button
            className="cell-revert-btn"
            title="Revert to last saved value"
            onClick={(e) => {
              e.stopPropagation();
              onRevert();
            }}
          >
            ↩
          </button>
        )}
      </span>
      {lines.map((line, i) => (
        <div key={i} className="cell-line">
          {line}
        </div>
      ))}
    </td>
  );
}
