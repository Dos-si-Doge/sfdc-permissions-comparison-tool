import { getDirectChildren, elementToObject } from '../parseXml';
import type { NormalizedRow } from '../types';

export function normalizeCustomSettingAccesses(doc: Document): NormalizedRow[] {
  return getDirectChildren(doc, 'customSettingAccesses').map((el) => {
    const obj = elementToObject(el);
    const key = obj.name ?? '(unknown custom setting)';
    return { key, displayLabel: key, fields: { enabled: obj.enabled === 'true' } };
  });
}
