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

export function CommandFinderWorkspace({
  onBackToHome,
  onOpenGuideArticle,
  initialQuery = '',
}: CommandFinderWorkspaceProps) {
  const [query, setQuery] = useState(initialQuery);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on mount & handle Ctrl + K
  useEffect(() => {
    inputRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
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

  // Smart Search matching
  const searchResults = useMemo(() => {
    const raw = query.trim().toLowerCase();

    // Expand Vietnamese keywords
    let expandedTokens = raw.split(/\s+/);
    Object.entries(VIETNAMESE_KEYWORD_MAP).forEach(([vnKey, enTerms]) => {
      if (raw.includes(vnKey)) {
        expandedTokens = [...expandedTokens, ...enTerms];
      }
    });

    const isSearching = raw.length > 0 || selectedCategory !== 'all';

    if (!isSearching) return [];

    return DEV_COMMANDS.filter((cmd) => {
      // 1. Category Filter
      if (selectedCategory !== 'all' && cmd.categoryId.toLowerCase() !== selectedCategory) {
        return false;
      }

      if (!raw) return true;

      // 2. Multi-field text match
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
  }, [query, selectedCategory]);

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
          <span>Full Workspace Mode</span>
        </div>
      </div>

      {/* Header Banner & Hero Search */}
      <div className="p-6 rounded-2xl bg-card border border-border/70 space-y-4 shadow-sm">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-primary/10 text-primary border border-primary/20">
            <Icon name="Search" className="w-3 h-3" />
            <span>DEVELOPER COMMAND SEARCH ENGINE</span>
          </div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">
            Command Finder
          </h1>
          <p className="text-xs text-muted-foreground">
            Find the exact, copy-ready command for what you're trying to accomplish.
          </p>
        </div>

        {/* Main Search Bar */}
        <div className="relative">
          <Icon
            name="Search"
            className="w-4.5 h-4.5 absolute left-4 top-1/2 -translate-y-1/2 text-primary"
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="What do you want to do? (e.g. undo last commit, find port 8080, view docker logs, hoàn tác commit)..."
            className="w-full h-12 pl-11 pr-24 text-sm font-sans bg-background border border-border/80 rounded-xl text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all shadow-inner"
          />
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center space-x-1.5">
            {query ? (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="text-muted-foreground hover:text-foreground p-1 cursor-pointer"
                title="Clear"
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

        {/* Quick Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-[11px] font-mono text-muted-foreground shrink-0 mr-1">Filter:</span>
          {CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1 rounded-xl text-xs font-medium transition-all cursor-pointer shrink-0 ${
                  isActive
                    ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                    : 'bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/50'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* SEARCH-FIRST EMPTY STATE */}
      {!query.trim() && selectedCategory === 'all' && (
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
                onClick={() => setQuery(item.query)}
                className="px-3 py-1.5 rounded-xl bg-muted/60 hover:bg-primary/10 hover:border-primary/30 border border-border/60 text-xs font-mono text-foreground transition-all cursor-pointer flex items-center space-x-1.5"
              >
                <span className="text-primary">•</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* SEARCH RESULTS DISPLAY */}
      {(query.trim() || selectedCategory !== 'all') && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-mono text-muted-foreground">
              Found <strong className="text-foreground">{searchResults.length}</strong> matching commands
            </span>
            {selectedCategory !== 'all' && (
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className="text-xs font-mono text-primary hover:underline cursor-pointer"
              >
                Clear category filter
              </button>
            )}
          </div>

          {searchResults.length === 0 ? (
            <div className="p-8 rounded-2xl bg-card border border-border/60 text-center space-y-3">
              <Icon name="SearchX" className="w-8 h-8 text-muted-foreground/60 mx-auto" />
              <p className="text-xs text-muted-foreground font-mono">
                No matching commands found for "{query}". Try checking your spelling or try another keyword.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {searchResults.map((cmd) => (
                <SearchResultCard
                  key={cmd.id}
                  command={cmd}
                  onCopy={handleCopy}
                  isCopied={copiedKey === cmd.id}
                  onOpenArticle={onOpenGuideArticle}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface SearchResultCardProps {
  command: DevCommand;
  onCopy: (code: string, key: string) => void;
  isCopied: boolean;
  onOpenArticle?: (articleId: string) => void;
}

function SearchResultCard({ command, onCopy, isCopied, onOpenArticle }: SearchResultCardProps) {
  const getRiskBadge = (level?: string) => {
    switch (level) {
      case 'safe':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">SAFE</span>;
      case 'caution':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">MEDIUM RISK</span>;
      case 'dangerous':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">HIGH RISK</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-muted text-muted-foreground border border-border">SAFE</span>;
    }
  };

  const articleId = command.relatedArticleIds?.[0];

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border/70 space-y-3 hover:border-primary/40 transition-all shadow-xs">
      {/* Title & Risk Badge */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase font-semibold bg-primary/10 text-primary border border-primary/20">
              {command.categoryId}
            </span>
            {getRiskBadge(command.riskLevel)}
          </div>
          <h3 className="text-sm font-bold text-foreground tracking-tight pt-1">
            {command.title}
          </h3>
        </div>

        <button
          type="button"
          onClick={() => onCopy(command.command, command.id)}
          className="px-3 py-1.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold transition-all cursor-pointer flex items-center space-x-1.5 shrink-0 shadow-xs"
        >
          <Icon name={isCopied ? 'Check' : 'Copy'} className="w-3.5 h-3.5" />
          <span>{isCopied ? 'Copied!' : 'Copy'}</span>
        </button>
      </div>

      {/* Code Box */}
      <div className="p-3 rounded-xl bg-background border border-border/80 font-mono text-xs text-emerald-400 overflow-x-auto flex items-center justify-between group">
        <code className="select-all">$ {command.command}</code>
      </div>

      {/* Explanation & Purpose */}
      <p className="text-xs text-muted-foreground leading-relaxed">
        {command.description}
      </p>

      {/* Related Commands / Guide Link */}
      <div className="pt-2 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground flex-wrap gap-2">
        {command.relatedCommandIds && command.relatedCommandIds.length > 0 ? (
          <div className="flex items-center space-x-1.5 font-mono text-[11px]">
            <span className="text-muted-foreground">Related:</span>
            {command.relatedCommandIds.slice(0, 3).map((rel: string, idx: number) => (
              <span key={idx} className="px-1.5 py-0.5 rounded bg-muted/60 text-foreground border border-border/40">
                {rel}
              </span>
            ))}
          </div>
        ) : <div />}

        {articleId && onOpenArticle && (
          <button
            type="button"
            onClick={() => onOpenArticle(articleId)}
            className="text-xs font-mono font-medium text-primary hover:underline flex items-center space-x-1 cursor-pointer"
          >
            <span>Read full guide</span>
            <Icon name="ArrowRight" className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}
