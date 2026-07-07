import { getDirectChildren, getSingleChildText } from '../parseXml';
import type { SourceType } from '../types';

const REPEATED_TAGS = [
  'layoutAssignments',
  'loginIpRanges',
  'loginHours',
  'profileActionOverrides',
  'categoryGroupVisibilities',
  'externalDataSourceAccesses',
];

export function normalizeProfileOnlyFields(
  doc: Document,
  sourceType: SourceType,
): { label: string; entries: string[] }[] {
  if (sourceType !== 'profile') return [];

  const sections: { label: string; entries: string[] }[] = [];

  for (const tag of REPEATED_TAGS) {
    const els = getDirectChildren(doc, tag);
    if (els.length === 0) continue;
    const entries = els.map((el) => {
      const parts = Array.from(el.children).map((c) => `${c.tagName}=${c.textContent?.trim() ?? ''}`);
      return parts.join(', ') || el.textContent?.trim() || '(empty)';
    });
    sections.push({ label: tag, entries });
  }

  const customFlag = getSingleChildText(doc, 'custom');
  if (customFlag !== undefined) {
    sections.push({ label: 'custom', entries: [customFlag] });
  }

  return sections;
}
