import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Icon } from '@/shared/components/ui/Icon';
import { Button } from '@/shared/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { mockHealthStats } from '../data/mockCICDData';

export function PipelineHealth() {
  const { total, success, failed, cancelled, running } = mockHealthStats;
  
  // Calculate stroke dasharrays for the donut chart
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  
  const successPercent = total > 0 ? success / total : 0;
  const failedPercent = total > 0 ? failed / total : 0;
  
  const successDash = successPercent * circumference;
  const failedDash = failedPercent * circumference;
  
  // Offsets
  const successOffset = 0;
  const failedOffset = -successDash;

  return (
    <Card className="col-span-1 bg-card/40 border-border/40 backdrop-blur-sm">
      <CardHeader className="p-4 border-b border-border/20 flex flex-row items-center justify-between pb-4">
        <CardTitle className="text-sm font-semibold">Pipeline Health</CardTitle>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground hover:text-foreground">
              This Week
              <Icon name="ChevronDown" size={12} className="ml-1 opacity-70 shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>Today</DropdownMenuItem>
            <DropdownMenuItem>This Week</DropdownMenuItem>
            <DropdownMenuItem>This Month</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent className="p-4 flex flex-col md:flex-row items-center justify-center md:justify-start gap-4">
        
        {/* SVG Donut Chart */}
        <div className="relative w-24 h-24 flex items-center justify-center shrink-0">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 160 160">
            {/* Background ring */}
            <circle
              cx="80"
              cy="80"
              r={radius}
              fill="transparent"
              stroke="currentColor"
              strokeWidth="16"
              className="text-muted/20"
            />
            {/* Success ring */}
            {successPercent > 0 && (
              <circle
                cx="80"
                cy="80"
                r={radius}
                fill="transparent"
                stroke="currentColor"
                strokeWidth="16"
                strokeDasharray={`${successDash} ${circumference}`}
                strokeDashoffset={successOffset}
                className="text-green-500 transition-all duration-1000 ease-in-out"
              />
            )}
            {/* Failed ring */}
            {failedPercent > 0 && (
              <circle
                cx="80"
                cy="80"
                r={radius}
                fill="transparent"
                stroke="currentColor"
                strokeWidth="16"
                strokeDasharray={`${failedDash} ${circumference}`}
                strokeDashoffset={failedOffset}
                className="text-red-500 transition-all duration-1000 ease-in-out"
              />
            )}
          </svg>
          
          {/* Inner Text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-xl font-bold tracking-tight text-foreground">{total}</span>
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Total</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-col gap-1.5 flex-1 min-w-[120px]">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-[3px] bg-green-500 shrink-0"></div>
              <span className="text-muted-foreground">Success</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground">{success}</span>
              <span className="text-xs text-muted-foreground/60 w-12 text-right">
                ({total > 0 ? Math.round((success/total)*1000)/10 : 0}%)
              </span>
            </div>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-[3px] bg-red-500 shrink-0"></div>
              <span className="text-muted-foreground">Failed</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground">{failed}</span>
              <span className="text-xs text-muted-foreground/60 w-12 text-right">
                ({total > 0 ? Math.round((failed/total)*1000)/10 : 0}%)
              </span>
            </div>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-[3px] bg-muted-foreground shrink-0"></div>
              <span className="text-muted-foreground">Cancelled</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground">{cancelled}</span>
              <span className="text-xs text-muted-foreground/60 w-12 text-right">
                (0%)
              </span>
            </div>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-[3px] bg-blue-500 shrink-0"></div>
              <span className="text-muted-foreground">Running</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-foreground">{running}</span>
              <span className="text-xs text-muted-foreground/60 w-12 text-right">
                (0%)
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
