import { getSingleChildText } from '../parseXml';
import type { NormalizedRow, SourceType } from '../types';

export function normalizeLicense(doc: Document, sourceType: SourceType): NormalizedRow[] {
  const tagName = sourceType === 'profile' ? 'userLicense' : 'license';
  const value = getSingleChildText(doc, tagName);
  if (value === undefined) return [];
  return [{ key: '__license__', displayLabel: 'License', fields: { license: value } }];
}
