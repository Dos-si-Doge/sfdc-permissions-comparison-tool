import { getDirectChildren, elementToObject } from '../parseXml';
import type { NormalizedRow } from '../types';

export function normalizeRecordTypeVisibilities(doc: Document): NormalizedRow[] {
  return getDirectChildren(doc, 'recordTypeVisibilities').map((el) => {
    const obj = elementToObject(el);
    const key = obj.recordType ?? '(unknown record type)';
    const fields: Record<string, unknown> = { visible: obj.visible === 'true' };
    if ('personAccountDefault' in obj) {
      fields.personAccountDefault = obj.personAccountDefault === 'true';
    }
    // `default` intentionally omitted: profile-only, no permission set equivalent.
    return { key, displayLabel: key, fields };
  });
}
