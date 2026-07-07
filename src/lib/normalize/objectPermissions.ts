import { getDirectChildren, elementToObject } from '../parseXml';
import type { NormalizedRow } from '../types';

const BOOLEAN_FIELDS = ['allowCreate', 'allowDelete', 'allowEdit', 'allowRead', 'modifyAllRecords', 'viewAllRecords'];

export function normalizeObjectPermissions(doc: Document): NormalizedRow[] {
  return getDirectChildren(doc, 'objectPermissions').map((el) => {
    const obj = elementToObject(el);
    const key = obj.object ?? '(unknown object)';
    const fields: Record<string, unknown> = {};
    for (const f of BOOLEAN_FIELDS) {
      if (f in obj) fields[f] = obj[f] === 'true';
    }
    return { key, displayLabel: key, fields };
  });
}
