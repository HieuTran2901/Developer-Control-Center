import { useState } from 'react';
import { Icon } from '@/shared/components/ui/Icon';

export interface CommandToken {
  token: string;
  role: string;
  explanation: string;
  details?: {
    key: string;
    value: string;
  }[];
}

interface CommandBreakdownProps {
  tokens?: CommandToken[];
}

export function CommandBreakdown({
  tokens = [
    {
      token: 'docker run',
      role: 'CLI Subcommand',
      explanation: 'Instructs the Docker Engine daemon to create and start a new container instance from a specified image.',
    },
    {
      token: '-d',
      role: 'Detached Mode Flag',
      explanation: 'Runs the container in the background (detached mode) and prints the container ID instead of locking your terminal session.',
    },
    {
      token: '-p 8080:80',
      role: 'Port Mapping Flag',
      explanation: 'Forwards network traffic from host port 8080 to container port 80.',
      details: [
        { key: 'HOST PORT', value: '8080 (Accessible via http://localhost:8080)' },
        { key: 'CONTAINER PORT', value: '80 (Internal Nginx listening port)' },
      ],
    },
    {
      token: '--name my-nginx',
      role: 'Container Name Flag',
      explanation: 'Assigns the custom readable name "my-nginx" to the container instead of a random generated string.',
    },
    {
      token: 'nginx',
      role: 'Target Image Name',
      explanation: 'The Docker image to pull and instantiate (official Nginx web server image from Docker Hub).',
    },
  ],
}: CommandBreakdownProps) {
  const [selectedTokenIdx, setSelectedTokenIdx] = useState<number>(2); // Default to -p 8080:80

  const activeToken = tokens[selectedTokenIdx] || tokens[0];

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border/80 space-y-4 shadow-xs select-none">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 text-xs font-mono font-bold text-primary uppercase">
          <Icon name="Terminal" className="w-4 h-4 text-primary" />
          <span>Interactive Command Token Breakdown</span>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground">Click token to inspect</span>
      </div>

      {/* Monospace Interactive Token Bar */}
      <div className="p-3 rounded-xl bg-background border border-border/80 font-mono text-xs flex flex-wrap items-center gap-1.5 overflow-x-auto shadow-inner">
        <span className="text-muted-foreground select-none">$</span>
        {tokens.map((tok, idx) => {
          const isSelected = idx === selectedTokenIdx;

          return (
            <button
              key={idx}
              type="button"
              onClick={() => setSelectedTokenIdx(idx)}
              className={`px-2 py-1 rounded transition-all cursor-pointer font-bold ${
                isSelected
                  ? 'bg-primary text-primary-foreground shadow-xs ring-2 ring-primary/40'
                  : 'bg-card text-emerald-400 border border-border/60 hover:border-primary/50 hover:bg-muted'
              }`}
            >
              {tok.token}
            </button>
          );
        })}
      </div>

      {/* Token Explanation Box */}
      {activeToken && (
        <div className="p-4 rounded-xl bg-background border border-primary/30 space-y-2.5 animate-in fade-in duration-150">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="font-bold text-emerald-400 bg-card px-2 py-0.5 rounded border border-border/60">
              {activeToken.token}
            </span>
            <span className="text-[11px] font-bold text-primary uppercase">{activeToken.role}</span>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">{activeToken.explanation}</p>

          {/* Key-Value Details (e.g. Port Map Breakdown) */}
          {activeToken.details && activeToken.details.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 font-mono text-xs">
              {activeToken.details.map((d, dIdx) => (
                <div key={dIdx} className="p-2.5 rounded-lg bg-card border border-border/60 space-y-0.5">
                  <div className="text-[10px] text-primary font-bold">{d.key}</div>
                  <div className="text-foreground text-[11px]">{d.value}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
