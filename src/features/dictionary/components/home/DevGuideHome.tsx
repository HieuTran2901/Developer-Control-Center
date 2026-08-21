import { useState } from 'react';
import { Icon } from '@/shared/components/ui/Icon';
import { DICTIONARY_CATEGORIES } from '../../data/mockDictionaryData';
import { CategorySidebar } from '../CategorySidebar';
import { ArticleCard } from '../ArticleCard';
import { GuideReaderPanel } from '../GuideReaderPanel';
import { GuideArticle } from '../../domain/entities/GuideArticle';
import { DeveloperIntentType } from '../../domain/entities/DeveloperContext';

interface DevGuideHomeProps {
  onSelectIntent: (intent: DeveloperIntentType) => void;
  filteredArticles: GuideArticle[];
  selectedArticle: GuideArticle | null;
  onSelectArticle: (article: GuideArticle) => void;
  onCloseArticle: () => void;
  bookmarkedIds: string[];
  onToggleBookmark: (e: React.MouseEvent | undefined, articleId: string) => void;
  recentlyViewedGuides: GuideArticle[];
  selectedCategoryId: string;
  selectedSubcategoryId: string | null;
  onSelectCategory: (catId: string, subId?: string | null) => void;
  getCategoryCount: (catId: string, subId?: string | null) => number;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  favoritedCount: number;
  isFavoritesSelected: boolean;
  onSelectFavorites: () => void;
}

const QUICK_ACTIONS = [
  { id: 'docker', label: 'Docker Container', icon: 'Box', categoryId: 'docker' },
  { id: 'aws', label: 'AWS Cloud CLI', icon: 'Cloud', categoryId: 'aws' },
  { id: 'git', label: 'Git Workflow', icon: 'GitBranch', categoryId: 'git' },
  { id: 'linux', label: 'Linux Server', icon: 'Terminal', categoryId: 'linux' },
];

export function DevGuideHome({
  onSelectIntent,
  filteredArticles,
  selectedArticle,
  onSelectArticle,
  onCloseArticle,
  bookmarkedIds,
  onToggleBookmark,
  recentlyViewedGuides,
  selectedCategoryId,
  selectedSubcategoryId,
  onSelectCategory,
  getCategoryCount,
  searchQuery,
  onSearchChange,
  favoritedCount,
  isFavoritesSelected,
  onSelectFavorites,
}: DevGuideHomeProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-150">
      {/* 1. INTENT NAVIGATION BAR */}
      <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-xs flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <Icon name="Compass" className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-foreground">
              What do you want to accomplish?
            </h2>
            <p className="text-[11px] text-muted-foreground">
              Select an intent mode or browse the knowledge base below.
            </p>
          </div>
        </div>

        {/* Intent Pills: DO / FIND / LEARN / FIX */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <button
            type="button"
            onClick={() => onSelectIntent('DO')}
            className="px-3.5 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold transition-all cursor-pointer flex items-center space-x-1.5"
          >
            <Icon name="Zap" className="w-3.5 h-3.5" />
            <span>⚡ DO (Workflows)</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectIntent('FIND')}
            className="px-3.5 py-1.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 text-xs font-semibold transition-all cursor-pointer flex items-center space-x-1.5"
          >
            <Icon name="Search" className="w-3.5 h-3.5" />
            <span>🔍 FIND (Commands)</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectIntent('LEARN')}
            className="px-3.5 py-1.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 text-xs font-semibold transition-all cursor-pointer flex items-center space-x-1.5"
          >
            <Icon name="BookOpen" className="w-3.5 h-3.5" />
            <span>📖 LEARN (Guides)</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectIntent('FIX')}
            className="px-3.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-semibold transition-all cursor-pointer flex items-center space-x-1.5"
          >
            <Icon name="Wrench" className="w-3.5 h-3.5" />
            <span>🛠 FIX (Errors)</span>
          </button>
        </div>
      </div>

      {/* 2. HERO SEARCH BAR */}
      <div className="relative">
        <Icon
          name="Search"
          className="w-4.5 h-4.5 absolute left-4 top-1/2 -translate-y-1/2 text-primary"
        />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search developer guides, CLI commands, AWS, Docker, Git, errors..."
          className="w-full h-12 pl-11 pr-24 text-sm font-sans bg-card border border-border/80 rounded-xl text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all shadow-inner"
        />
        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center space-x-2">
          {searchQuery ? (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="text-muted-foreground hover:text-foreground p-1 cursor-pointer"
            >
              <Icon name="X" className="w-4 h-4" />
            </button>
          ) : (
            <span className="text-[11px] font-mono text-muted-foreground hidden sm:inline">
              Search directory
            </span>
          )}
        </div>
      </div>

      {/* 3. POPULAR QUICK ACTIONS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {QUICK_ACTIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelectCategory(item.categoryId, null)}
            className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-center space-x-3 ${
              selectedCategoryId === item.categoryId && !isFavoritesSelected
                ? 'bg-primary/10 border-primary/50 text-primary shadow-xs'
                : 'bg-card hover:bg-muted/40 border-border/70 text-foreground'
            }`}
          >
            <div className="w-8 h-8 rounded-xl bg-muted/60 flex items-center justify-center text-primary shrink-0">
              <Icon name={item.icon as any} className="w-4 h-4" />
            </div>
            <div className="truncate">
              <div className="text-xs font-bold truncate">{item.label}</div>
              <div className="text-[10px] font-mono text-muted-foreground">
                {getCategoryCount(item.categoryId)} articles
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* 4. MAIN KNOWLEDGE DIRECTORY 3-ZONE LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* ZONE 1: Left Knowledge Directory Category Sidebar */}
        <div className="hidden lg:block lg:col-span-3 space-y-3">
          <CategorySidebar
            categories={DICTIONARY_CATEGORIES}
            selectedCategoryId={selectedCategoryId}
            selectedSubcategoryId={selectedSubcategoryId}
            onSelectCategory={onSelectCategory}
            getCategoryCount={getCategoryCount}
            recentlyViewedGuides={recentlyViewedGuides}
            onOpenArticleDetail={onSelectArticle}
            favoritedCount={favoritedCount}
            isFavoritesSelected={isFavoritesSelected}
            onSelectFavorites={onSelectFavorites}
          />
        </div>

        {/* ZONE 2: Center Article Grid/List */}
        <div className={selectedArticle ? 'lg:col-span-5 space-y-4' : 'lg:col-span-9 space-y-4'}>
          {/* Header Controls */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-foreground">
                {isFavoritesSelected ? 'Favorites' : selectedCategoryId.toUpperCase()} GUIDES
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-muted text-muted-foreground">
                {filteredArticles.length}
              </span>
            </div>

            <div className="flex items-center space-x-1.5">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                  viewMode === 'grid' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-muted'
                }`}
                title="Grid View"
              >
                <Icon name="LayoutGrid" className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                  viewMode === 'list' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-muted'
                }`}
                title="List View"
              >
                <Icon name="List" className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Article Cards Grid/List */}
          {filteredArticles.length === 0 ? (
            <div className="p-8 rounded-2xl bg-card border border-border/60 text-center space-y-3">
              <Icon name="FileQuestion" className="w-8 h-8 text-muted-foreground/60 mx-auto" />
              <p className="text-xs font-mono text-muted-foreground">
                No guides found matching your current filter or search query.
              </p>
            </div>
          ) : (
            <div className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 gap-3.5' : 'space-y-3'}>
              {filteredArticles.map((article) => (
                <ArticleCard
                  key={article.id}
                  article={article}
                  onOpenDetail={onSelectArticle}
                  viewMode={viewMode}
                  isSelected={selectedArticle?.id === article.id}
                  onToggleBookmark={(e) => onToggleBookmark(e, article.id)}
                  isBookmarked={bookmarkedIds.includes(article.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* ZONE 3: Right Embedded Guide Reader Panel (Desktop) */}
        {selectedArticle && (
          <div className="hidden lg:block lg:col-span-4 sticky top-6">
            <GuideReaderPanel
              article={selectedArticle}
              onClose={onCloseArticle}
              onToggleBookmark={(id) => onToggleBookmark(undefined, id)}
              isBookmarked={bookmarkedIds.includes(selectedArticle.id)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
