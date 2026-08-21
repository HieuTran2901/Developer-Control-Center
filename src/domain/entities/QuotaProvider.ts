export type QuotaProviderId = 'antigravity' | 'google_cloud_code' | 'codex' | 'claude_code';

export type ModelQuotaStatus =
  | 'Available'
  | 'Unavailable'
  | 'Unsupported'
  | 'AuthRequired'
  | 'ReauthorizationRequired'
  | 'ScopeInsufficient'
  | 'ServiceDisabled'
  | 'Forbidden'
  | 'RateLimited'
  | 'NetworkError'
  | 'IdentityMismatch'
  | 'NotFound';

export type QuotaDataSource = 'RealProvider' | 'CachedRealProvider' | 'Unavailable';

export type QuotaDataQuality = 'Live' | 'Stale' | 'Unavailable';

export interface AccountIdentity {
  id: string;
  email: string;
  provider: string;
  projectId: string | null;
  tier: string | null;
  status: string;
}

export interface QuotaWindowInfo {
  windowType: string; // "5h" | "weekly" | "custom"
  remainingFraction: number | null;
  remainingPercentage: number | null;
  resetTime: string | null;
  description?: string | null;
}

export interface ModelQuota {
  modelId: string;
  displayName: string;
  remainingFraction: number | null;
  remainingPercentage: number | null;
  resetAt: string | null;
  status: ModelQuotaStatus;
  weeklyRemainingFraction?: number | null;
  weeklyRemainingPercentage?: number | null;
  weeklyResetAt?: string | null;
  windows?: QuotaWindowInfo[];
}

export interface QuotaStatus {
  accountId: string;
  email: string;
  tier: string | null;
  provider: string;
  models: ModelQuota[];
  fetchedAt: string;
  status: ModelQuotaStatus;
  dataSource: QuotaDataSource;
  dataQuality: QuotaDataQuality;
  safeDiagnosticMessage: string | null;
}

export interface QuotaVerificationDiagnostic {
  accountId: string;
  provider: string;
  authenticationState: string;
  requestStatus: string;
  quotaDataAvailable: boolean;
  modelCount: number;
  lastSuccessfulSyncAt: string | null;
  dataSource: QuotaDataSource;
  dataQuality: QuotaDataQuality;
  latencyMs: number | null;
  sanitizedError: string | null;
}

export interface QuotaProviderError {
  kind: string;
  message: string;
}

export type AntigravityRuntimeState =
  | 'antigravityNotRunning'
  | 'languageServerNotFound'
  | 'rpcPortNotFound'
  | 'csrfTokenNotFound'
  | 'rpcConnectionFailed'
  | 'rpcUnauthorized'
  | 'rpcTimeout'
  | 'invalidResponse'
  | 'quotaUnavailable'
  | 'connected';

export interface AntigravityModelQuota {
  modelId: string;
  displayName: string | null;
  remainingFraction: number | null;
  remainingPercent: number | null;
  resetTime: string | null;
}

export interface AntigravityQuotaSnapshot {
  accountIdentity: string | null;
  planName: string | null;
  tier: string | null;
  models: AntigravityModelQuota[];
  availablePromptCredits: number | null;
  availableFlowCredits: number | null;
  monthlyPromptCredits: number | null;
  monthlyFlowCredits: number | null;
  fetchedAt: string;
  source: string;
}

export interface AntigravityRuntimeDiagnostic {
  state: AntigravityRuntimeState;
  processId: number | null;
  rpcHost: string | null;
  rpcPort: number | null;
  csrfTokenDetected: boolean;
  httpStatus: number | null;
  modelCount: number;
  planName: string | null;
  tier: string | null;
  latencyMs: number | null;
  safeMessage: string;
}


export interface OAuthConnectionResult {
  accountId: string;
  authenticatedEmail: string | null;
  status: string;
  success: boolean;
  message: string;
  diagnosticStage?: string | null;
  clientFingerprint?: string | null;
  redirectUriUsed?: string | null;
}

export interface AntigravityOAuthVerificationResult {
  clientConfigured: boolean;
  clientSource: string;
  clientIdFingerprint: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  scopes: string[];
  clientType: string;
  confidence: string;
  loadCodeAssistCompatible: string;
}

