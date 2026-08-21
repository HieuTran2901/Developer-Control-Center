import { useState } from 'react';
import { Icon } from '@/shared/components/ui/Icon';

interface CommandOutput {
  command: string;
  output: string;
}

const PREDEFINED_SIMULATIONS: Record<string, string> = {
  'docker ps': `CONTAINER ID   IMAGE          COMMAND                  CREATED         STATUS         PORTS                  NAMES
a1b2c3d4e5f6   nginx:alpine   "/docker-entrypoint.…"   10 seconds ago  Up 10 seconds  0.0.0.0:8080->80/tcp   my-nginx`,
  'docker images': `REPOSITORY   TAG       IMAGE ID       CREATED        SIZE
nginx        alpine    f890c23a12b4   2 days ago     42.5MB
redis        latest    a1290ffc1122   1 week ago     112MB`,
  'docker stop my-nginx': `my-nginx`,
  'docker start my-nginx': `my-nginx`,
  'docker logs my-nginx': `2026-08-20T20:00:00Z [INFO] Configuration loaded successfully.
2026-08-20T20:00:01Z [INFO] Ready for incoming HTTP connections on port 80.`,
  'git status': `On branch main
Your branch is up to date with 'origin/main'.

nothing to commit, working tree clean`,
  'free -h': `               total        used        free      shared  buff/cache   available
Mem:           15Gi       4.2Gi       6.8Gi       120Mi       4.5Gi        10Gi`,
};

export function TerminalPlayground() {
  const [history, setHistory] = useState<CommandOutput[]>([
    {
      command: 'docker ps',
      output: PREDEFINED_SIMULATIONS['docker ps'],
    },
  ]);
  const [inputVal, setInputVal] = useState('');

  const handleRunCommand = (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = inputVal.trim();
    if (!cmd) return;

    const matchedOutput =
      PREDEFINED_SIMULATIONS[cmd.toLowerCase()] ||
      `bash: command not found or disabled in sandbox: ${cmd}\nTry running: 'docker ps', 'docker images', 'docker logs my-nginx', or 'git status'.`;

    setHistory((prev) => [...prev, { command: cmd, output: matchedOutput }]);
    setInputVal('');
  };

  const handleQuickClick = (cmd: string) => {
    const matchedOutput = PREDEFINED_SIMULATIONS[cmd] || `Executed ${cmd}`;
    setHistory((prev) => [...prev, { command: cmd, output: matchedOutput }]);
  };

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border/80 space-y-3 shadow-xs select-none">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 text-xs font-mono font-bold text-primary uppercase">
          <Icon name="Terminal" className="w-4 h-4 text-primary" />
          <span>Safe Terminal Playground Simulator</span>
        </div>
        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
          Client-Side Sandbox
        </span>
      </div>

      {/* Terminal Screen Container */}
      <div className="p-4 rounded-xl bg-background border border-border/80 font-mono text-xs text-foreground space-y-3 min-h-[160px] max-h-[260px] overflow-y-auto shadow-inner">
        {history.map((item, idx) => (
          <div key={idx} className="space-y-1">
            <div className="flex items-center space-x-1.5 text-emerald-400">
              <span className="text-muted-foreground select-none">user@dcc-sandbox:~$</span>
              <span className="font-bold">{item.command}</span>
            </div>
            <pre className="text-[11px] text-muted-foreground whitespace-pre-wrap leading-relaxed">
              {item.output}
            </pre>
          </div>
        ))}

        {/* Command Input Form */}
        <form onSubmit={handleRunCommand} className="flex items-center space-x-2 pt-1">
          <span className="text-muted-foreground select-none">user@dcc-sandbox:~$</span>
          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            placeholder="Type 'docker ps' or 'docker images'..."
            className="flex-1 bg-transparent border-none outline-none font-mono text-xs text-foreground placeholder:text-muted-foreground/60"
          />
        </form>
      </div>

      {/* Predefined Quick Run Chips */}
      <div className="flex flex-wrap gap-1.5 pt-1">
        <span className="text-[10px] font-mono text-muted-foreground py-1">Quick Run:</span>
        {Object.keys(PREDEFINED_SIMULATIONS).map((cmd, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleQuickClick(cmd)}
            className="px-2 py-0.5 rounded bg-muted/60 hover:bg-primary/20 hover:text-primary text-[10px] font-mono text-muted-foreground border border-border/50 transition-colors"
          >
            $ {cmd}
          </button>
        ))}
      </div>
    </div>
  );
}
