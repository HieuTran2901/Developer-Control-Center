import { DevCommand } from '../domain/entities/DevCommand';

export interface CommandSearchResult {
  command: DevCommand;
  score: number;
  matchedField?: string;
}

/**
  * Normalize a search string by converting to lowercase and stripping accents / extra spaces.
  */
export function normalizeSearchQuery(query: string): string {
  return query
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
  * Calculate intent matching score for a single command against a normalized query string.
  */
export function calculateCommandScore(command: DevCommand, rawQuery: string): number {
  if (!rawQuery.trim()) return 0;

  const query = normalizeSearchQuery(rawQuery);
  const terms = query.split(/\s+/).filter(Boolean);

  let score = 0;

  const normalizedTitle = normalizeSearchQuery(command.title);
  const normalizedDesc = normalizeSearchQuery(command.description);
  const normalizedCommandText = normalizeSearchQuery(command.command);
  const normalizedCategory = normalizeSearchQuery(command.categoryId);
  const normalizedSubcategory = command.subcategoryId
    ? normalizeSearchQuery(command.subcategoryId)
    : '';

  // 1. Exact phrase match (+10)
  if (
    normalizedTitle.includes(query) ||
    normalizedCommandText.includes(query) ||
    command.useCases.some((uc) => normalizeSearchQuery(uc).includes(query))
  ) {
    score += 10;
  }

  // 2. Title match (+7)
  if (terms.some((term) => normalizedTitle.includes(term))) {
    score += 7;
  }

  // 3. UseCase match (+5)
  if (
    command.useCases.some((uc) => {
      const norm = normalizeSearchQuery(uc);
      return terms.some((term) => norm.includes(term));
    })
  ) {
    score += 5;
  }

  // 4. Tag match (+4)
  if (
    command.tags.some((tag) => {
      const norm = normalizeSearchQuery(tag);
      return terms.some((term) => norm.includes(term));
    })
  ) {
    score += 4;
  }

  // 5. Description match (+3)
  if (terms.some((term) => normalizedDesc.includes(term))) {
    score += 3;
  }

  // 6. Category match (+2)
  if (
    terms.some(
      (term) => normalizedCategory.includes(term) || normalizedSubcategory.includes(term)
    )
  ) {
    score += 2;
  }

  // 7. Command text match (+1)
  if (terms.some((term) => normalizedCommandText.includes(term))) {
    score += 1;
  }

  return score;
}

/**
  * Search commands with intent scoring strategy and rank by score descending.
  */
export function searchCommands(
  query: string,
  commands: DevCommand[],
  categoryIdFilter?: string
): CommandSearchResult[] {
  if (!query.trim() && !categoryIdFilter) {
    return commands.map((c) => ({ command: c, score: 1 }));
  }

  let filtered = commands;

  if (categoryIdFilter && categoryIdFilter !== 'all') {
    filtered = filtered.filter((c) => c.categoryId === categoryIdFilter);
  }

  if (!query.trim()) {
    return filtered.map((c) => ({ command: c, score: 1 }));
  }

  const results: CommandSearchResult[] = [];

  for (const cmd of filtered) {
    const score = calculateCommandScore(cmd, query);
    if (score > 0) {
      results.push({ command: cmd, score });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}

/**
  * Get quick auto-complete suggestions while typing (max 5 items).
  */
export function getCommandSuggestions(query: string, commands: DevCommand[]): DevCommand[] {
  if (!query.trim() || query.length < 2) return [];

  const results = searchCommands(query, commands);
  return results.slice(0, 5).map((r) => r.command);
}
