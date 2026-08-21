import { useState, useMemo } from 'react';
import { Icon } from '@/shared/components/ui/Icon';

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

interface TroubleshootingWorkspaceProps {
  onBackToHome: () => void;
  initialQuery?: string;
}

export function TroubleshootingWorkspace({
  onBackToHome,
  initialQuery = '',
}: TroubleshootingWorkspaceProps) {
  const [query, setQuery] = useState(initialQuery);
  const [selectedErrId, setSelectedErrId] = useState<string>(COMMON_ERROR_SOLUTIONS[0].id);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const filteredSolutions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COMMON_ERROR_SOLUTIONS;

    return COMMON_ERROR_SOLUTIONS.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.errorCode.toLowerCase().includes(q) ||
        item.technology.toLowerCase().includes(q) ||
        item.whyExplanation.toLowerCase().includes(q)
    );
  }, [query]);

  const activeError =
    filteredSolutions.find((e) => e.id === selectedErrId) || filteredSolutions[0] || COMMON_ERROR_SOLUTIONS[0];

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
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
          <span className="text-foreground font-bold">Troubleshooting</span>
        </div>

        <div className="text-[11px] font-mono text-muted-foreground flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span>Intent FIX Workspace</span>
        </div>
      </div>

      {/* Header Banner & Hero Search */}
      <div className="p-6 rounded-2xl bg-card border border-amber-500/30 space-y-4 shadow-sm">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Icon name="Wrench" className="w-3 h-3 text-amber-400" />
            <span>TROUBLESHOOTING ASSISTANT</span>
          </div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">
            What is broken?
          </h1>
          <p className="text-xs text-muted-foreground">
            Diagnose runtime failures, port conflicts, and system errors step-by-step.
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Icon
            name="Search"
            className="w-4.5 h-4.5 absolute left-4 top-1/2 -translate-y-1/2 text-amber-400"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search error code or symptom (e.g. port 8080, OOM 137, SSH timeout, disk full)..."
            className="w-full h-12 pl-11 pr-10 text-sm font-sans bg-background border border-border/80 rounded-xl text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 transition-all shadow-inner"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 cursor-pointer"
            >
              <Icon name="X" className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main Troubleshooting Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Error Issue Selector */}
        <div className="lg:col-span-4 space-y-2.5">
          <div className="text-xs font-mono font-bold uppercase tracking-wider text-muted-foreground px-1">
            Common Incidents ({filteredSolutions.length})
          </div>

          {filteredSolutions.map((err) => {
            const isSelected = activeError?.id === err.id;
            return (
              <button
                key={err.id}
                type="button"
                onClick={() => setSelectedErrId(err.id)}
                className={`w-full text-left p-3.5 rounded-2xl border transition-all cursor-pointer space-y-1 ${
                  isSelected
                    ? 'bg-amber-500/10 border-amber-500/50 shadow-xs'
                    : 'bg-card hover:bg-muted/40 border-border/70 text-muted-foreground'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold uppercase text-amber-400">
                    {err.technology}
                  </span>
                  {isSelected && <Icon name="ChevronRight" className="w-4 h-4 text-amber-400" />}
                </div>
                <h4 className="text-xs font-bold text-foreground truncate">
                  {err.title}
                </h4>
                <p className="text-[11px] font-mono text-muted-foreground truncate">
                  {err.errorCode}
                </p>
              </button>
            );
          })}
        </div>

        {/* Right Column: Structured Solution Workflow (WHY -> DIAGNOSE -> FIX -> VERIFY) */}
        {activeError && (
          <div className="lg:col-span-8 p-6 rounded-2xl bg-card border border-border/80 space-y-5 shadow-xs">
            {/* Header */}
            <div className="border-b border-border/60 pb-3 space-y-1">
              <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                {activeError.technology}
              </span>
              <h2 className="text-base font-bold text-foreground">
                {activeError.title}
              </h2>
              <div className="text-xs font-mono text-muted-foreground">
                Code: {activeError.errorCode}
              </div>
            </div>

            {/* STEP 1: WHY */}
            <div className="space-y-1.5">
              <div className="flex items-center space-x-1.5 text-xs font-mono font-bold text-amber-400 uppercase">
                <span className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center text-[11px]">1</span>
                <span>WHY (Root Cause)</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed pl-6">
                {activeError.whyExplanation}
              </p>
            </div>

            {/* STEP 2: DIAGNOSE */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono font-bold text-sky-400 uppercase">
                <div className="flex items-center space-x-1.5">
                  <span className="w-5 h-5 rounded-full bg-sky-500/20 flex items-center justify-center text-[11px]">2</span>
                  <span>DIAGNOSE (Run Command)</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(activeError.diagnosticCommand, 'diag')}
                  className="text-[11px] text-muted-foreground hover:text-foreground cursor-pointer flex items-center space-x-1"
                >
                  <Icon name={copiedKey === 'diag' ? 'Check' : 'Copy'} className="w-3 h-3 text-sky-400" />
                  <span>{copiedKey === 'diag' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <pre className="ml-6 p-3 rounded-xl bg-background border border-border/80 font-mono text-xs text-sky-300 overflow-x-auto">
                <code>$ {activeError.diagnosticCommand}</code>
              </pre>
            </div>

            {/* STEP 3: FIX */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono font-bold text-emerald-400 uppercase">
                <div className="flex items-center space-x-1.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-[11px]">3</span>
                  <span>FIX (Resolution Command)</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(activeError.fixCommand, 'fix')}
                  className="text-[11px] text-muted-foreground hover:text-foreground cursor-pointer flex items-center space-x-1"
                >
                  <Icon name={copiedKey === 'fix' ? 'Check' : 'Copy'} className="w-3 h-3 text-emerald-400" />
                  <span>{copiedKey === 'fix' ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <pre className="ml-6 p-3 rounded-xl bg-background border border-border/80 font-mono text-xs text-emerald-300 overflow-x-auto">
                <code>$ {activeError.fixCommand}</code>
              </pre>
            </div>

            {/* STEP 4: VERIFY */}
            <div className="space-y-1.5">
              <div className="flex items-center space-x-1.5 text-xs font-mono font-bold text-indigo-400 uppercase">
                <span className="w-5 h-5 rounded-full bg-indigo-500/20 flex items-center justify-center text-[11px]">4</span>
                <span>VERIFY (Expected Outcome)</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed pl-6 font-mono">
                {activeError.expectedFixOutput}
              </p>
            </div>

            {/* Safety Alert */}
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-start space-x-2">
              <Icon name="AlertTriangle" className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span><strong>Safety Warning:</strong> {activeError.safetyCheck}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
