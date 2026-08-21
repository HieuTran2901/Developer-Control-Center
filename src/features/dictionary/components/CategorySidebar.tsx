import { useState } from 'react';
import { Icon, IconName } from '@/shared/components/ui/Icon';
import { Category, GuideArticle } from '../domain/entities/GuideArticle';

interface CategorySidebarProps {
  categories: Category[];
  selectedCategoryId: string;
  selectedSubcategoryId: string | null;
  onSelectCategory: (categoryId: string, subcategoryId?: string | null) => void;
  getCategoryCount: (categoryId: string, subcategoryId?: string | null) => number;
  recentlyViewedGuides?: GuideArticle[];
  onOpenArticleDetail?: (article: GuideArticle) => void;
  favoritedCount?: number;
  isFavoritesSelected?: boolean;
  onSelectFavorites?: () => void;
}

export function CategorySidebar({
  categories,
  selectedCategoryId,
  selectedSubcategoryId,
  onSelectCategory,
  getCategoryCount,
  recentlyViewedGuides = [],
  onOpenArticleDetail,
  favoritedCount = 0,
  isFavoritesSelected = false,
  onSelectFavorites,
}: CategorySidebarProps) {
  const [directorySearch, setDirectorySearch] = useState<string>('');
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<Record<string, boolean>>({
    aws: true,
    frontend: true,
    backend: false,
  });

  const toggleExpand = (categoryId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedCategoryIds((prev) => ({
      ...prev,
      [categoryId]: !prev[categoryId],
    }));
  };

  const handleExpandAll = () => {
    const allExpanded: Record<string, boolean> = {};
    categories.forEach((cat) => {
      if (cat.children && cat.children.length > 0) {
        allExpanded[cat.id] = true;
      }
    });
    setExpandedCategoryIds(allExpanded);
  };

  const handleCollapseAll = () => {
    setExpandedCategoryIds({});
  };

  const isAllExpanded = categories.every(
    (cat) => !cat.children || cat.children.length === 0 || expandedCategoryIds[cat.id]
  );

  // Filter categories and subcategories based on local directorySearch
  const filteredCategories = categories.filter((cat) => {
    if (!directorySearch.trim()) return true;
    const query = directorySearch.toLowerCase().trim();
    const matchParent = cat.name.toLowerCase().includes(query) || cat.id.toLowerCase().includes(query);
    const matchChild = cat.children?.some((child) => child.name.toLowerCase().includes(query));
    return matchParent || matchChild;
  });

  return (
    <nav
      aria-label="Knowledge Directory Navigation"
      className="space-y-3 p-3.5 rounded-2xl bg-surface border border-border/70 shadow-xs select-none max-h-[calc(100vh-140px)] overflow-y-auto scrollbar-thin"
    >
      {/* Directory Header */}
      <div className="px-2.5 py-1.5 flex items-center justify-between text-muted-foreground border-b border-border/50 pb-2.5">
        <div className="flex items-center gap-2">
          <Icon name="Layers" className="w-4 h-4 text-primary shrink-0" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-foreground">
            KNOWLEDGE DIRECTORY
          </span>
        </div>

        <button
          onClick={isAllExpanded ? handleCollapseAll : handleExpandAll}
          aria-label={isAllExpanded ? 'Collapse All Topics' : 'Expand All Topics'}
          title={isAllExpanded ? 'Collapse All' : 'Expand All'}
          className="p-1 rounded-md hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-all focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <Icon name={isAllExpanded ? 'ChevronsUp' : 'ChevronsDown'} className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Directory Filter Topics Input */}
      <div className="relative">
        <Icon
          name="Search"
          className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <input
          type="text"
          value={directorySearch}
          onChange={(e) => setDirectorySearch(e.target.value)}
          placeholder="Filter topics..."
          aria-label="Filter topics in directory"
          className="w-full pl-8 pr-7 py-1.5 text-xs rounded-xl bg-muted/40 border border-border/60 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition-all font-sans"
        />
        {directorySearch && (
          <button
            onClick={() => setDirectorySearch('')}
            aria-label="Clear topic filter"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
          >
            <Icon name="X" className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Favorites Section (if favoritedCount > 0 or onSelectFavorites provided) */}
      {favoritedCount > 0 && onSelectFavorites && (
        <div className="space-y-1 pt-1">
          <button
            onClick={onSelectFavorites}
            aria-label={`View ${favoritedCount} bookmarked favorites`}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all group ${
              isFavoritesSelected
                ? 'bg-primary/10 text-primary border-l-2 border-primary font-semibold'
                : 'text-amber-400/90 hover:bg-muted/50 hover:text-amber-400'
            }`}
          >
            <div className="flex items-center gap-2 truncate">
              <Icon name="Star" className="w-3.5 h-3.5 shrink-0 fill-amber-400/20 text-amber-400" />
              <span className="truncate">★ Favorites</span>
            </div>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-400/10 text-amber-400 border border-amber-400/20">
              [{favoritedCount}]
            </span>
          </button>
        </div>
      )}

      {/* Main Categories Navigation Tree */}
      <div className="space-y-1 pt-1">
        {filteredCategories.map((cat) => {
          const isParentActive = selectedCategoryId === cat.id && !selectedSubcategoryId;
          const isAnyChildActive = selectedCategoryId === cat.id && !!selectedSubcategoryId;
          const count = getCategoryCount(cat.id);
          const hasChildren = cat.children && cat.children.length > 0;
          const isExpanded = !!expandedCategoryIds[cat.id] || !!directorySearch.trim();

          return (
            <div key={cat.id} className="space-y-0.5">
              {/* Parent Category Row */}
              <div
                onClick={() => onSelectCategory(cat.id, null)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectCategory(cat.id, null);
                  }
                }}
                aria-label={`Select category ${cat.name}`}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all group cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary/40 ${
                  isParentActive
                    ? 'bg-primary/15 text-foreground border-l-2 border-primary font-semibold shadow-xs'
                    : isAnyChildActive
                    ? 'bg-muted/30 text-foreground font-medium'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {/* Chevron Toggle for Collapsible Category */}
                  {hasChildren ? (
                    <button
                      onClick={(e) => toggleExpand(cat.id, e)}
                      aria-expanded={isExpanded}
                      aria-label={`Toggle ${cat.name} subcategories`}
                      className="p-0.5 rounded hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-all shrink-0 focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <Icon
                        name={isExpanded ? 'ChevronDown' : 'ChevronRight'}
                        className="w-3.5 h-3.5"
                      />
                    </button>
                  ) : (
                    <div className="w-3.5 h-3.5 shrink-0" />
                  )}

                  {/* Icon */}
                  <Icon
                    name={(cat.icon as IconName) || 'Folder'}
                    className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-105 ${
                      isParentActive ? 'text-primary' : 'text-muted-foreground group-hover:text-primary'
                    }`}
                  />

                  {/* Category Name */}
                  <span className="truncate">{cat.name}</span>
                </div>

                {/* Count Badge */}
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded shrink-0 transition-colors ${
                    count === 0
                      ? 'bg-muted/30 text-muted-foreground/50 border border-border/40'
                      : isParentActive
                      ? 'bg-primary/20 text-primary font-bold border border-primary/30'
                      : 'bg-muted/60 text-muted-foreground border border-border/50 group-hover:text-foreground'
                  }`}
                >
                  [{count}]
                </span>
              </div>

              {/* Subcategories Tree (Child List) */}
              {hasChildren && isExpanded && (
                <div className="pl-6 space-y-0.5 border-l border-border/40 ml-4 my-1">
                  {cat.children!.map((child) => {
                    const isChildActive = selectedCategoryId === cat.id && selectedSubcategoryId === child.id;
                    const childCount = getCategoryCount(cat.id, child.id);

                    return (
                      <button
                        key={child.id}
                        onClick={() => onSelectCategory(cat.id, child.id)}
                        aria-label={`Select subcategory ${child.name}`}
                        className={`w-full flex items-center justify-between px-2 py-1 rounded-lg text-[11px] font-medium transition-all group focus:outline-none focus:ring-1 focus:ring-primary/40 ${
                          isChildActive
                            ? 'bg-primary/10 text-primary border-l-2 border-primary font-semibold'
                            : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className="text-muted-foreground/40 font-mono text-[10px]">├</span>
                          <span className="truncate">{child.name}</span>
                        </div>

                        <span
                          className={`text-[10px] font-mono px-1 py-0.2 rounded shrink-0 ${
                            childCount === 0
                              ? 'text-muted-foreground/40'
                              : isChildActive
                              ? 'text-primary font-bold'
                              : 'text-muted-foreground/70'
                          }`}
                        >
                          [{childCount}]
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Recently Viewed Guides Section */}
      {recentlyViewedGuides.length > 0 && onOpenArticleDetail && (
        <div className="pt-3 border-t border-border/50 space-y-2">
          <div className="px-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Icon name="History" className="w-3 h-3 text-primary" />
            <span>RECENT</span>
          </div>

          <div className="space-y-1">
            {recentlyViewedGuides.slice(0, 3).map((guide) => (
              <button
                key={guide.id}
                onClick={() => onOpenArticleDetail(guide)}
                aria-label={`Open recent guide ${guide.title}`}
                className="w-full text-left px-2 py-1.5 rounded-lg text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-all truncate flex items-center gap-2 group focus:outline-none focus:ring-1 focus:ring-primary/40"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-primary/60 group-hover:bg-primary shrink-0" />
                <span className="truncate">{guide.title}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}
