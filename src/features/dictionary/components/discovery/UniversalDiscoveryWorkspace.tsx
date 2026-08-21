import { useState, useEffect, useRef, useMemo } from 'react';
import { Icon } from '@/shared/components/ui/Icon';
import {
  searchDeveloperKnowledge,
  DiscoveryResultItem,
  DiscoveryItemType,
} from '../../services/developerDiscovery';
import { DeveloperIntentType } from '../../domain/entities/DeveloperContext';

interface UniversalDiscoveryWorkspaceProps {
  onSelectArticle: (articleId: string) => void;
  onSelectIntentMode?: (intent: DeveloperIntentType) => void;
  onSelectCategory?: (catId: string) => void;
  activeCategoryContext?: string | null;
}

const POPULAR_TOPICS = [
  { id: 'git', label: 'Git', query: 'undo last commit' },
  { id: 'docker', label: 'Docker', query: 'docker container keeps restarting' },
  { id: 'linux', label: 'Linux', query: 'check disk usage' },
  { id: 'aws', label: 'AWS', query: 'deploy spring boot ec2' },
  { id: 'react', label: 'React', query: 'create react app' },
  { id: 'springboot', label: 'Spring Boot', query: 'spring boot port 8080' },
];

export function UniversalDiscoveryWorkspace({
  onSelectArticle,
  onSelectIntentMode,
  onSelectCategory,
  activeCategoryContext,
}: UniversalDiscoveryWorkspaceProps) {
  const [query, setQuery] = useState('');
  const [activeIntentFilter, setActiveIntentFilter] = useState<DeveloperIntentType | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [isFocused, setIsFocused] = useState<boolean>(false);

  const inputRef = useRef<HTMLInputElement>(null);

  // Search Engine query execution
  const { bestMatch, results, suggestions } = useMemo(() => {
    return searchDeveloperKnowledge(query, activeIntentFilter, activeCategoryContext);
  }, [query, activeIntentFilter, activeCategoryContext]);

  const allDisplayItems = useMemo(() => {
    const list: DiscoveryResultItem[] = [];
    if (bestMatch) list.push(bestMatch);
    if (results) list.push(...results);
    return list;
  }, [bestMatch, results]);

  // Global Keyboard listener for Ctrl + K, '/', ArrowUp, ArrowDown, Enter, Esc
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl + K or '/' to focus input
      if (
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') ||
        (e.key === '/' && document.activeElement !== inputRef.current)
      ) {
        e.preventDefault();
        inputRef.current?.focus();
        return;
      }

      if (document.activeElement === inputRef.current) {
        if (e.key === 'Escape') {
          setQuery('');
          setSelectedIndex(-1);
          inputRef.current?.blur();
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, allDisplayItems.length - 1));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, -1));
        } else if (e.key === 'Enter' && selectedIndex >= 0 && allDisplayItems[selectedIndex]) {
          e.preventDefault();
          handleExecuteItemAction(allDisplayItems[selectedIndex]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [allDisplayItems, selectedIndex]);

  const handleCopy = (code: string, key: string) => {
    navigator.clipboard.writeText(code);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleExecuteItemAction = (item: DiscoveryResultItem) => {
    if (item.actionType === 'copy' && item.codeSnippet) {
      handleCopy(item.codeSnippet, item.id);
    } else if (item.actionType === 'open_article') {
      onSelectArticle(item.targetId);
    } else if (item.actionType === 'start_workflow' && onSelectIntentMode) {
      onSelectIntentMode('DO');
    } else if (item.actionType === 'diagnose' && onSelectIntentMode) {
      onSelectIntentMode('FIX');
    }
  };

  const getTypeBadge = (type: DiscoveryItemType) => {
    switch (type) {
      case 'command':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-primary/10 text-primary border border-primary/20">COMMAND</span>;
      case 'article':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">GUIDE</span>;
      case 'workflow':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">WORKFLOW</span>;
      case 'fix':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">ERROR FIX</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-muted text-muted-foreground border border-border">KNOWLEDGE</span>;
    }
  };

  return (
    <div className="space-y-4">
      {/* HERO DISCOVERY HEADER & SEARCH INPUT */}
      <div className="p-5 sm:p-6 rounded-2xl bg-card border border-border/80 space-y-4 shadow-sm relative">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="space-y-0.5">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-primary/10 text-primary border border-primary/20">
              <Icon name="Sparkles" className="w-3 h-3 text-primary" />
              <span>INTELLIGENT KNOWLEDGE DISCOVERY WORKSPACE</span>
            </div>
            <h1 className="text-lg sm:text-xl font-bold text-foreground tracking-tight pt-0.5">
              What are you trying to accomplish?
            </h1>
          </div>

          {/* Lightweight Intent Filters: DO / FIND / LEARN / FIX */}
          <div className="flex items-center space-x-1 bg-background/90 p-1 rounded-xl border border-border/70 text-xs font-mono">
            <button
              type="button"
              onClick={() => {
                const next = activeIntentFilter === 'DO' ? null : 'DO';
                setActiveIntentFilter(next);
                if (onSelectIntentMode && next) onSelectIntentMode('DO');
              }}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center space-x-1 ${
                activeIntentFilter === 'DO'
                  ? 'bg-emerald-500 text-emerald-950 font-bold shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>⚡ DO</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const next = activeIntentFilter === 'FIND' ? null : 'FIND';
                setActiveIntentFilter(next);
                if (onSelectIntentMode && next) onSelectIntentMode('FIND');
              }}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center space-x-1 ${
                activeIntentFilter === 'FIND'
                  ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>🔍 FIND</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const next = activeIntentFilter === 'LEARN' ? null : 'LEARN';
                setActiveIntentFilter(next);
                if (onSelectIntentMode && next) onSelectIntentMode('LEARN');
              }}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center space-x-1 ${
                activeIntentFilter === 'LEARN'
                  ? 'bg-purple-500 text-purple-950 font-bold shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>📖 LEARN</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const next = activeIntentFilter === 'FIX' ? null : 'FIX';
                setActiveIntentFilter(next);
                if (onSelectIntentMode && next) onSelectIntentMode('FIX');
              }}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center space-x-1 ${
                activeIntentFilter === 'FIX'
                  ? 'bg-amber-500 text-amber-950 font-bold shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <span>🛠 FIX</span>
            </button>
          </div>
        </div>

        {/* Primary Universal Search Bar */}
        <div className="relative">
          <Icon
            name="Search"
            className="w-4.5 h-4.5 absolute left-4 top-1/2 -translate-y-1/2 text-primary"
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setTimeout(() => setIsFocused(false), 200)}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(-1);
            }}
            placeholder="Search commands, guides, workflows, fixes (e.g. undo last commit, docker port conflict, create react app)..."
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

          {/* LIVE AUTOCOMPLETE SUGGESTIONS DROPDOWN */}
          {isFocused && query.trim() && suggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1.5 p-2 rounded-xl bg-card border border-border/80 shadow-xl z-30 space-y-1 animate-in fade-in duration-100">
              <div className="text-[10px] font-mono font-bold uppercase text-muted-foreground px-2 py-0.5">
                Suggested Matches
              </div>
              {suggestions.map((sugg, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setQuery(sugg)}
                  className="w-full text-left px-3 py-1.5 rounded-lg text-xs font-mono text-foreground hover:bg-primary/10 hover:text-primary transition-colors flex items-center justify-between cursor-pointer"
                >
                  <span>{sugg}</span>
                  <Icon name="ArrowRight" className="w-3 h-3 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ZERO QUERY STATE: POPULAR TOPIC CHIPS */}
        {!query.trim() && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none pt-1">
            <span className="text-[11px] font-mono text-muted-foreground shrink-0 mr-1">Popular Topics:</span>
            {POPULAR_TOPICS.map((topic) => (
              <button
                key={topic.id}
                type="button"
                onClick={() => {
                  setQuery(topic.query);
                  if (onSelectCategory) onSelectCategory(topic.id);
                }}
                className="px-3 py-1 rounded-xl bg-muted/60 hover:bg-primary/10 hover:border-primary/30 border border-border/60 text-xs font-mono text-foreground transition-all cursor-pointer shrink-0 flex items-center space-x-1"
              >
                <span className="text-primary">•</span>
                <span>{topic.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* DISCOVERY RANKED RESULTS DISPLAY */}
      {query.trim() && (
        <div className="space-y-4 animate-in fade-in duration-150">
          {/* BEST MATCH SECTION */}
          {bestMatch && (
            <div className="space-y-2">
              <div className="text-xs font-mono font-bold text-primary uppercase tracking-wider flex items-center space-x-1.5">
                <Icon name="Sparkles" className="w-3.5 h-3.5 text-primary animate-pulse" />
                <span>BEST MATCH</span>
              </div>

              <div className="p-4 sm:p-5 rounded-2xl bg-card border-2 border-primary/40 space-y-3 shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                      {getTypeBadge(bestMatch.type)}
                      <span className="text-[10px] font-mono text-muted-foreground uppercase">
                        {bestMatch.category}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-foreground tracking-tight pt-0.5">
                      {bestMatch.title}
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleExecuteItemAction(bestMatch)}
                    className="px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold transition-all cursor-pointer flex items-center space-x-1.5 shrink-0 shadow-xs"
                  >
                    <Icon
                      name={
                        bestMatch.actionType === 'copy'
                          ? copiedKey === bestMatch.id
                            ? 'Check'
                            : 'Copy'
                          : 'ArrowRight'
                      }
                      className="w-3.5 h-3.5"
                    />
                    <span>
                      {bestMatch.actionType === 'copy'
                        ? copiedKey === bestMatch.id
                          ? 'Copied!'
                          : 'Copy Command'
                        : bestMatch.actionType === 'open_article'
                        ? 'Open Guide'
                        : bestMatch.actionType === 'start_workflow'
                        ? 'Start Workflow'
                        : 'Diagnose Fix'}
                    </span>
                  </button>
                </div>

                {/* Code Snippet Box */}
                {bestMatch.codeSnippet && (
                  <div className="p-3 rounded-xl bg-background border border-border/80 font-mono text-xs text-emerald-400 overflow-x-auto flex items-center justify-between">
                    <code className="select-all">$ {bestMatch.codeSnippet}</code>
                  </div>
                )}

                <p className="text-xs text-muted-foreground leading-relaxed">
                  {bestMatch.description}
                </p>
              </div>
            </div>
          )}

          {/* RELATED RESULTS LIST */}
          {results.length > 0 && (
            <div className="space-y-2 pt-2">
              <div className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-wider">
                RELATED KNOWLEDGE ({results.length})
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {results.map((item, idx) => {
                  const isFocusedItem = selectedIndex === idx + (bestMatch ? 1 : 0);
                  const isCopied = copiedKey === item.id;

                  return (
                    <div
                      key={item.id}
                      onClick={() => handleExecuteItemAction(item)}
                      className={`p-3.5 rounded-xl bg-card border transition-all cursor-pointer space-y-2 ${
                        isFocusedItem
                          ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
                          : 'border-border/70 hover:border-primary/40'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center space-x-2">
                            {getTypeBadge(item.type)}
                            <span className="text-[10px] font-mono text-muted-foreground truncate uppercase">
                              {item.category}
                            </span>
                          </div>
                          <h4 className="text-xs font-bold text-foreground tracking-tight truncate pt-0.5">
                            {item.title}
                          </h4>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleExecuteItemAction(item);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-muted/60 hover:bg-muted text-[11px] font-mono text-foreground transition-all cursor-pointer shrink-0"
                        >
                          {item.actionType === 'copy' ? (isCopied ? 'Copied' : 'Copy') : 'Open'}
                        </button>
                      </div>

                      {item.codeSnippet && (
                        <div className="p-2 rounded bg-background border border-border/70 font-mono text-[11px] text-emerald-400 truncate">
                          $ {item.codeSnippet}
                        </div>
                      )}

                      <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* NO RESULTS STATE */}
          {!bestMatch && results.length === 0 && (
            <div className="p-8 rounded-2xl bg-card border border-border/60 text-center space-y-3">
              <Icon name="SearchX" className="w-8 h-8 text-muted-foreground/60 mx-auto" />
              <div className="space-y-1 max-w-sm mx-auto">
                <h4 className="text-xs font-bold font-mono text-foreground">No matching knowledge found</h4>
                <p className="text-xs text-muted-foreground font-mono">
                  No matching results for "{query}". Try checking your spelling or trying one of the popular topics below.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
