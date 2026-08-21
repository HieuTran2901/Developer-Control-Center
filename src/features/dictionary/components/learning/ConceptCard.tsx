import { useState } from 'react';
import { Icon, IconName } from '@/shared/components/ui/Icon';

export interface ConceptSubFeature {
  title: string;
  description: string;
}

interface ConceptCardProps {
  title?: string;
  icon?: IconName;
  summary?: string;
  subFeatures?: ConceptSubFeature[];
}

export function ConceptCard({
  title = '🐳 Docker Container Concept',
  icon = 'Box',
  summary = 'A lightweight, standalone executable package containing application code + exact runtime dependencies.',
  subFeatures = [
    {
      title: 'PROCESS ISOLATION',
      description: 'Runs as an isolated Linux process namespace (PID) sharing the host OS kernel without VM hypervisor overhead.',
    },
    {
      title: 'WRITABLE LAYER',
      description: 'Adds a thin ephemeral write layer on top of immutable read-only image layers via OverlayFS.',
    },
    {
      title: 'NETWORK BRIDGING',
      description: 'Gains a private virtual ethernet interface connected to Docker bridge networks.',
    },
  ],
}: ConceptCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border/80 space-y-3 shadow-xs select-none">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 text-xs font-mono font-bold text-primary uppercase">
          <Icon name={icon} className="w-4 h-4 text-primary" />
          <span>{title}</span>
        </div>
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs font-mono text-primary hover:underline flex items-center space-x-1 cursor-pointer"
        >
          <span>{isExpanded ? 'Collapse' : 'Explore Concept'}</span>
          <Icon name={isExpanded ? 'ChevronUp' : 'ChevronDown'} className="w-3.5 h-3.5" />
        </button>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">{summary}</p>

      {isExpanded && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 font-mono text-xs animate-in fade-in duration-150">
          {subFeatures.map((sub, idx) => (
            <div key={idx} className="p-3 rounded-xl bg-background border border-border/60 space-y-1">
              <div className="text-[10px] font-bold text-primary">{sub.title}</div>
              <p className="text-muted-foreground text-[11px] font-sans leading-relaxed">
                {sub.description}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
