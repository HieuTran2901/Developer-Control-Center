import { Icon } from '@/shared/components/ui/Icon';

export type LearningLevel = 'BEGINNER' | 'ENGINEER' | 'DEEP_DIVE';
export type LearningModeView = 'LEARN' | 'PRACTICE' | 'PRODUCTION';

interface LearningModeControlsProps {
  level: LearningLevel;
  onLevelChange: (level: LearningLevel) => void;
  viewMode: LearningModeView;
  onViewModeChange: (mode: LearningModeView) => void;
}

export function LearningModeControls({
  level,
  onLevelChange,
  viewMode,
  onViewModeChange,
}: LearningModeControlsProps) {
  return (
    <div className="p-3 rounded-2xl bg-card border border-border/80 flex flex-wrap items-center justify-between gap-3 shadow-xs select-none">
      {/* Level Selector (Explain Like I'm New) */}
      <div className="flex items-center space-x-1.5">
        <span className="text-[11px] font-mono text-muted-foreground mr-1 flex items-center space-x-1">
          <Icon name="Sliders" className="w-3.5 h-3.5 text-primary" />
          <span>Difficulty Level:</span>
        </span>

        {(['BEGINNER', 'ENGINEER', 'DEEP_DIVE'] as LearningLevel[]).map((lvl) => {
          const isSelected = level === lvl;

          return (
            <button
              key={lvl}
              type="button"
              onClick={() => onLevelChange(lvl)}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono border transition-all cursor-pointer ${
                isSelected
                  ? 'bg-primary text-primary-foreground font-bold border-primary shadow-xs'
                  : 'bg-background/60 border-border/60 text-muted-foreground hover:text-foreground'
              }`}
            >
              {lvl === 'BEGINNER' && '🌱 Beginner'}
              {lvl === 'ENGINEER' && '⚡ Engineer'}
              {lvl === 'DEEP_DIVE' && '🔬 Deep Dive'}
            </button>
          );
        })}
      </div>

      {/* View Mode Selector (Learn vs Practice vs Production Checklist) */}
      <div className="flex items-center space-x-1.5">
        <span className="text-[11px] font-mono text-muted-foreground mr-1 flex items-center space-x-1">
          <Icon name="Layers" className="w-3.5 h-3.5 text-emerald-400" />
          <span>Mode:</span>
        </span>

        {(['LEARN', 'PRACTICE', 'PRODUCTION'] as LearningModeView[]).map((mode) => {
          const isSelected = viewMode === mode;
          let badgeClass = 'bg-background/60 border-border/60 text-muted-foreground hover:text-foreground';
          if (isSelected) {
            if (mode === 'LEARN') badgeClass = 'bg-primary text-primary-foreground font-bold border-primary';
            else if (mode === 'PRACTICE') badgeClass = 'bg-emerald-500 text-emerald-950 font-bold border-emerald-500';
            else if (mode === 'PRODUCTION') badgeClass = 'bg-amber-500 text-amber-950 font-bold border-amber-500';
          }

          return (
            <button
              key={mode}
              type="button"
              onClick={() => onViewModeChange(mode)}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono border transition-all cursor-pointer ${badgeClass}`}
            >
              {mode === 'LEARN' && '📖 Learn'}
              {mode === 'PRACTICE' && '💻 Practice'}
              {mode === 'PRODUCTION' && '🛡️ Production Checklist'}
            </button>
          );
        })}
      </div>
    </div>
  );
}
