import { Icon } from '@/shared/components/ui/Icon';
import { Button } from '@/shared/components/ui/button';

interface NextChapterCardProps {
  nextTitle?: string;
  nextDescription?: string;
  topics?: string[];
  onGoNext?: () => void;
}

export function NextChapterCard({
  nextTitle = '4. Docker Images & Layer Caching',
  nextDescription = 'Learn how Docker images, multi-stage builds, OverlayFS layer caching, and registries work.',
  topics = ['Image layer caching & hash verification', 'Multi-stage Dockerfiles for minimal production images', 'Docker Hub registry push & pull'],
  onGoNext,
}: NextChapterCardProps) {
  return (
    <div className="p-5 rounded-2xl bg-primary/10 border border-primary/40 space-y-4 shadow-sm select-none">
      <div className="flex items-center space-x-2">
        <span className="text-base font-bold text-primary">🎉 Chapter Complete</span>
        <span className="text-xs font-mono text-muted-foreground">You've mastered Docker Containers.</span>
      </div>

      <div className="space-y-1">
        <div className="text-[11px] font-mono font-bold uppercase text-primary">WHAT'S NEXT?</div>
        <h3 className="text-lg font-bold text-foreground">{nextTitle}</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">{nextDescription}</p>
      </div>

      <div className="space-y-1.5 pt-1">
        <div className="text-[10px] font-mono text-muted-foreground uppercase font-bold">You will learn:</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
          {topics.map((top, idx) => (
            <div key={idx} className="p-2 rounded-lg bg-background border border-border/60 text-[11px] text-foreground">
              → {top}
            </div>
          ))}
        </div>
      </div>

      <Button
        variant="default"
        size="sm"
        onClick={onGoNext}
        className="w-full h-9 text-xs font-mono bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs"
      >
        <span>Continue to Next Chapter ({nextTitle})</span>
        <Icon name="ArrowRight" className="w-3.5 h-3.5 ml-2" />
      </Button>
    </div>
  );
}
