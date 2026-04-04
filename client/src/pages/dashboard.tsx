import { useQuery } from "@tanstack/react-query";
import type { Deal, Activity } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  TrendingUp,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Phone,
  Mail,
  MessageSquare,
  FileText,
  ShoppingCart,
  Zap,
  Clock,
  AlertTriangle,
  BarChart3,
} from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";

function formatCompact(val: number): string {
  if (val >= 1_000_000_000) return `$${(val / 1_000_000_000).toFixed(1)}B`;
  if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
  return `$${val}`;
}

function formatCurrency(val: number, currency: string = "USD") {
  if (currency === "COP") {
    if (val >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M COP`;
    if (val >= 1_000) return `$${(val / 1_000).toFixed(0)}K COP`;
    return `$${val} COP`;
  }
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(val);
}

function formatAxisValue(val: number): string {
  if (val >= 1_000_000_000) return `${(val / 1_000_000_000).toFixed(1)}B`;
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(0)}K`;
  return String(val);
}

const activityIcons: Record<string, typeof Phone> = {
  call: Phone,
  email: Mail,
  meeting: MessageSquare,
  note: FileText,
  sale: ShoppingCart,
};

const stageLabels: Record<string, string> = {
  new_inquiry: "New Inquiry",
  qualified: "Qualified",
  artwork_presented: "Presented",
  collector_engaged: "Engaged",
  negotiation: "Negotiation",
  closed_won: "Won",
  closed_lost: "Lost",
};

const stageColors: Record<string, string> = {
  new_inquiry: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
  qualified: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  artwork_presented: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  collector_engaged: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  negotiation: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  closed_won: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  closed_lost: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

const priorityDots: Record<string, string> = {
  high: "bg-red-500",
  medium: "bg-amber-500",
  low: "bg-emerald-500",
};

const PIE_COLORS = [
  "hsl(220, 70%, 55%)",   // blue
  "hsl(150, 60%, 45%)",   // green
  "hsl(25, 90%, 55%)",    // orange
  "hsl(280, 60%, 55%)",   // purple
  "hsl(340, 70%, 55%)",   // pink
  "hsl(45, 80%, 50%)",    // gold
];

function StatCard({ label, value, icon: Icon, sub }: {
  label: string; value: string; icon: typeof Users; sub?: string;
}) {
  return (
    <Card data-testid={`stat-${label.toLowerCase().replace(/\s/g, '-')}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
            <p className="text-xl font-bold tabular-nums">{value}</p>
            {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
          </div>
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Icon className="h-4 w-4 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Custom legend for pie chart
function CustomPieLegend({ payload }: any) {
  return (
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-2">
      {(payload || []).map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-1.5 text-xs">
          <div className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: entry.color }} />
          <span className="text-muted-foreground">{entry.value}</span>
          <span className="font-medium tabular-nums">{entry.payload?.value}</span>
        </div>
      ))}
    </div>
  );
}

interface StatsData {
  totalContacts: number;
  totalArtworks: number;
  totalDeals: number;
  activeExhibitions: number;
  totalInventoryValue: number;
  activeDealsValue: number;
  closedWonValue: number;
  statusCounts: Record<string, number>;
  stageCounts: Record<string, number>;
  typeCounts: Record<string, number>;
  newLeadsThisWeek: number;
  avgResponseTime: number;
  repliedUnder1h: number;
  revenueClosedThisMonth: number;
  overdueFollowups: number;
  leadsBySource: Record<string, number>;
  pipelineByStage: { stage: string; count: number; value: number }[];
  pipelineByCurrency: { currency: string; total: number; count: number }[];
  dealsAtRisk: { id: number; title: string; contactName: string; value: number; stage: string; lastActivityAt: string | null }[];
}

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery<StatsData>({ queryKey: ["/api/stats"] });
  const { data: deals } = useQuery<Deal[]>({ queryKey: ["/api/deals"] });
  const { data: activities } = useQuery<Activity[]>({ queryKey: ["/api/activities"] });

  const activeDeals = deals?.filter(d => !d.stage.startsWith("closed"))
    .sort((a, b) => (b.value || 0) - (a.value || 0))
    .slice(0, 5) ?? [];
  const recentActivities = activities?.slice(0, 6) ?? [];

  const pieData = stats ? Object.entries(stats.leadsBySource || {})
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value) : [];

  // Filter USD-only deals for bar chart (avoid mixing currencies)
  const barData = stats ? (stats.pipelineByStage || [])
    .filter(s => s.stage !== "closed_lost")
    .map(s => ({ stage: stageLabels[s.stage] || s.stage, value: s.value, count: s.count }))
    .sort((a, b) => b.value - a.value) : [];

  // Pipeline by currency
  const usdPipeline = stats?.pipelineByCurrency?.find(c => c.currency === "USD");
  const copPipeline = stats?.pipelineByCurrency?.find(c => c.currency === "COP");
  const activeCount = stats ? stats.totalDeals - (stats.stageCounts?.closed_won || 0) - (stats.stageCounts?.closed_lost || 0) : 0;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1400px]">
      <div>
        <h1 className="text-xl font-bold" data-testid="text-page-title">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Sales performance and key metrics</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        {statsLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-16 w-full" /></CardContent></Card>
          ))
        ) : stats ? (
          <>
            <StatCard label="New Leads" value={String(stats.newLeadsThisWeek)} icon={Zap} sub="This week" />
            <StatCard label="Avg Response" value={stats.avgResponseTime ? `${stats.avgResponseTime}m` : "--"} icon={Clock} sub="First response" />
            <StatCard label="Replied <1h" value={stats.avgResponseTime ? `${stats.repliedUnder1h}%` : "--"} icon={TrendingUp} />
            <StatCard
              label="Pipeline"
              value={usdPipeline ? formatCompact(usdPipeline.total) : "$0"}
              icon={DollarSign}
              sub={copPipeline ? `${formatCurrency(copPipeline.total, "COP")} · ${activeCount} active` : `${activeCount} active`}
            />
            <StatCard label="Revenue" value={formatCurrency(stats.revenueClosedThisMonth)} icon={BarChart3} sub="Closed this month" />
            <StatCard label="Overdue" value={String(stats.overdueFollowups)} icon={AlertTriangle} sub="Follow-ups" />
          </>
        ) : null}
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Leads by Source — Donut */}
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-semibold">Leads by Source</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="45%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    strokeWidth={0}
                  >
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
                    formatter={(value: number, name: string) => [`${value} leads`, name]}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[240px] flex items-center justify-center text-sm text-muted-foreground">No source data yet</div>
            )}
          </CardContent>
        </Card>

        {/* Pipeline by Stage — Horizontal bar */}
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-semibold">Pipeline by Stage</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {barData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={barData} layout="vertical" margin={{ left: 10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" opacity={0.5} />
                  <XAxis
                    type="number"
                    tickFormatter={v => `$${formatAxisValue(v)}`}
                    tick={{ fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="stage"
                    width={85}
                    tick={{ fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}
                    formatter={(v: number) => [formatCompact(v), "Value"]}
                    labelFormatter={(label) => label}
                  />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[240px] flex items-center justify-center text-sm text-muted-foreground">No pipeline data yet</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Deals + Deals at Risk + Recent Activity */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Top Deals */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Top Deals</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {activeDeals.map(deal => (
                <div key={deal.id} className="flex items-center gap-3 px-4 py-3 hover-elevate" data-testid={`deal-row-${deal.id}`}>
                  <div className={`h-2 w-2 rounded-full shrink-0 ${priorityDots[deal.priority || "medium"]}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{deal.title}</p>
                    <p className="text-xs text-muted-foreground">{deal.contactName}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold tabular-nums">{deal.value ? formatCurrency(deal.value, deal.currency || "USD") : "--"}</p>
                    <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${stageColors[deal.stage]}`}>
                      {stageLabels[deal.stage] || deal.stage}
                    </Badge>
                  </div>
                </div>
              ))}
              {activeDeals.length === 0 && (
                <div className="p-8 text-center text-sm text-muted-foreground">No active deals</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Deals at Risk */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 text-amber-500" /> Deals at Risk
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {(stats?.dealsAtRisk || []).map((deal: any) => (
                <div key={deal.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{deal.title}</p>
                    <p className="text-xs text-muted-foreground">{deal.contactName || "No contact"}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold tabular-nums">{deal.value ? formatCompact(deal.value) : "--"}</p>
                    <p className="text-[10px] text-amber-600 dark:text-amber-400">
                      {deal.lastActivityAt ? `${Math.floor((Date.now() - new Date(deal.lastActivityAt).getTime()) / 86400000)}d ago` : "No activity"}
                    </p>
                  </div>
                </div>
              ))}
              {(!stats?.dealsAtRisk || stats.dealsAtRisk.length === 0) && (
                <div className="p-8 text-center text-sm text-muted-foreground">No deals at risk</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {recentActivities.map(act => {
                const ActIcon = activityIcons[act.type] || FileText;
                return (
                  <div key={act.id} className="flex gap-3 px-4 py-3" data-testid={`activity-row-${act.id}`}>
                    <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                      <ActIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm leading-snug line-clamp-2">{act.description}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{act.date}</p>
                    </div>
                  </div>
                );
              })}
              {recentActivities.length === 0 && (
                <div className="p-8 text-center text-sm text-muted-foreground">No recent activity</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
