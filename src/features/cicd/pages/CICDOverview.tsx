import { PageContainer } from '@/shared/components/layouts/PageContainer';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/shared/components/ui/tabs';
import { Icon } from '@/shared/components/ui/Icon';
import { CICDHeader } from '../components/CICDHeader';
import { CICDMetricCards } from '../components/CICDMetricCards';
import { RecentPipelineRuns } from '../components/RecentPipelineRuns';
import { PipelineHealth } from '../components/PipelineHealth';
import { RecentDeployments } from '../components/RecentDeployments';
import { PipelineStages } from '../components/PipelineStages';
import { PipelineProvider, usePipelineContext } from '../context/PipelineContext';
import { PolicyApprovalDialog } from '../components/PolicyApprovalDialog';
import { PipelineGenerator } from '../components/PipelineGenerator';
import { EnvironmentManager } from '../components/EnvironmentManager';

import { PipelineHistory } from '../components/PipelineHistory';

function CICDContent() {
  const { activeTab, setActiveTab } = usePipelineContext();

  return (
    <PageContainer>
      <PolicyApprovalDialog />
      <div className="w-full h-full flex flex-col min-h-0 pt-2 px-4 md:px-6 pb-2 max-w-[1600px] mx-auto">
        <CICDHeader />
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex-1 flex flex-col min-h-0">
          <TabsList className="w-full justify-start border-b border-border/40 rounded-none bg-transparent p-0 h-12 space-x-6">
            <TabsTrigger 
              value="overview" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none h-12 px-0 py-3 gap-2"
            >
              <Icon name="LayoutDashboard" size={16} className="text-muted-foreground" />
              Overview
            </TabsTrigger>
            <TabsTrigger 
              value="pipelines" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none h-12 px-0 py-3 gap-2"
            >
              <Icon name="GitBranch" size={16} className="text-muted-foreground" />
              Pipelines
            </TabsTrigger>
            <TabsTrigger 
              value="history" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none h-12 px-0 py-3 gap-2"
            >
              <Icon name="History" size={16} className="text-muted-foreground" />
              History & Audit
            </TabsTrigger>
            <TabsTrigger 
              value="runs" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none h-12 px-0 py-3 gap-2"
            >
              <Icon name="PlayCircle" size={16} className="text-muted-foreground" />
              Runs
            </TabsTrigger>
            <TabsTrigger 
              value="environments" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none h-12 px-0 py-3 gap-2"
            >
              <Icon name="Server" size={16} className="text-muted-foreground" />
              Environments
            </TabsTrigger>
            <TabsTrigger 
              value="artifacts" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none h-12 px-0 py-3 gap-2"
            >
              <Icon name="Package" size={16} className="text-muted-foreground" />
              Artifacts
            </TabsTrigger>
            <TabsTrigger 
              value="settings" 
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none h-12 px-0 py-3 gap-2"
            >
              <Icon name="Settings" size={16} className="text-muted-foreground" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="!mt-0 outline-none data-[state=active]:flex flex-col flex-1">
            <CICDMetricCards />
            
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 flex-1 min-h-0">
              <RecentPipelineRuns />
              <div className="col-span-1 flex flex-col gap-6 h-full">
                <PipelineHealth />
                <RecentDeployments />
              </div>
            </div>

            <PipelineStages />
          </TabsContent>

          <TabsContent value="pipelines" className="!mt-0 outline-none flex-1 data-[state=active]:flex flex-col min-h-0 overflow-hidden">
            <PipelineGenerator />
          </TabsContent>
          <TabsContent value="history" className="!mt-0 outline-none flex-1 data-[state=active]:flex flex-col min-h-0 overflow-hidden">
            <PipelineHistory />
          </TabsContent>
          <TabsContent value="runs" className="!mt-0 outline-none">
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              Runs UI Content (Not implemented in this phase)
            </div>
          </TabsContent>
          <TabsContent value="environments" className="!mt-0 outline-none">
            <EnvironmentManager />
          </TabsContent>
          <TabsContent value="artifacts" className="!mt-0 outline-none">
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              Artifacts UI Content (Not implemented in this phase)
            </div>
          </TabsContent>
          <TabsContent value="settings" className="!mt-0 outline-none">
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              Settings UI Content (Not implemented in this phase)
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </PageContainer>
  );
}

export function CICDOverview() {
  return (
    <PipelineProvider>
      <CICDContent />
    </PipelineProvider>
  );
}
