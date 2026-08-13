import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Icon } from '@/shared/components/ui/Icon';
import { Button } from '@/shared/components/ui/button';
import { usePipelineContext } from '../context/PipelineContext';
import { cn } from '@/shared/utils';

export function RecentPipelineRuns() {
  const { recentExecutions, triggerPipeline } = usePipelineContext();

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'Success':
        return { icon: 'CheckCircle2', color: 'text-green-500' };
      case 'Failed':
        return { icon: 'XCircle', color: 'text-red-500' };
      case 'Running':
        return { icon: 'Loader2', color: 'text-blue-500', className: 'animate-spin' };
      case 'Cancelled':
        return { icon: 'MinusCircle', color: 'text-muted-foreground' };
      default:
        return { icon: 'HelpCircle', color: 'text-muted-foreground' };
    }
  };

  const getProjectIcon = (project: string) => {
    if (project.includes('frontend') || project.includes('web')) return { icon: 'AppWindow', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' };
    if (project.includes('backend') || project.includes('api')) return { icon: 'Server', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' };
    if (project.includes('ai') || project.includes('worker')) return { icon: 'Cpu', color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' };
    return { icon: 'FolderGit2', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' };
  };

  return (
    <Card className="col-span-1 xl:col-span-2 bg-card/40 border-border/40 backdrop-blur-sm flex flex-col h-full">
      <CardHeader className="p-4 border-b border-border/20 flex flex-row items-center justify-between pb-4">
        <CardTitle className="text-sm font-semibold">Recent Pipeline Runs</CardTitle>
        <button className="text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1 group">
          View all runs
          <Icon name="ArrowRight" size={12} className="group-hover:translate-x-0.5 transition-transform" />
        </button>
      </CardHeader>
      <CardContent className="p-0 overflow-hidden flex flex-col flex-1">
        {/* Table Header */}
        <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_60px] gap-2 px-5 py-2 bg-muted/10 border-b border-border/20 text-[10px] font-semibold text-muted-foreground tracking-wider uppercase">
          <div>Pipeline</div>
          <div>Status</div>
          <div>Branch</div>
          <div>Commit</div>
          <div>Duration</div>
          <div>Triggered</div>
          <div className="text-right">Actions</div>
        </div>

        {/* Table Body */}
        <div className="flex-1 overflow-y-auto">
          {recentExecutions.map((run) => {
            const statusStyle = getStatusStyle(run.status);
            const projectStyle = getProjectIcon(run.project);
            
            return (
              <div 
                key={run.id}
                className="grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_60px] gap-2 px-5 py-2 border-b border-border/20 hover:bg-muted/10 transition-colors items-center"
              >
                {/* PIPELINE */}
                <div className="flex items-center gap-3">
                  <div className={cn("w-8 h-8 rounded-md border flex items-center justify-center shrink-0", projectStyle.bg)}>
                    <Icon name={projectStyle.icon as any} size={14} className={cn("w-3.5 h-3.5 shrink-0", projectStyle.color)} />
                  </div>
                  <div className="overflow-hidden">
                    <div className="text-xs font-semibold text-foreground truncate">{run.name}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{run.project}</div>
                  </div>
                </div>

                {/* STATUS */}
                <div className="flex items-center gap-1.5 overflow-hidden">
                  <Icon 
                    name={statusStyle.icon as any} 
                    size={14} 
                    className={cn("w-3.5 h-3.5 shrink-0", statusStyle.color, statusStyle.className)} 
                  />
                  <span className={cn("text-xs font-medium truncate", statusStyle.color)}>
                    {run.status}
                  </span>
                </div>

                {/* BRANCH */}
                <div className="flex items-center gap-1.5 overflow-hidden">
                  <Icon name="GitBranch" size={12} className="w-3 h-3 shrink-0 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground font-mono truncate">{run.branch}</span>
                </div>

                {/* COMMIT */}
                <div className="overflow-hidden">
                  <div className="text-xs text-muted-foreground font-mono truncate">{run.commit}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{run.commitMessage}</div>
                </div>

                {/* DURATION */}
                <div className="flex items-center gap-1.5 overflow-hidden">
                  <Icon name="Clock" size={12} className="w-3 h-3 shrink-0 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground truncate">{run.duration}</span>
                </div>

                {/* TRIGGERED */}
                <div className="overflow-hidden">
                  <div className="text-xs text-muted-foreground truncate">{run.triggeredAt}</div>
                  <div className="text-[10px] text-muted-foreground truncate">by {run.triggeredBy}</div>
                </div>

                {/* ACTIONS */}
                <div className="flex items-center justify-end gap-1">
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20" title="Run Again" onClick={() => triggerPipeline('web-app-pipeline')}>
                    <Icon name="Play" size={12} className="w-3 h-3 shrink-0 fill-current" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground">
                    <Icon name="MoreHorizontal" size={14} className="w-3.5 h-3.5 shrink-0" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
