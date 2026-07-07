import type { NormalizedFile } from './types';

const SUFFIXES: Record<NormalizedFile['sourceType'], string> = {
  profile: '.profile-meta.xml',
  permissionset: '.permissionset-meta.xml',
};

const TAGS: Record<NormalizedFile['sourceType'], string> = {
  profile: '(P)',
  permissionset: '(PS)',
};

export function formatFileHeaderLabel(file: NormalizedFile): string {
  const suffix = SUFFIXES[file.sourceType];
  const base = file.name.endsWith(suffix) ? file.name.slice(0, -suffix.length) : file.name;
  return `${base} ${TAGS[file.sourceType]}`;
}
