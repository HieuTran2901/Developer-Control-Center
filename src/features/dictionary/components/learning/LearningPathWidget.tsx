import { useState } from 'react';
import { Icon } from '@/shared/components/ui/Icon';
import { Modal } from '@/shared/components/overlay/Modal';
import { LEARNING_PATHS } from '../../data/learningPaths';

interface LearningPathWidgetProps {
  onSelectPath?: (pathId: string) => void;
}

export function LearningPathWidget({ onSelectPath }: LearningPathWidgetProps) {
  const [selectedPathId, setSelectedPathId] = useState<string>(LEARNING_PATHS[0].id);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const activePath = LEARNING_PATHS.find((p) => p.id === selectedPathId) || LEARNING_PATHS[0];
  const pct = Math.round((activePath.completedCount / activePath.totalCount) * 100);

  const renderTitle = (
    <div className="text-sm font-bold font-mono text-foreground flex items-center space-x-2">
      <Icon name="BookOpen" className="w-4 h-4 text-primary" />
      <span>Select Developer Learning Path</span>
    </div>
  );

  return (
    <>
      {/* Compact Status Bar Widget */}
      <div className="p-3 rounded-2xl bg-card border border-border/80 space-y-2 select-none">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1.5 text-xs font-mono font-bold text-primary">
            <Icon name="Compass" className="w-3.5 h-3.5" />
            <span className="truncate">Path: {activePath.title}</span>
          </div>

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="text-[10px] font-mono text-muted-foreground hover:text-primary underline cursor-pointer shrink-0"
          >
            Switch
          </button>
        </div>

        {/* Progress bar */}
        <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
          <span>{activePath.completedCount} / {activePath.totalCount} completed</span>
          <span className="text-primary font-bold">{pct}%</span>
        </div>
      </div>

      {/* Path Switcher Viewport-Level Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={renderTitle}
        maxWidthClass="max-w-md"
      >
        <div className="space-y-2 select-none">
          {LEARNING_PATHS.map((path) => {
            const pathPct = Math.round((path.completedCount / path.totalCount) * 100);
            const isSelected = path.id === selectedPathId;

            return (
              <div
                key={path.id}
                onClick={() => {
                  setSelectedPathId(path.id);
                  onSelectPath?.(path.id);
                  setIsModalOpen(false);
                }}
                className={`p-3 rounded-xl border transition-all cursor-pointer space-y-1.5 ${
                  isSelected
                    ? 'bg-primary/10 border-primary shadow-xs ring-1 ring-primary/30 text-foreground'
                    : 'bg-background/60 border-border/60 hover:border-primary/40 text-muted-foreground hover:text-foreground'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-bold font-mono">
                  <span>{path.title}</span>
                  <span className="text-primary">{pathPct}%</span>
                </div>

                <div className="w-full h-1 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${pathPct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Modal>
    </>
  );
}
