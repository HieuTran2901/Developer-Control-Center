import { Icon } from '@/shared/components/ui/Icon';

export function Header() {
  return (
    <header className="h-16 border-b border-border/40 bg-[#0d1117]/80 backdrop-blur-md flex items-center justify-between px-8 flex-shrink-0 z-10 sticky top-0 transition-all select-none">
      <div className="flex-1">
        {/* Placeholder for left-side tools if needed */}
      </div>

      <div className="flex-1 max-w-[480px] mx-4">
        <div className="relative group">
          <Icon name="Search" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4 transition-colors group-hover:text-primary" />
          <input 
            type="text" 
            placeholder="Search projects, commands..." 
            className="w-full bg-[#161b22] border border-border/60 focus:border-blue-500/80 focus:bg-background focus:ring-1 focus:ring-blue-500/30 rounded-md pl-10 pr-16 py-1.5 text-xs outline-none transition-all placeholder:text-muted-foreground/50 text-foreground"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 bg-muted/60 border border-border/80 px-1.5 py-0.5 rounded text-[10px] text-muted-foreground font-mono font-medium pointer-events-none select-none flex items-center gap-0.5 shadow-sm">
            <span>Ctrl</span>
            <span>K</span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-end space-x-3">
        <button className="relative p-2 rounded-md hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors" title="Light Mode">
          <Icon name="Sun" size={18} />
        </button>
        <button className="relative p-2 rounded-md hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors" title="Notifications">
          <Icon name="Bell" size={18} />
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500 border border-[#0d1117]"></span>
        </button>
        <div className="w-8 h-8 rounded-full bg-[#2563eb] cursor-pointer overflow-hidden shadow-sm flex items-center justify-center text-sm font-semibold text-white ml-2 hover:bg-[#3b82f6] transition-colors" title="User Profile">
          D
        </div>
      </div>
    </header>
  );
}
