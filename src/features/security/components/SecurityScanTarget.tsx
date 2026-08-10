import { Folder, Pencil, Copy, Check, Search, Shield, Lock, Settings, Clock, ChevronDown } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { SecurityScanMode } from '@/domain/entities/SecurityFinding';

interface SecurityScanTargetProps {
  activeTarget: { name: string; path: string; id?: string } | null;
  onChangeTarget: () => void;
  scanMode: SecurityScanMode;
  onScanModeChange: (mode: SecurityScanMode) => void;
  isScanning: boolean;
}

const normalizePath = (p: string) => {
  if (!p) return p;
  if (p.startsWith('\\\\?\\')) {
    return p.substring(4);
  }
  return p;
};

export function SecurityScanTarget({ activeTarget, onChangeTarget, scanMode, onScanModeChange, isScanning }: SecurityScanTargetProps) {
  const [copied, setCopied] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCopy = async () => {
    if (activeTarget?.path) {
      try {
        const normalized = normalizePath(activeTarget.path);
        await navigator.clipboard.writeText(normalized);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy text: ', err);
      }
    }
  };

  const getModeInfo = (mode: SecurityScanMode) => {
    switch (mode) {
      case 'QUICK':
        return { icon: Shield, label: 'Quick Security Scan', desc: 'Scan for secrets and sensitive files only' };
      case 'GIT_EXPOSURE':
        return { icon: Lock, label: 'Git Exposure Scan', desc: 'Check tracked files and Git exposures' };
      case 'FULL':
        return { icon: Search, label: 'Full Security Scan', desc: 'Complete security analysis' };
    }
  };

  const currentModeInfo = getModeInfo(scanMode);
  const CurrentIcon = currentModeInfo.icon;

  return (
    <div className="grid grid-cols-1 md:grid-cols-[minmax(250px,1.2fr)_minmax(250px,1fr)_minmax(200px,0.8fr)_minmax(200px,0.8fr)] gap-4">
      {/* 1. Scan Target */}
      <div className="bg-surface border border-border p-4 rounded-xl shadow-sm flex flex-col justify-between group relative overflow-hidden min-w-0">
        <div className="flex flex-col gap-1 min-w-0 z-10">
          <div className="flex items-center justify-between">
             <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Scan Target</span>
             <button 
                onClick={onChangeTarget}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-muted-foreground hover:text-primary rounded shrink-0 focus:opacity-100 outline-none"
                title="Change Target"
                disabled={isScanning}
             >
                <Pencil className="w-4 h-4 shrink-0" />
             </button>
          </div>
          
          {activeTarget ? (
            <div className="flex items-center gap-4 mt-1 min-w-0">
              <div className="shrink-0 w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <Folder className="w-6 h-6 shrink-0 text-primary" />
              </div>
              <div className="flex-1 min-w-0 flex flex-col">
                <span className="text-base font-bold text-foreground truncate" title={activeTarget.name}>{activeTarget.name}</span>
                <div className="flex items-center gap-2 group/path text-muted-foreground min-w-0">
                  <span className="text-xs font-mono truncate" title={normalizePath(activeTarget.path)}>
                    {normalizePath(activeTarget.path)}
                  </span>
                  <button 
                    onClick={handleCopy}
                    className="opacity-0 group-hover/path:opacity-100 text-muted-foreground hover:text-foreground transition-opacity focus:outline-none shrink-0 focus:opacity-100"
                    title="Copy Path"
                  >
                    {copied ? <Check className="w-4 h-4 shrink-0 text-success" /> : <Copy className="w-4 h-4 shrink-0" />}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4 mt-1 min-w-0">
              <div className="shrink-0 w-12 h-12 bg-destructive/10 rounded-lg flex items-center justify-center">
                <Folder className="w-6 h-6 shrink-0 text-destructive" />
              </div>
              <div className="flex-1 min-w-0 flex flex-col">
                <span className="font-medium text-destructive truncate">No target selected</span>
                <span className="text-xs text-muted-foreground truncate">Select a project folder.</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2. Scan Mode */}
      <div className="bg-surface border border-border p-4 rounded-xl shadow-sm flex flex-col relative z-20 min-w-0">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 shrink-0">Scan Mode</span>
        <div className="relative flex-1 min-w-0" ref={dropdownRef}>
          <button
            className={`w-full flex items-center justify-between p-2.5 rounded-lg border bg-background/50 hover:bg-background transition-colors text-left min-w-0 ${isScanning ? 'opacity-50 cursor-not-allowed border-border' : 'border-border hover:border-primary/50'} focus:outline-none focus:ring-2 focus:ring-primary/20`}
            onClick={() => !isScanning && setIsDropdownOpen(!isDropdownOpen)}
            disabled={isScanning}
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="shrink-0 flex items-center justify-center w-5 h-5">
                <CurrentIcon className="w-5 h-5 shrink-0 text-primary" />
              </div>
              <span className="text-sm font-medium text-foreground truncate">{currentModeInfo.label}</span>
            </div>
            <div className="shrink-0 flex items-center justify-center ml-2">
              <ChevronDown className={`w-4 h-4 shrink-0 text-muted-foreground transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </div>
          </button>

          {isDropdownOpen && (
            <div className="absolute top-full left-0 mt-2 bg-surface border border-border rounded-xl shadow-lg overflow-hidden py-1 z-50 min-w-[320px] max-w-[400px]">
              {(['QUICK', 'GIT_EXPOSURE', 'FULL'] as SecurityScanMode[]).map((mode) => {
                const info = getModeInfo(mode);
                const Icon = info.icon;
                const isSelected = scanMode === mode;
                return (
                  <button
                    key={mode}
                    className={`w-full flex items-start gap-3 p-3 text-left transition-colors hover:bg-surface-hover ${isSelected ? 'bg-primary/5' : ''}`}
                    onClick={() => {
                      onScanModeChange(mode);
                      setIsDropdownOpen(false);
                    }}
                  >
                    <div className="shrink-0 w-5 h-5 flex items-center justify-center mt-0.5">
                      <Icon className={`w-5 h-5 shrink-0 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 min-w-0">
                        <span className={`text-sm font-medium truncate ${isSelected ? 'text-foreground' : 'text-foreground/80'}`}>{info.label}</span>
                        {isSelected && (
                          <div className="shrink-0 flex items-center justify-center w-4 h-4">
                            <Check className="w-4 h-4 shrink-0 text-primary" />
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 pr-6 line-clamp-2">{info.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 3. Configuration */}
      <div className="bg-surface border border-border p-4 rounded-xl shadow-sm flex flex-col justify-between overflow-hidden min-w-0">
         <div className="flex flex-col gap-1 min-w-0">
           <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider shrink-0">Configuration</span>
           <div className="flex items-start gap-3 mt-1 min-w-0">
             <div className="shrink-0 w-5 h-5 flex items-center justify-center mt-0.5">
               <Settings className="w-5 h-5 shrink-0 text-muted-foreground" />
             </div>
             <div className="flex flex-col min-w-0 flex-1">
               <span className="text-sm font-medium text-foreground truncate">Default settings</span>
               <span className="text-xs text-muted-foreground truncate">All scanners enabled</span>
             </div>
           </div>
         </div>
      </div>

      {/* 4. Last Scan */}
      <div className="bg-surface border border-border p-4 rounded-xl shadow-sm flex flex-col justify-between overflow-hidden min-w-0">
        <div className="flex flex-col gap-1 min-w-0">
           <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider shrink-0">Last Scan</span>
           <div className="flex items-start gap-3 mt-1 min-w-0">
             <div className="shrink-0 w-5 h-5 flex items-center justify-center mt-0.5">
               <Clock className="w-5 h-5 shrink-0 text-muted-foreground" />
             </div>
             <div className="flex flex-col min-w-0 flex-1">
               <span className="text-sm font-medium text-foreground truncate">Not available</span>
               <span className="text-xs text-muted-foreground truncate">-</span>
             </div>
           </div>
        </div>
      </div>
    </div>
  );
}
