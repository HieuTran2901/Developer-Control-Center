import { Card, CardContent } from '@/shared/components/ui/card';
import { Icon, IconName } from '@/shared/components/ui/Icon';
import { mockMetrics } from '../data/mockCICDData';

export function CICDMetricCards() {
  const cards = [
    {
      title: 'Total Pipelines',
      value: mockMetrics.totalPipelines,
      subtitle: 'Across all projects',
      icon: 'Workflow' as IconName,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10 border-blue-500/20'
    },
    {
      title: 'Successful Runs',
      value: mockMetrics.successfulRuns,
      subtitle: 'This week',
      icon: 'CheckCircle2' as IconName,
      color: 'text-green-400',
      bg: 'bg-green-500/10 border-green-500/20'
    },
    {
      title: 'Failed Runs',
      value: mockMetrics.failedRuns,
      subtitle: 'This week',
      icon: 'XCircle' as IconName,
      color: 'text-red-400',
      bg: 'bg-red-500/10 border-red-500/20'
    },
    {
      title: 'Avg. Duration',
      value: mockMetrics.avgDuration,
      subtitle: 'This week',
      icon: 'Clock' as IconName,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10 border-blue-500/20'
    },
    {
      title: 'Deployments',
      value: mockMetrics.deployments,
      subtitle: 'This week',
      icon: 'Rocket' as IconName,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10 border-purple-500/20'
    }
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
      {cards.map((card, idx) => (
        <Card key={idx} className="bg-card/40 border-border/40 backdrop-blur-sm">
          <CardContent className="p-4 flex justify-between items-start">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">{card.title}</span>
              <span className="text-2xl font-bold tracking-tight text-foreground leading-none mt-1">{card.value}</span>
              <span className="text-[10px] text-muted-foreground/80 mt-1">{card.subtitle}</span>
            </div>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 ${card.bg}`}>
              <Icon name={card.icon} size={16} className={card.color} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
