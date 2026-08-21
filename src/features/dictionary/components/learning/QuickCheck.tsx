import { useState } from 'react';
import { Icon } from '@/shared/components/ui/Icon';
import { Button } from '@/shared/components/ui/button';

interface OptionItem {
  id: string;
  label: string;
  isCorrect: boolean;
  explanation: string;
}

interface QuickCheckProps {
  question?: string;
  options?: OptionItem[];
}

export function QuickCheck({
  question = 'Which port flag maps host port 8080 to container port 80?',
  options = [
    {
      id: 'opt-1',
      label: '-p 80:8080',
      isCorrect: false,
      explanation: 'Incorrect. -p 80:8080 maps host port 80 to container port 8080 (reverse).',
    },
    {
      id: 'opt-2',
      label: '-p 8080:80',
      isCorrect: true,
      explanation: 'Correct! The format is always -p <HOST_PORT>:<CONTAINER_PORT>.',
    },
    {
      id: 'opt-3',
      label: '-v 8080:80',
      isCorrect: false,
      explanation: 'Incorrect. -v is used for Volume mounting, not Port mapping.',
    },
    {
      id: 'opt-4',
      label: '--expose 8080',
      isCorrect: false,
      explanation: 'Incorrect. --expose specifies internal container ports, but does not publish to host.',
    },
  ],
}: QuickCheckProps) {
  const [selectedOptId, setSelectedOptId] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const selectedOpt = options.find((o) => o.id === selectedOptId);

  const handleSubmit = () => {
    if (selectedOptId) {
      setIsSubmitted(true);
    }
  };

  const handleReset = () => {
    setSelectedOptId(null);
    setIsSubmitted(false);
  };

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border/80 space-y-4 shadow-xs select-none">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 text-xs font-mono font-bold text-primary uppercase">
          <Icon name="HelpCircle" className="w-4 h-4 text-primary" />
          <span>Quick Knowledge Check</span>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground">1 Question</span>
      </div>

      <div className="space-y-1">
        <h4 className="text-xs sm:text-sm font-bold text-foreground font-sans">{question}</h4>
      </div>

      {/* Options List */}
      <div className="space-y-2">
        {options.map((opt) => {
          const isSelected = selectedOptId === opt.id;
          let borderClass = 'border-border/60 bg-background/60 hover:border-primary/40';

          if (isSubmitted) {
            if (opt.isCorrect) {
              borderClass = 'border-emerald-500 bg-emerald-500/10 text-emerald-400 font-bold';
            } else if (isSelected && !opt.isCorrect) {
              borderClass = 'border-destructive bg-destructive/10 text-destructive font-bold';
            }
          } else if (isSelected) {
            borderClass = 'border-primary bg-primary/10 text-primary font-bold';
          }

          return (
            <button
              key={opt.id}
              type="button"
              disabled={isSubmitted}
              onClick={() => setSelectedOptId(opt.id)}
              className={`w-full p-3 rounded-xl border text-left text-xs transition-all flex items-center justify-between cursor-pointer ${borderClass}`}
            >
              <div className="flex items-center space-x-2 font-mono">
                <span className="w-4 h-4 rounded-full border border-current flex items-center justify-center text-[10px]">
                  {isSelected ? '●' : '○'}
                </span>
                <span>{opt.label}</span>
              </div>

              {isSubmitted && opt.isCorrect && (
                <span className="text-xs font-mono text-emerald-400 font-bold">✓ Correct</span>
              )}
              {isSubmitted && isSelected && !opt.isCorrect && (
                <span className="text-xs font-mono text-destructive font-bold">✕ Incorrect</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Answer Feedback & Controls */}
      {!isSubmitted ? (
        <Button
          variant="default"
          size="sm"
          disabled={!selectedOptId}
          onClick={handleSubmit}
          className="w-full h-8 text-xs font-mono bg-primary text-primary-foreground hover:bg-primary/90"
        >
          Check Answer
        </Button>
      ) : (
        <div className="space-y-2 animate-in fade-in duration-150">
          {selectedOpt && (
            <div
              className={`p-3 rounded-xl border text-xs font-sans space-y-1 ${
                selectedOpt.isCorrect
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-foreground'
                  : 'bg-destructive/10 border-destructive/40 text-foreground'
              }`}
            >
              <div className="font-bold flex items-center space-x-1.5">
                <Icon
                  name={selectedOpt.isCorrect ? 'CheckCircle' : 'AlertTriangle'}
                  className={`w-4 h-4 ${selectedOpt.isCorrect ? 'text-emerald-400' : 'text-destructive'}`}
                />
                <span>{selectedOpt.isCorrect ? 'Correct!' : 'Try Again'}</span>
              </div>
              <p className="text-muted-foreground text-[11px] leading-relaxed">
                {selectedOpt.explanation}
              </p>
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="w-full h-8 text-xs font-mono"
          >
            Reset Quiz
          </Button>
        </div>
      )}
    </div>
  );
}
