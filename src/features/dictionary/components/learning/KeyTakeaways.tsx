import { useState } from 'react';
import { Icon } from '@/shared/components/ui/Icon';
import { Button } from '@/shared/components/ui/button';

interface KeyTakeawaysProps {
  takeaways?: string[];
  chapterTitle?: string;
  onBookmarkReview?: () => void;
}

export function KeyTakeaways({
  takeaways = [
    'Container = Isolated Linux process namespace sharing host OS kernel.',
    'Image = Read-only immutable template layered via OverlayFS.',
    'docker run = Executes docker create + docker start in a single command.',
    '-p flag = Maps host port (e.g. 8080) to container port (e.g. 80).',
    '-d flag = Runs container in background detached daemon mode.',
  ],
  chapterTitle = '3. Docker Containers',
  onBookmarkReview,
}: KeyTakeawaysProps) {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopySummary = () => {
    const text = `KEY TAKEAWAYS — ${chapterTitle}:\n` + takeaways.map((t) => `✓ ${t}`).join('\n');
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-card border border-emerald-500/30 space-y-3.5 shadow-xs select-none">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 text-xs font-mono font-bold text-emerald-400 uppercase">
          <Icon name="CheckCircle" className="w-4 h-4 text-emerald-400" />
          <span>Key Takeaways &amp; Memory Summary</span>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopySummary}
            className="h-7 px-2.5 text-xs font-mono text-emerald-400 hover:bg-emerald-500/10"
          >
            <Icon name={isCopied ? 'Check' : 'Copy'} className="w-3.5 h-3.5 mr-1" />
            <span>{isCopied ? 'Copied' : 'Copy Summary'}</span>
          </Button>

          {onBookmarkReview && (
            <Button
              variant="outline"
              size="sm"
              onClick={onBookmarkReview}
              className="h-7 px-2.5 text-xs font-mono border-amber-400/40 text-amber-400 hover:bg-amber-400/10"
            >
              <Icon name="Bookmark" className="w-3.5 h-3.5 mr-1" />
              <span>Review Later</span>
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-2 text-xs font-sans">
        {takeaways.map((item, idx) => (
          <div key={idx} className="flex items-start space-x-2 p-2 rounded-lg bg-background border border-border/50">
            <span className="text-emerald-400 font-bold font-mono">✓</span>
            <span className="text-foreground/90 leading-relaxed">{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
