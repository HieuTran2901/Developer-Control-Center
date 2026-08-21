import { useState } from 'react';
import { Icon } from '@/shared/components/ui/Icon';
import { Modal } from '@/shared/components/overlay/Modal';
import { GuideArticle } from '../domain/entities/GuideArticle';
import { StepByStepGuide } from './StepByStepGuide';

interface ArticleDetailModalProps {
  article: GuideArticle | null;
  onClose: () => void;
}

export function ArticleDetailModal({ article, onClose }: ArticleDetailModalProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  if (!article) return null;

  const handleCopySnippet = (code: string, index: number) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const renderHeader = (
    <div className="space-y-1.5 min-w-0 pr-4">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
          {article.type.toUpperCase()}
        </span>
        <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-semibold bg-muted text-muted-foreground border border-border">
          {article.difficulty}
        </span>
        <span className="text-[11px] text-muted-foreground font-mono flex items-center gap-1">
          <Icon name="Clock" className="w-3 h-3" />
          {article.readingTimeMinutes} mins read
        </span>
      </div>
      <h2 className="text-lg font-bold text-foreground tracking-tight">
        {article.title}
      </h2>
    </div>
  );

  return (
    <Modal
      isOpen={article !== null}
      onClose={onClose}
      title={renderHeader}
      maxWidthClass="max-w-4xl"
    >
      <div className="space-y-6 text-xs">
        {/* Summary Alert */}
        <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 text-muted-foreground leading-relaxed">
          <p className="font-medium text-foreground">{article.summary}</p>
        </div>

        {/* Architecture Diagram */}
        {article.architectureDiagram && (
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Icon name="Network" className="w-4 h-4 text-primary" />
              Core Architecture Flow
            </h3>
            <div className="p-4 rounded-xl bg-muted/80 border border-border/70 font-mono text-[11px] leading-relaxed overflow-x-auto text-foreground">
              <pre>{article.architectureDiagram}</pre>
            </div>
          </div>
        )}

        {/* Prerequisites */}
        {article.prerequisites && article.prerequisites.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Icon name="CheckSquare" className="w-4 h-4 text-primary" />
              Prerequisites (Điều kiện cần)
            </h3>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {article.prerequisites.map((req, idx) => (
                <li
                  key={idx}
                  className="p-2.5 rounded-lg bg-muted/40 border border-border/60 flex items-center gap-2 text-foreground"
                >
                  <Icon name="CheckCircle2" className="w-3.5 h-3.5 text-success shrink-0" />
                  <span>{req}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Step by Step View */}
        {article.steps && article.steps.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Icon name="ListOrdered" className="w-4 h-4 text-primary" />
              Interactive Workflow Guide (Từng bước chi tiết)
            </h3>
            <StepByStepGuide steps={article.steps} />
          </div>
        )}

        {/* Common Code Snippets */}
        {article.snippets && article.snippets.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Icon name="Code" className="w-4 h-4 text-primary" />
              Copy-Ready Snippets &amp; Runbooks
            </h3>
            <div className="space-y-3">
              {article.snippets.map((snippet, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl bg-background border border-border/70 space-y-2 font-mono text-[11px]"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground font-semibold">{snippet.description}</span>
                    <button
                      onClick={() => handleCopySnippet(snippet.code, idx)}
                      className="px-2 py-1 rounded bg-muted/60 hover:bg-muted border border-border/50 text-foreground transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <Icon name={copiedIndex === idx ? 'Check' : 'Copy'} className="w-3 h-3 text-primary" />
                      <span>{copiedIndex === idx ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <div className="p-2.5 rounded-lg bg-muted/80 text-emerald-400 overflow-x-auto">
                    <code>{snippet.code}</code>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* One Page Cheat Sheet */}
        {article.onePageCheatSheet && (
          <div className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Icon name="Zap" className="w-4 h-4 text-amber-400" />
              Dual Master Cheat Sheet (METHOD A: Web Console &amp; METHOD B: AWS CLI)
            </h3>
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 font-mono text-[11px] leading-relaxed text-amber-300">
              <pre className="whitespace-pre-wrap">{article.onePageCheatSheet}</pre>
            </div>
          </div>
        )}

        {/* Article Footer Tags */}
        <div className="pt-4 border-t border-border/40 flex items-center justify-between text-muted-foreground text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            {article.tags.map((tag) => (
              <span
                key={tag}
                className="px-2.5 py-0.5 rounded-md bg-muted/60 border border-border/50 font-mono text-[11px]"
              >
                #{tag}
              </span>
            ))}
          </div>

          <span>Updated: {article.updatedAt}</span>
        </div>
      </div>
    </Modal>
  );
}
