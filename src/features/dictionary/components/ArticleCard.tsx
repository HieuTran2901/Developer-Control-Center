import { Icon } from '@/shared/components/ui/Icon';
import { GuideArticle } from '../domain/entities/GuideArticle';

interface ArticleCardProps {
  article: GuideArticle;
  onOpenDetail: (article: GuideArticle) => void;
  viewMode?: 'grid' | 'list';
  isSelected?: boolean;
  onToggleBookmark?: (e: React.MouseEvent, articleId: string) => void;
  isBookmarked?: boolean;
}

export function ArticleCard({
  article,
  onOpenDetail,
  viewMode = 'grid',
  isSelected = false,
  onToggleBookmark,
  isBookmarked = false,
}: ArticleCardProps) {
  const getDifficultyBadge = (diff: string) => {
    switch (diff) {
      case 'Beginner':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'Intermediate':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'Advanced':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      default:
        return 'bg-muted text-muted-foreground border-border';
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'step_by_step':
        return {
          label: 'STEP-BY-STEP',
          color: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
        };
      case 'concept':
        return {
          label: 'CONCEPT',
          color: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
        };
      case 'troubleshoot':
        return {
          label: 'TROUBLESHOOT',
          color: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
        };
      case 'runbook':
        return {
          label: 'RUNBOOK',
          color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
        };
      case 'cheatsheet':
      default:
        return {
          label: 'CHEATSHEET',
          color: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
        };
    }
  };

  const typeInfo = getTypeBadge(article.type);

  if (viewMode === 'list') {
    return (
      <div
        onClick={() => onOpenDetail(article)}
        className={`p-3.5 rounded-xl bg-surface border transition-all cursor-pointer group flex flex-col md:flex-row md:items-center justify-between gap-3 ${
          isSelected
            ? 'border-primary ring-1 ring-primary/40 bg-primary/5 shadow-sm'
            : 'border-border/70 hover:border-primary/50'
        }`}
      >
        <div className="space-y-1.5 flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`px-2 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase border ${typeInfo.color}`}
            >
              {typeInfo.label}
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[9px] font-semibold border ${getDifficultyBadge(
                article.difficulty
              )}`}
            >
              {article.difficulty}
            </span>
            <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-mono">
              <Icon name="Clock" className="w-3 h-3 text-muted-foreground" />
              {article.readingTimeMinutes} min read
            </span>
          </div>

          <h3 className="text-xs font-bold text-foreground group-hover:text-primary transition-colors truncate">
            {article.title}
          </h3>
          <p className="text-[11px] text-muted-foreground line-clamp-1">{article.summary}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onToggleBookmark && (
            <button
              onClick={(e) => onToggleBookmark(e, article.id)}
              className="p-1.5 rounded-lg hover:bg-muted/80 text-muted-foreground hover:text-amber-400 transition-colors"
            >
              <Icon
                name="Star"
                className={`w-4 h-4 ${
                  isBookmarked || article.isBookmarked
                    ? 'fill-amber-400 text-amber-400'
                    : 'text-muted-foreground/60'
                }`}
              />
            </button>
          )}
          <div className="w-7 h-7 rounded-lg bg-muted/40 border border-border/50 flex items-center justify-center text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-all">
            <Icon name="ChevronRight" className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={() => onOpenDetail(article)}
      className={`p-4 rounded-2xl bg-surface border transition-all cursor-pointer group flex flex-col justify-between space-y-3.5 hover:shadow-md ${
        isSelected
          ? 'border-primary ring-1 ring-primary/40 bg-primary/5 shadow-xs'
          : 'border-border/70 hover:border-primary/50'
      }`}
    >
      <div className="space-y-2.5">
        {/* Type Badge & Star Bookmark */}
        <div className="flex items-center justify-between gap-2">
          <span
            className={`px-2.5 py-0.5 rounded text-[9px] font-bold tracking-wider uppercase border ${typeInfo.color}`}
          >
            {typeInfo.label}
          </span>

          {onToggleBookmark && (
            <button
              onClick={(e) => onToggleBookmark(e, article.id)}
              aria-label="Bookmark article"
              className="p-1 rounded-md hover:bg-muted/60 transition-colors"
            >
              <Icon
                name="Star"
                className={`w-3.5 h-3.5 ${
                  isBookmarked || article.isBookmarked
                    ? 'fill-amber-400 text-amber-400'
                    : 'text-muted-foreground/40 hover:text-amber-400'
                }`}
              />
            </button>
          )}
        </div>

        {/* Title & Short Summary */}
        <div className="space-y-1">
          <h3 className="text-xs font-bold text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-snug">
            {article.title}
          </h3>
          <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
            {article.summary}
          </p>
        </div>

        {/* Technology Tags */}
        <div className="flex items-center gap-1.5 flex-wrap pt-1">
          {article.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 rounded bg-muted/60 text-muted-foreground text-[10px] font-mono font-medium border border-border/40"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Bottom Metadata: Difficulty & Reading Time */}
      <div className="pt-2.5 border-t border-border/40 flex items-center justify-between text-[10px]">
        <span
          className={`px-2 py-0.5 rounded font-semibold border ${getDifficultyBadge(
            article.difficulty
          )}`}
        >
          {article.difficulty}
        </span>

        <span className="flex items-center gap-1 text-muted-foreground font-mono">
          <Icon name="Clock" className="w-3 h-3" />
          {article.readingTimeMinutes} min
        </span>
      </div>
    </div>
  );
}
