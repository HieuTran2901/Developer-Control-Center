import { QuotaDataSource, QuotaDataQuality, QuotaProviderId, QuotaStatus } from './QuotaProvider';

export type AccountPollingState =
  | 'Unknown'
  | 'Checking'
  | 'Online'
  | 'AuthRequired'
  | 'RateLimited'
  | 'NetworkError'
  | 'ProviderError'
  | 'Disabled';

export interface AccountMonitorConfig {
  accountId: string;
  provider?: QuotaProviderId;
  email: string;
  displayName: string | null;
  tier: string | null;
  enabled: boolean;
  autoConnect?: boolean;
  pollingIntervalSeconds: number;
  createdAt: string;
  updatedAt: string;
}

export interface AccountQuotaSnapshot {
  accountId: string;
  provider: QuotaProviderId;
  email: string;
  displayName: string | null;
  tier: string | null;
  status: AccountPollingState;
  autoConnect?: boolean;
  dataSource: QuotaDataSource;
  dataQuality: QuotaDataQuality;
  lastUpdatedAt: string;
  lastSuccessfulSyncAt: string | null;
  nextRefreshAt: string | null;
  quota: QuotaStatus | null;
  errorMessage: string | null;
}



export interface QuotaRefreshSettings {
  autoRefreshEnabled: boolean;
  intervalSeconds: number;
}

export interface PollingEngineStatus {
  isRunning: boolean;
  activeAccountsCount: number;
  totalAccountsCount: number;
  onlineCount: number;
  authRequiredCount: number;
  errorCount: number;
  lastGlobalRefreshAt: string | null;
  nextGlobalRefreshAt: string | null;
  autoRefreshEnabled: boolean;
  intervalSeconds: number;
  defaultIntervalSeconds?: number;
}


