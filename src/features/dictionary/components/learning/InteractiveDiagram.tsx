import { useState } from 'react';
import { Icon, IconName } from '@/shared/components/ui/Icon';

export interface DiagramElement {
  id: string;
  name: string;
  category: string;
  icon: IconName;
  details: {
    filesystem: string;
    process: string;
    network: string;
    lifecycle: string;
  };
}

const DOCKER_ARCH_ELEMENTS: DiagramElement[] = [
  {
    id: 'container',
    name: 'Docker Container',
    category: 'Runtime Instance',
    icon: 'Box',
    details: {
      filesystem: 'Writable Layer (OverlayFS) over immutable read-only image layers.',
      process: 'Isolated Linux process namespace (PID namespace) running on Host OS kernel.',
      network: 'Dedicated virtual ethernet bridge (docker0) with private IP (e.g. 172.17.0.2).',
      lifecycle: 'Created ➔ Running ➔ Paused ➔ Stopped ➔ Exited / Removed.',
    },
  },
  {
    id: 'image',
    name: 'Docker Image',
    category: 'Read-Only Template',
    icon: 'Layers',
    details: {
      filesystem: 'Stacked read-only layers built from Dockerfile instructions with content hashes.',
      process: 'Stateless binary template; does not consume CPU/RAM until instantiated into a Container.',
      network: 'No network interface; defines exposed port metadata (EXPOSE 80).',
      lifecycle: 'Pulled from Registry ➔ Stored in local cache ➔ Built via Dockerfile ➔ Pushed.',
    },
  },
  {
    id: 'volume',
    name: 'Docker Volume',
    category: 'Persistent Storage',
    icon: 'Database',
    details: {
      filesystem: 'Host directory managed by Docker at /var/lib/docker/volumes/ bypassing OverlayFS.',
      process: 'Persistent storage decoupled from container lifecycle; data survives container deletion.',
      network: 'N/A (Storage subsystem).',
      lifecycle: 'Created ➔ Mounted to Container ➔ Unmounted ➔ Pruned.',
    },
  },
  {
    id: 'engine',
    name: 'Docker Engine (Daemon)',
    category: 'Background System Service',
    icon: 'Server',
    details: {
      filesystem: 'Manages image layer storage, container rootfs, and volume mounts.',
      process: 'Background dockerd daemon listening on Unix socket (/var/run/docker.sock).',
      network: 'Creates bridge networks, iptables NAT port mappings, and DNS resolution.',
      lifecycle: 'Always running as a systemd background daemon service.',
    },
  },
];

export function InteractiveDiagram() {
  const [selectedId, setSelectedId] = useState<string>('container');

  const activeElement = DOCKER_ARCH_ELEMENTS.find((el) => el.id === selectedId) || DOCKER_ARCH_ELEMENTS[0];

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border/80 space-y-4 shadow-xs select-none">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 text-xs font-mono font-bold text-primary uppercase">
          <Icon name="LayoutGrid" className="w-4 h-4 text-primary" />
          <span>Interactive Architecture Explorer</span>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground">Click component to inspect</span>
      </div>

      {/* Interactive Element Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {DOCKER_ARCH_ELEMENTS.map((el) => {
          const isSelected = el.id === selectedId;

          return (
            <button
              key={el.id}
              type="button"
              onClick={() => setSelectedId(el.id)}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer space-y-1 ${
                isSelected
                  ? 'bg-primary/10 border-primary shadow-xs ring-1 ring-primary/30 text-foreground'
                  : 'bg-background/60 border-border/60 hover:border-primary/40 hover:bg-background text-muted-foreground hover:text-foreground'
              }`}
            >
              <div className="flex items-center justify-between">
                <Icon
                  name={el.icon}
                  className={`w-4 h-4 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`}
                />
                {isSelected && <span className="text-[10px] font-mono text-primary font-bold">● Active</span>}
              </div>
              <div className="text-xs font-bold font-mono leading-tight">{el.name}</div>
              <div className="text-[10px] text-muted-foreground truncate">{el.category}</div>
            </button>
          );
        })}
      </div>

      {/* Component Details Card */}
      {activeElement && (
        <div className="p-4 rounded-xl bg-background border border-primary/30 space-y-3 animate-in fade-in duration-150">
          <div className="flex items-center space-x-2 text-xs font-mono font-bold text-primary">
            <Icon name={activeElement.icon} className="w-4 h-4" />
            <span>{activeElement.name} Architecture Details</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-2.5 rounded-lg bg-card border border-border/60 space-y-0.5">
              <span className="text-[10px] font-mono font-bold uppercase text-primary">Filesystem Layer</span>
              <p className="text-muted-foreground text-[11px] leading-relaxed">{activeElement.details.filesystem}</p>
            </div>
            <div className="p-2.5 rounded-lg bg-card border border-border/60 space-y-0.5">
              <span className="text-[10px] font-mono font-bold uppercase text-emerald-400">Process Model</span>
              <p className="text-muted-foreground text-[11px] leading-relaxed">{activeElement.details.process}</p>
            </div>
            <div className="p-2.5 rounded-lg bg-card border border-border/60 space-y-0.5">
              <span className="text-[10px] font-mono font-bold uppercase text-amber-400">Network &amp; Ports</span>
              <p className="text-muted-foreground text-[11px] leading-relaxed">{activeElement.details.network}</p>
            </div>
            <div className="p-2.5 rounded-lg bg-card border border-border/60 space-y-0.5">
              <span className="text-[10px] font-mono font-bold uppercase text-purple-400">Lifecycle</span>
              <p className="text-muted-foreground text-[11px] leading-relaxed">{activeElement.details.lifecycle}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
