import { useEffect, useRef } from 'react';
import { Icon } from '@/shared/components/ui/Icon';
import { ArticleType, DifficultyLevel } from '../domain/entities/GuideArticle';

interface DictionaryHeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedType: ArticleType | 'all';
  onTypeChange: (type: ArticleType | 'all') => void;
  selectedDifficulty: DifficultyLevel | 'all';
  onDifficultyChange: (difficulty: DifficultyLevel | 'all') => void;
  totalArticles: number;
  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;
  onToggleMobileSidebar?: () => void;
  isLearningMode?: boolean;
  onToggleLearningMode?: () => void;
  isCommandFinderMode?: boolean;
  onToggleCommandFinder?: () => void;
}

export function DictionaryHeader({
  searchQuery,
  onSearchChange,
  selectedType,
  onTypeChange,
  selectedDifficulty,
  onDifficultyChange,
  totalArticles,
  viewMode,
  onViewModeChange,
  onToggleMobileSidebar,
  isLearningMode = false,
  onToggleLearningMode,
  isCommandFinderMode = false,
  onToggleCommandFinder,
}: DictionaryHeaderProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Ctrl + K keyboard shortcut listener to focus search input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="space-y-4 p-4 md:p-5 rounded-2xl bg-surface border border-border/70 shadow-xs backdrop-blur-md">
      {/* Top Title & Stats Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {onToggleMobileSidebar && (
            <button
              onClick={onToggleMobileSidebar}
              className="lg:hidden p-2 rounded-xl bg-muted/60 border border-border/60 text-foreground hover:bg-muted transition-colors flex items-center gap-1.5 text-xs font-semibold"
              title="Toggle Knowledge Directory"
            >
              <Icon name="Menu" className="w-4 h-4 text-primary" />
              <span>Knowledge</span>
            </button>
          )}

          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
              <Icon name="BookOpen" className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                Dev Guide &amp; Knowledge Workspace
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-semibold font-mono">
                  {totalArticles} guides
                </span>
              </h1>
              <p className="text-xs text-muted-foreground hidden sm:block">
                Tra cứu kiến thức, quy trình từng bước, runbooks và từ điển lỗi lập trình.
              </p>
            </div>
          </div>
        </div>

        {/* Action Toggles */}
        <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
          {onToggleCommandFinder && (
            <button
              onClick={onToggleCommandFinder}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-semibold transition-all flex items-center gap-1.5 border cursor-pointer ${
                isCommandFinderMode
                  ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                  : 'bg-muted/40 hover:bg-muted text-foreground border-border/60'
              }`}
            >
              <Icon name="Terminal" className="w-4 h-4" />
              <span>{isCommandFinderMode ? '✓ Command Finder' : '⚡ Command Finder'}</span>
            </button>
          )}

          {onToggleLearningMode && (
            <button
              onClick={onToggleLearningMode}
              className={`px-3 py-1.5 rounded-xl text-xs font-mono font-semibold transition-all flex items-center gap-1.5 border cursor-pointer ${
                isLearningMode
                  ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                  : 'bg-muted/40 hover:bg-muted text-foreground border-border/60'
              }`}
            >
              <Icon name="BookOpen" className="w-4 h-4" />
              <span>{isLearningMode ? '✓ Learning Mode' : '📖 Learning Mode'}</span>
            </button>
          )}

          <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border/60">
            <button
              onClick={() => onViewModeChange('grid')}
              className={`p-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                viewMode === 'grid'
                  ? 'bg-surface text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="Grid View"
            >
              <Icon name="LayoutGrid" className="w-4 h-4" />
              <span className="hidden sm:inline">Grid</span>
            </button>
            <button
              onClick={() => onViewModeChange('list')}
              className={`p-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                viewMode === 'list'
                  ? 'bg-surface text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="List View"
            >
              <Icon name="List" className="w-4 h-4" />
              <span className="hidden sm:inline">List</span>
            </button>
          </div>
        </div>
      </div>

      {/* Global Search & Filter Controls */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-2 border-t border-border/40">
        {/* Global Search Bar */}
        <div className="relative md:col-span-6">
          <Icon
            name="Search"
            className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search guides, commands, errors (e.g. SSM, IAM AccessDenied, df -h)..."
            aria-label="Search guides, commands, errors"
            className="w-full h-10 pl-10 pr-14 text-xs bg-muted/30 border border-border/60 rounded-xl text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all font-sans"
          />
          {searchQuery ? (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
            >
              <Icon name="X" className="w-3.5 h-3.5" />
            </button>
          ) : (
            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground bg-muted/60 border border-border/60 rounded select-none">
              Ctrl K
            </kbd>
          )}
        </div>

        {/* Article Type Filter */}
        <div className="md:col-span-3">
          <select
            value={selectedType}
            onChange={(e) => onTypeChange(e.target.value as ArticleType | 'all')}
            className="w-full h-10 px-3 text-xs bg-muted/30 border border-border/60 rounded-xl text-foreground focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all font-sans cursor-pointer"
          >
            <option value="all">Tất cả loại bài (All Types)</option>
            <option value="step_by_step">📋 Step-by-Step</option>
            <option value="concept">💡 Concept (Khái niệm)</option>
            <option value="troubleshoot">🚨 Troubleshoot (Sửa lỗi)</option>
            <option value="runbook">🛠 Runbook (Quy trình)</option>
            <option value="cheatsheet">⚡ Cheatsheet (Cú pháp)</option>
          </select>
        </div>

        {/* Difficulty Filter */}
        <div className="md:col-span-3">
          <select
            value={selectedDifficulty}
            onChange={(e) => onDifficultyChange(e.target.value as DifficultyLevel | 'all')}
            className="w-full h-10 px-3 text-xs bg-muted/30 border border-border/60 rounded-xl text-foreground focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all font-sans cursor-pointer"
          >
            <option value="all">Tất cả trình độ (All Levels)</option>
            <option value="Beginner">🟢 Beginner (Cơ bản)</option>
            <option value="Intermediate">🟡 Intermediate (Trung cấp)</option>
            <option value="Advanced">🔴 Advanced (Nâng cao)</option>
          </select>
        </div>
      </div>
    </div>
  );
}
