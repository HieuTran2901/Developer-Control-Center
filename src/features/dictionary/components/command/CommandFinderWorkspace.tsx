import { useState, useEffect, useRef, useMemo } from 'react';
import { Icon } from '@/shared/components/ui/Icon';
import { DEV_COMMANDS } from '../../data/devCommands';
import { DevCommand } from '../../domain/entities/DevCommand';

interface CommandFinderWorkspaceProps {
  onBackToHome: () => void;
  onOpenGuideArticle?: (articleId: string) => void;
  initialQuery?: string;
}

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'git', label: 'Git' },
  { id: 'docker', label: 'Docker' },
  { id: 'linux', label: 'Linux' },
  { id: 'aws', label: 'AWS' },
  { id: 'npm', label: 'npm / Node' },
  { id: 'kubernetes', label: 'Kubernetes' },
];

const RISK_LEVELS = [
  { id: 'all', label: 'All Risks' },
  { id: 'safe', label: 'Safe Only' },
  { id: 'caution', label: 'Medium Risk' },
  { id: 'dangerous', label: 'High Risk' },
];

const SORT_OPTIONS = [
  { id: 'relevance', label: 'Best Match' },
  { id: 'title_asc', label: 'Name A–Z' },
  { id: 'risk_asc', label: 'Safest First' },
];

const PAGE_SIZE_OPTIONS = [10, 20, 50];

const TRY_SUGGESTIONS = [
  { label: 'undo last commit', query: 'undo last commit' },
  { label: 'find process using port 8080', query: 'find process using port 8080' },
  { label: 'see docker logs', query: 'view docker logs' },
  { label: 'check disk usage', query: 'check disk usage' },
  { label: 'create new git branch', query: 'create git branch' },
  { label: 'xóa container docker', query: 'delete docker container' },
  { label: 'hoàn tác commit mới nhất', query: 'undo last commit' },
];

// Dictionary of Vietnamese intent mappings for smart search
const VIETNAMESE_KEYWORD_MAP: Record<string, string[]> = {
  'hoàn tác': ['undo', 'reset', 'revert', 'rollback'],
  'xóa': ['remove', 'delete', 'prune', 'kill', 'clean'],
  'quay lại': ['reset', 'checkout', 'undo'],
  'tìm': ['find', 'search', 'lsof', 'grep', 'ps'],
  'cổng': ['port', '8080', 'lsof'],
  'dung lượng': ['disk', 'du', 'df', 'storage'],
  'bộ nhớ': ['ram', 'memory', 'free'],
  'tiến trình': ['process', 'kill', 'ps'],
};

function getPageNumbers(current: number, total: number): (number | string)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, '...', total];
  if (current >= total - 3) return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
  return [1, '...', current - 1, current, current + 1, '...', total];
}

export function CommandFinderWorkspace({
  onBackToHome,
  onOpenGuideArticle,
  initialQuery = '',
}: CommandFinderWorkspaceProps) {
  const [query, setQuery] = useState(initialQuery);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedRisk, setSelectedRisk] = useState<string>('all');
  const [selectedSort, setSelectedSort] = useState<string>('relevance');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const resultsContainerRef = useRef<HTMLDivElement>(null);

  // Reset page to 1 whenever query, category, risk, sort, or pageSize changes
  const handleQueryChange = (val: string) => {
    setQuery(val);
    setCurrentPage(1);
  };

  const handleCategoryChange = (catId: string) => {
    setSelectedCategory(catId);
    setCurrentPage(1);
  };

  const handleRiskChange = (riskId: string) => {
    setSelectedRisk(riskId);
    setCurrentPage(1);
  };

  const handleSortChange = (sortId: string) => {
    setSelectedSort(sortId);
    setCurrentPage(1);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  // Keyboard navigation & Ctrl + K
  useEffect(() => {
    inputRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl + K to focus search
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        return;
      }

      // Left/Right arrow key navigation if input is NOT focused
      if (document.activeElement !== inputRef.current) {
        if (e.key === 'ArrowLeft' || (e.altKey && e.key === 'ArrowLeft')) {
          setCurrentPage((prev) => Math.max(1, prev - 1));
        } else if (e.key === 'ArrowRight' || (e.altKey && e.key === 'ArrowRight')) {
          setCurrentPage((prev) => Math.min(totalPages, prev + 1));
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleCopy = (commandText: string, key: string) => {
    navigator.clipboard.writeText(commandText);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // 1. FILTERING PIPELINE
  const filteredCommands = useMemo(() => {
    const raw = query.trim().toLowerCase();

    // Expand Vietnamese keywords
    let expandedTokens = raw.split(/\s+/);
    Object.entries(VIETNAMESE_KEYWORD_MAP).forEach(([vnKey, enTerms]) => {
      if (raw.includes(vnKey)) {
        expandedTokens = [...expandedTokens, ...enTerms];
      }
    });

    const isFiltering = raw.length > 0 || selectedCategory !== 'all' || selectedRisk !== 'all';

    if (!isFiltering) return [];

    return DEV_COMMANDS.filter((cmd) => {
      // Category Filter
      if (selectedCategory !== 'all' && cmd.categoryId.toLowerCase() !== selectedCategory) {
        return false;
      }

      // Risk Filter
      if (selectedRisk !== 'all' && (cmd.riskLevel || 'safe') !== selectedRisk) {
        return false;
      }

      if (!raw) return true;

      // Search matching across multiple fields
      const searchableText = [
        cmd.title,
        cmd.command,
        cmd.description,
        cmd.categoryId,
        cmd.riskLevel || '',
        ...(cmd.useCases || []),
        ...(cmd.tags || []),
        ...(cmd.relatedCommandIds || []),
      ]
        .join(' ')
        .toLowerCase();

      return expandedTokens.some((token) => token && searchableText.includes(token));
    });
  }, [query, selectedCategory, selectedRisk]);

  // 2. SORTING PIPELINE
  const sortedCommands = useMemo(() => {
    const copy = [...filteredCommands];
    if (selectedSort === 'title_asc') {
      return copy.sort((a, b) => a.title.localeCompare(b.title));
    }
    if (selectedSort === 'risk_asc') {
      const riskMap: Record<string, number> = { safe: 1, caution: 2, dangerous: 3 };
      return copy.sort(
        (a, b) => (riskMap[a.riskLevel || 'safe'] || 1) - (riskMap[b.riskLevel || 'safe'] || 1)
      );
    }
    return copy; // Relevance (default array order)
  }, [filteredCommands, selectedSort]);

  // 3. PAGINATION CALCULATION PIPELINE
  const totalItems = sortedCommands.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);

  // 4. SLICING PAGINATED COMMANDS
  const paginatedCommands = useMemo(() => {
    return sortedCommands.slice(startIndex, endIndex);
  }, [sortedCommands, startIndex, endIndex]);

  const handlePageSelect = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    resultsContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-150">
      {/* Top Breadcrumb & Back Navigation */}
      <div className="flex items-center justify-between border-b border-border/50 pb-3">
        <div className="flex items-center space-x-2 text-xs font-mono text-muted-foreground">
          <button
            type="button"
            onClick={onBackToHome}
            className="flex items-center space-x-1 hover:text-primary transition-colors cursor-pointer font-semibold"
          >
            <Icon name="ArrowLeft" className="w-3.5 h-3.5" />
            <span>Dev Guide</span>
          </button>
          <span>/</span>
          <span className="text-foreground font-bold">Command Finder</span>
        </div>

        <div className="text-[11px] font-mono text-muted-foreground flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Smart Paginated Search Engine</span>
        </div>
      </div>

      {/* STICKY SEARCH & FILTER TOOLBAR */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md pb-4 pt-2 border-b border-border/60 space-y-3 shadow-xs">
        {/* Search Input Box */}
        <div className="relative">
          <Icon
            name="Search"
            className="w-4.5 h-4.5 absolute left-4 top-1/2 -translate-y-1/2 text-primary"
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="What do you want to do? (e.g. undo last commit, find port 8080, view docker logs, hoàn tác commit)..."
            className="w-full h-11 pl-11 pr-24 text-sm font-sans bg-card border border-border/80 rounded-xl text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all shadow-inner"
          />
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center space-x-1.5">
            {query ? (
              <button
                type="button"
                onClick={() => handleQueryChange('')}
                className="text-muted-foreground hover:text-foreground p-1 cursor-pointer"
                title="Clear Search"
              >
                <Icon name="X" className="w-4 h-4" />
              </button>
            ) : (
              <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono text-muted-foreground bg-muted border border-border/70 rounded">
                Ctrl K
              </kbd>
            )}
          </div>
        </div>

        {/* Category Pills & Filter Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Quick Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {CATEGORIES.map((cat) => {
              const isActive = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleCategoryChange(cat.id)}
                  className={`px-3 py-1 rounded-xl text-xs font-medium transition-all cursor-pointer shrink-0 ${
                    isActive
                      ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                      : 'bg-card hover:bg-muted text-muted-foreground hover:text-foreground border border-border/50'
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* Secondary Controls: Risk Filter, Sort & Page Size */}
          <div className="flex items-center space-x-2 text-xs font-mono">
            {/* Risk Selector */}
            <select
              value={selectedRisk}
              onChange={(e) => handleRiskChange(e.target.value)}
              className="px-2.5 py-1 rounded-xl bg-card border border-border/70 text-muted-foreground hover:text-foreground focus:outline-none focus:border-primary cursor-pointer text-xs"
            >
              {RISK_LEVELS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>

            {/* Sort Selector */}
            <select
              value={selectedSort}
              onChange={(e) => handleSortChange(e.target.value)}
              className="px-2.5 py-1 rounded-xl bg-card border border-border/70 text-muted-foreground hover:text-foreground focus:outline-none focus:border-primary cursor-pointer text-xs"
            >
              {SORT_OPTIONS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>

            {/* Page Size Selector */}
            <div className="flex items-center space-x-1 pl-1">
              <span className="text-[11px] text-muted-foreground hidden sm:inline">Per page:</span>
              <select
                value={pageSize}
                onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                className="px-2 py-1 rounded-xl bg-card border border-border/70 text-foreground font-bold focus:outline-none focus:border-primary cursor-pointer text-xs"
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size} / page
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* SEARCH-FIRST EMPTY STATE */}
      {!query.trim() && selectedCategory === 'all' && selectedRisk === 'all' && (
        <div className="p-8 rounded-2xl bg-card/40 border border-border/60 text-center space-y-5">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto text-primary">
            <Icon name="Terminal" className="w-6 h-6" />
          </div>

          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-sm font-bold text-foreground">
              What do you want to accomplish?
            </h3>
            <p className="text-xs text-muted-foreground">
              Type your goal in English or Vietnamese above, or click a common workflow suggestion below to get started.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 max-w-2xl mx-auto pt-2">
            {TRY_SUGGESTIONS.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleQueryChange(item.query)}
                className="px-3 py-1.5 rounded-xl bg-muted/60 hover:bg-primary/10 hover:border-primary/30 border border-border/60 text-xs font-mono text-foreground transition-all cursor-pointer flex items-center space-x-1.5"
              >
                <span className="text-primary">•</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* SEARCH RESULTS SECTION */}
      {(query.trim() || selectedCategory !== 'all' || selectedRisk !== 'all') && (
        <div ref={resultsContainerRef} className="space-y-4 pt-1 scroll-mt-20">
          {/* Result Count & Summary Header */}
          <div className="flex items-center justify-between px-1 text-xs font-mono text-muted-foreground">
            <div>
              {totalItems > 0 ? (
                <span>
                  Showing <strong className="text-foreground">{startIndex + 1}–{endIndex}</strong> of{' '}
                  <strong className="text-foreground">{totalItems}</strong> matching commands
                </span>
              ) : (
                <span>0 commands found</span>
              )}
            </div>

            {(selectedCategory !== 'all' || selectedRisk !== 'all' || query.trim()) && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setSelectedCategory('all');
                  setSelectedRisk('all');
                  setCurrentPage(1);
                }}
                className="text-xs font-mono text-primary hover:underline cursor-pointer flex items-center space-x-1"
              >
                <Icon name="RotateCcw" className="w-3 h-3" />
                <span>Reset all filters</span>
              </button>
            )}
          </div>

          {/* EMPTY RESULT VIEW */}
          {totalItems === 0 ? (
            <div className="p-8 rounded-2xl bg-card border border-border/60 text-center space-y-4">
              <Icon name="SearchX" className="w-8 h-8 text-muted-foreground/60 mx-auto" />
              <div className="space-y-1">
                <h4 className="text-xs font-bold font-mono text-foreground">No commands found</h4>
                <p className="text-xs text-muted-foreground font-mono">
                  No matching commands found for "{query}". Try checking your spelling or trying another keyword.
                </p>
              </div>

              <div className="pt-2 flex flex-wrap items-center justify-center gap-2 max-w-md mx-auto">
                {TRY_SUGGESTIONS.slice(0, 4).map((sugg, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleQueryChange(sugg.query)}
                    className="px-2.5 py-1 rounded-lg bg-muted/60 hover:bg-muted text-[11px] font-mono text-primary cursor-pointer border border-border/50"
                  >
                    {sugg.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* COMPACT PAGINATED COMMAND CARDS LIST */
            <div className="space-y-3">
              {paginatedCommands.map((cmd) => (
                <CompactSearchResultCard
                  key={cmd.id}
                  command={cmd}
                  onCopy={handleCopy}
                  isCopied={copiedKey === cmd.id}
                  onOpenArticle={onOpenGuideArticle}
                />
              ))}
            </div>
          )}

          {/* SMART PAGINATION FOOTER */}
          {totalItems > pageSize && (
            <div className="pt-4 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono select-none">
              <div className="text-muted-foreground">
                Page <strong className="text-foreground">{currentPage}</strong> of{' '}
                <strong className="text-foreground">{totalPages}</strong>
              </div>

              {/* Responsive Page Buttons */}
              <div className="flex items-center space-x-1.5 flex-wrap">
                {/* Previous Page Button */}
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => handlePageSelect(currentPage - 1)}
                  className="px-2.5 py-1.5 rounded-xl border border-border/70 bg-card hover:bg-muted text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center space-x-1"
                  title="Previous Page (Alt + ←)"
                >
                  <Icon name="ChevronLeft" className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Prev</span>
                </button>

                {/* Numbered Page Buttons */}
                {getPageNumbers(currentPage, totalPages).map((p, idx) => {
                  if (typeof p === 'string') {
                    return (
                      <span key={`ellipsis-${idx}`} className="px-2 py-1 text-muted-foreground">
                        ...
                      </span>
                    );
                  }
                  const isCurrent = p === currentPage;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => handlePageSelect(p)}
                      className={`min-w-[32px] h-8 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        isCurrent
                          ? 'bg-primary text-primary-foreground shadow-xs'
                          : 'bg-card hover:bg-muted border border-border/60 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}

                {/* Next Page Button */}
                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => handlePageSelect(currentPage + 1)}
                  className="px-2.5 py-1.5 rounded-xl border border-border/70 bg-card hover:bg-muted text-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center space-x-1"
                  title="Next Page (Alt + →)"
                >
                  <span className="hidden sm:inline">Next</span>
                  <Icon name="ChevronRight" className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface CompactSearchResultCardProps {
  command: DevCommand;
  onCopy: (code: string, key: string) => void;
  isCopied: boolean;
  onOpenArticle?: (articleId: string) => void;
}

function CompactSearchResultCard({
  command,
  onCopy,
  isCopied,
  onOpenArticle,
}: CompactSearchResultCardProps) {
  const getRiskBadge = (level?: string) => {
    switch (level) {
      case 'safe':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            SAFE
          </span>
        );
      case 'caution':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            MEDIUM RISK
          </span>
        );
      case 'dangerous':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            HIGH RISK
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-muted text-muted-foreground border border-border">
            SAFE
          </span>
        );
    }
  };

  const articleId = command.relatedArticleIds?.[0];

  return (
    <div className="p-3.5 sm:p-4 rounded-xl bg-card border border-border/70 space-y-2.5 hover:border-primary/40 transition-all shadow-xs">
      {/* Title, Category & Copy Action */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase font-semibold bg-primary/10 text-primary border border-primary/20">
              {command.categoryId}
            </span>
            {getRiskBadge(command.riskLevel)}
          </div>
          <h3 className="text-sm font-bold text-foreground tracking-tight truncate">
            {command.title}
          </h3>
        </div>

        <button
          type="button"
          onClick={() => onCopy(command.command, command.id)}
          className="px-3 py-1.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold transition-all cursor-pointer flex items-center space-x-1.5 shrink-0 shadow-xs"
        >
          <Icon name={isCopied ? 'Check' : 'Copy'} className="w-3.5 h-3.5" />
          <span>{isCopied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>

      {/* Monospace Command Code Block */}
      <div className="p-2.5 rounded-lg bg-background border border-border/80 font-mono text-xs text-emerald-400 overflow-x-auto flex items-center justify-between">
        <code className="select-all">$ {command.command}</code>
      </div>

      {/* Description / Purpose */}
      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
        {command.description}
      </p>

      {/* Footer: Tags / Related Commands / Guide Link */}
      <div className="pt-2 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground flex-wrap gap-2">
        {command.relatedCommandIds && command.relatedCommandIds.length > 0 ? (
          <div className="flex items-center space-x-1.5 font-mono text-[11px] truncate">
            <span className="text-muted-foreground">Related:</span>
            {command.relatedCommandIds.slice(0, 3).map((rel: string, idx: number) => (
              <span
                key={idx}
                className="px-1.5 py-0.5 rounded bg-muted/60 text-foreground border border-border/40 truncate max-w-[140px]"
              >
                {rel}
              </span>
            ))}
          </div>
        ) : (
          <div />
        )}

        {articleId && onOpenArticle && (
          <button
            type="button"
            onClick={() => onOpenArticle(articleId)}
            className="text-xs font-mono font-medium text-primary hover:underline flex items-center space-x-1 cursor-pointer shrink-0"
          >
            <span>Read full guide</span>
            <Icon name="ArrowRight" className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}
