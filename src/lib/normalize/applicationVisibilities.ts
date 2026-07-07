import { getDirectChildren, elementToObject } from '../parseXml';
import type { NormalizedRow } from '../types';

export function normalizeApplicationVisibilities(doc: Document): NormalizedRow[] {
  return getDirectChildren(doc, 'applicationVisibilities').map((el) => {
    const obj = elementToObject(el);
    const key = obj.application ?? '(unknown application)';
    // `default` intentionally omitted: profile-only, no permission set equivalent.
    return { key, displayLabel: key, fields: { visible: obj.visible === 'true' } };
  });
}
