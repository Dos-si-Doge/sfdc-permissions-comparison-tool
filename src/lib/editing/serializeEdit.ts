import { getDirectChildren } from '../parseXml';
import { CATEGORY_SCHEMAS, type FieldSpec } from './editSchema';
import { PROFILE_MAP, PERMSET_MAP } from '../normalize/tabVisibility';
import type { Category, SourceType } from '../types';

function invert(map: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [raw, normalized] of Object.entries(map)) {
    if (!(normalized in result)) result[normalized] = raw;
  }
  return result;
}

const PROFILE_INVERSE = invert(PROFILE_MAP);
const PERMSET_INVERSE = invert(PERMSET_MAP);

function resolveContainerTag(containerTag: string | Record<SourceType, string>, sourceType: SourceType): string {
  return typeof containerTag === 'string' ? containerTag : containerTag[sourceType];
}

/** tabVisibility's normalized value must be inverted back to the target file's raw enum before writing. */
function resolveRawFields(category: Category, sourceType: SourceType, fields: Record<string, unknown>): Record<string, unknown> {
  if (category !== 'tabVisibility') return fields;
  const inverse = sourceType === 'profile' ? PROFILE_INVERSE : PERMSET_INVERSE;
  const normalized = String(fields.visibility);
  return { visibility: inverse[normalized] ?? normalized };
}

function toRawValue(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value ?? '');
}

/**
 * document.createElement always creates elements in the null namespace. Salesforce metadata XML
 * declares a default xmlns on the root, so a plain createElement would serialize with a spurious
 * xmlns="" override breaking consistency with every sibling. Match the root's namespace instead.
 */
function createEl(doc: Document, tag: string): Element {
  return doc.createElementNS(doc.documentElement.namespaceURI, tag);
}

function isWhitespaceTextNode(node: ChildNode | null): node is ChildNode {
  return !!node && node.nodeType === Node.TEXT_NODE && !!node.textContent && /^\s*$/.test(node.textContent);
}

function detachElement(el: Element): void {
  const prev = el.previousSibling;
  if (isWhitespaceTextNode(prev)) prev.remove();
  el.remove();
}

/** Infers the file's indentation unit from any whitespace-only text node directly under root. */
function getIndentUnit(doc: Document): string {
  const root = doc.documentElement;
  for (const node of Array.from(root.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE && node.textContent && /^\n[ \t]+$/.test(node.textContent)) {
      return node.textContent.slice(1);
    }
  }
  return '    ';
}

function findContainerAndRow(
  doc: Document,
  containerTag: string,
  keyXmlTag: string,
  key: string,
): { containers: Element[]; match: Element | undefined } {
  const containers = getDirectChildren(doc, containerTag);
  const match = containers.find((el) => {
    const child = Array.from(el.children).find((c) => c.tagName === keyXmlTag);
    return child?.textContent?.trim() === key;
  });
  return { containers, match };
}

/** Inserts newChild among parent's element children in alphabetical tag order, with matching indentation. */
function insertChildSorted(doc: Document, parent: Element, newChild: Element, childIndent: string): void {
  const elementChildren = Array.from(parent.children);
  const next = elementChildren.find((c) => c.tagName > newChild.tagName);
  const indentNode = doc.createTextNode(`\n${childIndent}`);
  if (next) {
    parent.insertBefore(indentNode, next);
    parent.insertBefore(newChild, next);
  } else {
    const lastElementChild = elementChildren[elementChildren.length - 1];
    const insertionPoint = lastElementChild ? lastElementChild.nextSibling : null;
    parent.insertBefore(indentNode, insertionPoint);
    parent.insertBefore(newChild, insertionPoint);
  }
}

/** Inserts newEl as a direct child of root, right after the last existing same-tag sibling (or near the end of root if none exist). */
function insertContainerAfterSiblings(doc: Document, containers: Element[], newEl: Element, baseIndent: string): void {
  const root = doc.documentElement;
  const indentNode = doc.createTextNode(`\n${baseIndent}`);
  if (containers.length > 0) {
    const last = containers[containers.length - 1];
    const insertionPoint = last.nextSibling;
    root.insertBefore(indentNode, insertionPoint);
    root.insertBefore(newEl, insertionPoint);
  } else {
    const rootChildNodes = Array.from(root.childNodes);
    const lastNode = rootChildNodes[rootChildNodes.length - 1] ?? null;
    const insertionPoint = isWhitespaceTextNode(lastNode) ? lastNode : null;
    root.insertBefore(indentNode, insertionPoint);
    root.insertBefore(newEl, insertionPoint);
  }
}

function buildContainerElement(
  doc: Document,
  containerTag: string,
  entries: { tag: string; value: string }[],
  childIndent: string,
  baseIndent: string,
): Element {
  const el = createEl(doc, containerTag);
  const sorted = [...entries].sort((a, b) => (a.tag < b.tag ? -1 : a.tag > b.tag ? 1 : 0));
  for (const { tag, value } of sorted) {
    el.appendChild(doc.createTextNode(`\n${childIndent}`));
    const child = createEl(doc, tag);
    child.textContent = value;
    el.appendChild(child);
  }
  el.appendChild(doc.createTextNode(`\n${baseIndent}`));
  return el;
}

/** Sets/creates the fields present in rawFields; removes optional fields absent from rawFields (true copy fidelity). */
function updateExistingRow(doc: Document, rowEl: Element, fieldSpecs: FieldSpec[], rawFields: Record<string, unknown>, childIndent: string): void {
  for (const spec of fieldSpecs) {
    const existingChild = Array.from(rowEl.children).find((c) => c.tagName === spec.xmlTag);
    if (spec.name in rawFields) {
      const raw = toRawValue(rawFields[spec.name]);
      if (existingChild) {
        existingChild.textContent = raw;
      } else {
        const newChild = createEl(doc, spec.xmlTag);
        newChild.textContent = raw;
        insertChildSorted(doc, rowEl, newChild, childIndent);
      }
    } else if (spec.optional && existingChild) {
      detachElement(existingChild);
    }
  }
}

/** Creates or updates a permission row for the given category/key in `doc`, writing `fields` (already-normalized values). */
export function upsertRow(doc: Document, sourceType: SourceType, category: Category, key: string, fields: Record<string, unknown>): void {
  const schema = CATEGORY_SCHEMAS[category];
  const containerTag = resolveContainerTag(schema.containerTag, sourceType);
  const indentUnit = getIndentUnit(doc);
  const baseIndent = indentUnit;

  if (schema.singleton) {
    const [existing] = getDirectChildren(doc, containerTag);
    const raw = toRawValue(fields[schema.fields[0].name]);
    if (existing) {
      existing.textContent = raw;
    } else {
      const el = createEl(doc, containerTag);
      el.textContent = raw;
      insertContainerAfterSiblings(doc, [], el, baseIndent);
    }
    return;
  }

  const keyXmlTag = schema.keyXmlTag!;
  const rawFields = resolveRawFields(category, sourceType, fields);
  const { containers, match } = findContainerAndRow(doc, containerTag, keyXmlTag, key);
  const childIndent = baseIndent + indentUnit;

  if (match) {
    updateExistingRow(doc, match, schema.fields, rawFields, childIndent);
  } else {
    const entries = [
      { tag: keyXmlTag, value: key },
      ...schema.fields.filter((f) => f.name in rawFields).map((f) => ({ tag: f.xmlTag, value: toRawValue(rawFields[f.name]) })),
    ];
    const el = buildContainerElement(doc, containerTag, entries, childIndent, baseIndent);
    insertContainerAfterSiblings(doc, containers, el, baseIndent);
  }
}

/** Removes a permission row for the given category/key from `doc`, if present. */
export function removeRow(doc: Document, sourceType: SourceType, category: Category, key: string): void {
  const schema = CATEGORY_SCHEMAS[category];
  const containerTag = resolveContainerTag(schema.containerTag, sourceType);

  if (schema.singleton) {
    const [existing] = getDirectChildren(doc, containerTag);
    if (existing) detachElement(existing);
    return;
  }

  const keyXmlTag = schema.keyXmlTag!;
  const { match } = findContainerAndRow(doc, containerTag, keyXmlTag, key);
  if (match) detachElement(match);
}
