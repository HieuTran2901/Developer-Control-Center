import { useState, useEffect } from 'react';
import { Icon } from '@/shared/components/ui/Icon';
import { Drawer } from '@/shared/components/overlay/Drawer';
import { KnowledgeGraph } from './KnowledgeGraph';
import { TroubleshootingAssistant } from './TroubleshootingAssistant';
import { ProductionChecklist } from '../learning/ProductionChecklist';
import { CommandFinder } from '../CommandFinder';
import { DevCommand } from '../../domain/entities/DevCommand';

export type ContextualToolType = 'COMMANDS' | 'GRAPH' | 'FIX' | 'PRODUCTION' | null;

interface ContextualToolsDrawerProps {
  activeTool: ContextualToolType;
  onClose: () => void;
  onOpenArticle?: (articleId: string) => void;
  onSelectCommand?: (command: DevCommand) => void;
}

export function ContextualToolsDrawer({
  activeTool,
  onClose,
  onOpenArticle,
}: ContextualToolsDrawerProps) {
  const [currentTool, setCurrentTool] = useState<ContextualToolType>(activeTool);

  useEffect(() => {
    setCurrentTool(activeTool);
  }, [activeTool]);

  const renderHeader = () => (
    <div className="flex flex-wrap items-center justify-between gap-3 w-full">
      <div className="flex items-center space-x-2">
        {currentTool === 'COMMANDS' && (
          <div className="flex items-center space-x-2 text-primary font-bold text-sm font-mono">
            <Icon name="Terminal" className="w-5 h-5" />
            <span>Command Finder 2.0</span>
          </div>
        )}
        {currentTool === 'GRAPH' && (
          <div className="flex items-center space-x-2 text-purple-400 font-bold text-sm font-mono">
            <Icon name="GitMerge" className="w-5 h-5" />
            <span>Knowledge Graph Visualizer</span>
          </div>
        )}
        {currentTool === 'FIX' && (
          <div className="flex items-center space-x-2 text-amber-400 font-bold text-sm font-mono">
            <Icon name="Wrench" className="w-5 h-5" />
            <span>Troubleshooting Assistant</span>
          </div>
        )}
        {currentTool === 'PRODUCTION' && (
          <div className="flex items-center space-x-2 text-emerald-400 font-bold text-sm font-mono">
            <Icon name="ShieldCheck" className="w-5 h-5" />
            <span>Production Readiness Checklist</span>
          </div>
        )}
      </div>

      {/* Tool Switcher */}
      <div className="flex items-center space-x-1 bg-background/80 p-1 rounded-xl border border-border/60 text-xs font-mono">
        <button
          type="button"
          onClick={() => setCurrentTool('COMMANDS')}
          className={`px-2 py-1 rounded-lg transition-all cursor-pointer ${
            currentTool === 'COMMANDS'
              ? 'bg-primary text-primary-foreground font-bold'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          title="Command Finder"
        >
          ⚡ Lệnh
        </button>
        <button
          type="button"
          onClick={() => setCurrentTool('GRAPH')}
          className={`px-2 py-1 rounded-lg transition-all cursor-pointer ${
            currentTool === 'GRAPH'
              ? 'bg-purple-500 text-purple-950 font-bold'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          title="Knowledge Graph"
        >
          🧠 Sơ đồ
        </button>
        <button
          type="button"
          onClick={() => setCurrentTool('FIX')}
          className={`px-2 py-1 rounded-lg transition-all cursor-pointer ${
            currentTool === 'FIX'
              ? 'bg-amber-500 text-amber-950 font-bold'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          title="Troubleshooting"
        >
          🚨 Sửa lỗi
        </button>
        <button
          type="button"
          onClick={() => setCurrentTool('PRODUCTION')}
          className={`px-2 py-1 rounded-lg transition-all cursor-pointer ${
            currentTool === 'PRODUCTION'
              ? 'bg-emerald-500 text-emerald-950 font-bold'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          title="Production Checklist"
        >
          🛡️ Deployment
        </button>
      </div>
    </div>
  );

  return (
    <Drawer
      isOpen={currentTool !== null}
      onClose={onClose}
      title={renderHeader()}
      widthClass="max-w-2xl"
      transparentBackdrop={true}
    >
      <div className="space-y-4 select-none">
        {currentTool === 'COMMANDS' && (
          <CommandFinder
            onOpenGuideArticle={(artId) => {
              onOpenArticle?.(artId);
              onClose();
            }}
            onClose={onClose}
          />
        )}

        {currentTool === 'GRAPH' && (
          <KnowledgeGraph
            onOpenArticle={(artId) => {
              onOpenArticle?.(artId);
              onClose();
            }}
          />
        )}

        {currentTool === 'FIX' && (
          <TroubleshootingAssistant onClose={onClose} />
        )}

        {currentTool === 'PRODUCTION' && <ProductionChecklist />}
      </div>
    </Drawer>
  );
}
