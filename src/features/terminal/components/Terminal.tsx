import React, { useEffect, useRef, useState, useCallback } from 'react';
import { EventBus, EventType } from '@/application/events/EventBus';
import { LogMessage } from '@/application/managers/LogBuffer';
import { logBufferManager } from '@/application/services';
import { cn } from '@/shared/utils';
import { TerminalRenderer } from '../utils/TerminalRenderer';
import { Icon } from '@/shared/components/ui/Icon';
import { Button } from '@/shared/components/ui/button';
import { Switch } from '@/shared/components/ui/switch';

interface TerminalProps {
  projectId: string;
  profileId: string;
  className?: string;
}

export function Terminal({ projectId, profileId, className }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<TerminalRenderer | null>(null);
  
  // Metrics state
  const [metrics, setMetrics] = useState({
    bufferLines: 0,
    renderedLines: 0,
    isAutoScroll: true,
  });

  const updateMetrics = useCallback(() => {
    setMetrics(prev => ({
      ...prev,
      bufferLines: logBufferManager.getRecent(projectId, profileId, 5000).length,
      renderedLines: rendererRef.current?.getLinesCount() || 0,
      isAutoScroll: rendererRef.current?.getAutoScroll() ?? true,
    }));
  }, [projectId, profileId]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Initialize renderer
    rendererRef.current = new TerminalRenderer(container, 500);

    // Load initial logs
    const initialLogs = logBufferManager.getRecent(projectId, profileId, 500);
    rendererRef.current.appendBatch(initialLogs);
    updateMetrics();

    // Subscribe to new logs
    const handleNewLog = (log: LogMessage) => {
      if (log.projectId === projectId && log.profileId === profileId) {
        rendererRef.current?.append(log);
      }
    };

    const unsubOut = EventBus.subscribe<LogMessage>(EventType.ProcessOutput, handleNewLog);
    const unsubErr = EventBus.subscribe<LogMessage>(EventType.ProcessErrorOutput, handleNewLog);

    // Metrics interval to avoid re-rendering on every log line
    const interval = setInterval(updateMetrics, 1000);

    return () => {
      unsubOut();
      unsubErr();
      clearInterval(interval);
      rendererRef.current = null;
    };
  }, [projectId, profileId, updateMetrics]);

  // Handle manual scroll to disable auto-scroll if user scrolls up
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!rendererRef.current) return;
    
    const target = e.currentTarget;
    const isAtBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 50;
    
    // Only update if state changes
    if (rendererRef.current.getAutoScroll() !== isAtBottom) {
      rendererRef.current.setAutoScroll(isAtBottom);
      updateMetrics();
    }
  };

  const handleClear = () => {
    rendererRef.current?.clear();
    logBufferManager.clear(projectId, profileId);
    updateMetrics();
  };

  const handleCopy = () => {
    const text = rendererRef.current?.copyAll();
    if (text) {
      navigator.clipboard.writeText(text);
    }
  };

  const toggleAutoScroll = (checked: boolean) => {
    rendererRef.current?.setAutoScroll(checked);
    updateMetrics();
  };

  return (
    <div className={cn("relative flex flex-col h-full bg-[#0d1117] rounded-md border border-border/40 overflow-hidden", className)}>
      {/* Terminal Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#161b22] border-b border-border/40 shrink-0">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
          <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
          <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
          <span className="ml-4 text-xs font-medium text-muted-foreground/80 font-mono tracking-wider">
            {projectId} / {profileId}
          </span>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <span className="text-xs text-muted-foreground">Auto Scroll</span>
            <Switch 
              checked={metrics.isAutoScroll} 
              onCheckedChange={toggleAutoScroll} 
              className="scale-75 data-[state=checked]:bg-primary"
            />
          </div>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-muted-foreground hover:text-foreground" onClick={handleCopy} title="Copy visible logs">
            <Icon name="Copy" size={14} className="mr-1.5" />
            Copy
          </Button>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-muted-foreground hover:text-red-400" onClick={handleClear} title="Clear logs">
            <Icon name="Trash2" size={14} className="mr-1.5" />
            Clear
          </Button>
        </div>
      </div>
      
      {/* Terminal Body */}
      <div 
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 scroll-smooth"
        style={{ scrollBehavior: 'auto' }}
      >
        {/* Logs will be injected here manually via TerminalRenderer */}
      </div>

      {/* Terminal Footer Metrics */}
      <div className="flex items-center justify-between px-4 py-1.5 bg-[#161b22]/80 border-t border-border/40 shrink-0 text-[10px] text-muted-foreground font-mono">
        <div className="flex space-x-4">
          <span className="flex items-center">
            <span className="w-1.5 h-1.5 rounded-full bg-success mr-1.5 animate-pulse"></span>
            Connected
          </span>
          <span>Buffer: {metrics.bufferLines}/5000</span>
          <span>Rendered DOM: {metrics.renderedLines}/500</span>
        </div>
        <div>
          {metrics.isAutoScroll ? 'Auto Scrolling' : 'Scroll Locked (DOM Pruning Paused)'}
        </div>
      </div>
    </div>
  );
}


