
import { PageContainer } from '@/shared/components/layouts/PageContainer';
import { EmptyState } from '@/shared/components/ui/EmptyState';

export function PlaceholderPage({ title, icon }: { title: string, icon: any }) {
  return (
    <PageContainer title={title}>
      <EmptyState 
        icon={icon} 
        title={`${title} Module`} 
        description={`This module is currently under construction in the UI Foundation phase.`} 
        className="h-full mt-20"
      />
    </PageContainer>
  );
}
