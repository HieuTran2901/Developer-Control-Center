import { useState, useEffect } from 'react';
import { PageContainer } from '@/shared/components/layouts/PageContainer';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Icon } from '@/shared/components/ui/Icon';
import { ProcessState } from '@/domain/entities/ProcessState';
import { ReadinessState } from '@/domain/entities/ReadinessState';
import { useWorkspace } from '@/shared/hooks/useWorkspace';
import { AlertPanel } from '../components/AlertPanel';
import { SparklineChart } from '../components/SparklineChart';
import { processLifecycleService } from '@/application/services';
import { Terminal } from '@/features/terminal/components/Terminal';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/shared/components/ui/dropdown-menu';
import { EventBus, EventType } from '@/application/events/EventBus';
import { ProcessHistory } from '@/domain/entities/ProcessHistory';
import { PerformanceSummary } from '@/domain/entities/PerformanceSummary';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/shared/utils';

// Icons per runtime type
const RUNTIME_ICONS: Record<string, { icon: string; color: string; bg: string }> = {
  node: { icon: 'Server', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
  nodejs: { icon: 'Server', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
  npm: { icon: 'Server', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
  react: { icon: 'Atom', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
  client: { icon: 'Atom', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
  frontend: { icon: 'Atom', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
  python: { icon: 'Braces', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
  data: { icon: 'Braces', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
  docker: { icon: 'Box', color: 'text-blue-500', bg: 'bg-blue-600/10 border-blue-500/20' },
  postgresql: { icon: 'Database', color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/20' },
  postgres: { icon: 'Database', color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/20' },
  default: { icon: 'FolderGit2', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
};

function getRuntimeStyle(nameOrCmd: string) {
  const text = nameOrCmd?.toLowerCase() || '';
  for (const [key, val] of Object.entries(RUNTIME_ICONS)) {
    if (text.includes(key)) return val;
  }
  return RUNTIME_ICONS.default;
}

function formatUptime(startMs?: number) {
  if (!startMs) return '—';
  const diff = Date.now() - startMs;
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatBytes(b: number) {
  if (!b || b === 0) return '0 B';
  const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return `${parseFloat((b / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function Dashboard() {
  const navigate = useNavigate();
  const { workspace, session, updateSession } = useWorkspace();
  const projects = workspace?.projects || [];

  // Resource monitoring state
  const [histories, setHistories] = useState<ProcessHistory[]>([]);
  const [summaries, setSummaries] = useState<Record<number, PerformanceSummary>>({});

  // Terminal dialog
  const activeTerminalStr = session?.activeTerminalId;
  const activeTerminal = activeTerminalStr ? {
    projectId: activeTerminalStr.split('|')[0],
    profileId: activeTerminalStr.split('|')[1],
    name: activeTerminalStr.split('|')[2] || 'Terminal'
  } : null;

  const [infoDialog, setInfoDialog] = useState<{ projectId: string } | null>(null);

  const setActiveTerminal = (term: { projectId: string; profileId: string; name: string } | null) => {
    updateSession({ activeTerminalId: term ? `${term.projectId}|${term.profileId}|${term.name}` : undefined });
  };

  useEffect(() => {
    const unsubHistory = EventBus.subscribe<ProcessHistory[]>(EventType.HistoryMetricsUpdated, (data) => {
      setHistories([...data]);
    });
    const unsubSummary = EventBus.subscribe<PerformanceSummary[]>(EventType.PerformanceSummaryUpdated, (data) => {
      const map: Record<number, PerformanceSummary> = {};
      data.forEach(s => map[s.pid] = s);
      setSummaries(map);
    });
    return () => { unsubHistory(); unsubSummary(); };
  }, []);

  const allServices = projects.flatMap(p => p.profiles);
  const allProfiles = projects.flatMap(project =>
    (project.profiles || []).map(profile => ({
      ...profile,
      projectId: project.id,
      projectName: project.name,
      projectPath: project.rootPath,
    }))
  );

  const activeServices = allServices.filter(s => s.status === ProcessState.Running || s.status === ProcessState.Starting).length;
  const totalProjects = projects.length;

  const totalCpu = histories.reduce((acc, h) => acc + (h.cpu[h.cpu.length - 1] || 0), 0);
  const totalMemory = histories.reduce((acc, h) => acc + (h.memory[h.memory.length - 1] || 0), 0);
  const processCount = histories.length;

  // Combined CPU sparkline across all processes
  const combinedCpuSparkline = histories.length > 0
    ? histories[0].cpu.map((_, i) => histories.reduce((sum, h) => sum + (h.cpu[i] || 0), 0))
    : Array(20).fill(0);
  const combinedRamSparkline = histories.length > 0
    ? histories[0].memory.map((_, i) => histories.reduce((sum, h) => sum + (h.memory[i] || 0), 0))
    : Array(20).fill(0);

  const toggleService = async (projectId: string, profile: any) => {
    // Prevent stop if process is starting/waiting or stopping
    if (profile.status === ProcessState.Stopping || profile.readinessState === ReadinessState.Waiting) {
      return;
    }

    if (profile.status === ProcessState.Running || profile.status === ProcessState.Starting) {
      await processLifecycleService.stop(projectId, profile.id);
    } else {
      const cmd = profile.command ? `${profile.command} ${(profile.arguments || []).join(' ')}`.trim() : 'npm run start';
      const cwd = profile.workingDirectory || './';
      await processLifecycleService.start(projectId, profile.id, cmd, cwd, profile.readinessRegex);
    }
  };

  const selectedInfoProject = infoDialog ? projects.find(p => p.id === infoDialog.projectId) : null;

  return (
    <PageContainer
      title="Dashboard"
      description="Overview of your workspaces and active services"
      actions={
        <div className="flex items-center bg-[#2563eb] rounded-md overflow-hidden text-white font-medium hover:bg-blue-600 transition-colors shadow-sm select-none">
          <Button
            className="bg-transparent hover:bg-transparent shadow-none px-3.5 h-9 rounded-none text-xs flex items-center border-r border-blue-400/30"
            onClick={() => navigate('/workspace')}
          >
            <Icon name="Plus" size={16} className="mr-2 text-white" />
            New Project
          </Button>
          <Button
            className="bg-transparent hover:bg-transparent shadow-none px-2.5 h-9 rounded-none text-xs flex items-center justify-center"
            title="More Options"
            onClick={() => navigate('/workspace')}
          >
            <Icon name="ChevronDown" size={16} className="text-white" />
          </Button>
        </div>
      }
    >
      {/* ── Top Stats Row ─────────────────────────────────── */}
      <div className="grid grid-cols-2 2xl:grid-cols-4 gap-4 mb-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

        {/* Total Projects */}
        <Card className="bg-[#0d1117]/60 border-border/40 flex flex-col justify-between min-h-[130px]">
          <CardHeader className="flex flex-row items-start justify-between pb-1 px-5 pt-5">
            <CardTitle className="text-xs font-medium text-muted-foreground">Total Projects</CardTitle>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Icon name="FolderGit2" size={16} className="text-blue-500" />
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="text-5xl font-bold tracking-tight">{totalProjects}</div>
            <p className="text-xs text-muted-foreground mt-1.5">Across all workspaces</p>
          </CardContent>
        </Card>

        {/* Running Services */}
        <Card className="bg-[#0d1117]/60 border-border/40 flex flex-col justify-between min-h-[130px]">
          <CardHeader className="flex flex-row items-start justify-between pb-1 px-5 pt-5">
            <CardTitle className="text-xs font-medium text-muted-foreground">Running Services</CardTitle>
            <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
              <Icon name="Activity" size={16} className="text-green-500" />
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="text-5xl font-bold tracking-tight text-primary">{activeServices}</div>
            <p className="text-xs text-muted-foreground mt-1.5">Consuming ~1.2GB RAM</p>
          </CardContent>
        </Card>

        {/* Resource Monitor & Analysis (Compact) */}
        <Card className="bg-[#0d1117]/60 border-border/40 col-span-1 min-h-[130px] flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between pb-2 px-4 pt-4 shrink-0">
            <CardTitle className="text-xs font-medium flex items-center gap-1.5">
              <Icon name="Activity" size={13} className="text-blue-400" />
              Resource Monitor & Analysis
            </CardTitle>
            <span className="text-[9px] text-green-400 animate-pulse font-semibold tracking-wider uppercase">Live</span>
          </CardHeader>
          <CardContent className="px-4 pb-4 flex-1 flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[10px] text-muted-foreground mb-0.5">Total CPU</div>
                <div className="text-base font-bold text-blue-400">{totalCpu.toFixed(1)}%</div>
              </div>
              <div>
                <div className="text-[10px] text-muted-foreground mb-0.5">Total RAM</div>
                <div className="text-base font-bold text-green-400">{formatBytes(totalMemory)}</div>
              </div>
            </div>
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <div className="flex justify-between text-[9px] text-muted-foreground mb-0.5">
                  <span>CPU</span>
                  <span className="text-blue-400">{totalCpu.toFixed(1)}%</span>
                </div>
                <SparklineChart data={combinedCpuSparkline} color="#60a5fa" height={22} width={80} />
              </div>
              <div className="flex-1">
                <div className="flex justify-between text-[9px] text-muted-foreground mb-0.5">
                  <span>RAM</span>
                  <span className="text-green-400">{formatBytes(totalMemory)}</span>
                </div>
                <SparklineChart data={combinedRamSparkline} color="#4ade80" height={22} width={80} />
              </div>
            </div>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground border-t border-border/30 pt-2 mt-auto">
              <span>Processes <span className="text-foreground font-semibold ml-1">{processCount}</span></span>
              <span className="flex items-center gap-1 text-green-400">
                Healthy <Icon name="ShieldCheck" size={11} className="ml-0.5" />
              </span>
            </div>
          </CardContent>
        </Card>

        {/* AI Assistant */}
        <Card className="bg-gradient-to-br from-primary/10 to-[#0d1117]/60 border-primary/20 flex flex-col justify-between min-h-[130px]">
          <CardHeader className="flex flex-row items-start justify-between pb-1 px-5 pt-5">
            <CardTitle className="text-xs font-medium text-primary flex items-center gap-1.5">
              <Icon name="Sparkles" size={13} className="text-primary" />
              AI Assistant
            </CardTitle>
            <button className="text-muted-foreground hover:text-foreground">
              <Icon name="ArrowUpRight" size={14} />
            </button>
          </CardHeader>
          <CardContent className="px-5 pb-5 flex-1 flex flex-col justify-between">
            <div>
              <div className="text-2xl font-bold tracking-tight">Ready</div>
              <p className="text-xs text-muted-foreground mt-1">Ask me to fix your logs</p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              className="mt-4 text-xs h-7 w-full bg-primary/10 hover:bg-primary/20 border border-primary/20 text-primary"
            >
              Open Assistant
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* ── Bottom Two-Column Row (Balanced 50% / 50%) ─────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

        {/* LEFT: Recent Projects */}
        <div className="flex flex-col gap-4">
          <div className="bg-[#0d1117]/60 border border-border/40 rounded-lg p-5 flex flex-col justify-between h-full">
            <div>
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold tracking-tight">Recent Projects</h2>
                <button
                  onClick={() => navigate('/workspace')}
                  className="text-xs text-blue-400 hover:underline flex items-center gap-1 font-medium"
                >
                  View all <Icon name="ArrowRight" size={12} />
                </button>
              </div>

              {/* Table Container for horizontal scrolling */}
              <div className="overflow-x-auto w-full pb-2">
                <div className="min-w-[500px]">
                  {/* Table Header */}
                  <div className="grid grid-cols-[1fr_90px_140px_100px] gap-3 px-3 py-2 text-[11px] font-medium text-muted-foreground border-b border-border/30">
                    <span>Project</span>
                    <span>Status</span>
                    <span>Last Active</span>
                    <span className="text-right">Actions</span>
                  </div>

                  {/* Profile List */}
                  <div className="divide-y divide-border/20">
                    {allProfiles.map(profile => {
                      const isRunning = profile.status === ProcessState.Running || profile.status === ProcessState.Starting;
                      const style = getRuntimeStyle(profile.name + ' ' + (profile.command || ''));

                      return (
                        <div key={`${profile.projectId}-${profile.id}`} className="grid grid-cols-[1fr_90px_140px_100px] gap-3 px-3 py-3.5 items-center hover:bg-muted/10 transition-colors group">
                          {/* Profile & Project Info */}
                          <div className="flex items-center gap-3 overflow-hidden">
                            <div className={cn("w-9 h-9 rounded-lg border flex items-center justify-center shrink-0", style.bg)}>
                              <Icon name={style.icon as any} size={18} className={style.color} />
                            </div>
                            <div className="overflow-hidden">
                              <p className="text-sm font-semibold text-foreground truncate group-hover:text-blue-400 transition-colors">{profile.name}</p>
                              <p className="text-[11px] text-muted-foreground font-mono truncate">
                                {profile.projectName}{profile.command ? ` • ${profile.command}` : ''}
                              </p>
                            </div>
                          </div>

                          {/* Status */}
                          <div className="flex items-center gap-1.5">
                            <span className={cn(
                              "w-2 h-2 rounded-full shrink-0",
                              isRunning
                                ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"
                                : "bg-slate-500"
                            )} />
                            <span className={cn(
                              "text-xs",
                              isRunning ? "font-medium text-foreground" : "text-muted-foreground"
                            )}>
                              {isRunning ? 'Running' : 'Stopped'}
                            </span>
                          </div>

                          {/* Last Active */}
                          <div className="text-xs font-mono text-muted-foreground">
                            {new Date((profile as any).updatedAt || Date.now()).toLocaleString()}
                          </div>

                          {/* Actions */}
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <Button
                              size="sm"
                              variant="outline"
                              className={cn(
                                "h-7 px-3 text-xs flex items-center gap-1.5 w-[85px] justify-center transition-all",
                                isRunning
                                  ? "bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20 hover:border-red-500/50"
                                  : "bg-[#161b22] border-border/60 hover:bg-blue-600/20 hover:border-blue-500 hover:text-blue-400 text-foreground"
                              )}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleService(profile.projectId, profile);
                              }}
                            >
                              <Icon name={isRunning ? "Square" : "Play"} size={12} className={isRunning ? "fill-red-400" : "fill-blue-400"} />
                              <span>{isRunning ? 'Stop' : 'Run'}</span>
                            </Button>

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 w-[85px] justify-center"
                                >
                                  <span>More</span>
                                  <Icon name="ChevronDown" size={11} />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" side="bottom" sideOffset={8} className="w-[180px]">
                                <DropdownMenuItem
                                  className="flex items-center gap-2.5 w-full px-3.5 py-2 hover:bg-blue-500/10 hover:text-blue-400 text-left transition-colors font-medium cursor-pointer"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveTerminal({ projectId: profile.projectId, profileId: profile.id, name: profile.name });
                                  }}
                                >
                                  <Icon name="Terminal" size={14} className="text-blue-400" />
                                  <span>Open Terminal</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="flex items-center gap-2.5 w-full px-3.5 py-2 hover:bg-muted/40 text-left transition-colors font-medium cursor-pointer"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleService(profile.projectId, profile);
                                  }}
                                >
                                  <Icon name={profile?.status === ProcessState.Running ? 'Square' : 'Play'} size={14} className={profile?.status === ProcessState.Running ? 'text-red-400' : 'text-green-400'} />
                                  <span>{profile?.status === ProcessState.Running ? 'Stop Service' : 'Start Service'}</span>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="flex items-center gap-2.5 w-full px-3.5 py-2 hover:bg-muted/40 text-left transition-colors font-medium text-muted-foreground hover:text-foreground cursor-pointer"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate('/workspace');
                                  }}
                                >
                                  <Icon name="Settings2" size={14} />
                                  <span>Configure</span>
                                </DropdownMenuItem>
                                {profile.pid && (
                                  <div className="px-3.5 py-1.5 text-[10px] font-mono text-muted-foreground border-t border-border/30 mt-1 select-none">
                                    PID: {profile.pid}
                                  </div>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      );
                    })}

                    {allProfiles.length === 0 && (
                      <div className="text-xs text-muted-foreground text-center py-8 italic">
                        No profiles configured yet. Create one in Workspace.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* System Alerts */}
          <AlertPanel />
        </div>

        {/* RIGHT: Process Resource Monitor Table */}
        <div className="bg-[#0d1117]/60 border border-border/40 rounded-lg flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/40 shrink-0">
            <h2 className="text-sm font-semibold">Resource Monitor</h2>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-[#161b22] border border-border/50 rounded-md px-3 py-1.5 text-xs text-muted-foreground cursor-pointer hover:border-border/80 transition-colors">
                <span>All Processes ({Math.max(processCount, allServices.length)})</span>
                <Icon name="ChevronDown" size={12} />
              </div>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground">
                <Icon name="AlignJustify" size={14} />
              </Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground">
                <Icon name="Maximize2" size={14} />
              </Button>
            </div>
          </div>

          {/* Table Container for horizontal scrolling */}
          <div className="overflow-x-auto min-w-full flex-1 flex flex-col">
            <div className="min-w-[600px] flex-1 flex flex-col">
              {/* Table Header */}
              <div className="grid grid-cols-[2fr_80px_100px_100px_100px_80px_40px] gap-2 px-5 py-2.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/30 shrink-0">
                <span>Process</span>
                <span>PID</span>
                <span>CPU</span>
                <span>RAM</span>
                <span>Status</span>
                <span>Uptime</span>
                <span></span>
              </div>

              {/* Table Rows */}
              <div className="w-full pb-2">
                {/* Unified Rows: Merging active workspace profiles with real-time process metrics */}
                {(() => {
                  const activeProfiles = projects.flatMap(project =>
                    project.profiles
                      .filter(s => s.status === ProcessState.Running || s.status === ProcessState.Starting || s.status === ProcessState.Stopping)
                      .map(profile => ({ project, profile }))
                  );

                  const seenPids = new Set<number>();
                  const renderedRows: React.ReactNode[] = [];

                  // 1. Render active profiles with enriched metrics if available
                  activeProfiles.forEach(({ project, profile }) => {
                    if (profile.pid) seenPids.add(profile.pid);
                    
                    const history = profile.pid ? histories.find(h => h.pid === profile.pid) : undefined;
                    const summary = profile.pid ? summaries[profile.pid] : undefined;
                    
                    const currentCpu = history ? (history.cpu[history.cpu.length - 1] || 0) : 0;
                    const currentMem = history ? (history.memory[history.memory.length - 1] || 0) : 0;
                    const cpuHistory = history ? history.cpu.slice(-12) : Array(12).fill(0);
                    
                    let healthStatus: string | undefined = summary?.healthStatus;
                    if (!healthStatus) {
                       healthStatus = profile.status === ProcessState.Stopping ? 'Stopping...' : 
                                      profile.readinessState === ReadinessState.Waiting ? 'Starting...' : 'Ready';
                    }
                    
                    const healthColor = healthStatus === 'Excellent' ? 'text-green-400' :
                      healthStatus === 'Good' ? 'text-blue-400' :
                        healthStatus === 'Warning' ? 'text-yellow-400' : 
                        healthStatus === 'Critical' ? 'text-red-400' : 'text-muted-foreground';
                    
                    const style = getRuntimeStyle(profile.command || '');
                    
                    renderedRows.push(
                        <div
                          key={`${project.id}-${profile.id}`}
                          className="grid grid-cols-[2fr_80px_100px_100px_100px_80px_40px] gap-2 px-5 py-3 border-b border-border/20 hover:bg-muted/10 transition-colors items-center"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className={cn("w-8 h-8 rounded-md flex items-center justify-center shrink-0", style.bg)}>
                              <Icon name={style.icon as any} size={14} className={cn("w-3.5 h-3.5 shrink-0", style.color)} />
                            </div>
                            <div className="overflow-hidden">
                              <div className="text-xs font-semibold truncate">{profile.name}</div>
                              <div className="text-[10px] text-muted-foreground truncate">{profile.command || 'Unknown'}</div>
                            </div>
                          </div>
                          <div className="text-xs font-mono text-muted-foreground">
                            {profile.pid ?? '—'}
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-mono text-blue-400 w-10 text-right shrink-0">{currentCpu.toFixed(1)}%</span>
                            <SparklineChart data={cpuHistory} color="#60a5fa" height={18} width={48} />
                          </div>
                          <div className="text-xs font-mono text-green-400">{currentMem > 0 ? formatBytes(currentMem) : '—'}</div>
                          <div className={cn(
                            "flex items-center gap-1 text-xs font-semibold", 
                            healthColor
                          )}>
                            <Icon 
                              name={profile.status === ProcessState.Stopping ? "Loader2" : (profile.readinessState === ReadinessState.Waiting ? "Loader2" : "ShieldCheck")} 
                              size={12} 
                              className={(profile.readinessState === ReadinessState.Waiting || profile.status === ProcessState.Stopping) ? "animate-spin" : ""} 
                            />
                            {healthStatus}
                          </div>
                          <div className="text-[10px] text-muted-foreground">{formatUptime(profile.startTime)}</div>
                          
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground animate-none"
                              >
                                <Icon name="MoreVertical" size={13} />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" side="bottom" sideOffset={8} className="w-[180px]">
                              <DropdownMenuItem
                                className="flex items-center gap-2.5 w-full px-3.5 py-2 hover:bg-blue-500/10 hover:text-blue-400 text-left transition-colors font-medium cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveTerminal({ projectId: project.id, profileId: profile.id, name: profile.name });
                                }}
                              >
                                <Icon name="Terminal" size={14} className="text-blue-400" />
                                <span>Open Terminal</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className={cn(
                                  "flex items-center gap-2.5 w-full px-3.5 py-2 hover:bg-muted/40 text-left transition-colors font-medium cursor-pointer",
                                  (profile.readinessState === ReadinessState.Waiting || profile.status === ProcessState.Stopping) && "opacity-50 cursor-not-allowed hover:bg-transparent"
                                )}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (profile.readinessState === ReadinessState.Waiting || profile.status === ProcessState.Stopping) return;
                                  toggleService(project.id, profile);
                                }}
                              >
                                <Icon 
                                  name={profile?.status === ProcessState.Stopping ? 'Loader2' : (profile?.status === ProcessState.Running ? 'Square' : 'Play')} 
                                  size={14} 
                                  className={cn(
                                    profile?.status === ProcessState.Stopping && "animate-spin text-muted-foreground",
                                    profile?.status === ProcessState.Running && 'text-red-400',
                                    profile?.status !== ProcessState.Running && profile?.status !== ProcessState.Stopping && 'text-green-400'
                                  )} 
                                />
                                <span>
                                  {profile?.status === ProcessState.Stopping 
                                    ? 'Stopping...' 
                                    : (profile?.status === ProcessState.Running ? 'Stop Service' : 'Start Service')}
                                </span>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="flex items-center gap-2.5 w-full px-3.5 py-2 hover:bg-muted/40 text-left transition-colors font-medium text-muted-foreground hover:text-foreground cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate('/workspace');
                                }}
                              >
                                <Icon name="Settings2" size={14} />
                                <span>Configure</span>
                              </DropdownMenuItem>
                              {profile.pid && (
                                <div className="px-3.5 py-1.5 text-[10px] font-mono text-muted-foreground border-t border-border/30 mt-1 select-none">
                                  PID: {profile.pid}
                                </div>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                    );
                  });

                  // 2. Render any orphaned histories (processes tracked by backend that lost workspace association)
                  histories.forEach(h => {
                    if (!seenPids.has(h.pid)) {
                      const summary = summaries[h.pid];
                      const currentCpu = h.cpu[h.cpu.length - 1] || 0;
                      const currentMem = h.memory[h.memory.length - 1] || 0;
                      const healthStatus = summary?.healthStatus || 'Monitoring';
                      const healthColor = healthStatus === 'Excellent' ? 'text-green-400' :
                        healthStatus === 'Good' ? 'text-blue-400' :
                          healthStatus === 'Warning' ? 'text-yellow-400' : 'text-red-400';
                          
                      renderedRows.push(
                        <div
                          key={`history-${h.pid}`}
                          className="grid grid-cols-[2fr_80px_100px_100px_100px_80px_40px] gap-2 px-5 py-3 border-b border-border/20 hover:bg-muted/10 transition-colors items-center"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-md bg-muted/20 flex items-center justify-center shrink-0">
                              <Icon name="Terminal" size={14} className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                            </div>
                            <div className="overflow-hidden">
                              <div className="text-xs font-medium truncate">PID {h.pid}</div>
                              <div className="text-[10px] text-muted-foreground">Process</div>
                            </div>
                          </div>
                          <div className="text-xs font-mono text-muted-foreground">{h.pid}</div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-mono text-blue-400 w-10 text-right shrink-0">{currentCpu.toFixed(1)}%</span>
                            <SparklineChart data={h.cpu.slice(-12)} color="#60a5fa" height={18} width={48} />
                          </div>
                          <div className="text-xs font-mono text-green-400">{formatBytes(currentMem)}</div>
                          <div className={cn("flex items-center gap-1 text-xs font-semibold", healthColor)}>
                            <Icon name="ShieldCheck" size={12} />
                            {healthStatus}
                          </div>
                          <div className="text-[10px] text-muted-foreground">—</div>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground">
                            <Icon name="MoreVertical" size={13} />
                          </Button>
                        </div>
                      );
                    }
                  });

                  return renderedRows;
                })()}

                {/* Empty state */}
                {histories.length === 0 && allServices.filter(s => s.status === ProcessState.Running || s.status === ProcessState.Starting || s.status === ProcessState.Stopping).length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                    <div className="w-12 h-12 rounded-full bg-muted/10 flex items-center justify-center mb-3">
                      <Icon name="Activity" size={20} className="text-muted-foreground/50" />
                    </div>
                    <p className="text-xs">No active processes monitored</p>
                    <p className="text-[10px] mt-1 text-muted-foreground/60">Start a runtime profile to see it here</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Table Footer */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-border/30 shrink-0 text-[10px] text-muted-foreground">
            <button
              onClick={() => navigate('/processes')}
              className="text-blue-400 hover:underline flex items-center gap-1"
            >
              View all processes <Icon name="ArrowRight" size={11} />
            </button>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground"><Icon name="ChevronLeft" size={12} /></Button>
              <span>1 / 1</span>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground"><Icon name="ChevronRight" size={12} /></Button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Project Info Dialog ───────────────────────────── */}
      <Dialog open={infoDialog !== null} onOpenChange={(open) => !open && setInfoDialog(null)}>
        <DialogContent className="max-w-lg bg-[#0d1117] border-border/50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon name="FolderGit2" size={18} className="text-blue-400" />
              {selectedInfoProject?.name || 'Project Details'}
            </DialogTitle>
          </DialogHeader>
          {selectedInfoProject && (
            <div className="space-y-4 text-sm">
              <div className="bg-[#161b22] rounded-md border border-border/40 divide-y divide-border/30">
                <div className="flex justify-between px-4 py-2.5">
                  <span className="text-muted-foreground">Path</span>
                  <span className="font-mono text-xs truncate max-w-[220px]">{selectedInfoProject.rootPath}</span>
                </div>
                <div className="flex justify-between px-4 py-2.5">
                  <span className="text-muted-foreground">Profiles</span>
                  <span className="font-semibold">{selectedInfoProject.profiles.length}</span>
                </div>
                <div className="flex justify-between px-4 py-2.5">
                  <span className="text-muted-foreground">Active Services</span>
                  <span className="font-semibold text-green-400">
                    {selectedInfoProject.profiles.filter(p => p.status === ProcessState.Running).length}
                  </span>
                </div>
                <div className="flex justify-between px-4 py-2.5">
                  <span className="text-muted-foreground">ID</span>
                  <span className="font-mono text-[10px] text-muted-foreground">{selectedInfoProject.id}</span>
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Runtime Profiles</div>
                <div className="space-y-1.5">
                  {selectedInfoProject.profiles.map(p => {
                    const style = getRuntimeStyle(p.command || '');
                    return (
                      <div key={p.id} className="flex items-center gap-3 bg-[#161b22] rounded-md border border-border/40 px-3 py-2.5">
                        <div className={cn("w-7 h-7 rounded flex items-center justify-center shrink-0", style.bg)}>
                          <Icon name={style.icon as any} size={13} className={style.color} />
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <div className="font-medium text-xs truncate">{p.name}</div>
                          <div className="text-[10px] text-muted-foreground font-mono truncate">{p.command} {p.arguments?.join(' ')}</div>
                        </div>
                        <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border",
                          p.status === ProcessState.Running
                            ? "text-green-500 bg-green-500/10 border-green-500/20"
                            : "text-muted-foreground bg-muted/20 border-border/40"
                        )}>
                          {p.status === ProcessState.Running ? 'Running' : 'Idle'}
                        </span>
                      </div>
                    );
                  })}
                  {selectedInfoProject.profiles.length === 0 && (
                    <p className="text-xs text-muted-foreground italic px-1">No profiles configured.</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Terminal Dialog ───────────────────────────────── */}
      <Dialog open={activeTerminal !== null} onOpenChange={(open) => !open && setActiveTerminal(null)}>
        <DialogContent className="max-w-4xl h-[70vh] flex flex-col p-0 overflow-hidden bg-background border-border/50">
          <DialogHeader className="px-4 py-3 border-b border-border/50 shrink-0 bg-muted/20">
            <DialogTitle className="text-sm font-medium flex items-center">
              <Icon name="Terminal" size={20} className="mr-2 text-muted-foreground" />
              Terminal: {activeTerminal?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden p-2">
            {activeTerminal && (
              <Terminal projectId={activeTerminal.projectId} profileId={activeTerminal.profileId} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
