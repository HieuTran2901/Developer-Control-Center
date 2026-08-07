import { useEffect, useState } from 'react';
import { Icon } from '@/shared/components/ui/Icon';
import { Workspace } from '@/domain/entities/Workspace';
import { cn } from '@/shared/utils';
import { Button } from '@/shared/components/ui/button';

interface WorkspaceSidebarProps {
  workspace: Workspace;
  selectedProjectId: string | null;
  selectedProfileId: string | null;
  onSelectProject: (projectId: string) => void;
  onSelectProfile: (projectId: string, profileId: string) => void;
  onCreateProject: () => void;
  onCreateProfile: (projectId: string) => void;
}

export function WorkspaceSidebar({
  workspace,
  selectedProjectId,
  selectedProfileId,
  onSelectProject,
  onSelectProfile,
  onCreateProject,
  onCreateProfile
}: WorkspaceSidebarProps) {
  console.log("[RUNTIME] WorkspaceSidebar file:", import.meta.url);
  console.log('[DEBUG 7 WorkspaceSidebar] Rendered. project count:', workspace?.projects?.length);

  const [isWorkspaceExpanded, setIsWorkspaceExpanded] = useState(true);
  const [isProjectsExpanded, setIsProjectsExpanded] = useState(true);
  const [isProfilesExpanded, setIsProfilesExpanded] = useState(false);
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  const [filterText, setFilterText] = useState('');

  useEffect(() => {
    console.log('[TRACE] AddProject Button Rendered');
  }, []);

  const toggleProject = (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedProjects(prev => ({
      ...prev,
      [projectId]: !prev[projectId]
    }));
  };

  const handlePlusClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log("[RUNTIME] Click");
    console.log('[TRACE] AddProject Clicked');
    onCreateProject();
  };

  const projectsList = workspace?.projects || [];
  const filteredProjects = projectsList.filter(p => 
    p.name.toLowerCase().includes(filterText.toLowerCase())
  );
  const totalProjects = projectsList.length;
  
  // Calculate total profiles
  const allProfiles = projectsList.flatMap(p => p.profiles.map(pr => ({ ...pr, projectId: p.id })));
  const totalProfiles = allProfiles.length;

  return (
    <div className="flex flex-col h-full select-none bg-[#0d1117] text-[#c9d1d9] font-sans">
      {/* Explorer Header */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Explorer</span>
        <div className="flex items-center space-x-1.5">
          <Button 
            size="sm" 
            className="h-5 w-5 p-0 bg-blue-600 hover:bg-blue-700 text-white rounded" 
            onClick={handlePlusClick}
            title="New Project"
          >
            <Icon name="Plus" size={12} />
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground hover:bg-transparent"
            title="Add Folder"
            onClick={handlePlusClick}
          >
            <Icon name="FolderPlus" size={13} />
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground hover:bg-transparent"
            title="Refresh Explorer"
          >
            <Icon name="RotateCw" size={13} />
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground hover:bg-transparent"
            title="More Actions"
          >
            <Icon name="MoreVertical" size={13} />
          </Button>
        </div>
      </div>

      {/* Filter Input */}
      <div className="px-3 pb-3">
        <div className="relative">
          <input 
            type="text"
            placeholder="Filter projects..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="w-full h-7 bg-[#161b22] border border-border/60 rounded px-2.5 pr-8 text-[11px] outline-none placeholder:text-muted-foreground/40 focus:border-blue-500/80 focus:ring-1 focus:ring-blue-500/20 text-foreground transition-all"
          />
          <Icon name="Search" size={11} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 pointer-events-none" />
        </div>
      </div>

      {/* Tree Section */}
      <div className="flex-1 overflow-y-auto px-1 space-y-0.5">
        {/* Workspace Root Node */}
        <div>
          <div 
            onClick={() => setIsWorkspaceExpanded(!isWorkspaceExpanded)}
            className="flex items-center px-2 py-1.5 rounded-md hover:bg-muted/30 cursor-pointer text-xs font-semibold text-foreground/90 transition-colors"
          >
            <Icon 
              name={isWorkspaceExpanded ? "ChevronDown" : "ChevronRight"} 
              size={13} 
              className="mr-1.5 text-muted-foreground/60 shrink-0" 
            />
            <Icon name="Briefcase" size={13} className="mr-2 text-blue-500 shrink-0" />
            <span className="truncate">{workspace.name}</span>
          </div>

          {/* Root Content */}
          {isWorkspaceExpanded && (
            <div className="mt-0.5">
              
              {/* Virtual Folder: Projects */}
              <div>
                <div 
                  onClick={() => setIsProjectsExpanded(!isProjectsExpanded)}
                  className="flex items-center justify-between px-2 py-1.5 ml-3 rounded-md hover:bg-muted/30 cursor-pointer text-xs text-foreground/80 transition-colors"
                >
                  <div className="flex items-center overflow-hidden">
                    <Icon 
                      name={isProjectsExpanded ? "ChevronDown" : "ChevronRight"} 
                      size={12} 
                      className="mr-1.5 text-muted-foreground/60 shrink-0" 
                    />
                    <Icon name="FolderOpen" size={13} className="mr-2 text-yellow-600/80 shrink-0" />
                    <span className="truncate">Projects</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground bg-muted/40 px-1.5 py-0.2 rounded-full font-semibold">{totalProjects}</span>
                </div>

                {/* Projects List */}
                {isProjectsExpanded && (
                  <div className="ml-6 space-y-0.5 mt-0.5">
                    {filteredProjects.map(project => {
                      const isExpanded = !!expandedProjects[project.id];
                      return (
                        <div key={project.id}>
                          <div 
                            onClick={() => onSelectProject(project.id)}
                            className={cn(
                              "flex items-center group justify-between px-2 py-1 rounded-md cursor-pointer text-xs transition-colors",
                              selectedProjectId === project.id && !selectedProfileId 
                                ? "bg-[#1f2937]/60 text-blue-400 font-medium" 
                                : "text-foreground/75 hover:bg-muted/30 hover:text-foreground"
                            )}
                          >
                            <div className="flex items-center overflow-hidden flex-1">
                              <button 
                                onClick={(e) => toggleProject(project.id, e)}
                                className="p-0.5 mr-1 hover:bg-muted/50 rounded shrink-0"
                              >
                                <Icon 
                                  name={isExpanded ? "ChevronDown" : "ChevronRight"} 
                                  size={11} 
                                  className="text-muted-foreground/60" 
                                />
                              </button>
                              <Icon name="FolderGit2" size={12} className="mr-1.5 text-blue-500/70 shrink-0" />
                              <span className="truncate flex-1">{project.name}</span>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-20 w-20 p-0 opacity-0 group-hover:opacity-100 hover:bg-muted/50 rounded shrink-0" 
                              onClick={(e) => { e.stopPropagation(); onCreateProfile(project.id); }}
                              title="New Profile"
                            >
                              <Icon name="Plus" size={11} />
                            </Button>
                          </div>

                          {/* Nested Profiles list */}
                          {isExpanded && (
                            <div className="ml-4 pl-2 border-l border-border/30 space-y-0.5 mt-0.5">
                              {project.profiles.map(profile => (
                                <div 
                                  key={profile.id}
                                  onClick={() => onSelectProfile(project.id, profile.id)}
                                  className={cn(
                                    "flex items-center px-2 py-1 rounded-md cursor-pointer text-[11px] transition-colors",
                                    selectedProfileId === profile.id 
                                      ? "bg-[#2563eb]/20 text-blue-400 font-medium" 
                                      : "text-muted-foreground hover:bg-muted/20 hover:text-foreground"
                                  )}
                                >
                                  <Icon name="Terminal" size={11} className="mr-2 text-muted-foreground/70 shrink-0" />
                                  <span className="truncate">{profile.name}</span>
                                </div>
                              ))}
                              {project.profiles.length === 0 && (
                                <div className="text-[10px] text-muted-foreground/50 px-2 py-0.5 italic">
                                  No profiles
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {filteredProjects.length === 0 && (
                      <div className="text-[11px] text-muted-foreground/50 px-2 py-1 italic">
                        No projects found
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Virtual Folder: Profiles */}
              <div className="mt-1">
                <div 
                  onClick={() => setIsProfilesExpanded(!isProfilesExpanded)}
                  className="flex items-center justify-between px-2 py-1.5 ml-3 rounded-md hover:bg-muted/30 cursor-pointer text-xs text-foreground/80 transition-colors"
                >
                  <div className="flex items-center overflow-hidden">
                    <Icon 
                      name={isProfilesExpanded ? "ChevronDown" : "ChevronRight"} 
                      size={12} 
                      className="mr-1.5 text-muted-foreground/60 shrink-0" 
                    />
                    <Icon name="FolderOpen" size={13} className="mr-2 text-yellow-600/80 shrink-0" />
                    <span className="truncate">Profiles</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground bg-muted/40 px-1.5 py-0.2 rounded-full font-semibold">{totalProfiles}</span>
                </div>

                {/* Profiles List */}
                {isProfilesExpanded && (
                  <div className="ml-6 space-y-0.5 mt-0.5">
                    {allProfiles.map(profile => (
                      <div 
                        key={profile.id}
                        onClick={() => onSelectProfile(profile.projectId, profile.id)}
                        className={cn(
                          "flex items-center px-2 py-1 rounded-md cursor-pointer text-[11px] transition-colors",
                          selectedProfileId === profile.id 
                            ? "bg-[#2563eb]/20 text-blue-400 font-medium" 
                            : "text-muted-foreground hover:bg-muted/20 hover:text-foreground"
                        )}
                      >
                        <Icon name="Terminal" size={11} className="mr-2 text-muted-foreground/70 shrink-0" />
                        <span className="truncate flex-1">{profile.name}</span>
                      </div>
                    ))}
                    {totalProfiles === 0 && (
                      <div className="text-[11px] text-muted-foreground/50 px-2 py-1 italic">
                        No profiles configured
                      </div>
                    )}
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
      </div>

      {/* Explorer Footer */}
      <div className="px-4 py-2.5 border-t border-border/30 bg-[#0d1117] flex items-center justify-between text-[10px] text-muted-foreground mt-auto shrink-0">
        <span className="truncate max-w-[120px]">{workspace.name}</span>
        <span className="text-blue-500 font-semibold">{totalProjects} projects</span>
      </div>
    </div>
  );
}
