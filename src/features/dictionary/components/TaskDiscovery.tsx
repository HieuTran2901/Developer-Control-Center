import { useState } from 'react';
import { Icon } from '@/shared/components/ui/Icon';
import { GuideTask } from '../domain/entities/GuideTask';
import { GUIDE_WORKFLOWS } from '../data/guideWorkflows';
import { Button } from '@/shared/components/ui/button';

interface TaskDiscoveryProps {
  tasks: GuideTask[];
  selectedTaskId: string | null;
  onSelectTask: (taskId: string) => void;
  onClearTask: () => void;
  onLaunchWorkflow?: (workflowId: string) => void;
  onOpenCommandFinder?: () => void;
  matchedCount?: number;
}

export function TaskDiscovery({
  tasks,
  selectedTaskId,
  onSelectTask,
  onClearTask,
  onLaunchWorkflow,
  onOpenCommandFinder,
  matchedCount = 0,
}: TaskDiscoveryProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const activeTask = tasks.find((t) => t.id === selectedTaskId) || null;
  const activeWorkflow = activeTask
    ? GUIDE_WORKFLOWS.find((w) => w.taskId === activeTask.id) || null
    : null;

  // Show 4 initial tasks when collapsed, or all when expanded
  const visibleTasks = isExpanded ? tasks : tasks.slice(0, 4);
  const hiddenCount = tasks.length - 4;

  const handleKeyDown = (e: React.KeyboardEvent, taskId: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelectTask(taskId);
    }
  };

  return (
    <div className="space-y-3 bg-card/40 border border-border/60 rounded-xl p-4 transition-all">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
              Goal Launcher
            </span>
            <h2 className="text-sm font-semibold tracking-tight text-foreground uppercase">
              What are you trying to do?
            </h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Start with a goal and choose between a Guided Workflow, Command Finder, or Browsing Documentation.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {onOpenCommandFinder && (
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenCommandFinder}
              className="text-xs font-mono text-primary border-primary/40 hover:bg-primary/10 h-7 px-2.5"
            >
              <Icon name="Search" className="w-3.5 h-3.5 mr-1" />
              <span>Find a Command</span>
            </Button>
          )}

          {hiddenCount > 0 && !selectedTaskId && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-xs text-muted-foreground hover:text-foreground h-7 px-2 font-mono"
            >
              {isExpanded ? (
                <>
                  <span>Show Less</span>
                  <Icon name="ChevronUp" className="w-3.5 h-3.5 ml-1" />
                </>
              ) : (
                <>
                  <span>+{hiddenCount} More Tasks</span>
                  <Icon name="ChevronDown" className="w-3.5 h-3.5 ml-1" />
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Task Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        {visibleTasks.map((task) => {
          const isSelected = selectedTaskId === task.id;
          const hasWorkflow = GUIDE_WORKFLOWS.some((w) => w.taskId === task.id);

          return (
            <div
              key={task.id}
              role="button"
              tabIndex={0}
              aria-label={`Goal task: ${task.title}`}
              aria-pressed={isSelected}
              onClick={() => onSelectTask(task.id)}
              onKeyDown={(e) => handleKeyDown(e, task.id)}
              className={`group relative p-3 rounded-lg border text-left transition-all cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                isSelected
                  ? 'bg-primary/10 border-primary shadow-sm text-foreground'
                  : 'bg-background/60 border-border/60 hover:border-primary/40 hover:bg-background hover:shadow-xs text-muted-foreground hover:text-foreground'
              }`}
            >
              <div className="flex items-start justify-between space-x-2">
                <div
                  className={`p-1.5 rounded-md transition-colors ${
                    isSelected
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted/80 text-foreground group-hover:bg-primary/20 group-hover:text-primary'
                  }`}
                >
                  <Icon name={task.icon} className="w-4 h-4" />
                </div>
                <div className="flex items-center space-x-1">
                  {hasWorkflow && (
                    <span className="inline-flex items-center text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                      Workflow
                    </span>
                  )}
                  {isSelected && (
                    <span className="inline-flex items-center text-[10px] font-mono font-medium text-primary bg-primary/20 px-1.5 py-0.5 rounded">
                      ✓ Active
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-2.5 space-y-0.5">
                <h3
                  className={`text-xs font-semibold leading-snug tracking-tight ${
                    isSelected ? 'text-primary' : 'text-foreground'
                  }`}
                >
                  {task.title}
                </h3>
                <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                  {task.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Active Task Context Banner with Guided Workflow Launcher */}
      {activeTask && (
        <div className="mt-3 pt-3 border-t border-border/60 flex flex-wrap items-center justify-between gap-3 bg-primary/5 p-3 rounded-lg border border-primary/30">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-md bg-primary text-primary-foreground shrink-0">
              <Icon name={activeTask.icon} className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold font-mono text-primary uppercase">
                  ✓ Goal: {activeTask.title}
                </span>
                <span className="text-[11px] font-mono text-muted-foreground bg-background/80 px-2 py-0.5 rounded border border-border/50">
                  {matchedCount} {matchedCount === 1 ? 'guide' : 'guides'} found
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{activeTask.description}</p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            {activeWorkflow && onLaunchWorkflow && (
              <Button
                variant="default"
                size="sm"
                onClick={() => onLaunchWorkflow(activeWorkflow.id)}
                className="h-8 px-3 text-xs font-mono bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs"
              >
                <Icon name="Play" className="w-3.5 h-3.5 mr-1.5 fill-current" />
                Launch Guided Workflow ({activeWorkflow.steps.length} steps)
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={onClearTask}
              className="h-8 px-3 text-xs font-mono border-primary/40 text-primary hover:bg-primary/10 hover:text-primary"
            >
              <Icon name="X" className="w-3.5 h-3.5 mr-1.5" />
              Clear Task
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
