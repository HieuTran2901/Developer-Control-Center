import { Icon } from '@/shared/components/ui/Icon';
import { ContextualToolType } from './ContextualToolsDrawer';

interface ContextualToolbarProps {
  activeTopicId?: string;
  onOpenTool: (tool: ContextualToolType) => void;
  onQuickCommandCopy?: (command: string) => void;
}

const TOPIC_SUGGESTIONS: Record<string, { label: string; cmd: string }[]> = {
  docker: [
    { label: 'docker ps', cmd: 'docker ps' },
    { label: 'docker logs', cmd: 'docker logs -f <container>' },
    { label: 'docker prune', cmd: 'docker system prune -a' },
  ],
  git: [
    { label: 'git status', cmd: 'git status' },
    { label: 'git undo', cmd: 'git reset --soft HEAD~1' },
    { label: 'git log', cmd: 'git log --oneline --graph' },
  ],
  aws: [
    { label: 'aws caller-id', cmd: 'aws sts get-caller-identity' },
    { label: 's3 ls', cmd: 'aws s3 ls' },
    { label: 'ec2 status', cmd: 'aws ec2 describe-instances' },
  ],
  linux: [
    { label: 'free -h', cmd: 'free -h' },
    { label: 'du -sh', cmd: 'du -sh * | sort -rh | head -n 5' },
    { label: 'lsof :8080', cmd: 'lsof -i :8080' },
  ],
  react: [
    { label: 'vite create', cmd: 'npm create vite@latest' },
    { label: 'npm dev', cmd: 'npm run dev' },
    { label: 'npm build', cmd: 'npm run build' },
  ],
};

export function ContextualToolbar({
  activeTopicId = 'docker',
  onOpenTool,
  onQuickCommandCopy,
}: ContextualToolbarProps) {
  const suggestions = TOPIC_SUGGESTIONS[activeTopicId.toLowerCase()] || TOPIC_SUGGESTIONS['docker'];

  return (
    <div className="p-3 rounded-2xl bg-card border border-border/80 flex flex-wrap items-center justify-between gap-2.5 shadow-xs select-none">
      {/* Contextual Tools Buttons */}
      <div className="flex items-center space-x-1.5 overflow-x-auto">
        <span className="text-[11px] font-mono text-muted-foreground mr-1 flex items-center space-x-1">
          <Icon name="Wrench" className="w-3.5 h-3.5 text-primary" />
          <span>Tools:</span>
        </span>

        <button
          type="button"
          onClick={() => onOpenTool('COMMANDS')}
          className="px-2.5 py-1 rounded-lg bg-background border border-border/60 hover:border-primary/50 text-xs font-mono text-foreground hover:text-primary transition-all flex items-center space-x-1 cursor-pointer"
        >
          <span>⚡ Commands</span>
        </button>

        <button
          type="button"
          onClick={() => onOpenTool('GRAPH')}
          className="px-2.5 py-1 rounded-lg bg-background border border-border/60 hover:border-purple-500/50 text-xs font-mono text-foreground hover:text-purple-400 transition-all flex items-center space-x-1 cursor-pointer"
        >
          <span>🧠 Concepts</span>
        </button>

        <button
          type="button"
          onClick={() => onOpenTool('FIX')}
          className="px-2.5 py-1 rounded-lg bg-background border border-border/60 hover:border-amber-500/50 text-xs font-mono text-foreground hover:text-amber-400 transition-all flex items-center space-x-1 cursor-pointer"
        >
          <span>🚨 Troubleshoot</span>
        </button>

        <button
          type="button"
          onClick={() => onOpenTool('PRODUCTION')}
          className="px-2.5 py-1 rounded-lg bg-background border border-border/60 hover:border-emerald-500/50 text-xs font-mono text-foreground hover:text-emerald-400 transition-all flex items-center space-x-1 cursor-pointer"
        >
          <span>🛡️ Readiness</span>
        </button>
      </div>

      {/* Topic-Aware Suggestions */}
      {suggestions && suggestions.length > 0 && (
        <div className="flex items-center space-x-1.5 font-mono text-[11px]">
          <span className="text-muted-foreground hidden sm:inline">Quick {activeTopicId}:</span>
          {suggestions.map((s, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(s.cmd);
                onQuickCommandCopy?.(s.cmd);
              }}
              className="px-2 py-0.5 rounded bg-background border border-border/50 hover:border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 transition-colors cursor-pointer"
              title={`Copy "${s.cmd}"`}
            >
              $ {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
