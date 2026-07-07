import { getDirectChildren, elementToObject } from '../parseXml';
import type { NormalizedRow } from '../types';

export function normalizePageAccesses(doc: Document): NormalizedRow[] {
  return getDirectChildren(doc, 'pageAccesses').map((el) => {
    const obj = elementToObject(el);
    const key = obj.apexPage ?? '(unknown page)';
    return { key, displayLabel: key, fields: { enabled: obj.enabled === 'true' } };
  });
}
