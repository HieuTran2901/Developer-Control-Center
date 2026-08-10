interface SecurityTabsProps {
  activeTab: 'overview' | 'history';
  onTabChange: (tab: 'overview' | 'history') => void;
}

export function SecurityTabs({ activeTab, onTabChange }: SecurityTabsProps) {
  return (
    <div className="flex items-center gap-6 border-b border-border">
      <button
        onClick={() => onTabChange('overview')}
        className={`pb-3 text-sm font-medium transition-colors relative ${
          activeTab === 'overview' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        Overview
        {activeTab === 'overview' && (
          <div className="absolute bottom-[-1px] left-0 w-full h-[2px] bg-primary rounded-t" />
        )}
      </button>
      <button
        onClick={() => onTabChange('history')}
        className={`pb-3 text-sm font-medium transition-colors relative ${
          activeTab === 'history' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        History
        {activeTab === 'history' && (
          <div className="absolute bottom-[-1px] left-0 w-full h-[2px] bg-primary rounded-t" />
        )}
      </button>
    </div>
  );
}
