import { useState } from 'react';
import { Icon } from '@/shared/components/ui/Icon';
import { GuideChapter, ChapterSection } from '../../domain/entities/GuideChapter';
import { Button } from '@/shared/components/ui/button';

interface LearningContextPanelProps {
  chapter: GuideChapter;
  activeSectionId?: string;
  onSelectSection: (sectionId: string) => void;
  isSectionCompleted: (sectionId: string) => boolean;
  onToggleSectionCompleted: (sectionId: string) => void;
}

export function LearningContextPanel({
  chapter,
  activeSectionId,
  onSelectSection,
  isSectionCompleted,
  onToggleSectionCompleted,
}: LearningContextPanelProps) {
  const [verifiedMap, setVerifiedMap] = useState<Record<string, boolean>>({});
  const [copiedCmd, setCopiedCmd] = useState(false);

  const currentSection: ChapterSection =
    chapter.sections.find((s) => s.id === activeSectionId) || chapter.sections[0];

  const currentCommand = currentSection.commands?.[0];
  const isCurrentDone = isSectionCompleted(currentSection.id);
  const isVerified = !!verifiedMap[currentSection.id];

  const handleCopyCmd = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  return (
    <div className="space-y-5 sticky top-20 text-xs font-sans select-none">
      {/* 1. ON THIS PAGE Table of Contents */}
      <div className="p-4 rounded-2xl bg-card border border-border/80 space-y-2.5 shadow-xs">
        <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-muted-foreground flex items-center space-x-1.5">
          <Icon name="List" className="w-3.5 h-3.5 text-primary" />
          <span>On This Page</span>
        </div>
        <div className="space-y-1">
          {chapter.sections.map((sec) => {
            const isSelected = sec.id === activeSectionId;
            const isDone = isSectionCompleted(sec.id);

            return (
              <button
                key={sec.id}
                onClick={() => onSelectSection(sec.id)}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-all flex items-center justify-between cursor-pointer ${
                  isSelected
                    ? 'bg-primary/10 text-primary font-semibold border-l-2 border-primary'
                    : isDone
                    ? 'text-emerald-400 hover:bg-muted/50'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                }`}
              >
                <span className="truncate">{sec.title}</span>
                {isDone && <span className="text-[10px] font-mono text-emerald-400">✓</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. CURRENT STEP Interactive Card */}
      <div className="p-4 rounded-2xl bg-card border border-primary/40 space-y-3 shadow-sm ring-1 ring-primary/20">
        <div className="flex items-center justify-between text-[11px] font-mono">
          <span className="font-bold text-primary uppercase">
            STEP {chapter.sections.findIndex((s) => s.id === currentSection.id) + 1} OF{' '}
            {chapter.sections.length}
          </span>
          {isCurrentDone && (
            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
              Completed ✓
            </span>
          )}
        </div>

        <h3 className="font-bold text-sm text-foreground tracking-tight">
          {currentSection.title}
        </h3>

        {/* Step Breakdown List matching reference design */}
        <div className="space-y-2.5 pt-1">
          {/* 1. Why */}
          <div className="p-2.5 rounded-xl bg-background border border-border/60 space-y-1">
            <span className="font-mono text-[10px] uppercase font-bold text-primary flex items-center space-x-1">
              <span>① Why?</span>
            </span>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {currentSection.whyItMatters || currentSection.content.slice(0, 100) + '...'}
            </p>
          </div>

          {/* 2. Command */}
          {currentCommand && (
            <div className="p-2.5 rounded-xl bg-background border border-border/60 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase font-bold text-emerald-400">
                  ② Command
                </span>
                <button
                  onClick={() => handleCopyCmd(currentCommand.command)}
                  className="text-[10px] font-mono text-muted-foreground hover:text-foreground flex items-center space-x-1 cursor-pointer"
                >
                  <Icon name={copiedCmd ? 'Check' : 'Copy'} className="w-3 h-3" />
                  <span>{copiedCmd ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <div className="p-2 rounded bg-card text-[11px] font-mono text-emerald-400 overflow-x-auto">
                $ {currentCommand.command}
              </div>
            </div>
          )}

          {/* 3. Expected Result */}
          {currentCommand?.expectedResult && (
            <div className="p-2 rounded-xl bg-amber-500/5 border border-amber-500/20 text-[11px] space-y-0.5">
              <span className="font-mono text-[10px] uppercase font-bold text-amber-400">
                ③ Expected Result
              </span>
              <p className="text-muted-foreground">{currentCommand.expectedResult}</p>
            </div>
          )}

          {/* 4. Verify */}
          {currentCommand?.verificationCommand && (
            <div className="p-2.5 rounded-xl bg-background border border-border/60 space-y-1.5">
              <span className="font-mono text-[10px] uppercase font-bold text-primary">
                ④ Verify
              </span>
              <div className="p-2 rounded bg-card text-[11px] font-mono text-foreground truncate">
                $ {currentCommand.verificationCommand}
              </div>
              <label className="flex items-center space-x-2 pt-1 text-[11px] text-muted-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isVerified}
                  onChange={(e) =>
                    setVerifiedMap((prev) => ({
                      ...prev,
                      [currentSection.id]: e.target.checked,
                    }))
                  }
                  className="rounded border-border text-primary focus:ring-primary/50"
                />
                <span>{currentCommand.verificationCheck || 'I verified the output'}</span>
              </label>
            </div>
          )}

          {/* 5. Common Mistakes */}
          {currentSection.commonMistakes && currentSection.commonMistakes.length > 0 && (
            <div className="p-2 rounded-xl bg-destructive/5 border border-destructive/20 text-[11px] space-y-1">
              <span className="font-mono text-[10px] uppercase font-bold text-destructive">
                ⑤ Common Mistakes
              </span>
              <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                {currentSection.commonMistakes.map((m, idx) => (
                  <li key={idx} className="truncate">
                    {m.problem}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Mark Step Complete Button */}
        <Button
          variant={isCurrentDone ? 'outline' : 'default'}
          size="sm"
          onClick={() => onToggleSectionCompleted(currentSection.id)}
          className={`w-full h-8 text-xs font-mono mt-2 ${
            isCurrentDone
              ? 'border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10'
              : 'bg-primary text-primary-foreground hover:bg-primary/90'
          }`}
        >
          {isCurrentDone ? '✓ Completed' : 'Mark Step Complete'}
        </Button>
      </div>

      {/* 3. INTERACTIVE Sandbox / Practice Panel */}
      <div className="p-4 rounded-2xl bg-card border border-border/80 space-y-2.5 shadow-xs">
        <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-muted-foreground flex items-center space-x-1.5">
          <Icon name="Terminal" className="w-3.5 h-3.5 text-primary" />
          <span>Interactive Practice</span>
        </div>

        <div className="space-y-2">
          <div className="p-2.5 rounded-xl bg-background border border-border/60 space-y-1">
            <div className="font-bold text-foreground text-[11px]">Try it yourself</div>
            <p className="text-[10px] text-muted-foreground">
              Copy command & practice directly in terminal window.
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-background border border-border/60 space-y-1 opacity-75">
            <div className="font-bold text-foreground text-[11px] flex items-center justify-between">
              <span>Playground</span>
              <span className="text-[9px] font-mono text-muted-foreground">Soon</span>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Test commands in an isolated web sandbox.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
