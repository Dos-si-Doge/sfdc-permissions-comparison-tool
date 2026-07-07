import { getDirectChildren, elementToObject } from '../parseXml';
import type { NormalizedRow, SourceType } from '../types';

export type NormalizedVisibility = 'Visible' | 'Available' | 'Hidden';

export const PROFILE_MAP: Record<string, NormalizedVisibility> = {
  DefaultOn: 'Visible',
  DefaultOff: 'Available',
  Hidden: 'Hidden',
};

export const PERMSET_MAP: Record<string, NormalizedVisibility> = {
  Visible: 'Visible',
  Available: 'Available',
  None: 'Hidden',
};

export function normalizeTabVisibility(doc: Document, sourceType: SourceType): NormalizedRow[] {
  const tagName = sourceType === 'profile' ? 'tabVisibilities' : 'tabSettings';
  const map = sourceType === 'profile' ? PROFILE_MAP : PERMSET_MAP;
  return getDirectChildren(doc, tagName).map((el) => {
    const obj = elementToObject(el);
    const key = obj.tab ?? '(unknown tab)';
    const rawVisibility = obj.visibility ?? '';
    return {
      key,
      displayLabel: key,
      fields: { visibility: map[rawVisibility] ?? rawVisibility },
    };
  });
}
