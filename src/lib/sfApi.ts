import type {
  DetectResponse,
  OrgListResponse,
  LoginResponse,
  LogoutResponse,
  DeployResponse,
  LoginRequest,
  CancelRequest,
  LogoutRequest,
  DeployRequest,
} from '../../server/apiTypes';

/**
 * A plain static host (or `vite preview`) SPA-falls-back an unmatched GET to index.html, so
 * `.json()` on that throws — treating "non-2xx", "network error", and "non-JSON body" as the same
 * outcome collapses "CLI not installed" and "no backend present at all" into one code path, which
 * is exactly the behavior we want (the UI should be indistinguishable in both cases).
 */
async function safeJsonFetch<T>(input: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(input, init);
    if (!res.ok) return null;
    if (!res.headers.get('content-type')?.includes('application/json')) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function postJson<T>(url: string, body: unknown): Promise<T | null> {
  return safeJsonFetch<T>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function detectSfCli(): Promise<DetectResponse> {
  return (await safeJsonFetch<DetectResponse>('/api/sf/detect')) ?? { installed: false };
}

export async function fetchOrgs(): Promise<OrgListResponse> {
  return (await safeJsonFetch<OrgListResponse>('/api/sf/orgs')) ?? { orgs: [] };
}

export async function loginOrg(req: LoginRequest): Promise<LoginResponse> {
  return (await postJson<LoginResponse>('/api/sf/login', req)) ?? { success: false, error: 'Could not reach the local SF CLI backend.' };
}

export async function cancelLogin(req: CancelRequest): Promise<{ acknowledged: boolean }> {
  return (await postJson<{ acknowledged: boolean }>('/api/sf/login/cancel', req)) ?? { acknowledged: false };
}

export async function logoutOrg(req: LogoutRequest): Promise<LogoutResponse> {
  return (await postJson<LogoutResponse>('/api/sf/logout', req)) ?? { success: false, error: 'Could not reach the local SF CLI backend.' };
}

export type ValidateResult = { kind: 'success'; response: DeployResponse } | { kind: 'unavailable' };

export async function validateFiles(req: DeployRequest): Promise<ValidateResult> {
  const response = await postJson<DeployResponse>('/api/sf/validate', req);
  return response ? { kind: 'success', response } : { kind: 'unavailable' };
}

export type DeployResult =
  | { kind: 'success'; response: DeployResponse }
  | { kind: 'productionConfirmationRequired' }
  | { kind: 'unavailable' };

export async function deployFiles(req: DeployRequest): Promise<DeployResult> {
  try {
    const res = await fetch('/api/sf/deploy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    if (res.status === 409) return { kind: 'productionConfirmationRequired' };
    if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) return { kind: 'unavailable' };
    return { kind: 'success', response: (await res.json()) as DeployResponse };
  } catch {
    return { kind: 'unavailable' };
  }
}
