import { DEV_COMMANDS } from '../data/devCommands';
import { MOCK_ARTICLES } from '../data/mockDictionaryData';
import { GUIDE_TASKS } from '../data/guideTasks';
import { GUIDE_WORKFLOWS } from '../data/guideWorkflows';
import { DeveloperIntentType } from '../domain/entities/DeveloperContext';
import { ErrorSolutionItem } from '../components/knowledge/TroubleshootingAssistant';

export type DiscoveryItemType = 'command' | 'article' | 'workflow' | 'task' | 'fix';

export interface DiscoveryResultItem {
  id: string;
  type: DiscoveryItemType;
  title: string;
  subtitle?: string;
  description: string;
  codeSnippet?: string;
  category: string;
  subcategory?: string;
  tags: string[];
  score: number;
  matchedBy: string[];
  targetId: string;
  riskLevel?: string;
  difficulty?: string;
  actionType: 'copy' | 'open_article' | 'start_workflow' | 'diagnose';
  relatedItemIds?: { type: DiscoveryItemType; id: string; title: string }[];
}

const COMMON_ERROR_SOLUTIONS: ErrorSolutionItem[] = [
  {
    id: 'err-port-8080',
    errorCode: 'EADDRINUSE / Bind 0.0.0.0:8080 failed',
    title: 'Port 8080 Is Already Allocated By Another Process',
    technology: 'Docker / Linux / Node.js',
    whyExplanation: 'Port 8080 on your host machine is already bound by another background application or running container.',
    diagnosticCommand: 'lsof -i :8080',
    fixCommand: 'kill -9 <PID>   # OR run on another port: docker run -p 8081:80 nginx',
    expectedFixOutput: 'Process terminated or container started successfully on port 8081.',
    safetyCheck: 'Ensure the process using port 8080 is not a critical system service before executing kill -9.',
  },
  {
    id: 'err-docker-exit-137',
    errorCode: 'Docker Container Exited With Code 137',
    title: 'Container Terminated Due To Out-Of-Memory (OOM Killed)',
    technology: 'Docker / Linux',
    whyExplanation: 'The Linux kernel OOM Killer forcibly terminated the container process because it exceeded the assigned RAM memory limit.',
    diagnosticCommand: 'docker inspect <container_id> --format="{{.State.OOMKilled}}"',
    fixCommand: 'docker run -m 2g --memory-swap 2g <image>',
    expectedFixOutput: 'true (OOMKilled confirmed) -> Container re-launched with 2GB RAM budget limit.',
    safetyCheck: 'Allocate sufficient RAM limits (-m) based on your host RAM capacity.',
  },
  {
    id: 'err-git-conflict',
    errorCode: 'Automatic Merge Failed; Fix Conflicts And Commit',
    title: 'Git Merge Conflict In File',
    technology: 'Git',
    whyExplanation: 'Both branches modified the exact same lines of code in a file and Git cannot auto-merge safely.',
    diagnosticCommand: 'git status',
    fixCommand: 'git status   # Edit conflicted files, then: git add . && git commit -m "fix: resolve merge conflicts"',
    expectedFixOutput: '[main a1b2c3d] fix: resolve merge conflicts',
    safetyCheck: 'Review <<<<<<< HEAD markers carefully before committing resolved files.',
  },
  {
    id: 'err-ec2-connection-refused',
    errorCode: 'ssh: connect to host ec2-instance port 22: Connection refused / Timeout',
    title: 'AWS EC2 SSH Connection Refused Or Timed Out',
    technology: 'AWS EC2 / SSH',
    whyExplanation: 'Port 22 SSH inbound rule is missing in EC2 Security Group OR SSH daemon service is stopped.',
    diagnosticCommand: 'aws ec2 describe-security-groups --group-ids sg-xxxx',
    fixCommand: 'aws ec2 authorize-security-group-ingress --group-id sg-xxxx --protocol tcp --port 22 --cidr <your_ip>/32',
    expectedFixOutput: 'Inbound rule added to Security Group sg-xxxx for port 22.',
    safetyCheck: 'Never expose port 22 to 0.0.0.0/0 on production instances; restrict to your IP.',
  },
  {
    id: 'err-linux-disk-full',
    errorCode: 'No space left on device',
    title: 'Linux File System Storage Disk Full',
    technology: 'Linux / Storage',
    whyExplanation: 'Root disk filesystem partitions (/ or /var/log) have reached 100% disk usage capacity.',
    diagnosticCommand: 'du -ah /var/log | sort -rh | head -n 10',
    fixCommand: 'docker system prune -a --volumes   # OR delete old logs: journalctl --vacuum-time=3d',
    expectedFixOutput: 'Total reclaimed space: 12.4GB. Root disk usage reduced below 80%.',
    safetyCheck: 'Verify no persistent database data volume is located in pruned directories.',
  },
];

const SYNONYM_MAP: Record<string, string[]> = {
  undo: ['undo', 'rollback', 'revert', 'reset', 'recover', 'restore', 'hoàn tác', 'quay lại'],
  disk: ['disk', 'storage', 'space', 'filesystem', 'no space', 'du', 'df', 'dung lượng', 'bộ nhớ', 'ổ đĩa'],
  restart: ['restart', 'restarting', 'crash', 'crashing', 'oom', 'exit 137', 'loop', 'khởi động lại'],
  port: ['port', 'eaddrinuse', '8080', 'lsof', 'bind', 'allocate', 'cổng'],
  deploy: ['deploy', 'deployment', 'ec2', 'ssh', 'aws', 'server', 'spring boot', 'triển khai'],
  react: ['react', 'hooks', 'usestate', 'state', 'vite', 'component'],
  docker: ['docker', 'container', 'image', 'volume', 'compose', 'prune', 'logs'],
  git: ['git', 'commit', 'branch', 'merge', 'checkout', 'rebase', 'reflog'],
  process: ['process', 'kill', 'ps', 'lsof', 'tiến trình'],
};

// Flatten all sources into unified search items
function getUnifiedItems(): DiscoveryResultItem[] {
  const items: DiscoveryResultItem[] = [];

  // 1. Commands
  DEV_COMMANDS.forEach((cmd) => {
    items.push({
      id: `cmd-${cmd.id}`,
      type: 'command',
      title: cmd.title,
      subtitle: cmd.command,
      description: cmd.description,
      codeSnippet: cmd.command,
      category: cmd.categoryId,
      subcategory: cmd.subcategoryId,
      tags: cmd.tags || [],
      score: 0,
      matchedBy: [],
      targetId: cmd.id,
      riskLevel: cmd.riskLevel,
      difficulty: cmd.difficulty,
      actionType: 'copy',
      relatedItemIds: (cmd.relatedArticleIds || []).map((artId) => ({
        type: 'article',
        id: artId,
        title: 'Guide Documentation',
      })),
    });
  });

  // 2. Guide Articles
  MOCK_ARTICLES.forEach((art) => {
    items.push({
      id: `art-${art.id}`,
      type: 'article',
      title: art.title,
      subtitle: `${art.categoryId.toUpperCase()} Guide`,
      description: art.summary,
      category: art.categoryId,
      subcategory: art.subcategoryId,
      tags: art.tags || [],
      score: 0,
      matchedBy: [],
      targetId: art.id,
      difficulty: art.difficulty,
      actionType: 'open_article',
    });
  });

  // 3. Workflows
  Object.values(GUIDE_WORKFLOWS).forEach((wf) => {
    items.push({
      id: `wf-${wf.id}`,
      type: 'workflow',
      title: wf.title,
      subtitle: `Guided Workflow (${wf.estimatedMinutes || 10}m)`,
      description: wf.description,
      category: 'workflow',
      tags: wf.outcomes || ['workflow', 'guided-task'],
      score: 0,
      matchedBy: [],
      targetId: wf.id,
      actionType: 'start_workflow',
    });
  });

  // 4. Tasks
  Object.values(GUIDE_TASKS).forEach((task) => {
    const mainCat = task.categoryIds?.[0] || 'general';
    items.push({
      id: `task-${task.id}`,
      type: 'task',
      title: task.title,
      subtitle: `${mainCat.toUpperCase()} Task`,
      description: task.description,
      category: mainCat,
      tags: task.tags || [],
      score: 0,
      matchedBy: [],
      targetId: task.id,
      actionType: 'copy',
    });
  });

  // 5. Troubleshooting Solutions
  COMMON_ERROR_SOLUTIONS.forEach((err) => {
    items.push({
      id: `err-${err.id}`,
      type: 'fix',
      title: err.title,
      subtitle: `${err.technology} Error (${err.errorCode})`,
      description: err.whyExplanation,
      codeSnippet: err.fixCommand,
      category: err.technology.toLowerCase().includes('docker')
        ? 'docker'
        : err.technology.toLowerCase().includes('git')
        ? 'git'
        : err.technology.toLowerCase().includes('aws')
        ? 'aws'
        : 'linux',
      tags: [err.errorCode, err.technology, 'troubleshooting', 'error', 'fix'],
      score: 0,
      matchedBy: [],
      targetId: err.id,
      actionType: 'diagnose',
    });
  });

  return items;
}

export function searchDeveloperKnowledge(
  query: string,
  activeIntent?: DeveloperIntentType | null,
  activeCategoryContext?: string | null
): {
  bestMatch: DiscoveryResultItem | null;
  results: DiscoveryResultItem[];
  suggestions: string[];
} {
  const rawQuery = query.trim().toLowerCase();
  const allItems = getUnifiedItems();

  if (!rawQuery) {
    return {
      bestMatch: null,
      results: [],
      suggestions: [
        'undo last git commit',
        'docker container keeps restarting',
        'create react app with vite',
        'deploy spring boot to aws ec2',
        'check disk usage on linux',
        'find process on port 8080',
      ],
    };
  }

  // Tokenize & expand synonyms
  const queryTokens = rawQuery.split(/\s+/);
  const expandedTokens = new Set<string>(queryTokens);

  Object.values(SYNONYM_MAP).forEach((synGroup) => {
    if (synGroup.some((syn) => rawQuery.includes(syn))) {
      synGroup.forEach((term) => expandedTokens.add(term));
    }
  });

  const scoredItems = allItems
    .map((item) => {
      let score = 0;
      const matchedBy: string[] = [];

      const titleLower = item.title.toLowerCase();
      const codeLower = (item.codeSnippet || '').toLowerCase();
      const descLower = item.description.toLowerCase();
      const catLower = item.category.toLowerCase();
      const subLower = (item.subcategory || '').toLowerCase();
      const tagsLower = item.tags.map((t) => t.toLowerCase()).join(' ');

      // 1. Exact match on title or code
      if (titleLower === rawQuery) {
        score += 100;
        matchedBy.push('exact_title');
      } else if (titleLower.includes(rawQuery)) {
        score += 70;
        matchedBy.push('title_match');
      }

      if (codeLower && codeLower.includes(rawQuery)) {
        score += 90;
        matchedBy.push('command_match');
      }

      // 2. Token matches
      Array.from(expandedTokens).forEach((token) => {
        if (!token) return;

        if (titleLower.includes(token)) {
          score += 25;
        }
        if (codeLower.includes(token)) {
          score += 30;
        }
        if (tagsLower.includes(token)) {
          score += 20;
        }
        if (catLower.includes(token)) {
          score += 15;
        }
        if (subLower.includes(token)) {
          score += 15;
        }
        if (descLower.includes(token)) {
          score += 10;
        }
      });

      // 3. Intent Filter Boost
      if (activeIntent) {
        if (activeIntent === 'FIND' && item.type === 'command') {
          score += 35;
        } else if (activeIntent === 'LEARN' && item.type === 'article') {
          score += 35;
        } else if (activeIntent === 'FIX' && item.type === 'fix') {
          score += 35;
        } else if (activeIntent === 'DO' && (item.type === 'workflow' || item.type === 'task')) {
          score += 35;
        }
      }

      // 4. Category Context Boost
      if (activeCategoryContext && catLower === activeCategoryContext.toLowerCase()) {
        score += 25;
      }

      return { ...item, score, matchedBy };
    })
    .filter((item) => item.score > 15)
    .sort((a, b) => b.score - a.score);

  const bestMatch = scoredItems.length > 0 ? scoredItems[0] : null;
  const results = scoredItems.slice(bestMatch ? 1 : 0);

  // Dynamic Live Suggestions
  const suggestions = scoredItems.slice(0, 5).map((item) => item.title);

  return {
    bestMatch,
    results,
    suggestions,
  };
}
