import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, startOfDay } from "date-fns";

type DaySpend = { day: string; cost: number };

const SpendChart = () => {
  const [data, setData] = useState<DaySpend[]>([]);

  useEffect(() => {
    const fetchSpend = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Get user's flow IDs
      const { data: flows } = await supabase
        .from("flows")
        .select("id")
        .eq("user_id", user.id);

      if (!flows || flows.length === 0) {
        setData([]);
        return;
      }

      const flowIds = flows.map((f) => f.id);
      const sevenDaysAgo = startOfDay(subDays(new Date(), 6));

      const { data: runs } = await supabase
        .from("runs")
        .select("cost_usd, created_at")
        .in("flow_id", flowIds)
        .gte("created_at", sevenDaysAgo.toISOString());

      // Group by day
      const dayMap: Record<string, number> = {};
      for (let i = 6; i >= 0; i--) {
        const d = format(subDays(new Date(), i), "EEE");
        dayMap[d] = 0;
      }

      (runs || []).forEach((r) => {
        const day = format(new Date(r.created_at), "EEE");
        if (day in dayMap) {
          dayMap[day] += Number(r.cost_usd);
        }
      });

      setData(Object.entries(dayMap).map(([day, cost]) => ({ day, cost: Number(cost.toFixed(4)) })));
    };

    fetchSpend();
  }, []);

  return (
    <div className="border border-border rounded-xl bg-card p-6">
      <h3 className="font-display text-lg tracking-tight mb-4">Spend — Last 7 days</h3>
      <div className="h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
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
            <Bar dataKey="cost" fill="#1A4BFF" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default SpendChart;
