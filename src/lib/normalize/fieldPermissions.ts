import { getDirectChildren, elementToObject } from '../parseXml';
import type { NormalizedRow } from '../types';

export function normalizeFieldPermissions(doc: Document): NormalizedRow[] {
  return getDirectChildren(doc, 'fieldPermissions').map((el) => {
    const obj = elementToObject(el);
    const key = obj.field ?? '(unknown field)';
    const dotIndex = key.indexOf('.');
    const group = dotIndex >= 0 ? key.slice(0, dotIndex) : undefined;
    const displayLabel = dotIndex >= 0 ? key.slice(dotIndex + 1) : key;
    return {
      key,
      displayLabel,
      group,
      fields: {
        editable: obj.editable === 'true',
        readable: obj.readable === 'true',
      },
    };
  });
}
