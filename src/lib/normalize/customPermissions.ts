import { getDirectChildren, elementToObject } from '../parseXml';
import type { NormalizedRow } from '../types';

export function normalizeCustomPermissions(doc: Document): NormalizedRow[] {
  return getDirectChildren(doc, 'customPermissions').map((el) => {
    const obj = elementToObject(el);
    const key = obj.name ?? '(unknown custom permission)';
    return { key, displayLabel: key, fields: { enabled: obj.enabled === 'true' } };
  });
}
