import { Icon } from '@/shared/components/ui/Icon';
import { GuideChapter } from '../../domain/entities/GuideChapter';
import { Button } from '@/shared/components/ui/button';

interface LearningHeaderProps {
  chapter: GuideChapter;
  progressPercentage: number;
  isBookmarked: boolean;
  onToggleBookmark: () => void;
  onClose: () => void;
  isFocusMode?: boolean;
  onToggleFocusMode?: () => void;
}

export function LearningHeader({
  chapter,
  progressPercentage,
  isBookmarked,
  onToggleBookmark,
  onClose,
  isFocusMode = false,
  onToggleFocusMode,
}: LearningHeaderProps) {
  return (
    <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md border-b border-border/80 p-3 sm:p-4 space-y-2 select-none shadow-xs">
      <div className="flex items-center justify-between gap-3">
        {/* Breadcrumb Path */}
        <div className="flex items-center space-x-1.5 text-xs font-mono text-muted-foreground truncate">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-6 px-1.5 text-xs font-mono text-muted-foreground hover:text-foreground"
          >
            <Icon name="ArrowLeft" className="w-3.5 h-3.5 mr-1" />
            Dev Guide
          </Button>
          <span>&gt;</span>
          <span className="truncate">{chapter.categoryName}</span>
          <span>&gt;</span>
          <span className="truncate">{chapter.subcategoryName}</span>
          <span>&gt;</span>
          <span className="text-primary font-semibold truncate">{chapter.title}</span>
        </div>

        {/* Action Controls & Focus Mode Toggle */}
        <div className="flex items-center space-x-2 shrink-0">
          {onToggleFocusMode && (
            <Button
              variant={isFocusMode ? 'default' : 'outline'}
              size="sm"
              onClick={onToggleFocusMode}
              className={`h-7 px-2.5 text-xs font-mono transition-all ${
                isFocusMode
                  ? 'bg-purple-600 hover:bg-purple-700 text-white font-bold border-purple-500 shadow-xs'
                  : 'border-border/60 text-muted-foreground hover:text-foreground'
              }`}
              title="Toggle Focus Reading Mode"
            >
              <Icon name="Eye" className="w-3.5 h-3.5 mr-1" />
              <span>{isFocusMode ? 'Focus Active' : 'Focus Mode'}</span>
            </Button>
          )}

          <span className="hidden sm:inline-flex text-[11px] font-mono text-muted-foreground bg-muted/60 px-2 py-0.5 rounded border border-border/40">
            Chapter {chapter.chapterNumber} of {chapter.totalChapters}
          </span>
          <div className="flex items-center space-x-1.5 bg-primary/10 px-2.5 py-0.5 rounded border border-primary/20">
            <span className="text-[11px] font-mono font-bold text-primary">
              {progressPercentage}%
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleBookmark}
            className={`h-7 w-7 p-0 rounded-lg ${
              isBookmarked ? 'text-amber-400 bg-amber-400/10' : 'text-muted-foreground hover:text-foreground'
            }`}
            title={isBookmarked ? 'Remove Bookmark' : 'Bookmark Chapter'}
          >
            <Icon name="Bookmark" className={`w-3.5 h-3.5 ${isBookmarked ? 'fill-current' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Thin Progress Bar */}
      <div className="w-full h-1 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-300 ease-out"
          style={{ width: `${progressPercentage}%` }}
        />
      </div>
    </div>
  );
}
