import { useState } from 'react';
import { Icon } from '@/shared/components/ui/Icon';
import { GuideChapter, ChapterSection } from '../../domain/entities/GuideChapter';
import { Button } from '@/shared/components/ui/button';
import { VisualFlow, FlowNode } from './VisualFlow';
import { InteractiveDiagram } from './InteractiveDiagram';
import { BeforeAfterCard } from './BeforeAfterCard';
import { CommandBreakdown } from './CommandBreakdown';
import { CommonMistakeCard } from './CommonMistakeCard';
import { TerminalPlayground } from './TerminalPlayground';
import { QuickCheck } from './QuickCheck';
import { ConceptCard } from './ConceptCard';
import { KeyTakeaways } from './KeyTakeaways';
import { NextChapterCard } from './NextChapterCard';

interface LearningContentProps {
  chapter: GuideChapter;
  activeSectionId?: string;
  isSectionCompleted: (sectionId: string) => boolean;
  onToggleSectionCompleted: (sectionId: string) => void;
  onSelectSection: (sectionId: string) => void;
}

const DOCKER_FLOW_NODES: FlowNode[] = [
  {
    id: 'node-cli',
    label: 'Docker CLI',
    subtitle: 'Command Sent',
    icon: 'Terminal',
    description: 'Developer types "docker run -d -p 8080:80 nginx" into terminal.',
    relatedCommand: 'docker run -d -p 8080:80 nginx',
  },
  {
    id: 'node-daemon',
    label: 'Docker Engine',
    subtitle: 'Daemon Process',
    icon: 'Server',
    description: 'Background dockerd daemon receives API request over Unix socket.',
  },
  {
    id: 'node-image',
    label: 'Nginx Image',
    subtitle: 'Template Pulled',
    icon: 'Layers',
    description: 'Engine pulls nginx:latest read-only layers from Docker Hub registry.',
  },
  {
    id: 'node-container',
    label: 'Container Created',
    subtitle: 'Process Isolated',
    icon: 'Box',
    description: 'Engine creates thin OverlayFS writable layer and isolated PID namespace.',
  },
  {
    id: 'node-app',
    label: 'App Running',
    subtitle: 'Port 8080 ➔ 80',
    icon: 'Globe',
    description: 'Nginx web server is live at http://localhost:8080.',
  },
];

export function LearningContent({
  chapter,
  activeSectionId,
  isSectionCompleted,
  onToggleSectionCompleted,
  onSelectSection,
}: LearningContentProps) {
  const [copiedKeyMap, setCopiedKeyMap] = useState<Record<string, boolean>>({});

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKeyMap((prev) => ({ ...prev, [key]: true }));
    setTimeout(() => {
      setCopiedKeyMap((prev) => ({ ...prev, [key]: false }));
    }, 2000);
  };

  return (
    <div className="space-y-6 pb-12 max-w-3xl mx-auto font-sans leading-relaxed">
      {/* Chapter Title Banner */}
      <div className="space-y-2 border-b border-border/60 pb-5">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-primary bg-primary/10 px-2.5 py-0.5 rounded border border-primary/20">
            Chapter {chapter.chapterNumber}
          </span>
          <span className="text-xs font-mono text-muted-foreground">
            {chapter.subcategoryName}
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight leading-tight">
          {chapter.title}
        </h1>
        <p className="text-sm text-muted-foreground">{chapter.subtitle}</p>
      </div>

      {/* What You Will Learn Card */}
      <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border/80 space-y-3 shadow-xs">
        <div className="flex items-center space-x-2 text-xs font-mono font-bold text-primary uppercase">
          <Icon name="Info" className="w-4 h-4 text-primary" />
          <span>What you will learn in this chapter</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-foreground/90">
          {chapter.learningObjectives.map((obj, idx) => (
            <div key={idx} className="flex items-start space-x-2">
              <span className="text-primary font-bold">✓</span>
              <span>{obj}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 1. VISUAL FLOW COMPONENT */}
      <VisualFlow title="Container Lifecycle Execution Flow" nodes={DOCKER_FLOW_NODES} />

      {/* 2. INTERACTIVE DIAGRAM COMPONENT */}
      <InteractiveDiagram />

      {/* 3. BEFORE / AFTER TRANSFORMATION CARD */}
      <BeforeAfterCard />

      {/* Render Chapter Sections */}
      <div className="space-y-8">
        {chapter.sections.map((section: ChapterSection, sIdx: number) => {
          const isActive = activeSectionId === section.id;
          const isDone = isSectionCompleted(section.id);

          return (
            <div
              key={section.id}
              id={section.id}
              onClick={() => onSelectSection(section.id)}
              className={`space-y-4 p-4 sm:p-5 rounded-2xl border transition-all ${
                isActive
                  ? 'bg-card/90 border-primary/60 shadow-md ring-1 ring-primary/30'
                  : isDone
                  ? 'bg-card/40 border-emerald-500/30'
                  : 'bg-card/60 border-border/60 hover:border-border'
              }`}
            >
              {/* Section Header */}
              <div className="flex items-center justify-between gap-3 border-b border-border/40 pb-3">
                <h2 className="text-base sm:text-lg font-bold text-foreground tracking-tight">
                  {section.title}
                </h2>
                <Button
                  variant={isDone ? 'outline' : 'ghost'}
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleSectionCompleted(section.id);
                  }}
                  className={`h-7 px-2.5 text-xs font-mono ${
                    isDone
                      ? 'border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {isDone ? '✓ Completed' : '○ Mark Complete'}
                </Button>
              </div>

              {/* Main Section Content Text (Low Text Density) */}
              <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed">
                {section.content}
              </p>

              {/* Concept Card for 3.1 */}
              {sIdx === 0 && <ConceptCard />}

              {/* Why This Matters Callout */}
              {section.whyItMatters && (
                <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 space-y-1">
                  <div className="text-[11px] font-mono font-bold uppercase text-primary flex items-center space-x-1.5">
                    <Icon name="Zap" className="w-3.5 h-3.5 text-primary" />
                    <span>Why This Matters</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {section.whyItMatters}
                  </p>
                </div>
              )}

              {/* 4. COMMAND BREAKDOWN COMPONENT (Integrated in 3.2) */}
              {sIdx === 1 && <CommandBreakdown />}

              {/* Commands List */}
              {section.commands && section.commands.length > 0 && (
                <div className="space-y-3 pt-1">
                  {section.commands.map((cmd, idx) => {
                    const key = `${section.id}-cmd-${idx}`;
                    const isCopied = !!copiedKeyMap[key];

                    return (
                      <div key={key} className="space-y-2">
                        {cmd.description && (
                          <p className="text-xs text-muted-foreground font-mono">
                            {cmd.description}
                          </p>
                        )}

                        <div className="flex items-center justify-between p-3 rounded-xl bg-background border border-border/80 text-xs font-mono text-emerald-400 shadow-inner">
                          <div className="flex items-center space-x-2 truncate pr-2">
                            <span className="text-muted-foreground select-none">$</span>
                            <span className="truncate">{cmd.command}</span>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopy(cmd.command, key);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-muted/60 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0 flex items-center space-x-1 cursor-pointer font-mono"
                          >
                            <Icon name={isCopied ? 'Check' : 'Copy'} className="w-3.5 h-3.5" />
                            <span>{isCopied ? 'Copied' : 'Copy'}</span>
                          </button>
                        </div>

                        {/* Expected Result */}
                        {cmd.expectedResult && (
                          <div className="p-3 rounded-xl bg-muted/40 border border-border/50 text-xs space-y-1">
                            <span className="font-mono text-[10px] uppercase font-bold text-amber-400">
                              Expected Result
                            </span>
                            <p className="text-muted-foreground leading-relaxed">
                              {cmd.expectedResult}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 5. COMMON MISTAKES COMPONENT */}
              {sIdx === 1 && <CommonMistakeCard />}
            </div>
          );
        })}
      </div>

      {/* 6. TERMINAL PLAYGROUND SANDBOX */}
      <TerminalPlayground />

      {/* 7. QUICK KNOWLEDGE CHECK QUIZ */}
      <QuickCheck />

      {/* 8. KEY TAKEAWAYS & MEMORY SUMMARY */}
      <KeyTakeaways chapterTitle={chapter.title} />

      {/* 9. NEXT CHAPTER CARD */}
      <NextChapterCard />

      {/* Chapter Footer Navigation */}
      <div className="pt-6 border-t border-border/60 flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          disabled={!chapter.prevChapterId}
          className="h-9 px-4 text-xs font-mono"
        >
          <Icon name="ArrowLeft" className="w-3.5 h-3.5 mr-2" />
          Previous Chapter
        </Button>

        <span className="text-xs font-mono text-muted-foreground">
          {chapter.chapterNumber} / {chapter.totalChapters}
        </span>

        <Button
          variant="default"
          size="sm"
          disabled={!chapter.nextChapterId}
          className="h-9 px-4 text-xs font-mono bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <span>Next Chapter</span>
          <Icon name="ArrowRight" className="w-3.5 h-3.5 ml-2" />
        </Button>
      </div>
    </div>
  );
}
