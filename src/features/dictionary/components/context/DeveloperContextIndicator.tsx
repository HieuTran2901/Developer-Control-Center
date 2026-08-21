import { Icon } from '@/shared/components/ui/Icon';
import { useDeveloperContext } from '../../hooks/useDeveloperContext';
import { ContextualToolType } from '../knowledge/ContextualToolsDrawer';

interface DeveloperContextIndicatorProps {
  onOpenTool: (tool: ContextualToolType) => void;
  onOpenArticle?: (articleId: string) => void;
}

export function DeveloperContextIndicator({
  onOpenTool,
  onOpenArticle,
}: DeveloperContextIndicatorProps) {
  const {
    context,
    relatedCommands,
    relatedArticles,
    recommendedNextStep,
    setIntent,
  } = useDeveloperContext();

  return (
    <div className="p-3 rounded-2xl bg-card border border-border/80 flex flex-wrap items-center justify-between gap-2.5 shadow-xs select-none">
      {/* Active Breadcrumb Context */}
      <div className="flex items-center space-x-2 text-xs font-mono text-muted-foreground truncate">
        <span
          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
            context.intent === 'DO'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : context.intent === 'FIX'
              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
              : context.intent === 'LEARN'
              ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
              : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
          }`}
        >
          {context.intent}
        </span>

        <span className="capitalize font-bold text-foreground">
          {context.categoryId || 'General'}
        </span>
        {context.subcategoryId && (
          <>
            <span>&gt;</span>
            <span className="capitalize">{context.subcategoryId}</span>
          </>
        )}
        {context.commandId && (
          <>
            <span>&gt;</span>
            <span className="text-primary font-semibold truncate">{context.commandId}</span>
          </>
        )}
      </div>

      {/* Contextual Action Counters & Recommendation Chip */}
      <div className="flex items-center space-x-1.5 overflow-x-auto text-xs font-mono">
        <button
          type="button"
          onClick={() => {
            setIntent('FIND');
            onOpenTool('COMMANDS');
          }}
          className="px-2.5 py-1 rounded-lg bg-background border border-border/60 hover:border-primary/50 text-muted-foreground hover:text-foreground transition-all flex items-center space-x-1 cursor-pointer"
        >
          <Icon name="Terminal" className="w-3.5 h-3.5 text-primary" />
          <span>Commands ({relatedCommands.length})</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setIntent('LEARN');
            onOpenTool('GRAPH');
          }}
          className="px-2.5 py-1 rounded-lg bg-background border border-border/60 hover:border-purple-500/50 text-muted-foreground hover:text-foreground transition-all flex items-center space-x-1 cursor-pointer"
        >
          <Icon name="GitMerge" className="w-3.5 h-3.5 text-purple-400" />
          <span>Concepts ({relatedArticles.length})</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setIntent('FIX');
            onOpenTool('FIX');
          }}
          className="px-2.5 py-1 rounded-lg bg-background border border-border/60 hover:border-amber-500/50 text-muted-foreground hover:text-foreground transition-all flex items-center space-x-1 cursor-pointer"
        >
          <Icon name="Wrench" className="w-3.5 h-3.5 text-amber-400" />
          <span>Issues</span>
        </button>

        {/* Intelligent Recommendation Chip */}
        {recommendedNextStep && (
          <button
            type="button"
            onClick={() => {
              if (recommendedNextStep.targetType === 'article') {
                onOpenArticle?.(recommendedNextStep.targetId);
              }
            }}
            className="px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 font-bold transition-all flex items-center space-x-1 cursor-pointer"
            title={recommendedNextStep.reason}
          >
            <Icon name="Sparkles" className="w-3.5 h-3.5 text-primary" />
            <span className="truncate max-w-[160px]">{recommendedNextStep.title}</span>
          </button>
        )}
      </div>
    </div>
  );
}
