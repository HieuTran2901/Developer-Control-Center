import { useState } from 'react';
import { Icon, IconName } from '@/shared/components/ui/Icon';
import { GuideWorkflow } from '../domain/entities/GuideWorkflow';
import { GuideArticle } from '../domain/entities/GuideArticle';
import { MOCK_ARTICLES } from '../data/mockDictionaryData';
import { Button } from '@/shared/components/ui/button';

interface WorkflowViewProps {
  workflow: GuideWorkflow;
  taskIcon?: IconName;
  isStepCompleted: (workflowId: string, stepId: string) => boolean;
  onToggleStep: (workflowId: string, stepId: string) => void;
  onResetProgress: (workflowId: string) => void;
  onOpenArticle: (article: GuideArticle) => void;
  onCloseWorkflow: () => void;
}

export function WorkflowView({
  workflow,
  taskIcon = 'Box',
  isStepCompleted,
  onToggleStep,
  onResetProgress,
  onOpenArticle,
  onCloseWorkflow,
}: WorkflowViewProps) {
  const [copiedCommandMap, setCopiedCommandMap] = useState<Record<string, boolean>>({});

  const totalSteps = workflow.steps.length;
  const completedCount = workflow.steps.filter((s) =>
    isStepCompleted(workflow.id, s.id)
  ).length;
  const percentage = totalSteps > 0 ? Math.round((completedCount / totalSteps) * 100) : 0;
  const isAllCompleted = totalSteps > 0 && completedCount === totalSteps;

  const handleCopyCommand = (cmd: string, key: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedCommandMap((prev) => ({ ...prev, [key]: true }));
    setTimeout(() => {
      setCopiedCommandMap((prev) => ({ ...prev, [key]: false }));
    }, 2000);
  };

  const handleOpenReferencedArticle = (articleId?: string) => {
    if (!articleId) return;
    const article = MOCK_ARTICLES.find((a) => a.id === articleId);
    if (article) {
      onOpenArticle(article);
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Workflow Header & Control Banner */}
      <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border/80 space-y-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onCloseWorkflow}
            className="text-xs font-mono text-muted-foreground hover:text-foreground h-8 px-2.5"
          >
            <Icon name="ArrowLeft" className="w-3.5 h-3.5 mr-1.5" />
            Back to Dev Guide
          </Button>

          <div className="flex items-center space-x-2">
            <span className="text-[11px] font-mono font-medium text-muted-foreground bg-muted/60 px-2 py-1 rounded border border-border/40">
              ⏱ ~{workflow.estimatedMinutes || 20} min
            </span>
            <span className="text-[11px] font-mono font-medium text-primary bg-primary/10 px-2 py-1 rounded border border-primary/20">
              {totalSteps} steps
            </span>
            {completedCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onResetProgress(workflow.id)}
                className="text-[11px] font-mono text-muted-foreground hover:text-destructive h-7 px-2"
              >
                <Icon name="RotateCcw" className="w-3 h-3 mr-1" />
                Reset Progress
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-start space-x-3.5">
          <div className="p-2.5 rounded-xl bg-primary text-primary-foreground shrink-0 mt-0.5">
            <Icon name={taskIcon} className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono uppercase font-bold tracking-wider text-primary">
                Guided Workflow
              </span>
            </div>
            <h1 className="text-lg font-bold text-foreground tracking-tight leading-snug">
              {workflow.title}
            </h1>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {workflow.description}
            </p>
          </div>
        </div>

        {/* Progress Bar Container */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-muted-foreground">Workflow Progress</span>
            <span className="font-semibold text-foreground">
              {completedCount} / {totalSteps} steps ({percentage}%)
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300 ease-out"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Completion Banner */}
      {isAllCompleted && (
        <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-3 shadow-xs">
          <div className="flex items-center space-x-2 text-emerald-400 font-bold text-sm font-mono">
            <Icon name="CheckCircle" className="w-5 h-5 text-emerald-400" />
            <span>🎉 Workflow Complete!</span>
          </div>
          <p className="text-xs text-foreground/90 leading-relaxed">
            Congratulations! You have completed all {totalSteps} steps in{' '}
            <strong className="text-emerald-400">{workflow.title}</strong>.
          </p>
          {workflow.outcomes && workflow.outcomes.length > 0 && (
            <div className="space-y-1 pt-1">
              <span className="text-[11px] font-mono font-semibold uppercase text-muted-foreground">
                You are now ready to:
              </span>
              <ul className="text-xs space-y-1 text-muted-foreground list-disc list-inside font-mono">
                {workflow.outcomes.map((outcome, idx) => (
                  <li key={idx} className="text-foreground/80">
                    {outcome}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="pt-2 flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onCloseWorkflow}
              className="h-8 text-xs font-mono border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
            >
              Return to Dev Guide
            </Button>
          </div>
        </div>
      )}

      {/* Steps Rows List */}
      <div className="space-y-3">
        {workflow.steps.map((step) => {
          const isDone = isStepCompleted(workflow.id, step.id);
          const referencedArticle = step.articleId
            ? MOCK_ARTICLES.find((a) => a.id === step.articleId)
            : null;

          return (
            <div
              key={step.id}
              className={`p-4 rounded-xl border transition-all space-y-3 ${
                isDone
                  ? 'bg-card/40 border-emerald-500/30'
                  : 'bg-card border-border/80 hover:border-primary/40'
              }`}
            >
              {/* Step Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start space-x-3">
                  <div
                    className={`w-7 h-7 rounded-lg text-xs font-mono font-bold flex items-center justify-center shrink-0 mt-0.5 ${
                      isDone
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        : 'bg-muted text-foreground border border-border'
                    }`}
                  >
                    {isDone ? '✓' : step.order}
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center space-x-2">
                      <h3
                        className={`text-xs font-bold tracking-tight ${
                          isDone ? 'line-through text-muted-foreground' : 'text-foreground'
                        }`}
                      >
                        {step.title}
                      </h3>
                      {step.optional && (
                        <span className="text-[10px] font-mono text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded">
                          Optional
                        </span>
                      )}
                    </div>
                    {step.description && (
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        {step.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Mark Complete Button */}
                <Button
                  variant={isDone ? 'outline' : 'default'}
                  size="sm"
                  onClick={() => onToggleStep(workflow.id, step.id)}
                  className={`h-7 px-2.5 text-[11px] font-mono shrink-0 ${
                    isDone
                      ? 'border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10'
                      : 'bg-primary text-primary-foreground hover:bg-primary/90'
                  }`}
                >
                  {isDone ? (
                    <>
                      <Icon name="Check" className="w-3 h-3 mr-1" />
                      Completed
                    </>
                  ) : (
                    'Mark Complete'
                  )}
                </Button>
              </div>

              {/* Commands List */}
              {step.commands && step.commands.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  {step.commands.map((cmd, idx) => {
                    const key = `${step.id}-${idx}`;
                    const isCopied = !!copiedCommandMap[key];

                    return (
                      <div
                        key={key}
                        className="flex items-center justify-between p-2 rounded-lg bg-background border border-border/60 text-xs font-mono text-emerald-400 group"
                      >
                        <div className="flex items-center space-x-2 overflow-x-auto truncate pr-2">
                          <span className="text-muted-foreground select-none">$</span>
                          <span className="truncate">{cmd}</span>
                        </div>
                        <button
                          onClick={() => handleCopyCommand(cmd, key)}
                          className="px-2 py-0.5 rounded bg-muted/60 text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0 flex items-center space-x-1 cursor-pointer"
                          title="Copy command"
                        >
                          <Icon name={isCopied ? 'Check' : 'Copy'} className="w-3 h-3" />
                          <span>{isCopied ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Verification Info */}
              {step.verification && (
                <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/20 text-[11px] space-y-1">
                  <span className="font-mono uppercase font-bold text-[10px] text-primary flex items-center space-x-1">
                    <Icon name="CheckCircle" className="w-3 h-3" />
                    <span>Verification</span>
                  </span>
                  <p className="text-muted-foreground leading-relaxed">{step.verification}</p>
                </div>
              )}

              {/* Referenced Guide Link Button */}
              {referencedArticle && (
                <div className="pt-1 flex items-center justify-between border-t border-border/40">
                  <div className="flex items-center space-x-2 text-[11px] text-muted-foreground">
                    <Icon name="BookOpen" className="w-3.5 h-3.5 text-primary" />
                    <span className="truncate max-w-[240px] sm:max-w-md">
                      Guide: {referencedArticle.title}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenReferencedArticle(step.articleId)}
                    className="h-6 px-2 text-[11px] font-mono text-primary hover:bg-primary/10"
                  >
                    Open Guide →
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
