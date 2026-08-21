import { Category } from '../domain/entities/GuideArticle';

interface SubcategoryTabsProps {
  category: Category | null;
  selectedSubcategoryId: string | null;
  onSelectSubcategory: (subcategoryId: string | null) => void;
  totalCategoryGuides: number;
}

export function SubcategoryTabs({
  category,
  selectedSubcategoryId,
  onSelectSubcategory,
  totalCategoryGuides,
}: SubcategoryTabsProps) {
  if (!category || !category.children || category.children.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2 pt-1">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-foreground flex items-center gap-2">
          <span>Browse by {category.name}</span>
          <span className="text-[10px] text-muted-foreground font-normal font-mono">
            ({totalCategoryGuides} guides)
          </span>
        </h3>

        <button
          onClick={() => onSelectSubcategory(null)}
          className="text-[11px] font-semibold text-primary hover:underline"
        >
          View all
        </button>
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1">
        {/* All Tab */}
        <button
          onClick={() => onSelectSubcategory(null)}
          className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all shrink-0 cursor-pointer ${
            selectedSubcategoryId === null
              ? 'bg-primary text-primary-foreground shadow-xs shadow-primary/30 ring-1 ring-primary/50'
              : 'bg-surface border border-border/70 text-muted-foreground hover:text-foreground hover:bg-muted/40'
          }`}
        >
          All
        </button>

        {/* Subcategory Pills */}
        {category.children.map((child) => {
          const isActive = selectedSubcategoryId === child.id;

          return (
            <button
              key={child.id}
              onClick={() => onSelectSubcategory(child.id)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                isActive
                  ? 'bg-primary text-primary-foreground shadow-xs shadow-primary/30 ring-1 ring-primary/50'
                  : 'bg-surface border border-border/70 text-muted-foreground hover:text-foreground hover:bg-muted/40'
              }`}
            >
              {child.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
