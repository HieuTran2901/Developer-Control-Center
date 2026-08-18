import { Icon } from '@/shared/components/ui/Icon';

export type FilterStatus = 'all' | 'healthy' | 'pending' | 'warning' | 'critical' | 'auth_required' | 'stale';
export type SortOption = 'recommended' | 'quota_5h' | 'quota_weekly' | 'reset' | 'updated' | 'name';

interface AccountStatusFiltersProps {
  currentFilter: FilterStatus;
  onFilterChange: (filter: FilterStatus) => void;
  filterCounts: {
    all: number;
    healthy: number;
    pending: number;
    warning: number;
    critical: number;
    auth_required: number;
    stale: number;
  };
  searchQuery: string;
  onSearchChange: (query: string) => void;
  currentSort: SortOption;
  onSortChange: (sort: SortOption) => void;
}

export function AccountStatusFilters({
  currentFilter,
  onFilterChange,
  filterCounts,
  searchQuery,
  onSearchChange,
  currentSort,
  onSortChange,
}: AccountStatusFiltersProps) {
  const filterButtons: { id: FilterStatus; label: string; count: number; activeColor: string }[] = [
    { id: 'all', label: 'All', count: filterCounts.all, activeColor: 'bg-primary/20 text-primary border-primary/40' },
    { id: 'healthy', label: 'Healthy', count: filterCounts.healthy, activeColor: 'bg-success/20 text-success border-success/40' },
    { id: 'pending', label: 'Pending', count: filterCounts.pending, activeColor: 'bg-slate-500/20 text-slate-300 border-slate-500/40' },
    { id: 'warning', label: 'Warning', count: filterCounts.warning, activeColor: 'bg-warning/20 text-warning border-warning/40' },
    { id: 'critical', label: 'Critical', count: filterCounts.critical, activeColor: 'bg-destructive/20 text-destructive border-destructive/40' },
    { id: 'auth_required', label: 'Auth Required', count: filterCounts.auth_required, activeColor: 'bg-amber-500/20 text-amber-400 border-amber-500/40' },
    { id: 'stale', label: 'Stale', count: filterCounts.stale, activeColor: 'bg-purple-500/20 text-purple-400 border-purple-500/40' },
  ];

  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-1">
      {/* Left: Filter Buttons */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {filterButtons.map((btn) => {
          const isActive = currentFilter === btn.id;
          return (
            <button
              key={btn.id}
              onClick={() => onFilterChange(btn.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all duration-150 flex items-center gap-1.5 ${
                isActive
                  ? btn.activeColor
                  : 'bg-surface/60 hover:bg-muted/60 text-muted-foreground border-border/60'
              }`}
            >
              <span>{btn.label}</span>
              <span
                className={`text-[10px] px-1 py-0.2 rounded-full font-mono ${
                  isActive ? 'bg-background/40' : 'bg-muted/40 text-muted-foreground'
                }`}
              >
                {btn.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Right: Search & Sort */}
      <div className="flex items-center gap-2.5 shrink-0 flex-wrap sm:flex-nowrap">
        {/* Search Input */}
        <div className="relative flex-1 sm:w-56">
          <Icon name="Search" className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search accounts..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full h-8 pl-8 pr-7 text-xs bg-surface border border-border/70 rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all font-sans"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <Icon name="X" className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Sort Dropdown */}
        <div className="flex items-center gap-1.5 text-xs bg-surface border border-border/70 rounded-lg px-2.5 h-8">
          <span className="text-muted-foreground text-[11px] whitespace-nowrap">Sort by:</span>
          <select
            value={currentSort}
            onChange={(e) => onSortChange(e.target.value as SortOption)}
            className="bg-transparent text-foreground text-xs font-semibold focus:outline-none cursor-pointer pr-1"
          >
            <option value="recommended" className="bg-surface text-foreground">Recommended</option>
            <option value="quota_5h" className="bg-surface text-foreground">5H Quota</option>
            <option value="quota_weekly" className="bg-surface text-foreground">Weekly Quota</option>
            <option value="reset" className="bg-surface text-foreground">Earliest Reset</option>
            <option value="updated" className="bg-surface text-foreground">Last Updated</option>
            <option value="name" className="bg-surface text-foreground">Account Name</option>
          </select>
        </div>
      </div>
    </div>
  );
}
