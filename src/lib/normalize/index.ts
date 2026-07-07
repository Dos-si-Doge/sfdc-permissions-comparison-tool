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

export function normalizeFile(file: LoadedFile): NormalizedFile {
  try {
    const { doc, rootTagName } = parseXml(file.raw);
    const sourceType = detectSourceType(rootTagName);

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
      id: file.id,
      name: file.name,
      sourceType,
      rows,
      profileOnly: normalizeProfileOnlyFields(doc, sourceType),
    };
  } catch (e) {
    return {
      id: file.id,
      name: file.name,
      sourceType: 'profile',
      rows: {
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
      },
      profileOnly: [],
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
