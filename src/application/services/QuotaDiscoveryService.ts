import { invoke } from '@tauri-apps/api/core';
import {
  LocalUsageDiscoveryReport,
  QuotaDiscoveryReport,
  UsageCorrelationReport,
  UsageProtocolDiscoveryReport,
  UsageTraceReport,
} from '@/domain/entities/QuotaDiscovery';

export class QuotaDiscoveryService {
  private static instance: QuotaDiscoveryService;

  public static getInstance(): QuotaDiscoveryService {
    if (!QuotaDiscoveryService.instance) {
      QuotaDiscoveryService.instance = new QuotaDiscoveryService();
    }
    return QuotaDiscoveryService.instance;
  }

  public async runDiscovery(): Promise<QuotaDiscoveryReport> {
    return await invoke<QuotaDiscoveryReport>('discover_antigravity_quota_endpoints_cmd');
  }

  public async correlateUsageEndpoints(): Promise<UsageCorrelationReport> {
    return await invoke<UsageCorrelationReport>('correlate_antigravity_usage_cmd');
  }

  public async startUsageTrace(durationSecs: number = 8): Promise<UsageTraceReport> {
    return await invoke<UsageTraceReport>('start_usage_trace_cmd', { durationSecs });
  }

  public async discoverLocalUsageSources(): Promise<LocalUsageDiscoveryReport> {
    return await invoke<LocalUsageDiscoveryReport>('discover_local_usage_sources_cmd');
  }

  public async discoverUsageProtocol(durationSecs: number = 8): Promise<UsageProtocolDiscoveryReport> {
    return await invoke<UsageProtocolDiscoveryReport>('discover_usage_protocol_cmd', { durationSecs });
  }
}

export const quotaDiscoveryService = QuotaDiscoveryService.getInstance();
