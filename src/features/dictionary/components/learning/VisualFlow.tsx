import { useState } from 'react';
import { Icon, IconName } from '@/shared/components/ui/Icon';

export interface FlowNode {
  id: string;
  label: string;
  subtitle: string;
  icon: IconName;
  description: string;
  relatedCommand?: string;
}

interface VisualFlowProps {
  title?: string;
  nodes: FlowNode[];
}

export function VisualFlow({ title = 'Technical Execution Flow', nodes }: VisualFlowProps) {
  const [activeNodeId, setActiveNodeId] = useState<string>(nodes[0]?.id || '');

  const activeNode = nodes.find((n) => n.id === activeNodeId) || nodes[0];

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border/80 space-y-4 shadow-xs select-none">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 text-xs font-mono font-bold text-primary uppercase">
          <Icon name="GitMerge" className="w-4 h-4 text-primary" />
          <span>{title}</span>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground">Click node to inspect</span>
      </div>

      {/* Interactive Horizontal Flow Nodes */}
      <div className="flex flex-wrap items-center gap-2 overflow-x-auto pb-1">
        {nodes.map((node, index) => {
          const isActive = node.id === activeNodeId;
          const isLast = index === nodes.length - 1;

          return (
            <div key={node.id} className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setActiveNodeId(node.id)}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center space-x-2 shrink-0 ${
                  isActive
                    ? 'bg-primary text-primary-foreground border-primary shadow-xs ring-2 ring-primary/30'
                    : 'bg-background/80 border-border/60 hover:border-primary/40 hover:bg-background text-foreground'
                }`}
              >
                <div
                  className={`p-1 rounded-md ${
                    isActive ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-primary'
                  }`}
                >
                  <Icon name={node.icon} className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="text-xs font-bold leading-tight font-mono">{node.label}</div>
                  <div
                    className={`text-[10px] ${
                      isActive ? 'text-primary-foreground/80' : 'text-muted-foreground'
                    }`}
                  >
                    {node.subtitle}
                  </div>
                </div>
              </button>

              {!isLast && <Icon name="ArrowRight" className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />}
            </div>
          );
        })}
      </div>

      {/* Inspected Node Detail Box */}
      {activeNode && (
        <div className="p-3.5 rounded-xl bg-background border border-primary/30 space-y-1.5 animate-in fade-in duration-150">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="font-bold text-primary flex items-center space-x-1.5">
              <Icon name={activeNode.icon} className="w-3.5 h-3.5" />
              <span>{activeNode.label}</span>
            </span>
            <span className="text-[10px] text-muted-foreground font-mono">{activeNode.subtitle}</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{activeNode.description}</p>
          {activeNode.relatedCommand && (
            <div className="pt-1 flex items-center space-x-2">
              <span className="text-[10px] font-mono text-muted-foreground">Command:</span>
              <code className="text-[11px] font-mono text-emerald-400 bg-card px-2 py-0.5 rounded border border-border/60">
                $ {activeNode.relatedCommand}
              </code>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
