import { PageContainer } from '@/shared/components/layouts/PageContainer';
import { QuotaDashboard } from '@/features/settings/components/QuotaDashboard';

export function AIQuotaPage() {
  return (
    <PageContainer
      title="AI Quota"
      description="Monitor your Antigravity account quota, capacity and reset times."
    >
      <div className="w-full max-w-5xl animate-in fade-in duration-300">
        <QuotaDashboard />
      </div>
    </PageContainer>
  );
}
