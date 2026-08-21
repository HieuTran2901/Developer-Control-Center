import { Icon } from '@/shared/components/ui/Icon';
import { useDeveloperContext } from '../../hooks/useDeveloperContext';
import { Button } from '@/shared/components/ui/button';

interface ContextRecommendationsProps {
  onOpenArticle?: (articleId: string) => void;
  onLaunchWorkflow?: (workflowId: string) => void;
}

export function ContextRecommendations({
  onOpenArticle,
  onLaunchWorkflow,
}: ContextRecommendationsProps) {
  const { recommendedNextStep, relatedWorkflow } = useDeveloperContext();

  return (
    <div className="p-4 rounded-2xl bg-card border border-primary/30 space-y-3 select-none">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 text-xs font-mono font-bold text-primary uppercase">
          <Icon name="Sparkles" className="w-4 h-4 text-primary" />
          <span>Intelligent Next Step Recommendation</span>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
          Context-Driven
        </span>
      </div>

      <div className="p-3.5 rounded-xl bg-background border border-border/70 space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold font-mono text-foreground">
            {recommendedNextStep.title}
          </h4>
          {recommendedNextStep.category && (
            <span className="text-[10px] font-mono text-primary font-bold px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20">
              {recommendedNextStep.category}
            </span>
          )}
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          {recommendedNextStep.reason}
        </p>

        <div className="flex items-center space-x-2 pt-1 font-mono text-xs">
          <Button
            size="sm"
            onClick={() => onOpenArticle?.(recommendedNextStep.targetId)}
            className="h-7 px-3 text-xs bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
          >
            <span>Start Next Step</span>
            <Icon name="ArrowRight" className="w-3.5 h-3.5 ml-1" />
          </Button>

          {relatedWorkflow && (
            <button
              type="button"
              onClick={() => onLaunchWorkflow?.(relatedWorkflow.id)}
              className="text-amber-400 hover:underline cursor-pointer text-xs font-mono pl-2"
            >
              [ Try Workflow: {relatedWorkflow.title} ]
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
