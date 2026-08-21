import { useState } from 'react';
import { Icon } from '@/shared/components/ui/Icon';
import { Button } from '@/shared/components/ui/button';

interface ChecklistItem {
  id: string;
  category: string;
  label: string;
  recommendation: string;
  commandSnippet?: string;
  isCompleted: boolean;
}

const PRODUCTION_ITEMS: ChecklistItem[] = [
  {
    id: 'chk-non-root',
    category: 'SECURITY',
    label: 'Container runs as non-root user',
    recommendation: 'Specify `USER node` or `USER 10001` in Dockerfile to prevent container breakout privilege escalation.',
    commandSnippet: 'USER node',
    isCompleted: false,
  },
  {
    id: 'chk-healthcheck',
    category: 'RELIABILITY',
    label: 'Container Healthcheck configured',
    recommendation: 'Define HEALTHCHECK in Dockerfile so orchestrators know when to restart unhealthy instances.',
    commandSnippet: 'HEALTHCHECK --interval=30s --timeout=3s CMD curl -f http://localhost:8080/health || exit 1',
    isCompleted: false,
  },
  {
    id: 'chk-resource-limits',
    category: 'PERFORMANCE',
    label: 'CPU & Memory Resource limits enforced',
    recommendation: 'Prevent OOM Killer from bringing down host machine by assigning explicit RAM and CPU budgets.',
    commandSnippet: 'docker run -d -m 2g --cpus "1.5" -p 8080:80 nginx',
    isCompleted: false,
  },
  {
    id: 'chk-log-rotation',
    category: 'OPERATIONS',
    label: 'Log driver & rotation configured',
    recommendation: 'Prevent container stdout logs from filling up host disk space.',
    commandSnippet: 'docker run -d --log-opt max-size=10m --log-opt max-file=3 nginx',
    isCompleted: false,
  },
  {
    id: 'chk-secrets',
    category: 'SECURITY',
    label: 'Secrets & API keys not embedded in Dockerfile',
    recommendation: 'Pass secrets via environment variables or secret managers, never hardcode in image layers.',
    commandSnippet: 'docker run -d -e DATABASE_URL=$DB_URL nginx',
    isCompleted: false,
  },
  {
    id: 'chk-pinned-tag',
    category: 'STABILITY',
    label: 'Immutable image tag pinned (no :latest)',
    recommendation: 'Always use specific semantic version tags (e.g., nginx:1.25.4-alpine) to guarantee reproducible builds.',
    commandSnippet: 'docker run -d nginx:1.25.4-alpine',
    isCompleted: false,
  },
];

export function ProductionChecklist() {
  const [items, setItems] = useState<ChecklistItem[]>(PRODUCTION_ITEMS);

  const toggleItem = (id: string) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, isCompleted: !it.isCompleted } : it))
    );
  };

  const completedCount = items.filter((it) => it.isCompleted).length;
  const progressPct = Math.round((completedCount / items.length) * 100);

  return (
    <div className="p-5 rounded-2xl bg-card border border-amber-500/30 space-y-4 shadow-sm select-none">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 text-xs font-mono font-bold text-amber-400 uppercase">
          <Icon name="ShieldCheck" className="w-4 h-4 text-amber-400" />
          <span>Production Readiness Checklist</span>
        </div>
        <span className="text-xs font-mono text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
          {completedCount} / {items.length} Ready ({progressPct}%)
        </span>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-2 rounded-full bg-background overflow-hidden border border-border/60">
        <div
          className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all duration-300"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Checklist Items */}
      <div className="space-y-2.5">
        {items.map((item) => (
          <div
            key={item.id}
            onClick={() => toggleItem(item.id)}
            className={`p-3.5 rounded-xl border text-xs transition-all cursor-pointer space-y-1.5 ${
              item.isCompleted
                ? 'bg-emerald-500/10 border-emerald-500/40 text-foreground ring-1 ring-emerald-500/20'
                : 'bg-background/60 border-border/60 hover:border-amber-500/40 text-foreground/90'
            }`}
          >
            <div className="flex items-center justify-between font-mono">
              <div className="flex items-center space-x-2">
                <span className="text-emerald-400 font-bold">
                  {item.isCompleted ? '☑' : '☐'}
                </span>
                <span className="font-bold font-sans">{item.label}</span>
              </div>
              <span className="text-[10px] uppercase font-bold text-amber-400 px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                {item.category}
              </span>
            </div>

            <p className="text-[11px] text-muted-foreground leading-relaxed font-sans pl-5">
              {item.recommendation}
            </p>

            {item.commandSnippet && (
              <div className="ml-5 p-2 rounded bg-card border border-border/50 text-[11px] font-mono text-emerald-400 flex items-center justify-between">
                <span className="truncate pr-2">$ {item.commandSnippet}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(item.commandSnippet!);
                  }}
                  className="h-5 px-2 text-[10px] font-mono text-emerald-400 hover:bg-emerald-500/10"
                >
                  Copy
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
