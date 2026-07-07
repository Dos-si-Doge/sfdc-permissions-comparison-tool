import { getDirectChildren, elementToObject } from '../parseXml';
import type { NormalizedRow } from '../types';

export function normalizeCustomMetadataTypeAccesses(doc: Document): NormalizedRow[] {
  return getDirectChildren(doc, 'customMetadataTypeAccesses').map((el) => {
    const obj = elementToObject(el);
    const key = obj.name ?? '(unknown custom metadata type)';
    return { key, displayLabel: key, fields: { enabled: obj.enabled === 'true' } };
  });
}
