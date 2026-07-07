import { parseXml } from '../parseXml';
import type { LoadedFile, NormalizedFile, Category } from '../types';
import { normalizeObjectPermissions } from './objectPermissions';
import { normalizeFieldPermissions } from './fieldPermissions';
import { normalizeClassAccesses } from './classAccesses';
import { normalizePageAccesses } from './pageAccesses';
import { normalizeTabVisibility } from './tabVisibility';
import { normalizeRecordTypeVisibilities } from './recordTypeVisibilities';
import { normalizeApplicationVisibilities } from './applicationVisibilities';
import { normalizeUserPermissions } from './userPermissions';
import { normalizeCustomPermissions } from './customPermissions';
import { normalizeCustomMetadataTypeAccesses } from './customMetadataTypeAccesses';
import { normalizeCustomSettingAccesses } from './customSettingAccesses';
import { normalizeFlowAccesses } from './flowAccesses';
import { normalizeLicense } from './license';
import { normalizeProfileOnlyFields } from './profileOnlyFields';

export function detectSourceType(rootTagName: string): 'profile' | 'permissionset' {
  if (rootTagName === 'Profile') return 'profile';
  if (rootTagName === 'PermissionSet') return 'permissionset';
  throw new Error(`Unrecognized root element <${rootTagName}> — expected <Profile> or <PermissionSet>`);
}

function emptyRows(): Record<Category, NormalizedFile['rows'][Category]> {
  return {
    objectPermissions: [],
    fieldPermissions: [],
    classAccesses: [],
    pageAccesses: [],
    tabVisibility: [],
    recordTypeVisibilities: [],
    applicationVisibilities: [],
    userPermissions: [],
    customPermissions: [],
    customMetadataTypeAccesses: [],
    customSettingAccesses: [],
    flowAccesses: [],
    license: [],
  };
}

function normalizeParsedFile(id: string, name: string, doc: Document, sourceType: 'profile' | 'permissionset'): NormalizedFile {
  const rows: Record<Category, ReturnType<typeof normalizeObjectPermissions>> = {
    objectPermissions: normalizeObjectPermissions(doc),
    fieldPermissions: normalizeFieldPermissions(doc),
    classAccesses: normalizeClassAccesses(doc),
    pageAccesses: normalizePageAccesses(doc),
    tabVisibility: normalizeTabVisibility(doc, sourceType),
    recordTypeVisibilities: normalizeRecordTypeVisibilities(doc),
    applicationVisibilities: normalizeApplicationVisibilities(doc),
    userPermissions: normalizeUserPermissions(doc),
    customPermissions: normalizeCustomPermissions(doc),
    customMetadataTypeAccesses: normalizeCustomMetadataTypeAccesses(doc),
    customSettingAccesses: normalizeCustomSettingAccesses(doc),
    flowAccesses: normalizeFlowAccesses(doc),
    license: normalizeLicense(doc, sourceType),
  };

  return {
    id,
    name,
    sourceType,
    rows,
    profileOnly: normalizeProfileOnlyFields(doc, sourceType),
  };
}

export function normalizeFile(file: LoadedFile): NormalizedFile {
  try {
    const { doc, rootTagName } = parseXml(file.raw);
    const sourceType = detectSourceType(rootTagName);
    return normalizeParsedFile(file.id, file.name, doc, sourceType);
  } catch (e) {
    return {
      id: file.id,
      name: file.name,
      sourceType: 'profile',
      rows: emptyRows(),
      profileOnly: [],
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/**
 * Like normalizeFile, but also returns the parsed Document so callers can retain it
 * for later DOM mutation + re-serialization (editing feature). Returns doc: null on
 * parse/detect failure, mirroring normalizeFile's error fallback.
 */
export function normalizeFileWithDocument(file: LoadedFile): { normalized: NormalizedFile; doc: Document | null } {
  try {
    const { doc, rootTagName } = parseXml(file.raw);
    const sourceType = detectSourceType(rootTagName);
    return { normalized: normalizeParsedFile(file.id, file.name, doc, sourceType), doc };
  } catch (e) {
    return {
      normalized: {
        id: file.id,
        name: file.name,
        sourceType: 'profile',
        rows: emptyRows(),
        profileOnly: [],
        error: e instanceof Error ? e.message : String(e),
      },
      doc: null,
    };
  }
}
