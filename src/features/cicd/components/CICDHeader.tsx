import { Icon } from '@/shared/components/ui/Icon';
import { Button } from '@/shared/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';

export function CICDHeader() {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          CI/CD
        </h1>
        <p className="text-sm text-muted-foreground">
          Build, test and deploy your applications
        </p>
      </div>
      
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-2 bg-muted/20 border-border/40">
              <Icon name="Box" size={16} className="text-green-500 shrink-0" />
              market-frontend
              <Icon name="ChevronDown" size={14} className="text-muted-foreground shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>market-frontend</DropdownMenuItem>
            <DropdownMenuItem>market-backend</DropdownMenuItem>
            <DropdownMenuItem>ai-service</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-2 bg-muted/20 border-border/40">
              <Icon name="GitBranch" size={16} className="text-muted-foreground shrink-0" />
              main
              <Icon name="ChevronDown" size={14} className="text-muted-foreground shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>main</DropdownMenuItem>
            <DropdownMenuItem>develop</DropdownMenuItem>
            <DropdownMenuItem>feature/cicd</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        
        <div className="relative ml-2">
          <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground shrink-0" />
          <input 
            type="text" 
            placeholder="Search (Ctrl+K)" 
            className="h-9 w-48 lg:w-64 bg-muted/20 border border-border/40 rounded-md pl-9 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary transition-all placeholder:text-muted-foreground/60"
          />
        </div>
        
        <Button size="sm" className="h-9 gap-2 ml-2 bg-blue-600 hover:bg-blue-700 text-white">
          <Icon name="Plus" size={16} className="shrink-0" />
          New Pipeline
          <Icon name="ChevronDown" size={14} className="shrink-0 ml-1 opacity-70" />
        </Button>
      </div>
    </div>
  );
}
