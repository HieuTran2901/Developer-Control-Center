import { Icon } from '@/shared/components/ui/Icon';
import { Button } from '@/shared/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { useWorkspace } from '@/shared/hooks/useWorkspace';
import { usePipelineContext } from '../context/PipelineContext';
import { useNavigate } from 'react-router-dom';

export function CICDHeader() {
  const { workspace } = useWorkspace();
  const { selectedProject, setSelectedProjectId, setActiveTab } = usePipelineContext();
  const navigate = useNavigate();

  const handleNewPipelineClick = () => {
    if (!selectedProject) {
      // Could show a toast here if we imported useToast, but for now just don't do anything
      // or open the tab which will show the "please select project" message
    }
    setActiveTab('pipelines');
  };

  const hasProjects = workspace?.projects && workspace.projects.length > 0;

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
            <Button variant="outline" size="sm" className="h-9 gap-2 bg-muted/20 border-border/40 min-w-[140px] justify-between">
              <div className="flex items-center gap-2 overflow-hidden">
                <Icon name="Box" size={16} className="text-green-500 shrink-0" />
                <span className="truncate">
                  {selectedProject ? selectedProject.name : 'Select Project'}
                </span>
              </div>
              <Icon name="ChevronDown" size={14} className="text-muted-foreground shrink-0 ml-2" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[200px]">
            {hasProjects ? (
              workspace.projects.map((project) => (
                <DropdownMenuItem 
                  key={project.id} 
                  onClick={() => setSelectedProjectId(project.id)}
                  className={selectedProject?.id === project.id ? 'bg-muted' : ''}
                >
                  {project.name}
                </DropdownMenuItem>
              ))
            ) : (
              <DropdownMenuItem onClick={() => navigate('/workspace')}>
                No projects. Go to Workspace.
              </DropdownMenuItem>
            )}
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
        
        <Button 
          size="sm" 
          className="h-9 gap-2 ml-2 bg-blue-600 hover:bg-blue-700 text-white"
          onClick={handleNewPipelineClick}
        >
          <Icon name="Plus" size={16} className="shrink-0" />
          New Pipeline
        </Button>
      </div>
    </div>
  );
}
