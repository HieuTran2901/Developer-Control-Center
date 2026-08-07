import { PageContainer } from "@/shared/components/layouts/PageContainer";
import { WorkspaceSidebar } from "../components/WorkspaceSidebar";
import { ProjectEditor } from "../components/ProjectEditor";
import { ProfileEditor } from "../components/ProfileEditor";
import { useWorkspace } from "@/shared/hooks/useWorkspace";
import {
  tauriDesktopGateway,
  workspaceRepository,
} from "@/application/services";
import { Project } from "@/domain/entities/Project";
import { RuntimeProfile } from "@/domain/entities/RuntimeProfile";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Icon } from "@/shared/components/ui/Icon";
import { Input } from "@/shared/components/ui/input";
import { useEffect, useState } from "react";

export function WorkspacePage() {
  const { workspace, session, updateSession } = useWorkspace();
  const selectedProjectId = session?.selectedProjectId;
  const selectedProfileId = session?.selectedProfileId;
  const [isCreateProjectDialogOpen, setIsCreateProjectDialogOpen] =
    useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectRootPath, setNewProjectRootPath] = useState("");

  console.log(
    "[DEBUG 5 WorkspacePage] Rendered. workspace === null?",
    workspace === null,
    "projects.length:",
    workspace?.projects?.length,
    "selectedProjectId:",
    selectedProjectId,
  );

  useEffect(() => {
    if (!isCreateProjectDialogOpen) {
      setNewProjectName("");
      setNewProjectRootPath("");
    }
  }, [isCreateProjectDialogOpen]);

  if (!workspace) {
    console.warn(
      "[DEBUG 5 WorkspacePage] Returning Loading UI because workspace is null",
    );
    return (
      <PageContainer title="Workspace" description="Loading workspace...">
        <div className="flex h-full items-center justify-center">
          Loading...
        </div>
      </PageContainer>
    );
  }

  const selectedProject = workspace.projects.find(
    (p) => p.id === selectedProjectId,
  );
  const selectedProfile = selectedProject?.profiles.find(
    (p) => p.id === selectedProfileId,
  );

  const handleOpenCreateProjectDialog = () => {
    console.log("[DEBUG 7 AddProject] handleCreateProject triggered!");
    setIsCreateProjectDialogOpen(true);
  };

  const handlePickNewProjectFolder = async () => {
    try {
      const selectedPath = await tauriDesktopGateway.selectFolder();

      if (!selectedPath) {
        console.log("[DEBUG 7 AddProject] User cancelled dialog");
        return;
      }

      const folderName = selectedPath.split(/[\\/]/).pop() || "New Project";
      setNewProjectRootPath(selectedPath);
      setNewProjectName((current) => (current.trim() ? current : folderName));
    } catch (err) {
      console.error(
        "[DEBUG 7 AddProject] Exception during folder selection:",
        err,
      );
    }
  };

  const handleCreateProject = async () => {
    const trimmedName = newProjectName.trim();
    const trimmedRootPath = newProjectRootPath.trim();

    if (!trimmedName || !trimmedRootPath) {
      return;
    }

    try {
      const newProject: Project = {
        id: `proj-${Date.now()}`,
        workspaceId: workspace.id,
        name: trimmedName,
        rootPath: trimmedRootPath,
        profiles: [],
      };
      console.log(
        "[DEBUG 7 AddProject] Calling workspaceRepository.addProject with:",
        newProject,
      );
      await workspaceRepository.addProject(newProject);
      console.log(
        "[DEBUG 7 AddProject] addProject finished. Updating session selectedProjectId...",
      );
      updateSession({
        selectedProjectId: newProject.id,
        selectedProfileId: undefined,
      });
      setIsCreateProjectDialogOpen(false);
    } catch (err) {
      console.error(
        "[DEBUG 7 AddProject] Exception during handleCreateProject:",
        err,
      );
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    await workspaceRepository.removeProject(projectId);
    if (selectedProjectId === projectId) {
      updateSession({
        selectedProjectId: undefined,
        selectedProfileId: undefined,
      });
    }
  };

  const handleUpdateProject = async (project: Project) => {
    // Repository doesn't have an update method yet, let's get WS, update and save
    const ws = await workspaceRepository.getWorkspace();
    const idx = ws.projects.findIndex((p) => p.id === project.id);
    if (idx >= 0) {
      ws.projects[idx] = project;
      await workspaceRepository.saveWorkspace(ws);
    }
  };

  const handleCreateProfile = async (projectId: string) => {
    const newProfile: RuntimeProfile = {
      id: `prof-${Date.now()}`,
      projectId,
      name: "New Profile",
      workingDirectory: "",
      command: "npm start",
      arguments: [],
    };
    await workspaceRepository.addProfile(projectId, newProfile);
    updateSession({
      selectedProjectId: projectId,
      selectedProfileId: newProfile.id,
    });
  };

  const handleDeleteProfile = async (projectId: string, profileId: string) => {
    await workspaceRepository.removeProfile(projectId, profileId);
    if (selectedProfileId === profileId) {
      updateSession({ selectedProfileId: undefined });
    }
  };

  const handleUpdateProfile = async (
    projectId: string,
    profile: RuntimeProfile,
  ) => {
    const ws = await workspaceRepository.getWorkspace();
    const p = ws.projects.find((p) => p.id === projectId);
    if (p) {
      const idx = p.profiles.findIndex((pr) => pr.id === profile.id);
      if (idx >= 0) {
        p.profiles[idx] = profile;
        await workspaceRepository.saveWorkspace(ws);
      }
    }
  };

  return (
    <PageContainer
      title="Workspace Manager"
      description="Configure your projects and runtime profiles."
      className="p-0 h-full overflow-hidden flex flex-col"
      actions={
        <div className="flex items-center bg-[#2563eb] rounded-md overflow-hidden text-white font-medium hover:bg-blue-600 transition-colors shadow-sm select-none">
          <Button 
            className="bg-transparent hover:bg-transparent shadow-none px-3.5 h-9 rounded-none text-xs flex items-center border-r border-blue-400/30"
            onClick={handleOpenCreateProjectDialog}
          >
            <Icon name="Plus" className="mr-2 h-16 w-16 text-white" />
            New Project
          </Button>
          <Button
            className="bg-transparent hover:bg-transparent shadow-none px-2.5 h-9 rounded-none text-xs flex items-center justify-center"
            title="Project Options"
            onClick={handleOpenCreateProjectDialog}
          >
            <Icon name="ChevronDown" className="h-3 w-3 text-white" />
          </Button>
        </div>
      }
    >
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <div className="w-[260px] border-r border-border/40 bg-[#0d1117]/40 flex flex-col shrink-0 overflow-y-auto">
          <WorkspaceSidebar
            workspace={workspace}
            selectedProjectId={selectedProjectId || null}
            selectedProfileId={selectedProfileId || null}
            onSelectProject={(id) =>
              updateSession({
                selectedProjectId: id,
                selectedProfileId: undefined,
              })
            }
            onSelectProfile={(projId, profId) =>
              updateSession({
                selectedProjectId: projId,
                selectedProfileId: profId,
              })
            }
            onCreateProject={handleOpenCreateProjectDialog}
            onCreateProfile={handleCreateProfile}
          />
        </div>

        {/* Resizer Splitter Handle */}
        <div className="w-[3px] bg-border/20 hover:bg-blue-500/30 cursor-col-resize flex items-center justify-center shrink-0 transition-all select-none group relative">
          <div className="absolute w-[5px] h-6 rounded bg-border/40 group-hover:bg-blue-400 flex flex-col justify-between py-1 px-[1px] shrink-0">
            <span className="w-0.5 h-0.5 rounded-full bg-muted-foreground/60"></span>
            <span className="w-0.5 h-0.5 rounded-full bg-muted-foreground/60"></span>
            <span className="w-0.5 h-0.5 rounded-full bg-muted-foreground/60"></span>
          </div>
        </div>

        {/* Right Detail Panel */}
        <div className="flex-1 bg-background/50 overflow-y-auto p-8">
          {!selectedProjectId && (
            <div className="flex flex-col h-full items-center justify-center text-center select-none animate-in fade-in duration-300">
              <div className="w-20 h-20 rounded-full bg-blue-500/10 flex items-center justify-center mb-6 shadow-inner">
                <Icon name="Briefcase" className="w-8 h-8 text-blue-500" />
              </div>
              <h3 className="font-semibold text-lg text-foreground mb-2 tracking-tight">
                No project or profile selected
              </h3>
              <p className="text-sm text-muted-foreground max-w-sm mb-12 leading-relaxed">
                Select a project or profile from the explorer to view and manage its details.
              </p>

              <div className="w-full max-w-xl bg-[#161b22]/30 border border-border/40 rounded-lg p-5">
                <div className="flex items-center justify-between border-b border-border/40 pb-3 mb-4">
                  <h3 className="text-sm font-semibold text-foreground/90">
                    Recent Workspaces
                  </h3>
                  <a href="#" className="text-xs text-blue-500 font-medium hover:underline flex items-center gap-0.5">
                    View all <Icon name="ChevronRight" size={12} />
                  </a>
                </div>

                <div className="space-y-3">
                  {session?.recentWorkspaces?.map((w) => (
                    <div
                      key={w.id}
                      className="flex items-center justify-between p-3.5 rounded-lg bg-[#161b22]/50 border border-border/40 hover:bg-[#161b22]/80 transition-all group"
                    >
                      <div className="flex items-center space-x-3.5 overflow-hidden">
                        <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                          <Icon name="Briefcase" className="w-4 h-4 text-blue-500" />
                        </div>
                        <div className="text-left overflow-hidden">
                          <p className="text-sm font-medium text-foreground truncate group-hover:text-blue-400 transition-colors">
                            {w.name}
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            Updated {new Date(w.lastOpened).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3 shrink-0">
                        <span className="text-[10px] font-bold text-green-500 bg-green-500/10 border border-green-500/20 px-2.5 py-0.5 rounded-full select-none">
                          Active
                        </span>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground hover:bg-muted/40"
                          title="Workspace Options"
                        >
                          <Icon name="MoreVertical" size={14} />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {(!session?.recentWorkspaces ||
                    session.recentWorkspaces.length === 0) && (
                    <div className="text-xs text-muted-foreground py-4 italic text-center">
                      No recent workspaces.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {selectedProjectId && !selectedProfileId && selectedProject && (
            <ProjectEditor
              project={selectedProject}
              onSave={handleUpdateProject}
              onDelete={() => handleDeleteProject(selectedProject.id)}
            />
          )}

          {selectedProjectId && selectedProfileId && selectedProfile && (
            <ProfileEditor
              profile={selectedProfile}
              onSave={(profile) =>
                handleUpdateProfile(selectedProjectId, profile)
              }
              onDelete={() =>
                handleDeleteProfile(selectedProjectId, selectedProfile.id)
              }
            />
          )}
        </div>
      </div>
      <Dialog
        open={isCreateProjectDialogOpen}
        onOpenChange={setIsCreateProjectDialogOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Project Name</label>
              <Input
                value={newProjectName}
                onChange={(event) => setNewProjectName(event.target.value)}
                placeholder="e.g. Developer Control Center"
                className="bg-[#161b22] border-border/50"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Root Path</label>
              <div className="flex gap-2">
                <Input
                  value={newProjectRootPath}
                  onChange={(event) =>
                    setNewProjectRootPath(event.target.value)
                  }
                  placeholder="Select project folder..."
                  className="bg-[#161b22] border-border/50 flex-1 font-mono text-sm"
                />
                <Button
                  variant="secondary"
                  onClick={handlePickNewProjectFolder}
                >
                  <Icon name="FolderOpen" size={16} className="mr-2" />
                  Browse
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setIsCreateProjectDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateProject}
              disabled={!newProjectName.trim() || !newProjectRootPath.trim()}
            >
              <Icon name="Plus" size={16} className="mr-2" />
              Add Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
