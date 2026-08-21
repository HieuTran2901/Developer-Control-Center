import { useState, useMemo, useCallback } from 'react';
import { DEV_COMMANDS } from '../data/devCommands';
import { DevCommand } from '../domain/entities/DevCommand';
import { searchCommands, getCommandSuggestions } from '../utils/commandSearch';

const HISTORY_KEY = 'dcc_dictionary_command_history';
const FAVORITES_KEY = 'dcc_dictionary_command_favorites';

export function useCommandFinder() {
  const [query, setQuery] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [selectedCommandId, setSelectedCommandId] = useState<string | null>(null);

  // Recent Searches History
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(HISTORY_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed.slice(0, 10);
      }
    } catch (e) {
      console.warn('Failed to parse command history from localStorage', e);
    }
    return [
      'check docker disk usage',
      'find process using port 8080',
      'undo last git commit',
      'view docker logs',
    ];
  });

  // Favorite Command IDs
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(FAVORITES_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('Failed to parse command favorites from localStorage', e);
    }
    return ['cmd-docker-system-df', 'cmd-git-reset-soft', 'cmd-linux-lsof-port'];
  });

  // Add search query to history
  const addRecentSearch = useCallback((rawQuery: string) => {
    const trimmed = rawQuery.trim();
    if (!trimmed || trimmed.length < 2) return;

    setRecentSearches((prev) => {
      const filtered = prev.filter((q) => q.toLowerCase() !== trimmed.toLowerCase());
      const updated = [trimmed, ...filtered].slice(0, 10);
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
      } catch {
        // Ignore storage write errors
      }
      return updated;
    });
  }, []);

  // Toggle favorite command
  const toggleFavorite = useCallback((commandId: string) => {
    if (!commandId) return;

    setFavoriteIds((prev) => {
      const isAlready = prev.includes(commandId);
      const updated = isAlready ? prev.filter((id) => id !== commandId) : [...prev, commandId];
      try {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
      } catch {
        // Ignore storage write errors
      }
      return updated;
    });
  }, []);

  // Intent search results
  const searchResults = useMemo(() => {
    return searchCommands(query, DEV_COMMANDS, selectedCategoryId);
  }, [query, selectedCategoryId]);

  // Suggestions for auto-complete
  const suggestions = useMemo(() => {
    return getCommandSuggestions(query, DEV_COMMANDS);
  }, [query]);

  // Selected command entity
  const selectedCommand: DevCommand | null = useMemo(() => {
    if (!selectedCommandId) {
      return searchResults[0]?.command || DEV_COMMANDS[0] || null;
    }
    return DEV_COMMANDS.find((c) => c.id === selectedCommandId) || null;
  }, [selectedCommandId, searchResults]);

  return {
    query,
    setQuery,
    selectedCategoryId,
    setSelectedCategoryId,
    selectedCommandId,
    setSelectedCommandId,
    selectedCommand,
    searchResults,
    suggestions,
    recentSearches,
    addRecentSearch,
    favoriteIds,
    toggleFavorite,
    isFavorite: (id: string) => favoriteIds.includes(id),
  };
}
