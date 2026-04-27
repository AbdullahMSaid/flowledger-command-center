import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format, subDays, startOfDay, startOfMonth } from "date-fns";
import { ArrowLeft, Calendar } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DaySpend = { day: string; cost: number };
type FlowSpend = { id: string; name: string; platform: string; totalCost: number; runCount: number };

const rangeOptions = [
  { label: "7 days", value: "7" },
  { label: "30 days", value: "30" },
  { label: "Custom", value: "custom" },
];

const Analytics = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();

  const [range, setRange] = useState("7");
  const [customFrom, setCustomFrom] = useState<Date | undefined>(subDays(new Date(), 6));
  const [customTo, setCustomTo] = useState<Date | undefined>(new Date());

  const [chartData, setChartData] = useState<DaySpend[]>([]);
  const [flowSpends, setFlowSpends] = useState<FlowSpend[]>([]);
  const [tokensToday, setTokensToday] = useState(0);
  const [tokensMonth, setTokensMonth] = useState(0);
  const [loading, setLoading] = useState(true);

  const getDays = useCallback(() => {
    if (range === "custom" && customFrom && customTo) {
      const diff = Math.ceil((customTo.getTime() - customFrom.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      return { days: Math.max(diff, 1), from: startOfDay(customFrom) };
    }
    const numDays = parseInt(range);
    return { days: numDays, from: startOfDay(subDays(new Date(), numDays - 1)) };
  }, [range, customFrom, customTo]);

  const fetchData = useCallback(async () => {
    if (!user) return;

    const { data: flows } = await supabase.from("flows").select("id, name, platform").eq("user_id", user.id);
    if (!flows || flows.length === 0) {
      setChartData([]);
      setFlowSpends([]);
      setTokensToday(0);
      setTokensMonth(0);
      setLoading(false);
      return;
    }

    const flowIds = flows.map((f) => f.id);
    const flowMap = new Map(flows.map((f) => [f.id, f]));
    const { days, from } = getDays();
    const monthStart = startOfMonth(new Date());
    const todayStart = startOfDay(new Date());

    const [{ data: rangeRuns }, { data: monthRuns }, { data: todayRuns }] = await Promise.all([
      supabase.from("runs").select("cost_usd, created_at, flow_id").in("flow_id", flowIds).gte("created_at", from.toISOString()),
      supabase.from("runs").select("cost_usd, flow_id, token_count, created_at").in("flow_id", flowIds).gte("created_at", monthStart.toISOString()),
      supabase.from("runs").select("token_count").in("flow_id", flowIds).gte("created_at", todayStart.toISOString()),
    ]);

    // Build chart data
    const dayMap: Record<string, number> = {};
    for (let i = days - 1; i >= 0; i--) {
      const d = format(subDays(new Date(), i), days <= 7 ? "EEE" : "MMM d");
      dayMap[d] = 0;
    }
    (rangeRuns || []).forEach((r) => {
      const dayKey = format(new Date(r.created_at), days <= 7 ? "EEE" : "MMM d");
      if (dayKey in dayMap) dayMap[dayKey] += Number(r.cost_usd);
    });
    setChartData(Object.entries(dayMap).map(([day, cost]) => ({ day, cost: Number(cost.toFixed(4)) })));

    // Monthly spend per flow
    const flowCostMap: Record<string, number> = {};
    const flowRunCount: Record<string, number> = {};
    let monthTokens = 0;
    (monthRuns || []).forEach((r) => {
      flowCostMap[r.flow_id] = (flowCostMap[r.flow_id] || 0) + Number(r.cost_usd);
      flowRunCount[r.flow_id] = (flowRunCount[r.flow_id] || 0) + 1;
      monthTokens += Number(r.token_count);
    });
    const sortedFlows: FlowSpend[] = Object.entries(flowCostMap)
      .map(([id, totalCost]) => {
        const flow = flowMap.get(id);
        return { id, name: flow?.name || "Unknown", platform: flow?.platform || "", totalCost, runCount: flowRunCount[id] || 0 };
      })
      .sort((a, b) => b.totalCost - a.totalCost);
    setFlowSpends(sortedFlows);
    setTokensMonth(monthTokens);

    setTokensToday((todayRuns || []).reduce((sum, r) => sum + Number(r.token_count), 0));
    setLoading(false);
  }, [user, getDays]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background">
        <nav className="sticky top-0 z-50 flex items-center justify-between px-8 py-4 border-b border-border bg-background/95 backdrop-blur-sm">
          <span className="font-display text-[22px] tracking-tight">Flow<span className="text-primary">Ledger</span></span>
        </nav>
        <div className="max-w-[1100px] mx-auto px-8 py-10">
          <div className="h-8 w-32 bg-muted rounded animate-pulse mb-8" />
          <div className="grid grid-cols-2 gap-4 mb-8">
            {[1, 2].map((i) => (
              <div key={i} className="border border-border rounded-xl px-5 py-4 bg-card">
                <div className="h-3 w-28 bg-muted rounded animate-pulse mb-3" />
                <div className="h-7 w-20 bg-muted rounded animate-pulse" />
              </div>
            ))}
          </div>
          <div className="border border-border rounded-xl bg-card p-6 mb-8">
            <div className="h-5 w-36 bg-muted rounded animate-pulse mb-6" />
            <div className="h-[320px] bg-muted rounded animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  const top5 = flowSpends.slice(0, 5);

  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-50 flex items-center justify-between px-8 py-4 border-b border-border bg-background/95 backdrop-blur-sm">
        <Link to="/" className="font-display text-[22px] tracking-tight">
          Flow<span className="text-primary">Ledger</span>
        </Link>
        <div className="flex items-center gap-4">
          <Link to="/docs" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Docs</Link>
          <span className="text-sm text-muted-foreground">{user?.email}</span>
          <button onClick={signOut} className="text-sm text-muted-foreground hover:text-foreground transition-colors">Sign out</button>
        </div>
      </nav>

      <div className="max-w-[1100px] mx-auto px-8 py-10">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => navigate("/dashboard")} className="p-2 rounded-lg hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
            <ArrowLeft size={18} />
          </button>
          <h1 className="font-display text-3xl tracking-tight">Analytics</h1>
        </div>

        {/* Token metrics */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="border border-border rounded-xl px-5 py-4 bg-card">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Tokens Today</div>
            <div className="text-2xl font-display">{tokensToday.toLocaleString()}</div>
          </div>
          <div className="border border-border rounded-xl px-5 py-4 bg-card">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Tokens This Month</div>
            <div className="text-2xl font-display">{tokensMonth.toLocaleString()}</div>
          </div>
        </div>

        {/* Spend chart with range picker */}
        <div className="border border-border rounded-xl bg-card p-6 mb-8">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-display text-lg tracking-tight">Spend over time</h3>
            <div className="flex items-center gap-2">
              {rangeOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setRange(opt.value)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                    range === opt.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground hover:text-foreground"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {range === "custom" && (
            <div className="flex items-center gap-3 mb-5">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-[160px] justify-start text-left font-normal text-sm", !customFrom && "text-muted-foreground")}>
                    <Calendar className="mr-2 h-4 w-4" />
                    {customFrom ? format(customFrom, "MMM d, yyyy") : "From"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarPicker mode="single" selected={customFrom} onSelect={setCustomFrom} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
              <span className="text-muted-foreground text-sm">to</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-[160px] justify-start text-left font-normal text-sm", !customTo && "text-muted-foreground")}>
                    <Calendar className="mr-2 h-4 w-4" />
                    {customTo ? format(customTo, "MMM d, yyyy") : "To"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarPicker mode="single" selected={customTo} onSelect={setCustomTo} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
          )}

          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 0% / 0.06)" />
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: "hsl(240 4% 57%)" }} />
                <YAxis tick={{ fontSize: 12, fill: "hsl(240 4% 57%)" }} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  formatter={(value: number) => [`$${value.toFixed(4)}`, "Cost"]}
                  contentStyle={{
                    background: "hsl(50 14% 97%)",
                    border: "1px solid hsl(0 0% 0% / 0.08)",
                    borderRadius: "8px",
                    fontSize: "13px",
                  }}
                />
                <Bar dataKey="cost" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Spend by flow table */}
          <div className="lg:col-span-2 border border-border rounded-xl bg-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="font-display text-lg tracking-tight">Spend by flow — this month</h3>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-5 py-3 text-xs text-muted-foreground uppercase tracking-wider font-medium">Flow</th>
                  <th className="px-5 py-3 text-xs text-muted-foreground uppercase tracking-wider font-medium">Platform</th>
                  <th className="px-5 py-3 text-xs text-muted-foreground uppercase tracking-wider font-medium text-right">Runs</th>
                  <th className="px-5 py-3 text-xs text-muted-foreground uppercase tracking-wider font-medium text-right">Avg/Run</th>
                  <th className="px-5 py-3 text-xs text-muted-foreground uppercase tracking-wider font-medium text-right">Total Cost</th>
                </tr>
              </thead>
              <tbody>
                {flowSpends.length === 0 ? (
                  <tr><td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">No spend data yet.</td></tr>
                ) : (
                  flowSpends.map((f) => (
                    <tr key={f.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => navigate(`/flows/${f.id}`)}>
                      <td className="px-5 py-3.5 font-medium text-foreground">{f.name}</td>
                      <td className="px-5 py-3.5 text-muted-foreground">{f.platform}</td>
                      <td className="px-5 py-3.5 text-right text-muted-foreground">{f.runCount}</td>
                      <td className="px-5 py-3.5 text-right text-muted-foreground">${f.runCount > 0 ? (f.totalCost / f.runCount).toFixed(4) : "—"}</td>
                      <td className="px-5 py-3.5 text-right text-foreground">${f.totalCost.toFixed(4)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Top 5 most expensive flows */}
          <div className="border border-border rounded-xl bg-card">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="font-display text-lg tracking-tight">Top 5 costliest</h3>
            </div>
            <div className="divide-y divide-border">
              {top5.length === 0 ? (
                <div className="px-5 py-8 text-center text-muted-foreground text-sm">No data yet.</div>
              ) : (
                top5.map((f, i) => (
                  <div key={f.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs font-medium text-muted-foreground w-5 shrink-0">#{i + 1}</span>
                      <span className="text-sm font-medium text-foreground truncate">{f.name}</span>
                    </div>
                    <span className="text-sm text-foreground font-medium ml-3">${f.totalCost.toFixed(2)}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
