import { useState } from 'react';
import { Icon } from '@/shared/components/ui/Icon';

export interface CommonMistakeCardProps {
  problemTitle?: string;
  wrongCommand?: string;
  wrongBehavior?: string;
  correctCommand?: string;
  correctBehavior?: string;
  whyExplanation?: string;
}

export function CommonMistakeCard({
  problemTitle = 'Forgetting the Detached Flag (-d)',
  wrongCommand = 'docker run nginx',
  wrongBehavior = 'Terminal session gets locked by Nginx stdout logs. Closing terminal terminates container.',
  correctCommand = 'docker run -d nginx',
  correctBehavior = 'Container runs in background daemon mode. Terminal remains free for next commands.',
  whyExplanation = 'Without -d, Docker attached STDOUT/STDERR directly to your current terminal looper thread.',
}: CommonMistakeCardProps) {
  const [isSolutionShown, setIsSolutionShown] = useState(false);

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-destructive/5 border border-destructive/20 space-y-4 shadow-xs select-none">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 text-xs font-mono font-bold text-destructive uppercase">
          <Icon name="AlertTriangle" className="w-4 h-4 text-destructive" />
          <span>Common Developer Pitfall</span>
        </div>
        <button
          type="button"
          onClick={() => setIsSolutionShown(!isSolutionShown)}
          className="text-xs font-mono text-emerald-400 hover:underline flex items-center space-x-1 cursor-pointer"
        >
          <span>{isSolutionShown ? 'Show Mistake' : 'Show Solution'}</span>
          <Icon name="ArrowRight" className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="space-y-1">
        <h4 className="text-xs sm:text-sm font-bold text-foreground font-sans">⚠ {problemTitle}</h4>
        <p className="text-xs text-muted-foreground leading-relaxed">{whyExplanation}</p>
      </div>

      {/* Visual Mistake vs Solution Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
        {/* WRONG BEHAVIOR */}
        <div
          className={`p-3 rounded-xl border space-y-1.5 transition-all ${
            !isSolutionShown
              ? 'bg-destructive/10 border-destructive/40 text-foreground ring-1 ring-destructive/30'
              : 'bg-background/60 border-border/60 opacity-60'
          }`}
        >
          <div className="text-[10px] font-bold text-destructive uppercase flex items-center space-x-1">
            <Icon name="XCircle" className="w-3.5 h-3.5 text-destructive" />
            <span>Mistake Syntax</span>
          </div>
          <div className="text-destructive font-bold">$ {wrongCommand}</div>
          <p className="text-[11px] text-muted-foreground font-sans">{wrongBehavior}</p>
        </div>

        {/* CORRECT SOLUTION */}
        <div
          className={`p-3 rounded-xl border space-y-1.5 transition-all ${
            isSolutionShown
              ? 'bg-emerald-500/10 border-emerald-500/40 text-foreground ring-1 ring-emerald-500/30'
              : 'bg-background/60 border-border/60 opacity-60'
          }`}
        >
          <div className="text-[10px] font-bold text-emerald-400 uppercase flex items-center space-x-1">
            <Icon name="CheckCircle" className="w-3.5 h-3.5 text-emerald-400" />
            <span>Correct Solution</span>
          </div>
          <div className="text-emerald-400 font-bold">$ {correctCommand}</div>
          <p className="text-[11px] text-muted-foreground font-sans">{correctBehavior}</p>
        </div>
      </div>
    </div>
  );
}
