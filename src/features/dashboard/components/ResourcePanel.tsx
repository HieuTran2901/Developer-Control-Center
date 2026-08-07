import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Icon } from '@/shared/components/ui/Icon';
import { ProcessHistory } from '@/domain/entities/ProcessHistory';
import { PerformanceSummary, PerformanceTrendDirection } from '@/domain/entities/PerformanceSummary';
import { EventBus, EventType } from '@/application/events/EventBus';
import { cn } from '@/shared/utils';
import { SparklineChart } from './SparklineChart';

export function ResourcePanel() {
  const [histories, setHistories] = useState<ProcessHistory[]>([]);
  const [summaries, setSummaries] = useState<Record<number, PerformanceSummary>>({});

  useEffect(() => {
    const unsubHistory = EventBus.subscribe<ProcessHistory[]>(EventType.HistoryMetricsUpdated, (data) => {
      setHistories([...data]);
    });
    
    const unsubSummary = EventBus.subscribe<PerformanceSummary[]>(EventType.PerformanceSummaryUpdated, (data) => {
      const map: Record<number, PerformanceSummary> = {};
      data.forEach(s => map[s.pid] = s);
      setSummaries(map);
    });

    return () => {
      unsubHistory();
      unsubSummary();
    };
  }, []);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Excellent': return 'text-green-400';
      case 'Good': return 'text-blue-400';
      case 'Warning': return 'text-yellow-400';
      case 'Critical': return 'text-red-400';
      default: return 'text-muted-foreground';
    }
  };

  const renderTrendIcon = (trend: PerformanceTrendDirection) => {
    if (trend === 'increasing') return <Icon name="TrendingUp" size={12} className="text-red-400" />;
    if (trend === 'decreasing') return <Icon name="TrendingDown" size={12} className="text-green-400" />;
    return <Icon name="Minus" size={12} className="text-muted-foreground" />;
  };

  const totalCpu = histories.reduce((acc, h) => acc + (h.cpu[h.cpu.length - 1] || 0), 0);
  const totalMemory = histories.reduce((acc, h) => acc + (h.memory[h.memory.length - 1] || 0), 0);

  return (
    <Card className="flex flex-col h-full bg-[#0d1117]/60">
      <CardHeader className="flex flex-row items-center justify-between pb-2 pt-4 px-4">
        <CardTitle className="text-sm font-medium flex items-center">
          <Icon name="Activity" size={16} className="mr-2 text-primary" />
          Resource Monitor & Analysis
        </CardTitle>
        <span className="text-[10px] text-muted-foreground animate-pulse">Live</span>
      </CardHeader>
      <CardContent className="px-4 pb-4 flex-1 flex flex-col">
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="bg-[#161b22] p-2 rounded border border-border/40">
            <div className="text-xs text-muted-foreground mb-1">Total CPU</div>
            <div className="text-lg font-bold text-blue-400">{totalCpu.toFixed(1)}%</div>
          </div>
          <div className="bg-[#161b22] p-2 rounded border border-border/40">
            <div className="text-xs text-muted-foreground mb-1">Total RAM</div>
            <div className="text-lg font-bold text-green-400">{formatBytes(totalMemory)}</div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto pr-1 space-y-3">
          {histories.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center mt-4">No active processes monitored</div>
          ) : (
            histories.map(h => {
              const summary = summaries[h.pid];
              const currentCpu = h.cpu[h.cpu.length - 1] || 0;
              const currentMem = h.memory[h.memory.length - 1] || 0;
              
              return (
                <div key={h.pid} className="bg-muted/10 p-3 rounded-md border border-border/30">
                  <div className="flex justify-between items-start mb-2 border-b border-border/30 pb-2">
                    <div>
                      <span className="font-mono text-xs font-semibold block">PID: {h.pid}</span>
                      {summary && (
                        <div className="flex items-center gap-2 mt-1">
                          <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded bg-background/50 border border-border/50", getStatusColor(summary.healthStatus))}>
                            {summary.healthScore} ({summary.healthStatus})
                          </span>
                          {summary.warnings.length > 0 && (
                            <span className="text-[10px] text-orange-400 flex items-center gap-1" title={summary.warnings.map(w => w.message).join('\n')}>
                              <Icon name="AlertTriangle" size={10} /> {summary.warnings.length}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex flex-col items-end gap-1 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1">CPU Trend: {summary ? renderTrendIcon(summary.trend.cpu) : <Icon name="Minus" size={12} />}</span>
                      <span className="flex items-center gap-1">RAM Trend: {summary ? renderTrendIcon(summary.trend.memory) : <Icon name="Minus" size={12} />}</span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    {/* CPU Chart */}
                    <div className="flex flex-col">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] text-muted-foreground">CPU</span>
                        <span className={cn("text-xs font-mono font-medium", currentCpu > 80 ? "text-red-400" : "text-blue-400")}>
                          {currentCpu.toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-[30px] w-full">
                        <SparklineChart data={h.cpu} maxValue={Math.max(100, h.peakCpu)} color="#60a5fa" width={120} height={30} />
                      </div>
                    </div>
                    
                    {/* Memory Chart */}
                    <div className="flex flex-col">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] text-muted-foreground">RAM</span>
                        <span className="text-xs font-mono font-medium text-green-400">
                          {formatBytes(currentMem)}
                        </span>
                      </div>
                      <div className="h-[30px] w-full">
                        <SparklineChart data={h.memory} maxValue={Math.max(1024 * 1024, h.peakMemory * 1.1)} color="#4ade80" width={120} height={30} />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}

