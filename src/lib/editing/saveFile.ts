/**
 * The <?xml ?> prolog isn't a DOM node, so whether XMLSerializer re-emits it is engine-dependent
 * (jsdom never does; some Chromium builds do when the source document had one). Strip any leading
 * declaration before prepending our own canonical one, so it's never duplicated.
 */
export function serializeDocument(doc: Document): string {
  const xml = new XMLSerializer().serializeToString(doc).replace(/^<\?xml[^?]*\?>\s*/, '');
  return `<?xml version="1.0" encoding="UTF-8"?>\n${xml}\n`;
}

export async function saveViaHandle(handle: FileSystemFileHandle, contents: string): Promise<void> {
  if (handle.queryPermission && handle.requestPermission) {
    const current = await handle.queryPermission({ mode: 'readwrite' });
    if (current !== 'granted') {
      const requested = await handle.requestPermission({ mode: 'readwrite' });
      if (requested !== 'granted') {
        throw new Error('Write permission was not granted for this file.');
      }
    }
  }
  if (!handle.createWritable) {
    throw new Error('This browser does not support writing files directly.');
  }
  const writable = await handle.createWritable();
  await writable.write(contents);
  await writable.close();
}

export function downloadAsFile(name: string, contents: string): void {
  const blob = new Blob([contents], { type: 'application/xml' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}
