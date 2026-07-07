import type { NormalizedFile } from './types';

/** Shared with server/tempScaffold.ts (SF CLI integration) to derive each file's API/developer name — keep in sync, don't fork a second copy. */
export const SUFFIXES: Record<NormalizedFile['sourceType'], string> = {
  profile: '.profile-meta.xml',
  permissionset: '.permissionset-meta.xml',
};

const TAGS: Record<NormalizedFile['sourceType'], string> = {
  profile: '(P)',
  permissionset: '(PS)',
};

/** Strips the known metadata suffix to get the Salesforce API/developer name, e.g. "MyProfile.profile-meta.xml" -> "MyProfile". */
export function deriveApiName(name: string, sourceType: NormalizedFile['sourceType']): string {
  const suffix = SUFFIXES[sourceType];
  return name.endsWith(suffix) ? name.slice(0, -suffix.length) : name;
}

export function formatFileHeaderLabel(file: NormalizedFile): string {
  return `${deriveApiName(file.name, file.sourceType)} ${TAGS[file.sourceType]}`;
}
