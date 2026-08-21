import { Icon } from '@/shared/components/ui/Icon';

export type TaskTypeFilter = 'learn' | 'troubleshoot' | 'runbook' | 'all';

interface TaskActionCardsProps {
  activeTaskFilter: TaskTypeFilter;
  onSelectTaskFilter: (filter: TaskTypeFilter) => void;
}

export function TaskActionCards({
  activeTaskFilter,
  onSelectTaskFilter,
}: TaskActionCardsProps) {
  const tasks = [
    {
      id: 'learn' as TaskTypeFilter,
      title: 'Learn',
      description: 'Learn a concept step by step',
      icon: 'BookOpen',
      color: 'text-blue-400',
      activeBg: 'bg-blue-500/10 border-blue-500/40 ring-1 ring-blue-500/30',
      iconBg: 'bg-blue-500/20 text-blue-400',
    },
    {
      id: 'troubleshoot' as TaskTypeFilter,
      title: 'Troubleshoot',
      description: 'Find solutions to fix problems',
      icon: 'AlertTriangle',
      color: 'text-rose-400',
      activeBg: 'bg-rose-500/10 border-rose-500/40 ring-1 ring-rose-500/30',
      iconBg: 'bg-rose-500/20 text-rose-400',
    },
    {
      id: 'runbook' as TaskTypeFilter,
      title: 'Runbook',
      description: 'Follow a task or procedure',
      icon: 'Terminal',
      color: 'text-emerald-400',
      activeBg: 'bg-emerald-500/10 border-emerald-500/40 ring-1 ring-emerald-500/30',
      iconBg: 'bg-emerald-500/20 text-emerald-400',
    },
  ];

  return (
    <div className="space-y-2.5">
      <h2 className="text-xs font-bold text-foreground tracking-tight flex items-center gap-2">
        <span>What do you want to do?</span>
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {tasks.map((t) => {
          const isActive = activeTaskFilter === t.id;

          return (
            <button
              key={t.id}
              onClick={() => onSelectTaskFilter(isActive ? 'all' : t.id)}
              className={`p-3 rounded-xl bg-surface border text-left transition-all group flex items-start gap-3 cursor-pointer ${
                isActive
                  ? t.activeBg
                  : 'border-border/70 hover:border-primary/40 hover:bg-muted/30'
              }`}
            >
              <div
                className={`p-2 rounded-lg shrink-0 transition-transform group-hover:scale-105 ${t.iconBg}`}
              >
                <Icon name={t.icon as any} className="w-4 h-4" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                    {t.title}
                  </h3>
                  {isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                  {t.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
