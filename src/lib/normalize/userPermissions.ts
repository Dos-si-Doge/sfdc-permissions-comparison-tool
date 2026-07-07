import { getDirectChildren, elementToObject } from '../parseXml';
import type { NormalizedRow } from '../types';

export function normalizeUserPermissions(doc: Document): NormalizedRow[] {
  return getDirectChildren(doc, 'userPermissions').map((el) => {
    const obj = elementToObject(el);
    const key = obj.name ?? '(unknown permission)';
    return { key, displayLabel: key, fields: { enabled: obj.enabled === 'true' } };
  });
}
