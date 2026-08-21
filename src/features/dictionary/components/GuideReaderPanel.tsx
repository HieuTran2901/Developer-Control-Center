import { useState } from 'react';
import { Icon } from '@/shared/components/ui/Icon';
import { GuideArticle } from '../domain/entities/GuideArticle';

interface GuideReaderPanelProps {
  article: GuideArticle | null;
  onClose: () => void;
  onToggleBookmark?: (articleId: string) => void;
  isBookmarked?: boolean;
}

export function GuideReaderPanel({
  article,
  onClose,
  onToggleBookmark,
  isBookmarked = false,
}: GuideReaderPanelProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  if (!article) {
    return (
      <div className="h-full min-h-[500px] p-6 rounded-2xl bg-surface border border-border/70 flex flex-col items-center justify-center text-center space-y-3 text-muted-foreground select-none">
        <div className="w-12 h-12 rounded-2xl bg-muted/40 border border-border/60 flex items-center justify-center text-muted-foreground/60">
          <Icon name="BookOpen" className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-xs font-bold text-foreground">Select a guide to read</h3>
          <p className="text-[11px] text-muted-foreground max-w-xs">
            Choose any guide from the left list to inspect detailed architecture, steps, commands, and code snippets.
          </p>
        </div>
      </div>
    );
  }

  const handleCopyCode = (code: string, index: number) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'step_by_step':
        return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
      case 'concept':
        return 'bg-purple-500/15 text-purple-300 border-purple-500/30';
      case 'troubleshoot':
        return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
      case 'runbook':
        return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
      default:
        return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    }
  };

  return (
    <div className="h-full p-4 md:p-5 rounded-2xl bg-surface border border-border/70 shadow-xs space-y-4 max-h-[calc(100vh-140px)] overflow-y-auto scrollbar-thin">
      {/* Header & Controls */}
      <div className="space-y-2 border-b border-border/50 pb-3">
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider truncate">
            AWS & Cloud / {article.subcategoryId || article.categoryId}
          </div>

          <div className="flex items-center gap-1">
            {onToggleBookmark && (
              <button
                onClick={() => onToggleBookmark(article.id)}
                title="Bookmark article"
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-amber-400 transition-colors"
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

            <button
              onClick={onClose}
              title="Close reader panel"
              className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <Icon name="X" className="w-4 h-4" />
            </button>
          </div>
        </div>

        <h2 className="text-base font-bold text-foreground leading-snug">{article.title}</h2>

        {/* Badges */}
        <div className="flex items-center gap-2 flex-wrap text-[10px]">
          <span className={`px-2 py-0.5 rounded font-bold uppercase border ${getTypeBadge(article.type)}`}>
            {article.type.replace('_', '-')}
          </span>
          <span className="px-2 py-0.5 rounded bg-muted/60 text-muted-foreground font-semibold border border-border/50">
            {article.difficulty}
          </span>
          <span className="text-muted-foreground font-mono flex items-center gap-1">
            <Icon name="Clock" className="w-3 h-3" />
            {article.readingTimeMinutes} min read
          </span>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed pt-1">{article.summary}</p>
      </div>

      {/* Table of Contents ("ON THIS PAGE") */}
      <div className="p-3 rounded-xl bg-muted/30 border border-border/60 space-y-1.5">
        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <Icon name="List" className="w-3 h-3 text-primary" />
          <span>ON THIS PAGE</span>
        </div>

        <div className="space-y-1 text-xs">
          {article.architectureDiagram && (
            <a href="#reader-architecture" className="block text-muted-foreground hover:text-primary transition-colors truncate">
              1. Architecture
            </a>
          )}
          {article.prerequisites && (
            <a href="#reader-prerequisites" className="block text-muted-foreground hover:text-primary transition-colors truncate">
              2. Prerequisites
            </a>
          )}
          {article.steps && article.steps.length > 0 && (
            <a href="#reader-steps" className="block text-muted-foreground hover:text-primary transition-colors truncate">
              3. Execution Steps
            </a>
          )}
          {article.snippets && article.snippets.length > 0 && (
            <a href="#reader-code" className="block text-muted-foreground hover:text-primary transition-colors truncate">
              4. Commands & Code
            </a>
          )}
          {article.commonErrors && article.commonErrors.length > 0 && (
            <a href="#reader-troubleshooting" className="block text-muted-foreground hover:text-primary transition-colors truncate">
              5. Troubleshooting
            </a>
          )}
        </div>
      </div>

      {/* Reader Content Sections */}
      <div className="space-y-5 text-xs">
        {/* Architecture Section */}
        {article.architectureDiagram && (
          <div id="reader-architecture" className="space-y-2 pt-1 border-t border-border/40">
            <h3 className="text-xs font-bold text-foreground flex items-center gap-2">
              <span className="w-4 h-4 rounded-full bg-primary/20 text-primary text-[10px] flex items-center justify-center font-mono">
                1
              </span>
              <span>Architecture</span>
            </h3>
            <div className="p-3 rounded-xl bg-muted/50 border border-border/60 font-mono text-[10px] overflow-x-auto leading-normal text-muted-foreground">
              <pre>{article.architectureDiagram}</pre>
            </div>
          </div>
        )}

        {/* Prerequisites Section */}
        {article.prerequisites && article.prerequisites.length > 0 && (
          <div id="reader-prerequisites" className="space-y-2 pt-1 border-t border-border/40">
            <h3 className="text-xs font-bold text-foreground flex items-center gap-2">
              <span className="w-4 h-4 rounded-full bg-primary/20 text-primary text-[10px] flex items-center justify-center font-mono">
                2
              </span>
              <span>Prerequisites</span>
            </h3>
            <ul className="space-y-1.5 pl-1">
              {article.prerequisites.map((req, idx) => (
                <li key={idx} className="flex items-start gap-2 text-muted-foreground">
                  <span className="text-emerald-400 font-bold shrink-0">✓</span>
                  <span>{req}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Execution Steps */}
        {article.steps && article.steps.length > 0 && (
          <div id="reader-steps" className="space-y-3 pt-1 border-t border-border/40">
            <h3 className="text-xs font-bold text-foreground flex items-center gap-2">
              <span className="w-4 h-4 rounded-full bg-primary/20 text-primary text-[10px] flex items-center justify-center font-mono">
                3
              </span>
              <span>Execution Steps</span>
            </h3>

            <div className="space-y-2.5">
              {article.steps.map((step) => (
                <div key={step.stepNumber} className="p-3 rounded-xl bg-surface border border-border/60 space-y-1.5">
                  <div className="font-bold text-foreground flex items-center gap-2 text-xs">
                    <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-mono">
                      Step {step.stepNumber}
                    </span>
                    <span>{step.title}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{step.description}</p>
                  {step.command && (
                    <div className="p-2 rounded-lg bg-muted/60 border border-border/50 font-mono text-[10px] flex items-center justify-between">
                      <code className="text-foreground truncate">{step.command}</code>
                      <button
                        onClick={() => handleCopyCode(step.command!, step.stepNumber + 100)}
                        className="text-primary hover:underline shrink-0 ml-2"
                      >
                        {copiedIndex === step.stepNumber + 100 ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Code Snippets Section */}
        {article.snippets && article.snippets.length > 0 && (
          <div id="reader-code" className="space-y-3 pt-1 border-t border-border/40">
            <h3 className="text-xs font-bold text-foreground flex items-center gap-2">
              <span className="w-4 h-4 rounded-full bg-primary/20 text-primary text-[10px] flex items-center justify-center font-mono">
                4
              </span>
              <span>Commands & Code</span>
            </h3>

            <div className="space-y-2">
              {article.snippets.map((snip, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-muted/40 border border-border/60 space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                    <span>{snip.description || snip.language}</span>
                    <button
                      onClick={() => handleCopyCode(snip.code, idx)}
                      className="text-primary hover:underline flex items-center gap-1 font-sans"
                    >
                      <Icon name={copiedIndex === idx ? 'Check' : 'Copy'} className="w-3 h-3" />
                      {copiedIndex === idx ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <pre className="font-mono text-[11px] text-foreground overflow-x-auto whitespace-pre-wrap">
                    {snip.code}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Troubleshooting Section */}
        {article.commonErrors && article.commonErrors.length > 0 && (
          <div id="reader-troubleshooting" className="space-y-3 pt-1 border-t border-border/40">
            <h3 className="text-xs font-bold text-foreground flex items-center gap-2">
              <span className="w-4 h-4 rounded-full bg-rose-500/20 text-rose-400 text-[10px] flex items-center justify-center font-mono">
                5
              </span>
              <span>Troubleshooting Scenarios</span>
            </h3>

            <div className="space-y-2">
              {article.commonErrors.map((err, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/20 space-y-1.5">
                  <div className="font-bold text-rose-400 text-xs flex items-center gap-1.5">
                    <Icon name="AlertTriangle" className="w-3.5 h-3.5" />
                    <span>{err.errorCode}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground"><strong className="text-foreground">Cause:</strong> {err.cause}</p>
                  <p className="text-[11px] text-muted-foreground"><strong className="text-emerald-400">Solution:</strong> {err.solution}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
