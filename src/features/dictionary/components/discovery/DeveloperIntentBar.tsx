import { useState, useMemo } from 'react';
import { Icon } from '@/shared/components/ui/Icon';
import { Button } from '@/shared/components/ui/button';
import { DEV_COMMANDS } from '../../data/devCommands';
import { DevCommand } from '../../domain/entities/DevCommand';

export type IntentType = 'ALL' | 'DO' | 'FIND' | 'LEARN' | 'FIX';

interface IntentResultItem {
  command: DevCommand;
  intent: IntentType;
  matchReason: string;
  score: number;
}

interface DeveloperIntentBarProps {
  onSelectCommand?: (cmd: DevCommand) => void;
  onOpenWorkflow?: (workflowId: string) => void;
  onOpenArticle?: (articleId: string) => void;
  onOpenTroubleshooting?: (query: string) => void;
}

const POPULAR_QUICK_INTENTS = [
  { label: '🏃 Run Docker Container', query: 'run docker container', intent: 'DO' },
  { label: '🌿 Undo Git Commit', query: 'undo last commit', intent: 'DO' },
  { label: '⚡ Create React App', query: 'create react vite app', intent: 'DO' },
  { label: '🚀 Deploy to AWS', query: 'deploy aws s3 caller identity', intent: 'DO' },
  { label: '🔍 Port 8080 Occupied', query: 'port 8080 occupied', intent: 'FIX' },
  { label: '🛠️ Linux Disk Full', query: 'linux disk full du', intent: 'FIX' },
];

export function DeveloperIntentBar({
  onSelectCommand,
  onOpenWorkflow,
  onOpenArticle,
  onOpenTroubleshooting,
}: DeveloperIntentBarProps) {
  const [query, setQuery] = useState('');
  const [activeIntent, setActiveIntent] = useState<IntentType>('ALL');

  // Compute Intent-Ranked Search Results
  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const results: IntentResultItem[] = [];

    DEV_COMMANDS.forEach((cmd) => {
      let score = 0;
      const reasons: string[] = [];

      // 1. Exact / Substring Command Match
      if (cmd.command.toLowerCase().includes(q)) {
        score += 10;
        reasons.push(`Exact command: "${cmd.command}"`);
      }

      // 2. Title Match
      if (cmd.title.toLowerCase().includes(q)) {
        score += 8;
        reasons.push(`Title match`);
      }

      // 3. UseCase Match
      const matchedUseCase = cmd.useCases.find((uc) => uc.toLowerCase().includes(q));
      if (matchedUseCase) {
        score += 7;
        reasons.push(`Use case: "${matchedUseCase}"`);
      }

      // 4. Tag Match
      const matchedTag = cmd.tags.find((t) => t.toLowerCase().includes(q));
      if (matchedTag) {
        score += 5;
        reasons.push(`Tag: #${matchedTag}`);
      }

      // 5. Intent Categorization
      let detectedIntent: IntentType = 'FIND';
      if (q.includes('undo') || q.includes('create') || q.includes('run') || q.includes('deploy') || q.includes('gộp')) {
        detectedIntent = 'DO';
      } else if (q.includes('error') || q.includes('occupied') || q.includes('full') || q.includes('kill') || q.includes('port')) {
        detectedIntent = 'FIX';
      } else if (q.includes('what') || q.includes('how') || q.includes('explain') || q.includes('architecture')) {
        detectedIntent = 'LEARN';
      }

      if (score > 0) {
        if (activeIntent === 'ALL' || activeIntent === detectedIntent) {
          results.push({
            command: cmd,
            intent: detectedIntent,
            matchReason: reasons.join(' • '),
            score,
          });
        }
      }
    });

    return results.sort((a, b) => b.score - a.score).slice(0, 5);
  }, [query, activeIntent]);

  return (
    <div className="p-5 rounded-2xl bg-card border border-border/80 space-y-4 shadow-sm select-none">
      {/* Intent Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Icon name="Search" className="w-5 h-5 text-primary" />
          <h2 className="text-base font-extrabold text-foreground tracking-tight">
            Developer Intent Bar
          </h2>
        </div>
        <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded border border-border/60">
          Press Ctrl + K
        </span>
      </div>

      {/* Main Search Input */}
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="What are you trying to do? (e.g., 'undo last commit', 'port 8080 occupied', 'run nginx')..."
          className="w-full h-12 pl-11 pr-4 rounded-xl bg-background border border-primary/40 focus:border-primary focus:ring-2 focus:ring-primary/20 text-sm font-sans text-foreground placeholder:text-muted-foreground outline-none transition-all"
        />
        <Icon
          name="Compass"
          className="w-5 h-5 text-primary absolute left-3.5 top-3.5 pointer-events-none"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            className="absolute right-3 top-3.5 text-xs text-muted-foreground hover:text-foreground font-mono cursor-pointer"
          >
            ✕ Clear
          </button>
        )}
      </div>

      {/* Intent Filter Chips */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <div className="flex items-center space-x-1.5 overflow-x-auto">
          <span className="text-[11px] font-mono text-muted-foreground mr-1">Intent Filter:</span>
          {(['ALL', 'DO', 'FIND', 'LEARN', 'FIX'] as IntentType[]).map((type) => {
            const isSelected = activeIntent === type;
            let badgeClass = 'bg-card border-border/60 text-muted-foreground hover:text-foreground';
            if (isSelected) {
              if (type === 'DO') badgeClass = 'bg-emerald-500 text-emerald-950 font-bold border-emerald-500';
              else if (type === 'FIND') badgeClass = 'bg-blue-500 text-blue-950 font-bold border-blue-500';
              else if (type === 'LEARN') badgeClass = 'bg-purple-500 text-purple-950 font-bold border-purple-500';
              else if (type === 'FIX') badgeClass = 'bg-amber-500 text-amber-950 font-bold border-amber-500';
              else badgeClass = 'bg-primary text-primary-foreground font-bold border-primary';
            }

            return (
              <button
                key={type}
                type="button"
                onClick={() => setActiveIntent(type)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono border transition-all cursor-pointer ${badgeClass}`}
              >
                {type === 'DO' && '⚡ '}
                {type === 'FIND' && '🔍 '}
                {type === 'LEARN' && '📖 '}
                {type === 'FIX' && '🛠️ '}
                {type}
              </button>
            );
          })}
        </div>
      </div>

      {/* Quick Task Chips */}
      {!query && (
        <div className="space-y-2 pt-1">
          <div className="text-[11px] font-mono text-muted-foreground uppercase font-bold">
            Popular Quick Developer Intents:
          </div>
          <div className="flex flex-wrap gap-1.5">
            {POPULAR_QUICK_INTENTS.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setQuery(item.query);
                  setActiveIntent(item.intent as IntentType);
                }}
                className="px-2.5 py-1 rounded-lg bg-background border border-border/60 hover:border-primary/50 text-xs font-sans text-foreground/90 transition-colors cursor-pointer"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Ranked Intent Results */}
      {query && searchResults.length > 0 && (
        <div className="space-y-3 pt-2 animate-in fade-in duration-150">
          <div className="text-xs font-mono text-muted-foreground flex items-center justify-between">
            <span>Found {searchResults.length} intent-routed results</span>
            <span>Sorted by relevance</span>
          </div>

          <div className="space-y-2.5">
            {searchResults.map(({ command, intent: itemIntent, matchReason }) => (
              <div
                key={command.id}
                className="p-3.5 rounded-xl bg-background border border-border/80 space-y-2 hover:border-primary/40 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border uppercase ${
                        itemIntent === 'DO'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          : itemIntent === 'FIX'
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          : itemIntent === 'LEARN'
                          ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                          : 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                      }`}
                    >
                      {itemIntent}
                    </span>
                    <span className="text-xs font-bold text-foreground font-sans">
                      {command.title}
                    </span>
                  </div>

                  <span className="text-[10px] font-mono text-muted-foreground">
                    Match: {matchReason}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-lg bg-card border border-border/60 text-xs font-mono text-emerald-400">
                  <span className="truncate pr-2">$ {command.command}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigator.clipboard.writeText(command.command)}
                    className="h-6 px-2 text-[10px] font-mono text-emerald-400 hover:bg-emerald-500/10"
                  >
                    Copy
                  </Button>
                </div>

                <div className="flex items-center justify-between text-[11px] font-sans pt-0.5">
                  <p className="text-muted-foreground truncate max-w-md">
                    {command.description}
                  </p>

                  <div className="flex items-center space-x-2 shrink-0 font-mono">
                    {command.relatedArticleIds && command.relatedArticleIds[0] && (
                      <button
                        type="button"
                        onClick={() => onOpenArticle?.(command.relatedArticleIds![0])}
                        className="text-primary hover:underline cursor-pointer"
                      >
                        [ Learn Why ]
                      </button>
                    )}
                    {command.workflowId && onOpenWorkflow && (
                      <button
                        type="button"
                        onClick={() => onOpenWorkflow(command.workflowId!)}
                        className="text-amber-400 hover:underline cursor-pointer"
                      >
                        [ Try Workflow ]
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onSelectCommand?.(command)}
                      className="text-emerald-400 hover:underline cursor-pointer"
                    >
                      [ Details ]
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {query && searchResults.length === 0 && (
        <div className="p-4 rounded-xl bg-background border border-border/60 text-center text-xs text-muted-foreground space-y-2">
          <p>No direct commands matched "{query}".</p>
          {onOpenTroubleshooting && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenTroubleshooting(query)}
              className="text-xs font-mono text-amber-400 border-amber-400/40"
            >
              <Icon name="Wrench" className="w-3.5 h-3.5 mr-1.5" />
              Open Troubleshooting Assistant for "{query}"
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
