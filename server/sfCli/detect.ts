import { runSf, SfCliNotFoundError } from './execSf';

export interface DetectResult {
  installed: boolean;
  version?: string;
}

/** `sf --version` has no --json support, so this is the one CLI call in this module that parses plain stdout via regex. */
export async function detectSfCli(): Promise<DetectResult> {
  try {
    const { stdout } = await runSf(['--version']);
    const match = stdout.match(/@salesforce\/cli\/(\S+)/);
    if (!match) return { installed: false };
    return { installed: true, version: match[1] };
  } catch (e) {
    if (e instanceof SfCliNotFoundError) return { installed: false };
    return { installed: false };
  }
}
