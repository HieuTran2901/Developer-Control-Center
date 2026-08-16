import { invoke } from '@tauri-apps/api/core';
import {
  AccountIdentity,
  AntigravityQuotaSnapshot,
  AntigravityRuntimeDiagnostic,
  QuotaStatus,
  QuotaVerificationDiagnostic,
} from '@/domain/entities/QuotaProvider';


export class QuotaProviderService {
  private static instance: QuotaProviderService;

  public static getInstance(): QuotaProviderService {
    if (!QuotaProviderService.instance) {
      QuotaProviderService.instance = new QuotaProviderService();
    }
    return QuotaProviderService.instance;
  }

  public async getAccountQuota(accountId?: string, forceRefresh: boolean = false): Promise<QuotaStatus> {
    return await invoke<QuotaStatus>('get_antigravity_account_quota_cmd', {
      accountId: accountId || null,
      forceRefresh,
    });
  }

  public async getLocalQuota(): Promise<AntigravityQuotaSnapshot> {
    return await invoke<AntigravityQuotaSnapshot>('get_antigravity_local_quota_cmd');
  }

  public async verifyLocalRuntime(): Promise<AntigravityRuntimeDiagnostic> {
    return await invoke<AntigravityRuntimeDiagnostic>('verify_antigravity_quota_runtime_cmd');
  }

  public async verifyQuotaPath(accountId?: string): Promise<QuotaVerificationDiagnostic> {
    return await invoke<QuotaVerificationDiagnostic>('verify_antigravity_quota_path_cmd', {
      accountId: accountId || null,
    });
  }

  public async listAccounts(): Promise<AccountIdentity[]> {
    return await invoke<AccountIdentity[]>('list_antigravity_accounts_cmd');
  }
}


export const quotaProviderService = QuotaProviderService.getInstance();
