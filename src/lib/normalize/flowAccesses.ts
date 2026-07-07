import { getDirectChildren, elementToObject } from '../parseXml';
import type { NormalizedRow } from '../types';

export function normalizeFlowAccesses(doc: Document): NormalizedRow[] {
  return getDirectChildren(doc, 'flowAccesses').map((el) => {
    const obj = elementToObject(el);
    const key = obj.flow ?? '(unknown flow)';
    return { key, displayLabel: key, fields: { enabled: obj.enabled === 'true' } };
  });
}
