import { useState } from 'react';
import { PageContainer } from '@/shared/components/layouts/PageContainer';
import { QuotaDashboard } from '@/features/settings/components/QuotaDashboard';
import { MultiAccountQuotaDashboard } from '@/features/quota/v2/MultiAccountQuotaDashboard';
import { Button } from '@/shared/components/ui/button';
import { Icon } from '@/shared/components/ui/Icon';

const VERSION_STORAGE_KEY = 'dcc:quota_dashboard_version';

export function AIQuotaPage() {
  const [version, setVersion] = useState<'v1' | 'v2'>(() => {
    try {
      const stored = localStorage.getItem(VERSION_STORAGE_KEY);
      return stored === 'v1' ? 'v1' : 'v2';
    } catch {
      return 'v2';
    }
  });

  const handleSetVersion = (v: 'v1' | 'v2') => {
    setVersion(v);
    try {
      localStorage.setItem(VERSION_STORAGE_KEY, v);
    } catch (e) {
      console.warn('Failed to save quota dashboard version preference', e);
    }
  };

  return (
    <PageContainer
      title="AI Quota"
      description="Monitor and orchestrate multiple Google & Antigravity accounts, capacity and reset times."
    >
      <div className="w-full max-w-7xl animate-in fade-in duration-300 space-y-3">
        {/* V1 Mode Switcher Bar */}
        {version === 'v1' && (
          <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/25 flex items-center justify-between text-xs font-sans">
            <div className="flex items-center gap-2 text-foreground font-medium">
              <Icon name="LayoutGrid" className="w-4 h-4 text-primary" />
              <span>Viewing <strong>Classic V1 Card Grid</strong>. Switch to <strong>V2 Orchestration Table</strong> for multi-account recommendations.</span>
            </div>
            <Button
              size="sm"
              onClick={() => handleSetVersion('v2')}
              className="h-7 text-xs px-3 bg-primary text-primary-foreground gap-1 font-semibold"
            >
              <Icon name="Sparkles" className="w-3.5 h-3.5" />
              <span>Switch to V2 Orchestration</span>
            </Button>
          </div>
        )}

        {/* Dynamic Version Presentation */}
        {version === 'v2' ? (
          <MultiAccountQuotaDashboard onSwitchToV1={() => handleSetVersion('v1')} />
        ) : (
          <QuotaDashboard />
        )}
      </div>
    </PageContainer>
  );
}
