import { AccountQuotaSnapshot } from '@/domain/entities/QuotaPolling';

export type QuotaHealthLevel = 'Healthy' | 'Warning' | 'Critical' | 'Exhausted' | 'Unknown';

export interface AccountHealthSummary {
  accountId: string;
  authState: string;
  health5h: QuotaHealthLevel;
  healthWeekly: QuotaHealthLevel;
  overallHealth: QuotaHealthLevel;
  isStale: boolean;
}

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface AccountAlert {
  id: string;
  accountId: string;
  type: 'auth_required' | 'reauth_required' | 'identity_mismatch' | 'quota_warning' | 'quota_critical' | 'reset_imminent' | 'stale_data';
  severity: AlertSeverity;
  title: string;
  message: string;
}

export interface ResetCountdownInfo {
  secondsRemaining: number | null;
  formattedCountdown: string;
  isImminent: boolean;
  isExpired: boolean;
}

export interface RankedAccount {
  accountId: string;
  email: string;
  displayName: string;
  score: number;
  rank: number;
  health: AccountHealthSummary;
  fraction5h: number | null;
  fractionWeekly: number | null;
  earliestResetSeconds: number | null;
  isEligible: boolean;
  disqualificationReason?: string;
}

export interface AccountRecommendation {
  accountId: string;
  email: string;
  displayName: string;
  reason: string;
  fraction5h: number | null;
  fractionWeekly: number | null;
  nextResetFormatted: string;
  confidence: 'High' | 'Medium' | 'Low';
}

// Configurable constants
export const ORCHESTRATION_CONSTANTS = {
  HEALTH_THRESHOLD_WARNING: 0.50,
  HEALTH_THRESHOLD_CRITICAL: 0.20,
  HEALTH_THRESHOLD_EXHAUSTED: 0.02,
  STALE_THRESHOLD_SECONDS: 300,
  RESET_IMMINENT_SECONDS: 900,
  WEIGHT_5H: 0.65,
  WEIGHT_WEEKLY: 0.35,
};

export class QuotaOrchestrationService {
  /**
   * Derive health level from remaining fraction
   */
  public static calculateHealthLevel(fraction: number | null | undefined): QuotaHealthLevel {
    if (fraction === null || fraction === undefined || isNaN(fraction)) {
      return 'Unknown';
    }
    if (fraction <= ORCHESTRATION_CONSTANTS.HEALTH_THRESHOLD_EXHAUSTED) {
      return 'Exhausted';
    }
    if (fraction <= ORCHESTRATION_CONSTANTS.HEALTH_THRESHOLD_CRITICAL) {
      return 'Critical';
    }
    if (fraction <= ORCHESTRATION_CONSTANTS.HEALTH_THRESHOLD_WARNING) {
      return 'Warning';
    }
    return 'Healthy';
  }

  /**
   * Centralized countdown calculation from an ISO reset timestamp
   */
  public static getResetCountdown(resetAtStr: string | null | undefined): ResetCountdownInfo {
    if (!resetAtStr || !resetAtStr.trim()) {
      return {
        secondsRemaining: null,
        formattedCountdown: 'Unknown',
        isImminent: false,
        isExpired: false,
      };
    }

    const resetDate = new Date(resetAtStr);
    const resetTimeMs = resetDate.getTime();
    if (isNaN(resetTimeMs)) {
      return {
        secondsRemaining: null,
        formattedCountdown: 'Unknown',
        isImminent: false,
        isExpired: false,
      };
    }

    const nowMs = Date.now();
    const diffSeconds = Math.max(0, Math.floor((resetTimeMs - nowMs) / 1000));

    if (diffSeconds === 0) {
      return {
        secondsRemaining: 0,
        formattedCountdown: 'Resetting soon...',
        isImminent: true,
        isExpired: true,
      };
    }

    const days = Math.floor(diffSeconds / 86400);
    const hours = Math.floor((diffSeconds % 86400) / 3600);
    const mins = Math.floor((diffSeconds % 3600) / 60);
    const secs = diffSeconds % 60;

    let formatted = '';
    if (days > 0) {
      formatted = `${days}d ${hours}h`;
    } else if (hours > 0) {
      formatted = `${hours}h ${mins}m`;
    } else {
      formatted = `${mins}m ${secs}s`;
    }

    const isImminent = diffSeconds <= ORCHESTRATION_CONSTANTS.RESET_IMMINENT_SECONDS;

    return {
      secondsRemaining: diffSeconds,
      formattedCountdown: formatted,
      isImminent,
      isExpired: false,
    };
  }

  /**
   * Extract aggregate 5H and Weekly fractions across models
   */
  public static extractAccountFractions(snapshot: AccountQuotaSnapshot): {
    fraction5h: number | null;
    fractionWeekly: number | null;
    earliest5hReset: string | null;
    earliestWeeklyReset: string | null;
  } {
    const models = snapshot.quota?.models || [];
    if (models.length === 0) {
      return {
        fraction5h: null,
        fractionWeekly: null,
        earliest5hReset: null,
        earliestWeeklyReset: null,
      };
    }

    // Average or take representative model (first model)
    const primaryModel = models[0];
    return {
      fraction5h: primaryModel.remainingFraction ?? null,
      fractionWeekly: primaryModel.weeklyRemainingFraction ?? null,
      earliest5hReset: primaryModel.resetAt ?? null,
      earliestWeeklyReset: primaryModel.weeklyResetAt ?? null,
    };
  }

  /**
   * Evaluate complete health summary for an account
   */
  public static getAccountHealth(snapshot: AccountQuotaSnapshot): AccountHealthSummary {
    const { fraction5h, fractionWeekly } = this.extractAccountFractions(snapshot);
    const health5h = this.calculateHealthLevel(fraction5h);
    const healthWeekly = this.calculateHealthLevel(fractionWeekly);

    const isStale = snapshot.dataQuality === 'Stale';

    let overallHealth: QuotaHealthLevel = 'Healthy';
    if (snapshot.status !== 'Online') {
      overallHealth = 'Unknown';
    } else if (health5h === 'Exhausted' || healthWeekly === 'Exhausted') {
      overallHealth = 'Exhausted';
    } else if (health5h === 'Critical' || healthWeekly === 'Critical') {
      overallHealth = 'Critical';
    } else if (health5h === 'Warning' || healthWeekly === 'Warning') {
      overallHealth = 'Warning';
    } else if (health5h === 'Unknown' && healthWeekly === 'Unknown') {
      overallHealth = 'Unknown';
    }

    return {
      accountId: snapshot.accountId,
      authState: snapshot.status,
      health5h,
      healthWeekly,
      overallHealth,
      isStale,
    };
  }

  /**
   * Generate account-scoped alerts
   */
  public static getAccountAlerts(snapshot: AccountQuotaSnapshot): AccountAlert[] {
    const alerts: AccountAlert[] = [];
    const idPrefix = `${snapshot.accountId}-alert`;

    if (snapshot.status === 'AuthRequired') {
      if (snapshot.errorMessage?.includes('Account mismatch')) {
        alerts.push({
          id: `${idPrefix}-mismatch`,
          accountId: snapshot.accountId,
          type: 'identity_mismatch',
          severity: 'critical',
          title: 'Identity Mismatch',
          message: 'Local runtime authenticated as another Google account.',
        });
      } else {
        alerts.push({
          id: `${idPrefix}-auth`,
          accountId: snapshot.accountId,
          type: 'auth_required',
          severity: 'critical',
          title: 'Authentication Required',
          message: 'Google authentication is required to monitor quota.',
        });
      }
      return alerts;
    }

    if (snapshot.status === 'ReauthorizationRequired') {
      alerts.push({
        id: `${idPrefix}-reauth`,
        accountId: snapshot.accountId,
        type: 'reauth_required',
        severity: 'critical',
        title: 'Reauthorization Required',
        message: 'Google OAuth token expired or revoked. Please reconnect.',
      });
      return alerts;
    }

    const { fraction5h, fractionWeekly, earliest5hReset } = this.extractAccountFractions(snapshot);

    if (fraction5h !== null) {
      if (fraction5h <= ORCHESTRATION_CONSTANTS.HEALTH_THRESHOLD_CRITICAL) {
        alerts.push({
          id: `${idPrefix}-5h-critical`,
          accountId: snapshot.accountId,
          type: 'quota_critical',
          severity: 'critical',
          title: '5H Quota Critical',
          message: `Only ${(fraction5h * 100).toFixed(0)}% remaining in 5H window.`,
        });
      } else if (fraction5h <= ORCHESTRATION_CONSTANTS.HEALTH_THRESHOLD_WARNING) {
        alerts.push({
          id: `${idPrefix}-5h-warn`,
          accountId: snapshot.accountId,
          type: 'quota_warning',
          severity: 'warning',
          title: '5H Quota Warning',
          message: `${(fraction5h * 100).toFixed(0)}% remaining in 5H window.`,
        });
      }
    }

    if (fractionWeekly !== null) {
      if (fractionWeekly <= ORCHESTRATION_CONSTANTS.HEALTH_THRESHOLD_CRITICAL) {
        alerts.push({
          id: `${idPrefix}-weekly-critical`,
          accountId: snapshot.accountId,
          type: 'quota_critical',
          severity: 'critical',
          title: 'Weekly Quota Critical',
          message: `Only ${(fractionWeekly * 100).toFixed(0)}% remaining in Weekly window.`,
        });
      }
    }

    if (earliest5hReset) {
      const countdown = this.getResetCountdown(earliest5hReset);
      if (countdown.isImminent && countdown.secondsRemaining !== null && countdown.secondsRemaining > 0) {
        alerts.push({
          id: `${idPrefix}-reset-imminent`,
          accountId: snapshot.accountId,
          type: 'reset_imminent',
          severity: 'info',
          title: 'Reset Imminent',
          message: `5H quota resets in ${countdown.formattedCountdown}.`,
        });
      }
    }

    if (snapshot.dataQuality === 'Stale') {
      alerts.push({
        id: `${idPrefix}-stale`,
        accountId: snapshot.accountId,
        type: 'stale_data',
        severity: 'warning',
        title: 'Stale Data',
        message: 'Using last known quota due to temporary sync error.',
      });
    }

    return alerts;
  }

  /**
   * Deterministic account ranking algorithm
   */
  public static rankAccounts(snapshots: AccountQuotaSnapshot[]): RankedAccount[] {
    const scored: RankedAccount[] = snapshots.map((s) => {
      const health = this.getAccountHealth(s);
      const { fraction5h, fractionWeekly, earliest5hReset } = this.extractAccountFractions(s);
      const countdown = this.getResetCountdown(earliest5hReset);

      let isEligible = true;
      let disqualificationReason: string | undefined;

      if (s.status !== 'Online') {
        isEligible = false;
        disqualificationReason = `Account state is ${s.status}`;
      } else if (fraction5h === null && fractionWeekly === null) {
        isEligible = false;
        disqualificationReason = 'No quota metrics available';
      } else if (health.overallHealth === 'Exhausted') {
        isEligible = false;
        disqualificationReason = 'Quota exhausted';
      }

      let score = 0;
      if (isEligible) {
        const val5h = fraction5h ?? 0;
        const valW = fractionWeekly ?? val5h;
        score = (val5h * ORCHESTRATION_CONSTANTS.WEIGHT_5H) + (valW * ORCHESTRATION_CONSTANTS.WEIGHT_WEEKLY);

        // Small penalty if data is stale
        if (health.isStale) {
          score *= 0.9;
        }
      }

      return {
        accountId: s.accountId,
        email: s.email,
        displayName: s.displayName || s.email,
        score,
        rank: 0,
        health,
        fraction5h,
        fractionWeekly,
        earliestResetSeconds: countdown.secondsRemaining,
        isEligible,
        disqualificationReason,
      };
    });

    // Deterministic sort: score DESC -> accountId ASC
    scored.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.accountId.localeCompare(b.accountId);
    });

    // Assign rank 1-indexed
    return scored.map((item, idx) => ({
      ...item,
      rank: idx + 1,
    }));
  }

  /**
   * Produce top account recommendation
   */
  public static getRecommendedAccount(snapshots: AccountQuotaSnapshot[]): AccountRecommendation | null {
    const ranked = this.rankAccounts(snapshots);
    const topEligible = ranked.find((r) => r.isEligible && r.score > 0);

    if (!topEligible) {
      return null;
    }

    const pct5h = topEligible.fraction5h !== null ? `${(topEligible.fraction5h * 100).toFixed(0)}%` : 'N/A';
    const pctW = topEligible.fractionWeekly !== null ? `${(topEligible.fractionWeekly * 100).toFixed(0)}%` : 'N/A';

    let confidence: 'High' | 'Medium' | 'Low' = 'High';
    if (topEligible.score < 0.4) {
      confidence = 'Low';
    } else if (topEligible.score < 0.7) {
      confidence = 'Medium';
    }

    return {
      accountId: topEligible.accountId,
      email: topEligible.email,
      displayName: topEligible.displayName,
      reason: `Best available quota (${pct5h} in 5H window, ${pctW} weekly)`,
      fraction5h: topEligible.fraction5h,
      fractionWeekly: topEligible.fractionWeekly,
      nextResetFormatted: topEligible.earliestResetSeconds
        ? `${Math.floor(topEligible.earliestResetSeconds / 3600)}h ${Math.floor((topEligible.earliestResetSeconds % 3600) / 60)}m`
        : 'Active',
      confidence,
    };
  }
}
