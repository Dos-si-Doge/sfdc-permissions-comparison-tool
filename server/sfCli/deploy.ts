import { runSfJson, SfCliExecutionError, SfJsonParseError } from './execSf';
import { buildTempScaffold, type ScaffoldFile } from '../tempScaffold';

export interface DeployComponentResult {
  fullName: string;
  componentType: string;
  success: boolean;
  changed: boolean;
  problem?: string;
}

export interface DeployResponse {
  success: boolean;
  checkOnly: boolean;
  deployId?: string;
  componentResults: DeployComponentResult[];
  message?: string;
}

interface RawComponentResult {
  fullName?: string;
  componentType?: string;
  success?: boolean | string;
  changed?: boolean | string;
  problem?: string;
}

interface RawDeployResult {
  result?: {
    id?: string;
    success?: boolean | string;
    checkOnly?: boolean | string;
    details?: {
      componentSuccesses?: RawComponentResult | RawComponentResult[];
      componentFailures?: RawComponentResult | RawComponentResult[];
    };
  };
  message?: string;
}

/** The Metadata API sometimes serializes booleans as the strings "true"/"false" — coerce defensively rather than assume a real boolean. */
function toBool(v: boolean | string | undefined): boolean {
  return v === true || v === 'true';
}

/** A single component's result is an object; multiple components come back as an array — normalize both to an array. */
function toArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

export function parseDeployResult(raw: RawDeployResult, checkOnly: boolean): DeployResponse {
  const details = raw.result?.details;
  const componentResults: DeployComponentResult[] = [
    ...toArray(details?.componentSuccesses),
    ...toArray(details?.componentFailures),
  ].map((c) => ({
    fullName: c.fullName ?? '(unknown)',
    componentType: c.componentType ?? '(unknown)',
    success: toBool(c.success),
    changed: toBool(c.changed),
    problem: c.problem,
  }));

  return {
    success: toBool(raw.result?.success),
    checkOnly,
    deployId: raw.result?.id,
    componentResults,
    message: raw.message,
  };
}

async function runDeployCommand(
  command: 'validate' | 'start',
  targetOrg: string,
  files: ScaffoldFile[],
): Promise<DeployResponse> {
  const scaffold = await buildTempScaffold(files);
  try {
    const raw = await runSfJson<RawDeployResult>(
      [
        'project',
        'deploy',
        command,
        '--source-dir',
        scaffold.sourceDir,
        '--target-org',
        targetOrg,
        // Deliberately NOT passing --test-level: `NoTestRun` is rejected outright by `deploy
        // validate` (confirmed directly — its --test-level only accepts RunAllTestsInOrg/
        // RunLocalTests/RunSpecifiedTests/RunRelevantTests), and even for `deploy start` where the
        // CLI syntax allows NoTestRun, Salesforce's platform itself rejects NoTestRun for a real
        // Production deploy (the exact scenario the production-guardrail exists for). Letting the
        // CLI's own default (RunLocalTests) apply is the one choice valid for both commands and
        // every org type — the tradeoff is that validate/deploy can take longer on orgs with a
        // large existing Apex test suite, since our scaffold being Apex-free doesn't exempt it.
        '--wait',
        '10',
      ],
      { cwd: scaffold.dir, timeoutMs: 11 * 60 * 1000 },
    );
    return parseDeployResult(raw, command === 'validate');
  } catch (e) {
    if (e instanceof SfCliExecutionError) {
      // A failed validate/deploy still often prints a parseable --json error envelope on stdout.
      try {
        const raw = JSON.parse(e.stdout) as RawDeployResult;
        return parseDeployResult(raw, command === 'validate');
      } catch {
        return { success: false, checkOnly: command === 'validate', componentResults: [], message: e.message };
      }
    }
    if (e instanceof SfJsonParseError) {
      return { success: false, checkOnly: command === 'validate', componentResults: [], message: 'Could not parse sf CLI output.' };
    }
    throw e;
  } finally {
    await scaffold.cleanup();
  }
}

export function validateFiles(targetOrg: string, files: ScaffoldFile[]): Promise<DeployResponse> {
  return runDeployCommand('validate', targetOrg, files);
}

export function deployFiles(targetOrg: string, files: ScaffoldFile[]): Promise<DeployResponse> {
  return runDeployCommand('start', targetOrg, files);
}
