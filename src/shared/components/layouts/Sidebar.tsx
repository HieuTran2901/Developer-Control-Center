import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Icon, IconName } from '@/shared/components/ui/Icon';
import { cn } from '@/shared/utils';

const navItems: { icon: IconName; label: string; path: string }[] = [
  { icon: 'LayoutDashboard', label: 'Dashboard', path: '/' },
  { icon: 'Briefcase', label: 'Workspace', path: '/workspace' },
  { icon: 'Activity', label: 'Processes', path: '/processes' },
  { icon: 'Terminal', label: 'Terminal', path: '/terminal' },
  { icon: 'List', label: 'Logs', path: '/logs' },
  { icon: 'Settings', label: 'Settings', path: '/settings' },
  { icon: 'Info', label: 'About', path: '/about' },
];

export function Sidebar() {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <aside 
      className={cn(
        "flex-shrink-0 h-full border-r border-border bg-card/80 backdrop-blur-xl flex flex-col transition-all duration-200 ease-in-out",
        isExpanded ? "w-[250px]" : "w-[72px]"
      )}
    >
      <div className={cn("p-6 flex items-center h-20 shrink-0", isExpanded ? "space-x-3 justify-start" : "justify-center px-0")}>
        <div className="w-3.5 h-3.5 rounded-full bg-blue-500 shrink-0 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
        <span 
          className={cn(
            "font-bold text-lg tracking-tight whitespace-nowrap overflow-hidden transition-all duration-200",
            isExpanded ? "opacity-100 w-auto" : "opacity-0 w-0"
          )}
        >
          DevControl
        </span>
      </div>

      <nav className="flex-1 px-3 space-y-1 mt-2 overflow-y-auto overflow-x-hidden">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            title={!isExpanded ? item.label : undefined}
            className={({ isActive }) =>
              cn(
                'flex items-center rounded-lg text-sm font-medium transition-colors duration-150 h-10',
                isExpanded ? 'px-3 space-x-3 justify-start' : 'justify-center',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )
            }
          >
            <Icon name={item.icon} size={18} className="shrink-0" />
            <span 
              className={cn(
                "whitespace-nowrap overflow-hidden transition-all duration-200",
                isExpanded ? "opacity-100 w-auto" : "opacity-0 w-0 hidden"
              )}
            >
              {item.label}
            </span>
          </NavLink>
        ))}
      </nav>
      
      <div className="p-3 mt-auto shrink-0 space-y-3">
        {isExpanded ? (
          <div className="p-4 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
            <h4 className="text-sm font-semibold mb-1 truncate">Status</h4>
            <p className="text-xs text-muted-foreground flex items-center truncate">
              <span className="w-2 h-2 rounded-full bg-success mr-2 shrink-0"></span> 
              All systems operational
            </p>
          </div>
        ) : (
          <div className="mx-auto w-10 h-10 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 flex items-center justify-center" title="All systems operational">
            <span className="w-2.5 h-2.5 rounded-full bg-success"></span>
          </div>
        )}
        
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-center p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          title={isExpanded ? "Collapse Sidebar" : "Expand Sidebar"}
        >
          <Icon name={isExpanded ? "PanelLeftClose" : "PanelLeftOpen"} size={18} />
        </button>
        {isExpanded && (
          <div className="text-[10px] text-muted-foreground/50 text-center select-none">
            v1.0.0
          </div>
        )}
      </div>
    </aside>
  );
}
