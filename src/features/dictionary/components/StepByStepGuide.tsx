import { useState } from 'react';
import { Icon } from '@/shared/components/ui/Icon';
import { StepItem } from '../domain/entities/GuideArticle';

interface StepByStepGuideProps {
  steps: StepItem[];
}

export function StepByStepGuide({ steps }: StepByStepGuideProps) {
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [copiedStepIndex, setCopiedStepIndex] = useState<number | null>(null);

  const toggleStep = (stepNumber: number) => {
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepNumber)) {
        next.delete(stepNumber);
      } else {
        next.add(stepNumber);
      }
      return next;
    });
  };

  const handleCopy = (command: string, stepNumber: number) => {
    navigator.clipboard.writeText(command);
    setCopiedStepIndex(stepNumber);
    setTimeout(() => setCopiedStepIndex(null), 2000);
  };

  const progressPercent = Math.round((completedSteps.size / steps.length) * 100);

  return (
    <div className="space-y-4">
      {/* Progress Header */}
      <div className="p-3.5 rounded-xl bg-surface border border-border/70 shadow-xs flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Icon name="CheckCircle2" className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold text-foreground">
            Tiến độ thực hiện: {completedSteps.size} / {steps.length} bước
          </span>
        </div>

        <div className="flex items-center gap-3 w-1/3 min-w-[120px]">
          <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-xs font-mono font-bold text-primary shrink-0">
            {progressPercent}%
          </span>
        </div>
      </div>

      {/* Step List */}
      <div className="space-y-3">
        {steps.map((step) => {
          const isDone = completedSteps.has(step.stepNumber);

          return (
            <div
              key={step.stepNumber}
              className={`p-4 rounded-2xl border transition-all ${
                isDone
                  ? 'bg-success/5 border-success/30'
                  : 'bg-surface border-border/70 hover:border-primary/40'
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Step Checkbox */}
                <button
                  onClick={() => toggleStep(step.stepNumber)}
                  className={`w-6 h-6 rounded-lg border shrink-0 flex items-center justify-center transition-colors mt-0.5 ${
                    isDone
                      ? 'bg-success border-success text-success-foreground'
                      : 'bg-muted/40 border-border/80 hover:border-primary text-transparent'
                  }`}
                  title={isDone ? 'Đã hoàn thành' : 'Đánh dấu hoàn thành'}
                >
                  <Icon name="Check" className="w-3.5 h-3.5 stroke-[3]" />
                </button>

                {/* Step Body */}
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h4
                      className={`text-xs font-bold ${
                        isDone ? 'text-success line-through' : 'text-foreground'
                      }`}
                    >
                      Bước {step.stepNumber}: {step.title}
                    </h4>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>

                  {/* Step Command Box */}
                  {step.command && (
                    <div className="p-3 rounded-xl bg-muted/60 border border-border/70 font-mono text-xs space-y-1.5 relative group">
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground select-none">
                        <span>Terminal Command</span>
                        <button
                          onClick={() => handleCopy(step.command!, step.stepNumber)}
                          className="px-2 py-0.5 rounded bg-background border border-border/60 hover:text-primary transition-all flex items-center gap-1 font-sans"
                        >
                          <Icon
                            name={copiedStepIndex === step.stepNumber ? 'Check' : 'Copy'}
                            className="w-3 h-3 text-primary"
                          />
                          <span>{copiedStepIndex === step.stepNumber ? 'Copied!' : 'Copy'}</span>
                        </button>
                      </div>
                      <pre className="text-foreground overflow-x-auto select-all scrollbar-thin">
                        {step.command}
                      </pre>
                    </div>
                  )}

                  {/* Expected Output */}
                  {step.expectedOutput && (
                    <div className="text-[11px] text-muted-foreground flex items-start gap-1.5 bg-muted/20 p-2.5 rounded-lg border border-border/40 font-mono">
                      <Icon name="Info" className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                      <span>Expected Output: {step.expectedOutput}</span>
                    </div>
                  )}

                  {/* Tips */}
                  {step.tips && (
                    <div className="text-[11px] text-amber-400/90 flex items-start gap-1.5 bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20">
                      <Icon name="Lightbulb" className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                      <span>Mẹo: {step.tips}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
