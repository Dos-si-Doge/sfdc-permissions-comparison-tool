import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deriveApiName } from '../src/lib/formatFileLabel';
import type { SourceType } from '../src/lib/types';

export interface ScaffoldFile {
  name: string;
  sourceType: SourceType;
  xml: string;
}

export interface Scaffold {
  dir: string;
  sourceDir: string;
  cleanup: () => Promise<void>;
}

const SOURCE_API_VERSION = '62.0';

const METADATA_FOLDER: Record<SourceType, string> = {
  profile: 'profiles',
  permissionset: 'permissionsets',
};

const FILE_EXTENSION: Record<SourceType, string> = {
  profile: 'profile-meta.xml',
  permissionset: 'permissionset-meta.xml',
};

/**
 * Builds a disposable, self-contained SFDX project from in-memory file content — never from a
 * real path on disk, since browsers never expose one. Batches every selected file into one
 * scaffold so a single validate/deploy call covers all of them together.
 */
export async function buildTempScaffold(files: ScaffoldFile[]): Promise<Scaffold> {
  const dir = await mkdtemp(join(tmpdir(), 'sf-permdiff-'));
  // On Windows, the sf CLI can briefly hold a file handle open inside this directory for a moment
  // after its process exits (observed directly: rm() failing with EBUSY immediately after a
  // validate call completed) — maxRetries/retryDelay is Node's own documented remedy for exactly
  // this class of transient Windows lock, not a generic "just in case" retry.
  const cleanup = () => rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).then(() => undefined);

  try {
    const sfdxProject = {
      packageDirectories: [{ path: 'force-app', default: true }],
      namespace: '',
      sourceApiVersion: SOURCE_API_VERSION,
    };
    await writeFile(join(dir, 'sfdx-project.json'), JSON.stringify(sfdxProject, null, 2), 'utf8');

    const defaultDir = join(dir, 'force-app', 'main', 'default');
    const foldersNeeded = new Set(files.map((f) => METADATA_FOLDER[f.sourceType]));
    for (const folder of foldersNeeded) {
      await mkdir(join(defaultDir, folder), { recursive: true });
    }

    for (const file of files) {
      const apiName = deriveApiName(file.name, file.sourceType);
      const folder = METADATA_FOLDER[file.sourceType];
      const extension = FILE_EXTENSION[file.sourceType];
      await writeFile(join(defaultDir, folder, `${apiName}.${extension}`), file.xml, 'utf8');
    }

    return { dir, sourceDir: join(dir, 'force-app'), cleanup };
  } catch (e) {
    await cleanup();
    throw e;
  }
}
