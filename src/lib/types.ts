export type SourceType = 'profile' | 'permissionset';

export const CATEGORIES = [
  'objectPermissions',
  'fieldPermissions',
  'classAccesses',
  'pageAccesses',
  'tabVisibility',
  'recordTypeVisibilities',
  'applicationVisibilities',
  'userPermissions',
  'customPermissions',
  'customMetadataTypeAccesses',
  'customSettingAccesses',
  'flowAccesses',
  'license',
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  objectPermissions: 'Object Permissions',
  fieldPermissions: 'Field Permissions',
  classAccesses: 'Class Access',
  pageAccesses: 'Page Access',
  tabVisibility: 'Tab Visibility',
  recordTypeVisibilities: 'Record Type Visibility',
  applicationVisibilities: 'Application Visibility',
  userPermissions: 'User Permissions',
  customPermissions: 'Custom Permissions',
  customMetadataTypeAccesses: 'Custom Metadata Type Access',
  customSettingAccesses: 'Custom Setting Access',
  flowAccesses: 'Flow Access',
  license: 'License',
};

export interface LoadedFile {
  id: string;
  name: string;
  sourceType: SourceType;
  raw: string;
}

export interface NormalizedRow {
  key: string;
  displayLabel: string;
  /** Optional grouping label for section headers, e.g. the object name for a field permission row */
  group?: string;
  /** Field values for this row, e.g. { allowRead: true, allowEdit: false } */
  fields: Record<string, unknown>;
}

export interface NormalizedFile {
  id: string;
  name: string;
  sourceType: SourceType;
  rows: Record<Category, NormalizedRow[]>;
  /** Profile-only fields with no permission set equivalent (layoutAssignments, etc.) */
  profileOnly: { label: string; entries: string[] }[];
  error?: string;
}

export type RowStatus = 'identical' | 'different' | 'missing';

export interface DiffRow {
  key: string;
  displayLabel: string;
  group?: string;
  status: RowStatus;
  /** value per fileId; undefined if the row is absent for that file */
  values: Record<string, Record<string, unknown> | undefined>;
}

export interface DiffResult {
  categories: Record<Category, DiffRow[]>;
  summary: Record<Category, { total: number; different: number; missing: number }>;
}
