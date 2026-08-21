import { useState } from 'react';
import { GuideChapter } from '../../domain/entities/GuideChapter';
import { LearningHeader } from './LearningHeader';
import { LearningContent } from './LearningContent';
import { LearningContextPanel } from './LearningContextPanel';
import { LearningPathWidget } from './LearningPathWidget';
import { LearningModeControls, LearningLevel, LearningModeView } from './LearningModeControls';
import { ProductionChecklist } from './ProductionChecklist';
import { ContextualToolbar } from '../knowledge/ContextualToolbar';
import { ContextualToolsDrawer, ContextualToolType } from '../knowledge/ContextualToolsDrawer';

interface LearningWorkspaceProps {
  chapter: GuideChapter;
  isBookmarked: boolean;
  onToggleBookmark: () => void;
  isSectionCompleted: (chapterId: string, sectionId: string) => boolean;
  onToggleSectionCompleted: (chapterId: string, sectionId: string) => void;
  getChapterProgress: (chapterId: string, totalSections: number) => { percentage: number };
  onClose: () => void;
  onOpenArticle?: (articleId: string) => void;
}

export function LearningWorkspace({
  chapter,
  isBookmarked,
  onToggleBookmark,
  isSectionCompleted,
  onToggleSectionCompleted,
  getChapterProgress,
  onClose,
  onOpenArticle,
}: LearningWorkspaceProps) {
  const [activeSectionId, setActiveSectionId] = useState<string>(
    chapter.sections[0]?.id || 'sec-3-1'
  );
  const [level, setLevel] = useState<LearningLevel>('ENGINEER');
  const [viewMode, setViewMode] = useState<LearningModeView>('LEARN');
  const [isFocusMode, setIsFocusMode] = useState<boolean>(false);
  const [activeTool, setActiveTool] = useState<ContextualToolType>(null);

  const { percentage } = getChapterProgress(chapter.id, chapter.sections.length);

  const handleSelectSection = (sectionId: string) => {
    setActiveSectionId(sectionId);
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      {/* Sticky Header */}
      <LearningHeader
        chapter={chapter}
        progressPercentage={percentage}
        isBookmarked={isBookmarked}
        onToggleBookmark={onToggleBookmark}
        onClose={onClose}
        isFocusMode={isFocusMode}
        onToggleFocusMode={() => setIsFocusMode(!isFocusMode)}
      />

      {/* Contextual Toolbar & Difficulty Controls Bar (Only in non-Focus mode) */}
      {!isFocusMode && (
        <div className="px-2 sm:px-4 space-y-3">
          <LearningModeControls
            level={level}
            onLevelChange={setLevel}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
          />
          <ContextualToolbar
            activeTopicId={chapter.categoryName || 'docker'}
            onOpenTool={(tool) => setActiveTool(tool)}
          />
        </div>
      )}

      {/* RENDER BASED ON MODE & FOCUS MODE */}
      {viewMode === 'PRODUCTION' ? (
        <div className="px-2 sm:px-4 max-w-4xl mx-auto space-y-4">
          <ProductionChecklist />
        </div>
      ) : isFocusMode ? (
        /* FOCUS READING MODE: Distraction-free single centered column */
        <div className="max-w-3xl mx-auto px-4 py-2 space-y-6">
          <LearningContent
            chapter={chapter}
            activeSectionId={activeSectionId}
            isSectionCompleted={(secId) => isSectionCompleted(chapter.id, secId)}
            onToggleSectionCompleted={(secId) => onToggleSectionCompleted(chapter.id, secId)}
            onSelectSection={handleSelectSection}
          />
        </div>
      ) : (
        /* STANDARD 3-COLUMN WORKSPACE LAYOUT */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start px-2 sm:px-4">
          {/* COLUMN 1: Left Learning Path & Navigation Widget */}
          <div className="hidden lg:block lg:col-span-3 space-y-4">
            <LearningPathWidget />

            {/* Chapter Outline Navigation */}
            <div className="p-3 rounded-2xl bg-card border border-border/80 space-y-2 text-xs font-mono select-none">
              <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Chapter Navigation
              </div>
              <div className="space-y-1">
                {chapter.sections.map((sec) => {
                  const isDone = isSectionCompleted(chapter.id, sec.id);
                  const isSelected = sec.id === activeSectionId;

                  return (
                    <button
                      key={sec.id}
                      onClick={() => handleSelectSection(sec.id)}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg transition-all flex items-center justify-between cursor-pointer ${
                        isSelected
                          ? 'bg-primary text-primary-foreground font-semibold'
                          : isDone
                          ? 'text-emerald-400 hover:bg-muted/50'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                      }`}
                    >
                      <span className="truncate">{sec.title}</span>
                      <span>{isDone ? '✓' : '○'}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* COLUMN 2: Center Reading Area ("The Book") */}
          <div className="lg:col-span-6 space-y-4">
            <LearningContent
              chapter={chapter}
              activeSectionId={activeSectionId}
              isSectionCompleted={(secId) => isSectionCompleted(chapter.id, secId)}
              onToggleSectionCompleted={(secId) => onToggleSectionCompleted(chapter.id, secId)}
              onSelectSection={handleSelectSection}
            />
          </div>

          {/* COLUMN 3: Right Contextual Interactive Panel */}
          <div className="hidden lg:block lg:col-span-3 space-y-4">
            <LearningContextPanel
              chapter={chapter}
              activeSectionId={activeSectionId}
              isSectionCompleted={(secId) => isSectionCompleted(chapter.id, secId)}
              onToggleSectionCompleted={(secId) => onToggleSectionCompleted(chapter.id, secId)}
              onSelectSection={handleSelectSection}
            />
          </div>
        </div>
      )}

      {/* Contextual Tools Overlay Drawer */}
      <ContextualToolsDrawer
        activeTool={activeTool}
        onClose={() => setActiveTool(null)}
        onOpenArticle={onOpenArticle}
      />
    </div>
  );
}
