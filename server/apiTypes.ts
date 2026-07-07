import type { SourceType } from '../src/lib/types';

export type { DetectResult as DetectResponse } from './sfCli/detect';
export type { OrgSummary, OrgListResponse, LoginResult as LoginResponse, LogoutResult as LogoutResponse } from './sfCli/orgs';
export type { DeployResponse, DeployComponentResult } from './sfCli/deploy';

export interface LoginRequest {
  requestId: string;
  alias?: string;
}

export interface CancelRequest {
  requestId: string;
}

export interface LogoutRequest {
  username: string;
}

export interface DeployRequestFile {
  name: string;
  sourceType: SourceType;
  xml: string;
}

export interface DeployRequest {
  requestId: string;
  targetOrg: string;
  /** Only meaningful for /api/sf/deploy — required when the target org is flagged likelyProduction. */
  confirmedProduction?: boolean;
  files: DeployRequestFile[];
}
