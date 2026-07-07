import { runSfJson, spawnSf, waitForSfProcess, registerProcess, unregisterProcess, cancelProcess } from './execSf';

export interface OrgSummary {
  alias?: string;
  username: string;
  orgId: string;
  instanceUrl: string;
  isSandbox: boolean;
  isScratch: boolean;
  isDevHub: boolean;
  orgEdition?: string;
  connectedStatus?: string;
  isDefault: boolean;
  /**
   * `sf org list --json` has no explicit "is this Production" field. Heuristic: not a sandbox and
   * not a scratch org. Known, deliberate false positive: Developer Edition / Trailhead orgs also
   * match this — that's the intentionally-conservative direction (over-warn, not under-warn).
   */
  likelyProduction: boolean;
}

interface RawOrg {
  alias?: string;
  username: string;
  orgId: string;
  instanceUrl: string;
  isSandbox?: boolean;
  isScratch?: boolean;
  isDevHub?: boolean;
  orgEdition?: string;
  connectedStatus?: string;
  isDefaultUsername?: boolean;
}

interface RawOrgListResult {
  result: {
    other?: RawOrg[];
    sandboxes?: RawOrg[];
    nonScratchOrgs?: RawOrg[];
    devHubs?: RawOrg[];
    scratchOrgs?: RawOrg[];
  };
}

export interface OrgListResponse {
  orgs: OrgSummary[];
  defaultUsername?: string;
}

/**
 * `sf org list --json`'s result buckets (other/sandboxes/nonScratchOrgs/devHubs/scratchOrgs)
 * overlap — the same org can legitimately appear in more than one (confirmed: a Dev Hub org shows
 * up in both `nonScratchOrgs` and `devHubs`, and non-scratch orgs generally show up in both `other`
 * and `nonScratchOrgs`). Flatten and dedupe by orgId (falling back to username) or the org picker
 * shows duplicates.
 */
export async function listOrgs(): Promise<OrgListResponse> {
  const parsed = await runSfJson<RawOrgListResult>(['org', 'list']);
  const buckets = parsed.result;
  const all = [
    ...(buckets.other ?? []),
    ...(buckets.sandboxes ?? []),
    ...(buckets.nonScratchOrgs ?? []),
    ...(buckets.devHubs ?? []),
    ...(buckets.scratchOrgs ?? []),
  ];

  const byKey = new Map<string, RawOrg>();
  for (const org of all) {
    const key = org.orgId || org.username;
    if (!byKey.has(key)) byKey.set(key, org);
  }

  const orgs: OrgSummary[] = [];
  let defaultUsername: string | undefined;
  for (const org of byKey.values()) {
    const isSandbox = !!org.isSandbox;
    const isScratch = !!org.isScratch;
    if (org.isDefaultUsername) defaultUsername = org.username;
    orgs.push({
      alias: org.alias,
      username: org.username,
      orgId: org.orgId,
      instanceUrl: org.instanceUrl,
      isSandbox,
      isScratch,
      isDevHub: !!org.isDevHub,
      orgEdition: org.orgEdition,
      connectedStatus: org.connectedStatus,
      isDefault: !!org.isDefaultUsername,
      likelyProduction: !isSandbox && !isScratch,
    });
  }

  return { orgs, defaultUsername };
}

export interface LoginResult {
  success: boolean;
  cancelled?: boolean;
  username?: string;
  alias?: string;
  error?: string;
}

/** Long-running interactive step (user completes OAuth in their system browser) — awaits the child process's exit rather than polling. */
export async function loginOrg(requestId: string, alias?: string): Promise<LoginResult> {
  const args = ['org', 'login', 'web', '--json', ...(alias ? ['--alias', alias] : [])];
  const child = spawnSf(args);
  registerProcess(requestId, child);
  try {
    const { stdout, exitCode, killed } = await waitForSfProcess(child);
    if (killed) return { success: false, cancelled: true };
    if (exitCode !== 0) {
      let error = 'Login failed.';
      try {
        const parsed = JSON.parse(stdout) as { message?: string };
        if (parsed.message) error = parsed.message;
      } catch {
        // stdout wasn't parseable JSON — fall back to the generic message.
      }
      return { success: false, error };
    }
    const parsed = JSON.parse(stdout) as { result?: { username?: string; alias?: string } };
    return { success: true, username: parsed.result?.username, alias: parsed.result?.alias };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  } finally {
    unregisterProcess(requestId);
  }
}

export function cancelLogin(requestId: string): boolean {
  return cancelProcess(requestId);
}

export interface LogoutResult {
  success: boolean;
  error?: string;
}

export async function logoutOrg(username: string): Promise<LogoutResult> {
  try {
    await runSfJson(['org', 'logout', '--target-org', username, '--no-prompt']);
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}
