import { useState } from 'react';
import { Icon } from '@/shared/components/ui/Icon';
import { DICTIONARY_CATEGORIES } from '../../data/mockDictionaryData';
import { CategorySidebar } from '../CategorySidebar';
import { ArticleCard } from '../ArticleCard';
import { GuideReaderPanel } from '../GuideReaderPanel';
import { GuideArticle } from '../../domain/entities/GuideArticle';
import { DeveloperIntentType } from '../../domain/entities/DeveloperContext';
import { UniversalDiscoveryWorkspace } from '../discovery/UniversalDiscoveryWorkspace';

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
  favoritedCount,
  isFavoritesSelected,
  onSelectFavorites,
}: DevGuideHomeProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-150">
      {/* 1. UNIVERSAL INTELLIGENT DEVELOPER DISCOVERY WORKSPACE */}
      <UniversalDiscoveryWorkspace
        onSelectArticle={(artId) => {
          const art = filteredArticles.find((a) => a.id === artId);
          if (art) onSelectArticle(art);
        }}
        onSelectIntentMode={onSelectIntent}
        onSelectCategory={(catId) => onSelectCategory(catId, null)}
        activeCategoryContext={selectedCategoryId}
      />

      {/* 2. MAIN KNOWLEDGE DIRECTORY 3-ZONE LAYOUT */}
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

            <div className="flex items-center space-x-1.5 text-xs font-mono">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-primary/10 border-primary text-primary'
                    : 'bg-card border-border/60 text-muted-foreground hover:text-foreground'
                }`}
                title="Grid view"
              >
                <Icon name="LayoutGrid" className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                  viewMode === 'list'
                    ? 'bg-primary/10 border-primary text-primary'
                    : 'bg-card border-border/60 text-muted-foreground hover:text-foreground'
                }`}
                title="List view"
              >
                <Icon name="List" className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Article Cards List */}
          {filteredArticles.length === 0 ? (
            <div className="p-8 rounded-2xl bg-card border border-border/60 text-center space-y-2">
              <Icon name="BookOpen" className="w-8 h-8 text-muted-foreground/60 mx-auto" />
              <p className="text-xs text-muted-foreground font-mono">
                No guide articles found for this category or search criteria.
              </p>
            </div>
          ) : (
            <div
              className={
                viewMode === 'grid'
                  ? selectedArticle
                    ? 'grid grid-cols-1 gap-3.5'
                    : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5'
                  : 'space-y-3'
              }
            >
              {filteredArticles.map((article) => (
                <ArticleCard
                  key={article.id}
                  article={article}
                  onOpenDetail={onSelectArticle}
                  isSelected={selectedArticle?.id === article.id}
                  isBookmarked={bookmarkedIds.includes(article.id)}
                  onToggleBookmark={(e) => onToggleBookmark(e, article.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* ZONE 3: Right Reader Panel (Desktop Inline Reader) */}
        {selectedArticle && (
          <div className="hidden lg:block lg:col-span-4 sticky top-6">
            <GuideReaderPanel
              article={selectedArticle}
              onClose={onCloseArticle}
              isBookmarked={bookmarkedIds.includes(selectedArticle.id)}
              onToggleBookmark={() => onToggleBookmark(undefined, selectedArticle.id)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
