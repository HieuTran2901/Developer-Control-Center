import { useState } from 'react';
import { Icon } from '@/shared/components/ui/Icon';
import { Button } from '@/shared/components/ui/button';

interface BeforeAfterCardProps {
  beforeTitle?: string;
  beforeText?: string;
  afterTitle?: string;
  afterText?: string;
  transformationText?: string;
}

export function BeforeAfterCard({
  beforeTitle = 'BEFORE (Host System Dependent)',
  beforeText = 'No container. Application depends directly on host OS libraries, Python/Node versions, and manual system configurations.',
  afterTitle = 'AFTER (Isolated Container Runtime)',
  afterText = 'Container running. Application + exact runtime dependencies are fully packaged and isolated inside a container wrapper.',
  transformationText = 'Docker encapsulates runtime dependencies into an immutable container image.',
}: BeforeAfterCardProps) {
  const [isTransformed, setIsTransformed] = useState(false);

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border/80 space-y-4 shadow-xs select-none">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 text-xs font-mono font-bold text-primary uppercase">
          <Icon name="Zap" className="w-4 h-4 text-primary" />
          <span>System Transformation (Before vs After)</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsTransformed(!isTransformed)}
          className="h-7 px-2.5 text-xs font-mono text-primary border-primary/40 hover:bg-primary/10"
        >
          <Icon name="RefreshCw" className={`w-3.5 h-3.5 mr-1 ${isTransformed ? 'rotate-180 transition-transform' : ''}`} />
          <span>{isTransformed ? 'Show Before' : 'Show Transformation'}</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        {/* BEFORE CARD */}
        <div
          className={`p-3.5 rounded-xl border transition-all space-y-1.5 ${
            !isTransformed
              ? 'bg-amber-500/10 border-amber-500/40 text-foreground ring-1 ring-amber-500/20'
              : 'bg-background/60 border-border/60 opacity-60'
          }`}
        >
          <div className="text-[11px] font-mono font-bold uppercase text-amber-400 flex items-center space-x-1.5">
            <Icon name="AlertCircle" className="w-3.5 h-3.5 text-amber-400" />
            <span>{beforeTitle}</span>
          </div>
          <p className="text-muted-foreground text-[11px] leading-relaxed">{beforeText}</p>
        </div>

        {/* AFTER CARD */}
        <div
          className={`p-3.5 rounded-xl border transition-all space-y-1.5 ${
            isTransformed
              ? 'bg-emerald-500/10 border-emerald-500/40 text-foreground ring-1 ring-emerald-500/20'
              : 'bg-background/60 border-border/60 opacity-60'
          }`}
        >
          <div className="text-[11px] font-mono font-bold uppercase text-emerald-400 flex items-center space-x-1.5">
            <Icon name="CheckCircle" className="w-3.5 h-3.5 text-emerald-400" />
            <span>{afterTitle}</span>
          </div>
          <p className="text-muted-foreground text-[11px] leading-relaxed">{afterText}</p>
        </div>
      </div>

      {transformationText && (
        <div className="p-3 rounded-xl bg-background border border-border/60 text-[11px] font-mono text-muted-foreground flex items-center space-x-2">
          <Icon name="Info" className="w-3.5 h-3.5 text-primary shrink-0" />
          <span>{transformationText}</span>
        </div>
      )}
    </div>
  );
}
