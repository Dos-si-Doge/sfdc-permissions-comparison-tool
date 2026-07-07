export interface ParsedXml {
  doc: Document;
  rootTagName: string;
}

export function parseXml(raw: string): ParsedXml {
  const doc = new DOMParser().parseFromString(raw, 'application/xml');
  const errorNode = doc.querySelector('parsererror');
  if (errorNode) {
    throw new Error(errorNode.textContent?.trim() || 'Failed to parse XML');
  }
  const root = doc.documentElement;
  if (!root) {
    throw new Error('XML has no root element');
  }
  return { doc, rootTagName: root.tagName };
}

/** Direct children of root matching a tag name (not deep/nested matches). */
export function getDirectChildren(doc: Document, tagName: string): Element[] {
  const root = doc.documentElement;
  const result: Element[] = [];
  for (const child of Array.from(root.children)) {
    if (child.tagName === tagName) {
      result.push(child);
    }
  }
  return result;
}

/** Reads immediate child text-node values of an element into a plain object. */
export function elementToObject(el: Element): Record<string, string> {
  const obj: Record<string, string> = {};
  for (const child of Array.from(el.children)) {
    obj[child.tagName] = child.textContent?.trim() ?? '';
  }
  return obj;
}

export function getSingleChildText(doc: Document, tagName: string): string | undefined {
  const els = getDirectChildren(doc, tagName);
  return els.length > 0 ? els[0].textContent?.trim() : undefined;
}
