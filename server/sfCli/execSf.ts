import { execFile, spawn, type ChildProcess } from 'node:child_process';

export class SfCliNotFoundError extends Error {
  constructor() {
    super('Salesforce CLI (sf) was not found on PATH.');
    this.name = 'SfCliNotFoundError';
  }
}

export class SfCliExecutionError extends Error {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  constructor(message: string, exitCode: number | null, stdout: string, stderr: string) {
    super(message);
    this.name = 'SfCliExecutionError';
    this.exitCode = exitCode;
    this.stdout = stdout;
    this.stderr = stderr;
  }
}

export class SfJsonParseError extends Error {
  stdout: string;
  constructor(message: string, stdout: string) {
    super(message);
    this.name = 'SfJsonParseError';
    this.stdout = stdout;
  }
}

// Node's execFile/spawn do not do PATHEXT-style resolution themselves — on Windows `sf` only
// resolves via the `sf.cmd` shim, which only cmd.exe/PowerShell know how to find. Without
// `shell: true` here, every invocation fails ENOENT on Windows and the whole feature silently
// reports "CLI not installed."
const isWindows = process.platform === 'win32';
const MAX_BUFFER = 1024 * 1024 * 50;

export interface RunSfOptions {
  cwd?: string;
  timeoutMs?: number;
}

export function runSf(args: string[], options: RunSfOptions = {}): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(
      'sf',
      args,
      { cwd: options.cwd, timeout: options.timeoutMs, shell: isWindows, maxBuffer: MAX_BUFFER },
      (error, stdout, stderr) => {
        if (error) {
          const code = (error as NodeJS.ErrnoException).code;
          if (code === 'ENOENT') {
            reject(new SfCliNotFoundError());
            return;
          }
          reject(new SfCliExecutionError(error.message, typeof error.code === 'number' ? error.code : null, stdout, stderr));
          return;
        }
        resolve({ stdout, stderr });
      },
    );
  });
}

/** Appends --json and parses stdout only — the CLI's "update available" banner and similar noise land on stderr, never stdout, when --json is used. */
export async function runSfJson<T>(args: string[], options: RunSfOptions = {}): Promise<T> {
  const { stdout } = await runSf([...args, '--json'], options);
  try {
    return JSON.parse(stdout) as T;
  } catch (e) {
    throw new SfJsonParseError(e instanceof Error ? e.message : String(e), stdout);
  }
}

export function spawnSf(args: string[], options: RunSfOptions = {}): ChildProcess {
  return spawn('sf', args, { cwd: options.cwd, shell: isWindows });
}

export function waitForSfProcess(child: ChildProcess): Promise<{ stdout: string; stderr: string; exitCode: number | null; killed: boolean }> {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (d) => {
      stdout += d;
    });
    child.stderr?.on('data', (d) => {
      stderr += d;
    });
    child.on('error', (err) => {
      const code = (err as NodeJS.ErrnoException).code;
      reject(code === 'ENOENT' ? new SfCliNotFoundError() : err);
    });
    child.on('close', (code, signal) => {
      resolve({ stdout, stderr, exitCode: code, killed: signal !== null });
    });
  });
}

/** Shared registry so long-running commands (login, validate, deploy) can be cancelled by requestId from a separate HTTP request. */
const activeProcesses = new Map<string, ChildProcess>();

export function registerProcess(requestId: string, child: ChildProcess): void {
  activeProcesses.set(requestId, child);
}

export function unregisterProcess(requestId: string): void {
  activeProcesses.delete(requestId);
}

export function cancelProcess(requestId: string): boolean {
  const child = activeProcesses.get(requestId);
  if (!child) return false;
  child.kill();
  return true;
}
