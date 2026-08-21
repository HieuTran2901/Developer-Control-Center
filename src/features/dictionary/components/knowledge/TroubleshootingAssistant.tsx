import { useState } from 'react';
import { Icon } from '@/shared/components/ui/Icon';
import { Button } from '@/shared/components/ui/button';

export interface ErrorSolutionItem {
  id: string;
  errorCode: string;
  title: string;
  technology: string;
  whyExplanation: string;
  diagnosticCommand: string;
  fixCommand: string;
  expectedFixOutput: string;
  safetyCheck: string;
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

interface TroubleshootingAssistantProps {
  onClose?: () => void;
}

export function TroubleshootingAssistant({
  onClose,
}: TroubleshootingAssistantProps) {
  const [selectedErrId, setSelectedErrId] = useState<string>(
    COMMON_ERROR_SOLUTIONS[0].id
  );
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const activeError =
    COMMON_ERROR_SOLUTIONS.find((e) => e.id === selectedErrId) ||
    COMMON_ERROR_SOLUTIONS[0];

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="p-5 rounded-2xl bg-card border border-amber-500/30 space-y-4 shadow-sm select-none">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 text-xs font-mono font-bold text-amber-400 uppercase">
          <Icon name="Wrench" className="w-4 h-4 text-amber-400" />
          <span>Troubleshooting Assistant (Intent D — FIX)</span>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-mono text-muted-foreground hover:text-foreground cursor-pointer"
          >
            ✕ Close
          </button>
        )}
      </div>

      {/* Error Category Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {COMMON_ERROR_SOLUTIONS.map((err) => {
          const isSelected = err.id === selectedErrId;

          return (
            <button
              key={err.id}
              type="button"
              onClick={() => setSelectedErrId(err.id)}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer space-y-1 ${
                isSelected
                  ? 'bg-amber-500/10 border-amber-500 shadow-xs text-foreground ring-1 ring-amber-500/30'
                  : 'bg-background/60 border-border/60 hover:border-amber-500/40 text-muted-foreground hover:text-foreground'
              }`}
            >
              <div className="text-[10px] font-mono text-amber-400 font-bold uppercase truncate">
                {err.technology}
              </div>
              <div className="text-xs font-bold font-mono text-foreground leading-tight truncate">
                {err.errorCode}
              </div>
            </button>
          );
        })}
      </div>

      {/* Inspected Error Solution Details */}
      {activeError && (
        <div className="p-4 sm:p-5 rounded-xl bg-background border border-amber-500/30 space-y-3.5 animate-in fade-in duration-150">
          <div className="space-y-1">
            <div className="text-xs font-mono text-amber-400 font-bold uppercase">
              {activeError.errorCode}
            </div>
            <h3 className="text-base font-bold text-foreground">{activeError.title}</h3>
          </div>

          {/* Why Explanation */}
          <div className="p-3 rounded-xl bg-card border border-border/60 space-y-1">
            <div className="text-[10px] font-mono font-bold uppercase text-primary">
              1. WHY DID IT FAIL?
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {activeError.whyExplanation}
            </p>
          </div>

          {/* How to Diagnose */}
          <div className="p-3 rounded-xl bg-card border border-border/60 space-y-1.5 font-mono">
            <div className="text-[10px] font-bold uppercase text-emerald-400">
              2. HOW TO DIAGNOSE
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-background border border-border/50 text-xs text-emerald-400">
              <span>$ {activeError.diagnosticCommand}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCopy(activeError.diagnosticCommand, 'diag')}
                className="h-6 px-2 text-[10px] font-mono text-emerald-400 hover:bg-emerald-500/10"
              >
                {copiedKey === 'diag' ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </div>

          {/* How to Fix */}
          <div className="p-3 rounded-xl bg-card border border-border/60 space-y-1.5 font-mono">
            <div className="text-[10px] font-bold uppercase text-primary">
              3. HOW TO FIX
            </div>
            <div className="flex items-center justify-between p-2 rounded bg-background border border-border/50 text-xs text-primary">
              <span className="truncate pr-2">$ {activeError.fixCommand}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCopy(activeError.fixCommand, 'fix')}
                className="h-6 px-2 text-[10px] font-mono text-primary hover:bg-primary/10 shrink-0"
              >
                {copiedKey === 'fix' ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </div>

          {/* Safety Check */}
          <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs text-muted-foreground flex items-center space-x-2">
            <Icon name="ShieldAlert" className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{activeError.safetyCheck}</span>
          </div>
        </div>
      )}
    </div>
  );
}
