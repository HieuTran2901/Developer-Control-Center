import { Lock, Code2, Settings, FileText } from 'lucide-react';

export function SecurityCapabilities() {
  const capabilities = [
    {
      title: 'Secrets',
      description: 'API keys, tokens, passwords, and other sensitive data',
      icon: Lock,
      color: 'text-primary',
      bg: 'bg-primary/10'
    },
    {
      title: 'Dependencies',
      description: 'Known vulnerabilities in third-party libraries',
      icon: Code2,
      color: 'text-[#8b5cf6]', // Purple
      bg: 'bg-[#8b5cf6]/10'
    },
    {
      title: 'Configurations',
      description: 'Security misconfigurations and best practice violations',
      icon: Settings,
      color: 'text-success', // Green
      bg: 'bg-success/10'
    },
    {
      title: 'Files',
      description: 'Sensitive files and risky file permissions',
      icon: FileText,
      color: 'text-warning', // Amber
      bg: 'bg-warning/10'
    }
  ];

  return (
    <div className="flex flex-col gap-4 mt-2">
      <h3 className="font-semibold text-sm text-foreground">What we scan</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {capabilities.map((cap, i) => (
          <div key={i} className="bg-surface border border-border p-4 rounded-xl shadow-sm flex items-center gap-4">
            <div className={`p-3 rounded-xl flex-shrink-0 flex items-center justify-center ${cap.bg}`}>
              <cap.icon className={`w-5 h-5 ${cap.color}`} />
            </div>
            <div className="flex flex-col gap-1 min-w-0 flex-1">
              <span className="font-semibold text-foreground text-sm leading-tight">{cap.title}</span>
              <span className="text-xs text-muted-foreground leading-snug">{cap.description}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
