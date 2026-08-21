import { useState, useMemo, useEffect } from 'react';
import { PageContainer } from '@/shared/components/layouts/PageContainer';
import { Icon } from '@/shared/components/ui/Icon';
import { MOCK_ARTICLES } from '../data/mockDictionaryData';
import { DEMO_DOCKER_CHAPTER, GUIDE_CHAPTERS } from '../data/guideChapters';
import { ArticleType, DifficultyLevel, GuideArticle } from '../domain/entities/GuideArticle';
import { ArticleDetailModal } from '../components/ArticleDetailModal';
import { LearningWorkspace } from '../components/learning/LearningWorkspace';
import { useLearningProgress } from '../hooks/useLearningProgress';
import { ContextualToolsDrawer, ContextualToolType } from '../components/knowledge/ContextualToolsDrawer';
import { DeveloperContextProvider } from '../hooks/useDeveloperContext';
import { DeveloperContextIndicator } from '../components/context/DeveloperContextIndicator';
import { useIsDesktop } from '@/shared/hooks/useMediaQuery';
import { DevGuideHome } from '../components/home/DevGuideHome';
import { CommandFinderWorkspace } from '../components/command/CommandFinderWorkspace';
import { TroubleshootingWorkspace } from '../components/troubleshooting/TroubleshootingWorkspace';
import { DeveloperIntentType } from '../domain/entities/DeveloperContext';

const RECENT_KEY = 'dcc_dictionary_recent_articles';
const BOOKMARKS_KEY = 'dcc_dictionary_bookmarks';

export type DevGuideViewMode = 'home' | 'do' | 'find' | 'learn' | 'fix';

export function DictionaryPage() {
  return (
    <DeveloperContextProvider>
      <DictionaryPageInner />
    </DeveloperContextProvider>
  );
}

function DictionaryPageInner() {
  const isDesktop = useIsDesktop();
  const [activeViewMode, setActiveViewMode] = useState<DevGuideViewMode>('home');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('aws');
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState<string | null>(null);
  const [activeContextualTool, setActiveContextualTool] = useState<ContextualToolType>(null);
  const [activeChapterId] = useState<string>('docker-containers-chapter');
  const [isFavoritesSelected, setIsFavoritesSelected] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedType] = useState<ArticleType | 'all'>('all');
  const [selectedDifficulty] = useState<DifficultyLevel | 'all'>('all');
  const [selectedArticle, setSelectedArticle] = useState<GuideArticle | null>(() => {
    return MOCK_ARTICLES.find((a) => a.id === 'how-to-connect-ai-agent-to-aws') || MOCK_ARTICLES[0] || null;
  });
  const [recentlyViewedGuides, setRecentlyViewedGuides] = useState<GuideArticle[]>([]);
  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(BOOKMARKS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // Fallback to default bookmarked articles in mock data
    }
    return MOCK_ARTICLES.filter((a) => a.isBookmarked).map((a) => a.id);
  });

  // Global Ctrl + K listener to switch to Command Finder workspace
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setActiveViewMode('find');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Learning progress hook
  const {
    isSectionCompleted,
    toggleSectionCompleted,
    getChapterProgress,
  } = useLearningProgress();

  const activeChapter = GUIDE_CHAPTERS[activeChapterId] || DEMO_DOCKER_CHAPTER;

  // Load recently viewed guides from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const validGuides = parsed.filter(
            (item) => item && typeof item.id === 'string' && typeof item.title === 'string'
          );
          setRecentlyViewedGuides(validGuides.slice(0, 3));
        }
      }
    } catch {
      setRecentlyViewedGuides([]);
    }
  }, []);

  // Handle article selection and update recent articles
  const handleOpenArticle = (article: GuideArticle) => {
    if (!article || !article.id) return;
    setSelectedArticle(article);

    setRecentlyViewedGuides((prev) => {
      const filtered = prev.filter((a) => a.id !== article.id);
      const updated = [article, ...filtered].slice(0, 3);
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
      } catch {
        // Ignore storage write errors
      }
      return updated;
    });
  };

  // Toggle bookmark on/off with localStorage persistence
  const handleToggleBookmark = (e?: React.MouseEvent | string, targetId?: string) => {
    if (e && typeof e !== 'string') {
      e.stopPropagation();
    }
    const articleId = typeof e === 'string' ? e : targetId;
    if (!articleId) return;

    setBookmarkedIds((prev) => {
      const isAlready = prev.includes(articleId);
      const updated = isAlready ? prev.filter((id) => id !== articleId) : [...prev, articleId];
      try {
        localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(updated));
      } catch {
        // Ignore storage write errors
      }
      return updated;
    });
  };

  // Compute counts dynamically from source data
  const getCategoryCount = (categoryId: string, subcategoryId?: string | null) => {
    if (categoryId === 'all') return MOCK_ARTICLES.length;

    if (subcategoryId) {
      return MOCK_ARTICLES.filter(
        (a) => a.categoryId === categoryId && a.subcategoryId === subcategoryId
      ).length;
    }

    return MOCK_ARTICLES.filter((a) => a.categoryId === categoryId).length;
  };

  const handleSelectCategory = (catId: string, subId?: string | null) => {
    setSelectedCategoryId(catId);
    setSelectedSubcategoryId(subId || null);
    setIsFavoritesSelected(false);
  };

  // Filter articles based on search & criteria
  const filteredArticles = useMemo(() => {
    return MOCK_ARTICLES.filter((article) => {
      const isArticleBookmarked = bookmarkedIds.includes(article.id);

      if (isFavoritesSelected && !isArticleBookmarked) {
        return false;
      }

      if (!isFavoritesSelected && selectedCategoryId !== 'all' && article.categoryId !== selectedCategoryId) {
        return false;
      }

      if (!isFavoritesSelected && selectedSubcategoryId && article.subcategoryId !== selectedSubcategoryId) {
        return false;
      }

      if (selectedType !== 'all' && article.type !== selectedType) {
        return false;
      }

      if (selectedDifficulty !== 'all' && article.difficulty !== selectedDifficulty) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = article.title.toLowerCase().includes(q);
        const matchesSummary = article.summary.toLowerCase().includes(q);
        const matchesTags = article.tags.some((t) => t.toLowerCase().includes(q));
        const matchesCategory = article.categoryId.toLowerCase().includes(q);
        return matchesTitle || matchesSummary || matchesTags || matchesCategory;
      }

      return true;
    });
  }, [
    selectedCategoryId,
    selectedSubcategoryId,
    isFavoritesSelected,
    searchQuery,
    selectedType,
    selectedDifficulty,
    bookmarkedIds,
  ]);

  const favoritedCount = useMemo(() => {
    return MOCK_ARTICLES.filter((a) => bookmarkedIds.includes(a.id)).length;
  }, [bookmarkedIds]);

  const handleIntentSelect = (intent: DeveloperIntentType) => {
    switch (intent) {
      case 'FIND':
        setActiveViewMode('find');
        break;
      case 'LEARN':
        setActiveViewMode('learn');
        break;
      case 'FIX':
        setActiveViewMode('fix');
        break;
      case 'DO':
      default:
        setActiveViewMode('home');
        break;
    }
  };

  return (
    <PageContainer>
      <div className="space-y-5">
        {/* Universal Top Context Indicator */}
        <DeveloperContextIndicator
          onOpenTool={(tool) => setActiveContextualTool(tool)}
        />

        {/* TOP WORKSPACE MODE NAVIGATION */}
        <div className="flex items-center justify-between p-3 rounded-2xl bg-surface border border-border/70 shadow-xs flex-wrap gap-3">
          {/* Main Title & Breadcrumb */}
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold">
              <Icon name="BookOpen" className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-foreground flex items-center space-x-1.5">
                <span>Dev Guide</span>
                <span className="text-muted-foreground">/</span>
                <span className="text-primary uppercase font-mono">{activeViewMode}</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Intelligent Developer Knowledge Workspace
              </p>
            </div>
          </div>

          {/* Mode Segmented Controls */}
          <div className="flex items-center space-x-1 bg-background p-1 rounded-xl border border-border/60 text-xs font-mono">
            <button
              type="button"
              onClick={() => setActiveViewMode('home')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center space-x-1.5 ${
                activeViewMode === 'home' || activeViewMode === 'do'
                  ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon name="Home" className="w-3.5 h-3.5" />
              <span>Workspace</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveViewMode('find')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center space-x-1.5 ${
                activeViewMode === 'find'
                  ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon name="Search" className="w-3.5 h-3.5" />
              <span>Command Finder</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveViewMode('learn')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center space-x-1.5 ${
                activeViewMode === 'learn'
                  ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon name="BookOpen" className="w-3.5 h-3.5" />
              <span>Learning Mode</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveViewMode('fix')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center space-x-1.5 ${
                activeViewMode === 'fix'
                  ? 'bg-amber-500 text-amber-950 font-bold shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon name="Wrench" className="w-3.5 h-3.5" />
              <span>Troubleshoot</span>
            </button>
          </div>
        </div>

        {/* WORKSPACE VIEW ROUTER */}
        {activeViewMode === 'find' && (
          <CommandFinderWorkspace
            onBackToHome={() => setActiveViewMode('home')}
            onOpenGuideArticle={(articleId) => {
              const art = MOCK_ARTICLES.find((a) => a.id === articleId);
              if (art) handleOpenArticle(art);
            }}
          />
        )}

        {activeViewMode === 'learn' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-border/50 pb-2">
              <button
                type="button"
                onClick={() => setActiveViewMode('home')}
                className="text-xs font-mono font-semibold text-muted-foreground hover:text-primary transition-colors cursor-pointer flex items-center space-x-1"
              >
                <Icon name="ArrowLeft" className="w-3.5 h-3.5" />
                <span>Back to Dev Guide</span>
              </button>
              <span className="text-xs font-mono text-muted-foreground">Learning Workspace Mode</span>
            </div>

            <LearningWorkspace
              chapter={activeChapter}
              isBookmarked={bookmarkedIds.includes(activeChapter.articleId)}
              onToggleBookmark={() => handleToggleBookmark(undefined, activeChapter.articleId)}
              isSectionCompleted={isSectionCompleted}
              onToggleSectionCompleted={toggleSectionCompleted}
              getChapterProgress={getChapterProgress}
              onClose={() => setActiveViewMode('home')}
            />
          </div>
        )}

        {activeViewMode === 'fix' && (
          <TroubleshootingWorkspace
            onBackToHome={() => setActiveViewMode('home')}
          />
        )}

        {(activeViewMode === 'home' || activeViewMode === 'do') && (
          <DevGuideHome
            onSelectIntent={handleIntentSelect}
            filteredArticles={filteredArticles}
            selectedArticle={selectedArticle}
            onSelectArticle={handleOpenArticle}
            onCloseArticle={() => setSelectedArticle(null)}
            bookmarkedIds={bookmarkedIds}
            onToggleBookmark={handleToggleBookmark}
            recentlyViewedGuides={recentlyViewedGuides}
            selectedCategoryId={selectedCategoryId}
            selectedSubcategoryId={selectedSubcategoryId}
            onSelectCategory={handleSelectCategory}
            getCategoryCount={getCategoryCount}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            favoritedCount={favoritedCount}
            isFavoritesSelected={isFavoritesSelected}
            onSelectFavorites={() => setIsFavoritesSelected(!isFavoritesSelected)}
          />
        )}
      </div>

      {/* Responsive Article Detail Reader Modal (Mobile Fallback ONLY) */}
      {selectedArticle && !isDesktop && (
        <ArticleDetailModal
          article={selectedArticle}
          onClose={() => setSelectedArticle(null)}
        />
      )}

      {/* Contextual Tools Overlay Side-Drawer */}
      <ContextualToolsDrawer
        activeTool={activeContextualTool}
        onClose={() => setActiveContextualTool(null)}
        onOpenArticle={(artId) => {
          const art = MOCK_ARTICLES.find((a) => a.id === artId);
          if (art) handleOpenArticle(art);
        }}
      />
    </PageContainer>
  );
}
