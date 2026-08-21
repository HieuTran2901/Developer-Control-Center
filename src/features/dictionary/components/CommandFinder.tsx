import { useState, useEffect, useRef } from 'react';
import { Icon } from '@/shared/components/ui/Icon';
import { useCommandFinder } from '../hooks/useCommandFinder';
import { Button } from '@/shared/components/ui/button';

interface CommandFinderProps {
  onOpenGuideArticle?: (articleId: string) => void;
  onClose?: () => void;
}

const POPULAR_TASKS = [
  { label: '🐳 Clean Docker', query: 'check docker disk usage', icon: 'Box' as const },
  { label: '🔍 Debug Container', query: 'view docker logs', icon: 'Search' as const },
  { label: '🌐 Find Port Owner', query: 'find process using port 8080', icon: 'Network' as const },
  { label: '🌿 Undo Git Commit', query: 'undo last git commit', icon: 'GitBranch' as const },
  { label: '🐧 Check RAM', query: 'check ram memory', icon: 'Cpu' as const },
  { label: '📦 Find Large Files', query: 'find top 10 big files', icon: 'Folder' as const },
  { label: '☁ Check AWS Identity', query: 'check aws identity', icon: 'Cloud' as const },
  { label: '⚛ Create React App', query: 'create react app', icon: 'Layout' as const },
];

export function CommandFinder({ onOpenGuideArticle, onClose }: CommandFinderProps) {
  const {
    query,
    setQuery,
    setSelectedCommandId,
    selectedCommand,
    searchResults,
    suggestions,
    recentSearches,
    addRecentSearch,
    toggleFavorite,
    isFavorite,
  } = useCommandFinder();

  const [copiedKeyMap, setCopiedKeyMap] = useState<Record<string, boolean>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  // Ctrl + K listener to focus input
  useEffect(() => {
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
    setCopiedKeyMap((prev) => ({ ...prev, [key]: true }));
    setTimeout(() => {
      setCopiedKeyMap((prev) => ({ ...prev, [key]: false }));
    }, 2000);
  };

  const handleTaskClick = (taskQuery: string) => {
    setQuery(taskQuery);
    addRecentSearch(taskQuery);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      addRecentSearch(query);
    }
  };

  return (
    <div className="space-y-5 p-4 sm:p-5 bg-card/40 border border-border/70 rounded-2xl shadow-xs backdrop-blur-md animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/50 pb-3">
        <div className="space-y-0.5">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
              Goal-Based Discovery
            </span>
            <h2 className="text-sm font-bold tracking-tight text-foreground uppercase">
              COMMAND FINDER
            </h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Tell us what you want to do. We'll find the right developer command instantly.
          </p>
        </div>

        {onClose && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
          >
            <Icon name="X" className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Main Search Input */}
      <form onSubmit={handleSearchSubmit} className="space-y-2">
        <div className="relative">
          <Icon
            name="Search"
            className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-primary"
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="What do you want to do? (e.g. check docker disk usage, find port 8080, undo last commit)..."
            className="w-full h-11 pl-10 pr-24 text-xs font-sans bg-background/90 border border-border/80 rounded-xl text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-primary/80 focus:ring-2 focus:ring-primary/20 shadow-inner"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center space-x-1.5">
            {query ? (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="text-muted-foreground hover:text-foreground p-1"
              >
                <Icon name="X" className="w-3.5 h-3.5" />
              </button>
            ) : (
              <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground bg-muted/60 border border-border/60 rounded">
                Ctrl K
              </kbd>
            )}
          </div>
        </div>

        {/* Live Auto-complete Suggestions */}
        {suggestions.length > 0 && query.trim() && (
          <div className="p-2 rounded-xl bg-background border border-border/80 shadow-md space-y-1">
            <div className="text-[10px] font-mono text-muted-foreground px-2">Suggestions</div>
            {suggestions.map((sugg) => (
              <button
                key={sugg.id}
                type="button"
                onClick={() => {
                  setQuery(sugg.title);
                  setSelectedCommandId(sugg.id);
                  addRecentSearch(sugg.title);
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-mono text-foreground hover:bg-primary/10 hover:text-primary transition-colors flex items-center justify-between"
              >
                <span className="truncate">{sugg.title}</span>
                <span className="text-[10px] text-muted-foreground font-mono">$ {sugg.command}</span>
              </button>
            ))}
          </div>
        )}
      </form>

      {/* Popular Developer Tasks (Quick Actions) */}
      <div className="space-y-2">
        <div className="text-[11px] font-mono font-bold uppercase text-muted-foreground">
          Popular Developer Tasks
        </div>
        <div className="flex flex-wrap gap-2">
          {POPULAR_TASKS.map((task, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleTaskClick(task.query)}
              className="px-2.5 py-1.5 rounded-xl bg-muted/40 hover:bg-primary/10 hover:border-primary/40 border border-border/60 text-xs text-foreground transition-all flex items-center space-x-1.5 cursor-pointer font-sans"
            >
              <span>{task.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Recent Searches History */}
      {recentSearches.length > 0 && !query && (
        <div className="space-y-1.5 pt-1">
          <div className="text-[11px] font-mono text-muted-foreground flex items-center space-x-1">
            <Icon name="Clock" className="w-3 h-3 text-muted-foreground" />
            <span>Recent Searches</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {recentSearches.map((rec, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleTaskClick(rec)}
                className="px-2 py-1 rounded-lg bg-background border border-border/50 text-[11px] font-mono text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
              >
                {rec}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Results vs Selected Command 2-Column Desktop Grid */}
      {searchResults.length === 0 ? (
        /* Empty State */
        <div className="p-8 rounded-2xl bg-surface border border-border/70 text-center space-y-3 shadow-xs">
          <div className="w-10 h-10 rounded-2xl bg-muted/60 border border-border flex items-center justify-center mx-auto text-muted-foreground">
            <Icon name="Search" className="w-5 h-5 text-muted-foreground/80" />
          </div>
          <h3 className="text-xs font-bold text-foreground">Couldn't find an exact command.</h3>
          <p className="text-[11px] text-muted-foreground max-w-xs mx-auto">
            Try describing what you're trying to accomplish in plain words (e.g. "check docker disk usage", "undo last commit").
          </p>
          <div className="flex items-center justify-center gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setQuery('docker')}
              className="h-7 text-xs font-mono"
            >
              Browse Docker Commands
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setQuery('git')}
              className="h-7 text-xs font-mono"
            >
              Browse Git Commands
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Results List Column (Lg: 7 cols) */}
          <div className="lg:col-span-7 space-y-3">
            <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
              <span>Found {searchResults.length} relevant commands</span>
              {query && <span>Sorted by intent score</span>}
            </div>

            <div className="space-y-2.5">
              {searchResults.map(({ command }) => {
                const isSelected = selectedCommand?.id === command.id;
                const isFav = isFavorite(command.id);
                const copyKey = `list-cmd-${command.id}`;
                const isCopied = !!copiedKeyMap[copyKey];

                return (
                  <div
                    key={command.id}
                    onClick={() => setSelectedCommandId(command.id)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer space-y-2.5 ${
                      isSelected
                        ? 'bg-primary/10 border-primary shadow-sm'
                        : 'bg-background/60 border-border/60 hover:border-primary/40 hover:bg-background'
                    }`}
                  >
                    {/* Command Card Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center space-x-2">
                          <span
                            className={`text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded border ${
                              command.riskLevel === 'dangerous'
                                ? 'bg-destructive/10 text-destructive border-destructive/20'
                                : command.riskLevel === 'caution'
                                ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            }`}
                          >
                            {command.riskLevel || 'safe'}
                          </span>
                          <h3 className="text-xs font-bold text-foreground leading-snug">
                            {command.title}
                          </h3>
                        </div>
                        <p className="text-[11px] text-muted-foreground line-clamp-1">
                          {command.description}
                        </p>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(command.id);
                        }}
                        className={`p-1 rounded-lg transition-colors ${
                          isFav ? 'text-amber-400' : 'text-muted-foreground hover:text-foreground'
                        }`}
                        title={isFav ? 'Remove Favorite' : 'Add Favorite'}
                      >
                        <Icon name="Star" className={`w-3.5 h-3.5 ${isFav ? 'fill-current' : ''}`} />
                      </button>
                    </div>

                    {/* Monospace Command Block */}
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-card border border-border/80 text-xs font-mono text-emerald-400 shadow-inner">
                      <div className="flex items-center space-x-1.5 truncate pr-2">
                        <span className="text-muted-foreground select-none">$</span>
                        <span className="truncate">{command.command}</span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopy(command.command, copyKey);
                        }}
                        className="px-2 py-0.5 rounded bg-muted/60 text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0 flex items-center space-x-1 cursor-pointer font-mono"
                      >
                        <Icon name={isCopied ? 'Check' : 'Copy'} className="w-3 h-3" />
                        <span>{isCopied ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>

                    {/* Card Actions */}
                    <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground pt-1 border-t border-border/40">
                      <span className="uppercase text-[10px]">
                        {command.categoryId} · {command.difficulty}
                      </span>
                      {command.relatedArticleIds && command.relatedArticleIds.length > 0 && onOpenGuideArticle && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenGuideArticle(command.relatedArticleIds![0]);
                          }}
                          className="text-primary hover:underline flex items-center space-x-1 font-semibold"
                        >
                          <span>Open Guide</span>
                          <Icon name="ArrowRight" className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected Command Details Side Panel (Lg: 5 cols) */}
          {selectedCommand && (
            <div className="lg:col-span-5 p-4 rounded-2xl bg-card border border-border/80 space-y-4 sticky top-6 shadow-sm">
              <div className="flex items-center justify-between border-b border-border/50 pb-2">
                <span className="text-xs font-mono font-bold uppercase text-primary">
                  Command Details
                </span>
                <span
                  className={`text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded border ${
                    selectedCommand.riskLevel === 'dangerous'
                      ? 'bg-destructive/10 text-destructive border-destructive/20'
                      : selectedCommand.riskLevel === 'caution'
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  }`}
                >
                  {selectedCommand.riskLevel || 'safe'}
                </span>
              </div>

              <div className="space-y-1">
                <h3 className="text-sm font-bold text-foreground">{selectedCommand.title}</h3>
                <p className="text-xs text-muted-foreground">{selectedCommand.description}</p>
              </div>

              {/* Command Code Display */}
              <div className="space-y-1.5">
                <div className="text-[10px] font-mono text-muted-foreground uppercase font-bold">
                  Command Syntax
                </div>
                <div className="p-3 rounded-xl bg-background border border-border/80 text-xs font-mono text-emerald-400 flex items-center justify-between">
                  <span className="truncate pr-2">$ {selectedCommand.command}</span>
                  <button
                    onClick={() => handleCopy(selectedCommand.command, 'detail-cmd')}
                    className="px-2 py-1 rounded bg-muted/60 text-[10px] text-muted-foreground hover:text-foreground font-mono flex items-center space-x-1"
                  >
                    <Icon name={copiedKeyMap['detail-cmd'] ? 'Check' : 'Copy'} className="w-3 h-3" />
                    <span>{copiedKeyMap['detail-cmd'] ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              {/* What it does & When to use it */}
              {selectedCommand.explanation && (
                <div className="space-y-1 p-3 rounded-xl bg-background/60 border border-border/60 text-xs">
                  <div className="font-mono text-[10px] font-bold text-primary uppercase">
                    What it does
                  </div>
                  <p className="text-muted-foreground leading-relaxed">
                    {selectedCommand.explanation}
                  </p>
                </div>
              )}

              {/* Expected Output */}
              {selectedCommand.expectedOutput && (
                <div className="space-y-1.5">
                  <div className="text-[10px] font-mono text-amber-400 font-bold uppercase">
                    Expected Output
                  </div>
                  <pre className="p-3 rounded-xl bg-background border border-border/80 text-[11px] font-mono text-muted-foreground overflow-x-auto">
                    {selectedCommand.expectedOutput}
                  </pre>
                </div>
              )}

              {/* Warnings */}
              {selectedCommand.warnings && selectedCommand.warnings.length > 0 && (
                <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 space-y-1 text-xs">
                  <div className="font-mono font-bold text-destructive flex items-center space-x-1">
                    <Icon name="AlertTriangle" className="w-3.5 h-3.5 text-destructive" />
                    <span>Safety Warning</span>
                  </div>
                  {selectedCommand.warnings.map((w, idx) => (
                    <p key={idx} className="text-muted-foreground">
                      {w}
                    </p>
                  ))}
                </div>
              )}

              {/* Related Guide Article Link */}
              {selectedCommand.relatedArticleIds &&
                selectedCommand.relatedArticleIds.length > 0 &&
                onOpenGuideArticle && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => onOpenGuideArticle(selectedCommand.relatedArticleIds![0])}
                    className="w-full h-8 text-xs font-mono bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <span>Read Related Documentation Guide</span>
                    <Icon name="ArrowRight" className="w-3.5 h-3.5 ml-2" />
                  </Button>
                )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
