import type { Category, SourceType } from '../types';

export type FieldEditor =
  | { kind: 'boolean' }
  | { kind: 'string' }
  | { kind: 'enum'; options: string[] };

export interface FieldSpec {
  /** Key into NormalizedRow.fields */
  name: string;
  /** Child tag holding this field's raw value; ignored when selfText is set. */
  xmlTag: string;
  label: string;
  editor: FieldEditor;
  default: unknown;
  /** True if the source XML may omit this child entirely (objectPermissions' 6 bools, recordTypeVisibilities.personAccountDefault). */
  optional?: boolean;
  /** True only for license: the value lives in the container element's own textContent, not a child. */
  selfText?: boolean;
}

export interface CategorySchema {
  category: Category;
  /** Container element tag; sourceType-variant only for tabVisibility. */
  containerTag: string | Record<SourceType, string>;
  /** True only for license: at most one row, constant key, no key child. */
  singleton?: boolean;
  /** Child tag holding the row's raw key text; omitted for license. */
  keyXmlTag?: string;
  fields: FieldSpec[];
}

function enabledCategory(category: Category, containerTag: string, keyXmlTag: string): CategorySchema {
  return {
    category,
    containerTag,
    keyXmlTag,
    fields: [{ name: 'enabled', xmlTag: 'enabled', label: 'Enabled', editor: { kind: 'boolean' }, default: false }],
  };
}

export const CATEGORY_SCHEMAS: Record<Category, CategorySchema> = {
  objectPermissions: {
    category: 'objectPermissions',
    containerTag: 'objectPermissions',
    keyXmlTag: 'object',
    fields: [
      { name: 'allowCreate', xmlTag: 'allowCreate', label: 'Create', editor: { kind: 'boolean' }, default: false, optional: true },
      { name: 'allowDelete', xmlTag: 'allowDelete', label: 'Delete', editor: { kind: 'boolean' }, default: false, optional: true },
      { name: 'allowEdit', xmlTag: 'allowEdit', label: 'Edit', editor: { kind: 'boolean' }, default: false, optional: true },
      { name: 'allowRead', xmlTag: 'allowRead', label: 'Read', editor: { kind: 'boolean' }, default: false, optional: true },
      { name: 'modifyAllRecords', xmlTag: 'modifyAllRecords', label: 'Modify All', editor: { kind: 'boolean' }, default: false, optional: true },
      { name: 'viewAllRecords', xmlTag: 'viewAllRecords', label: 'View All', editor: { kind: 'boolean' }, default: false, optional: true },
    ],
  },
  fieldPermissions: {
    category: 'fieldPermissions',
    containerTag: 'fieldPermissions',
    keyXmlTag: 'field',
    fields: [
      { name: 'readable', xmlTag: 'readable', label: 'Read', editor: { kind: 'boolean' }, default: false },
      { name: 'editable', xmlTag: 'editable', label: 'Edit', editor: { kind: 'boolean' }, default: false },
    ],
  },
  classAccesses: enabledCategory('classAccesses', 'classAccesses', 'apexClass'),
  pageAccesses: enabledCategory('pageAccesses', 'pageAccesses', 'apexPage'),
  tabVisibility: {
    category: 'tabVisibility',
    containerTag: { profile: 'tabVisibilities', permissionset: 'tabSettings' },
    keyXmlTag: 'tab',
    fields: [
      {
        name: 'visibility',
        xmlTag: 'visibility',
        label: 'Visibility',
        editor: { kind: 'enum', options: ['Visible', 'Available', 'Hidden'] },
        default: 'Hidden',
      },
    ],
  },
  recordTypeVisibilities: {
    category: 'recordTypeVisibilities',
    containerTag: 'recordTypeVisibilities',
    keyXmlTag: 'recordType',
    fields: [
      { name: 'visible', xmlTag: 'visible', label: 'Visible', editor: { kind: 'boolean' }, default: false },
      { name: 'personAccountDefault', xmlTag: 'personAccountDefault', label: 'Person Account Default', editor: { kind: 'boolean' }, default: false, optional: true },
    ],
  },
  applicationVisibilities: {
    category: 'applicationVisibilities',
    containerTag: 'applicationVisibilities',
    keyXmlTag: 'application',
    fields: [{ name: 'visible', xmlTag: 'visible', label: 'Visible', editor: { kind: 'boolean' }, default: false }],
  },
  userPermissions: enabledCategory('userPermissions', 'userPermissions', 'name'),
  customPermissions: enabledCategory('customPermissions', 'customPermissions', 'name'),
  customMetadataTypeAccesses: enabledCategory('customMetadataTypeAccesses', 'customMetadataTypeAccesses', 'name'),
  customSettingAccesses: enabledCategory('customSettingAccesses', 'customSettingAccesses', 'name'),
  flowAccesses: enabledCategory('flowAccesses', 'flowAccesses', 'flow'),
  license: {
    category: 'license',
    containerTag: { profile: 'userLicense', permissionset: 'license' },
    singleton: true,
    fields: [{ name: 'license', xmlTag: '', label: 'License', editor: { kind: 'string' }, default: '', selfText: true }],
  },
};
