import { useState } from 'react';
import { ShieldCheck, Filter, Play } from 'lucide-react';
import { SecurityFinding, SecurityScanStatus } from '@/domain/entities/SecurityFinding';

interface SecurityActiveFindingsProps {
  findings: SecurityFinding[];
  status: SecurityScanStatus;
  onRunScan: () => void;
  hasTarget: boolean;
}

type FilterLevel = 'All' | 'Critical' | 'High' | 'Medium' | 'Low';

const normalizePath = (p: string) => {
  if (!p) return p;
  // Remove Windows extended-path prefix \\?\
  if (p.startsWith('\\\\?\\')) {
    return p.substring(4);
  }
  return p;
};

export function SecurityActiveFindings({ findings, status, onRunScan, hasTarget }: SecurityActiveFindingsProps) {
  const [activeFilter, setActiveFilter] = useState<FilterLevel>('All');

  const filteredFindings = findings.filter(f => {
    if (activeFilter === 'All') return true;
    return f.severity.toUpperCase() === activeFilter.toUpperCase();
  });

  const getSeverityColor = (severity: string) => {
    switch (severity.toUpperCase()) {
      case 'CRITICAL': return 'bg-danger/10 text-danger border-danger/20';
      case 'HIGH': return 'bg-warning/10 text-warning border-warning/20';
      case 'MEDIUM': return 'bg-accent/10 text-accent border-accent/20';
      case 'LOW': return 'bg-primary/10 text-primary border-primary/20';
      default: return 'bg-surface-hover text-muted-foreground border-border';
    }
  };

  return (
    <div className="bg-surface border border-border rounded-xl shadow-sm flex flex-col">
      {/* Header & Filters */}
      <div className="p-4 sm:p-5 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h3 className="font-semibold text-lg text-foreground">Active Findings</h3>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {(['All', 'Critical', 'High', 'Medium', 'Low'] as FilterLevel[]).map(level => (
            <button
              key={level}
              onClick={() => setActiveFilter(level)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors whitespace-nowrap ${
                activeFilter === level
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background hover:bg-surface-hover text-muted-foreground border border-border'
              }`}
            >
              {level}
            </button>
          ))}
          <button className="px-3 py-1.5 text-xs font-medium rounded-full bg-background hover:bg-surface-hover text-muted-foreground border border-border flex items-center gap-1.5 transition-colors whitespace-nowrap ml-2">
            <Filter className="w-3.5 h-3.5" />
            Filters
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col min-h-[300px]">
        {findings.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center max-w-md mx-auto px-4 w-full h-full py-8">
            <div className="w-28 h-28 mb-8 rounded-full bg-primary/5 flex items-center justify-center relative flex-shrink-0">
              <div className="absolute inset-0 rounded-full bg-primary/10 animate-pulse" />
              <ShieldCheck className="w-14 h-14 text-primary relative z-10 flex-shrink-0" />
            </div>
            
            <h3 className="text-xl font-bold text-foreground mb-3 flex-shrink-0">
              {status === 'COMPLETED' ? 'No security issues found' : 'No security scan has been run'}
            </h3>
            
            <p className="text-sm text-muted-foreground mb-8 flex-shrink-0 leading-relaxed">
              {status === 'COMPLETED' 
                ? 'Your project looks secure! Run a scan anytime to re-analyze for secrets, vulnerable dependencies, and misconfigurations.'
                : 'Run a scan to analyze your project for secrets, vulnerable dependencies, and misconfigurations.'}
            </p>
            
            {status !== 'SCANNING' && (
              <button 
                onClick={onRunScan}
                disabled={!hasTarget}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg transition-colors font-semibold text-sm shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
              >
                <Play className="w-4 h-4 fill-current" />
                Run Security Scan
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredFindings.map((f) => {
              const isDependency = f.category === 'DEPENDENCY' || (f.metadata && f.metadata.type === 'Dependency');
              const meta = f.metadata?.type === 'Dependency' ? f.metadata.data : null;
              
              return (
                <div key={f.id} className="p-4 sm:p-5 border border-border rounded-lg bg-background hover:border-border/80 transition-colors shadow-sm">
                  <div className="flex justify-between items-start gap-4">
                    <span className={`font-semibold text-foreground text-sm leading-tight break-words min-w-0 ${f.severity.toUpperCase() === 'CRITICAL' || f.severity.toUpperCase() === 'HIGH' ? 'text-danger' : ''}`}>
                      {isDependency && meta ? `${meta.packageName} (${meta.version}) - ${f.title}` : f.title}
                    </span>
                    <div className="flex gap-2 flex-shrink-0">
                      {isDependency && meta && (
                        <span className="text-[10px] font-bold uppercase bg-primary/10 text-primary px-2 py-1 rounded border border-primary/20">
                          {meta.ecosystem}
                        </span>
                      )}
                      <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded border ${getSeverityColor(f.severity)}`}>
                        {f.severity}
                      </span>
                    </div>
                  </div>
                  {!isDependency && (
                    <p className="text-sm text-muted-foreground mt-2 break-words">{f.description}</p>
                  )}
                  
                  {isDependency && meta ? (
                    <div className="flex flex-col gap-5 mt-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Section 3 - Affected Dependency */}
                        <div className="flex flex-col gap-3 p-3 rounded-lg bg-surface border border-border">
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Affected Dependency</h4>
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <span className="text-foreground/60 text-xs">Ecosystem</span>
                            <span className="font-mono text-sm min-w-0 break-words">{meta.ecosystem}</span>
                          </div>
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <span className="text-foreground/60 text-xs">Package</span>
                            <span className="font-mono text-sm min-w-0 break-all">{meta.packageName}</span>
                          </div>
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <span className="text-foreground/60 text-xs">Version</span>
                            <span className="font-mono text-sm min-w-0 break-words">{meta.version}</span>
                          </div>
                        </div>

                        {/* Section 4 - Vulnerability Identity */}
                        <div className="flex flex-col gap-3 p-3 rounded-lg bg-surface border border-border">
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Vulnerability</h4>
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <span className="text-foreground/60 text-xs">Primary ID</span>
                            <span className="font-mono text-sm min-w-0 break-all">{meta.vulnerabilityId || 'N/A'}</span>
                          </div>
                          {meta.aliases && meta.aliases.length > 0 && (
                            <div className="flex flex-col gap-0.5 min-w-0">
                              <span className="text-foreground/60 text-xs">Aliases</span>
                              <span className="font-mono text-sm min-w-0 break-words text-muted-foreground">
                                {meta.aliases.join(', ')}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Section 5 - Fixed Version */}
                        <div className="flex flex-col gap-3 p-3 rounded-lg bg-surface border border-border">
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Fixed Version</h4>
                          <div className="flex flex-col gap-0.5 min-w-0">
                            {meta.fixedVersion ? (
                              <span className="font-mono text-sm text-foreground break-words">{meta.fixedVersion}</span>
                            ) : (
                              <span className="text-sm text-muted-foreground italic break-words">No verified fixed version provided by OSV.</span>
                            )}
                          </div>
                        </div>

                        {/* Section 7 - Location */}
                        <div className="flex flex-col gap-3 p-3 rounded-lg bg-surface border border-border">
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Location</h4>
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <span className="font-mono text-sm min-w-0 break-all text-muted-foreground" title={normalizePath(f.filePath)}>
                              {normalizePath(f.filePath)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Section 6 - Details / Why it matters */}
                      <div className="flex flex-col gap-2">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Why it matters</h4>
                        <div className="text-sm text-muted-foreground bg-surface p-4 rounded-lg border border-border whitespace-pre-wrap break-words max-h-60 overflow-y-auto overflow-x-hidden min-w-0">
                          {meta.details || f.description}
                        </div>
                      </div>

                      {/* Section 8 - References */}
                      {meta.references && meta.references.length > 0 && (
                        <div className="flex flex-col gap-2">
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">References</h4>
                          <div className="flex flex-wrap gap-2">
                            {meta.references.map((ref, idx) => {
                              let hostname = 'Link';
                              try {
                                hostname = new URL(ref).hostname;
                              } catch (e) {
                                // Invalid URL, fallback to 'Link'
                              }
                              return (
                                <a
                                  key={idx}
                                  href={ref}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-surface border border-border rounded-full text-xs font-medium text-foreground hover:bg-surface-hover hover:text-primary transition-colors max-w-full"
                                >
                                  <span className="truncate max-w-[200px]">{hostname}</span>
                                  <span className="opacity-50">↗</span>
                                </a>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Section 9 - Remediation */}
                      {f.remediation && (
                        <div className="flex flex-col gap-2 mt-2">
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recommended Action</h4>
                          <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg text-primary text-sm font-medium">
                            {f.remediation}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground mt-4 font-mono bg-surface p-3 rounded-md border border-border flex flex-col gap-2 overflow-hidden">
                      <div className="flex gap-3 min-w-0">
                        <span className="text-foreground/50 w-20 flex-shrink-0">Path:</span>
                        <span className="break-all min-w-0">
                          {normalizePath(f.filePath)}{f.line ? `:${f.line}` : ''}
                        </span>
                      </div>
                      {f.evidence && (
                        <div className="flex gap-3 min-w-0">
                          <span className="text-foreground/50 w-20 flex-shrink-0">Evidence:</span>
                          <span className="break-all min-w-0 text-warning/90 bg-warning/5 px-2 py-1 rounded">
                            {typeof f.evidence === 'string' ? f.evidence : JSON.stringify(f.evidence)}
                          </span>
                        </div>
                      )}
                      {f.remediation && (
                        <div className="text-primary mt-1 break-words min-w-0">
                          {f.remediation}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            
            {filteredFindings.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                No findings match the selected filter.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
