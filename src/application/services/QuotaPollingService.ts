import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import {
  AccountMonitorConfig,
  AccountQuotaSnapshot,
  PollingEngineStatus,
  QuotaRefreshSettings,
} from '@/domain/entities/QuotaPolling';

import { OAuthConnectionResult, AntigravityOAuthVerificationResult } from '@/domain/entities/QuotaProvider';

export class QuotaPollingService {
  private static instance: QuotaPollingService;

  public static getInstance(): QuotaPollingService {
    if (!QuotaPollingService.instance) {
      QuotaPollingService.instance = new QuotaPollingService();
    }
    return QuotaPollingService.instance;
  }

  public async listAccounts(): Promise<AccountMonitorConfig[]> {
    return await invoke<AccountMonitorConfig[]>('quota_list_accounts_cmd');
  }

  public async registerAccount(config: AccountMonitorConfig): Promise<void> {
    return await invoke<void>('quota_register_account_cmd', { config });
  }

  public async removeAccount(accountId: string): Promise<boolean> {
    return await invoke<boolean>('quota_remove_account_cmd', { accountId });
  }

  public async setAccountEnabled(accountId: string, enabled: boolean): Promise<boolean> {
    return await invoke<boolean>('quota_set_account_enabled_cmd', { accountId, enabled });
  }

  public async setAccountAutoConnect(accountId: string, autoConnect: boolean): Promise<boolean> {
    return await invoke<boolean>('quota_set_account_auto_connect_cmd', { accountId, autoConnect });
  }

  public async reconnectStartupAccounts(): Promise<AccountQuotaSnapshot[]> {
    return await invoke<AccountQuotaSnapshot[]>('quota_reconnect_startup_accounts_cmd');
  }

  public async renameAccount(accountId: string, displayName: string | null): Promise<boolean> {

    return await invoke<boolean>('quota_rename_account_cmd', { accountId, displayName });
  }

  public async getAccountState(accountId: string): Promise<AccountQuotaSnapshot | null> {
    return await invoke<AccountQuotaSnapshot | null>('quota_get_account_state_cmd', { accountId });
  }

  public async getAllStates(): Promise<AccountQuotaSnapshot[]> {
    return await invoke<AccountQuotaSnapshot[]>('quota_get_all_states_cmd');
  }

  public async refreshAccount(accountId: string): Promise<AccountQuotaSnapshot> {
    return await invoke<AccountQuotaSnapshot>('quota_refresh_account_cmd', { accountId });
  }

  public async refreshAll(): Promise<AccountQuotaSnapshot[]> {
    return await invoke<AccountQuotaSnapshot[]>('quota_refresh_all_cmd');
  }

  public async getPollingStatus(): Promise<PollingEngineStatus> {
    return await invoke<PollingEngineStatus>('quota_get_polling_status_cmd');
  }

  public async startMonitoring(): Promise<void> {
    return await invoke<void>('quota_start_monitoring_cmd');
  }

  public async stopMonitoring(): Promise<void> {
    return await invoke<void>('quota_stop_monitoring_cmd');
  }

  public async connectGoogleAccount(
    accountId: string,
    allowEmailUpdate?: boolean
  ): Promise<OAuthConnectionResult> {
    return await invoke<OAuthConnectionResult>('quota_connect_google_account_cmd', {
      accountId,
      allowEmailUpdate: allowEmailUpdate ?? false,
    });
  }

  public async verifyAntigravityOAuthConfiguration(): Promise<AntigravityOAuthVerificationResult> {
    return await invoke<AntigravityOAuthVerificationResult>('verify_antigravity_oauth_configuration_cmd');
  }

  public async getRefreshSettings(): Promise<QuotaRefreshSettings> {
    return await invoke<QuotaRefreshSettings>('quota_get_refresh_settings_cmd');
  }

  public async updateRefreshSettings(settings: QuotaRefreshSettings): Promise<void> {
    return await invoke<void>('quota_update_refresh_settings_cmd', { settings });
  }

  public async onAccountUpdated(callback: (snapshot: AccountQuotaSnapshot) => void): Promise<UnlistenFn> {
    return await listen<AccountQuotaSnapshot>('quota:account-updated', (event) => {
      callback(event.payload);
    });
  }

  public async onEngineStatusChanged(callback: () => void): Promise<UnlistenFn> {
    return await listen('quota:engine-status-changed', () => {
      callback();
    });
  }
}


export const quotaPollingService = QuotaPollingService.getInstance();
