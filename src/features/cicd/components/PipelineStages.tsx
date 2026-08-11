import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Icon } from '@/shared/components/ui/Icon';
import { Button } from '@/shared/components/ui/button';
import { mockPipelineStages } from '../data/mockCICDData';

export function PipelineStages() {
  return (
    <Card className="col-span-1 lg:col-span-3 bg-card/40 border-border/40 backdrop-blur-sm mt-4">
      <CardHeader className="p-4 border-b border-border/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <CardTitle className="text-sm font-semibold">Web Application Pipeline</CardTitle>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400">
            <Icon name="CheckCircle2" size={12} className="w-3 h-3 shrink-0" />
            <span className="text-[10px] font-medium uppercase tracking-wide">Success</span>
          </div>
          <span className="text-xs text-muted-foreground ml-1">Run #1245</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 gap-2 bg-muted/20">
            <Icon name="FileText" size={14} className="shrink-0" />
            View Logs
          </Button>
          <Button size="sm" className="h-8 gap-2 bg-blue-600 hover:bg-blue-700 text-white">
            <Icon name="Play" size={14} className="shrink-0 fill-current" />
            Run Again
          </Button>
          <Button variant="outline" size="sm" className="h-8 w-8 p-0 bg-muted/20">
            <Icon name="MoreHorizontal" size={14} className="shrink-0" />
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="p-4 overflow-x-auto">
        <div className="flex items-center min-w-max pb-2">
          {mockPipelineStages.map((stage, idx) => (
            <div key={stage.id} className="flex items-center">
              {/* Stage Card */}
              <div className="flex flex-col bg-muted/10 border border-border/30 rounded-lg p-2.5 min-w-[120px] flex-1 hover:bg-muted/20 hover:border-border/50 transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-semibold text-foreground truncate pr-2">{stage.name}</span>
                  {stage.status === 'Success' && (
                    <Icon name="CheckCircle2" size={14} className="w-3.5 h-3.5 text-green-500 shrink-0" />
                  )}
                  {stage.status === 'Failed' && (
                    <Icon name="XCircle" size={14} className="w-3.5 h-3.5 text-red-500 shrink-0" />
                  )}
                </div>
                <div className="flex flex-col gap-0.5 mt-auto">
                  <span className="text-[10px] text-muted-foreground font-mono">{stage.duration}</span>
                  {stage.info && (
                    <span className="text-[10px] text-green-400 font-medium">{stage.info}</span>
                  )}
                </div>
              </div>

              {/* Connector */}
              {idx < mockPipelineStages.length - 1 && (
                <div className="w-8 h-[2px] bg-green-500/50 mx-1 shrink-0 relative">
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-1.5 h-1.5 rounded-full bg-green-500"></div>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
