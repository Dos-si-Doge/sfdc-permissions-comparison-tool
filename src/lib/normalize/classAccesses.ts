import { getDirectChildren, elementToObject } from '../parseXml';
import type { NormalizedRow } from '../types';

export function normalizeClassAccesses(doc: Document): NormalizedRow[] {
  return getDirectChildren(doc, 'classAccesses').map((el) => {
    const obj = elementToObject(el);
    const key = obj.apexClass ?? '(unknown class)';
    return { key, displayLabel: key, fields: { enabled: obj.enabled === 'true' } };
  });
}
