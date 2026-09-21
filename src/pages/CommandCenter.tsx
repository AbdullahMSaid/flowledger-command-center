import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  ChevronRight,
  CircleAlert,
  Filter,
  LockKeyhole,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { demoAgents } from "@/lib/demo/fixtures";
import { useAuth } from "@/hooks/useAuth";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import { isLocalPreviewAuthEnabled } from "@/lib/localAuth";
import type { Database } from "@/integrations/supabase/types";
import { calculateValueMetrics } from "@/lib/metrics/value";
import { getWorkspaceMembership } from "@/lib/workspace";
import SampleReviews from "@/pages/SampleReviews";

type LiveSummary = {
  spend_usd: number;
  spend_today_usd?: number;
  month_to_date_spend_usd?: number;
  run_count: number;
  token_count?: number;
  month_to_date_run_count?: number;
  month_to_date_token_count?: number;
  average_cost_per_run_usd?: number;
  prior_period_spend_usd?: number;
  active_workflow_count: number;
  open_incident_count: number;
  production_count: number;
  approved_count: number;
  pending_review_count: number;
  missing_owner_count: number;
  overdue_review_count: number;
  value_coverage_count: number;
  value_estimate_usd?: number;
  covered_cost_usd?: number;
  over_budget_count?: number;
  experiment_count?: number;
  experiment_spend_usd?: number;
  missing_value_target_count?: number;
};

type LiveInventoryRow =
  Database["public"]["Functions"]["get_workspace_inventory"]["Returns"][number];
type LiveIncident = {
  id: string;
  flow_id: string | null;
  severity: string;
  reason: string;
  observed_cost_usd: number;
  blocked_request_count: number;
  evidence: Record<string, unknown>;
};
type LiveMember = { member_id: string; user_id: string; role: string };

const utcStartOfDay = (date: Date) =>
  new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );

const getPeriodBounds = (period: string) => {
  const end = new Date();
  if (period === "Last 30 days") {
    const start = utcStartOfDay(end);
    start.setUTCDate(start.getUTCDate() - 29);
    return { start, end };
  }
  if (period === "This quarter") {
    const quarterStartMonth = Math.floor(end.getUTCMonth() / 3) * 3;
    return {
      start: new Date(Date.UTC(end.getUTCFullYear(), quarterStartMonth, 1)),
      end,
    };
  }
  return {
    start: new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1)),
    end,
  };
};

const formatUsd = (value: number) =>
  `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

const inventory = [
  {
    ...demoAgents[0],
    environment: "Production",
    approval: "Approved",
    purpose: "Keep away-message coverage current",
    health: "Warning",
    review: "Reviewed 12 days ago",
  },
  {
    ...demoAgents[1],
    environment: "Experiment",
    approval: "Pending review",
    purpose: "Extract invoice fields",
    health: "Healthy",
    review: "Review due Sep 14",
  },
  {
    ...demoAgents[2],
    environment: "Production",
    approval: "Approved",
    purpose: "Route priority tickets",
    health: "Healthy",
    review: "Reviewed 4 days ago",
  },
  {
    id: "weekly-report",
    name: "Weekly report generator",
    description: "Turns team updates into a Friday digest.",
    owner: "Unassigned",
    team: "Operations",
    platform: "Zapier",
    model: "Unknown",
    protection: "Monitor only" as const,
    todayCost: 0.86,
    budget: 8,
    environment: "Staging",
    approval: "Pending review",
    purpose: "Missing",
    health: "Stale telemetry",
    review: "Never reviewed",
  },
];

const LiveCommandCenter = () => {
  const location = useLocation();
  const isDemoRoute = location.pathname.startsWith("/demo/");
  const [period, setPeriod] = useState("This month");
  const [reviewed, setReviewed] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [environmentFilter, setEnvironmentFilter] = useState("all");
  const [approvalFilter, setApprovalFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [teamFilter, setTeamFilter] = useState("all");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [modelFilter, setModelFilter] = useState("all");
  const [liveSummary, setLiveSummary] = useState<LiveSummary | null>(null);
  const [liveInventory, setLiveInventory] = useState<LiveInventoryRow[]>([]);
  const [liveIncidents, setLiveIncidents] = useState<LiveIncident[]>([]);
  const [liveMembers, setLiveMembers] = useState<LiveMember[]>([]);
  const [liveIsAdmin, setLiveIsAdmin] = useState(false);
  const [budgetOwnerByFlow, setBudgetOwnerByFlow] = useState<
    Record<string, string | null>
  >({});
  const [liveError, setLiveError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [reviewFlow, setReviewFlow] = useState<LiveInventoryRow | null>(null);
  const [reviewDecision, setReviewDecision] = useState("approved");
  const [reviewEnvironment, setReviewEnvironment] = useState("production");
  const [reviewDate, setReviewDate] = useState(() =>
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  );
  const [reviewNote, setReviewNote] = useState("");
  const [reviewExpectedOutcome, setReviewExpectedOutcome] = useState("");
  const [reviewTargetQuantity, setReviewTargetQuantity] = useState("");
  const [reviewValuePerUnit, setReviewValuePerUnit] = useState("");
  const [reviewMonthlyValue, setReviewMonthlyValue] = useState("");
  const [reviewValueSource, setReviewValueSource] = useState("user estimate");
  const [reviewValueAssumptions, setReviewValueAssumptions] = useState("");
  const [valueFlow, setValueFlow] = useState<LiveInventoryRow | null>(null);
  const [valueSaving, setValueSaving] = useState(false);
  const [valueError, setValueError] = useState<string | null>(null);
  const [reviewSaving, setReviewSaving] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [incidentToResolve, setIncidentToResolve] =
    useState<LiveIncident | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const [resolutionError, setResolutionError] = useState<string | null>(null);
  const [resolutionSaving, setResolutionSaving] = useState(false);
  const [governanceFlow, setGovernanceFlow] = useState<LiveInventoryRow | null>(
    null,
  );
  const [governanceOwner, setGovernanceOwner] = useState("");
  const [governanceBudgetOwner, setGovernanceBudgetOwner] = useState("");
  const [governanceTeam, setGovernanceTeam] = useState("");
  const [governancePurpose, setGovernancePurpose] = useState("");
  const [governanceSaving, setGovernanceSaving] = useState(false);
  const [governanceError, setGovernanceError] = useState<string | null>(null);
  const { user, signOut } = useAuth(false);

  useEffect(() => {
    if (isDemoRoute || !isSupabaseConfigured || !user) {
      setLiveSummary(null);
      setLiveInventory([]);
      setLiveIncidents([]);
      setLiveMembers([]);
      setLiveIsAdmin(false);
      setBudgetOwnerByFlow({});
      setLiveError(null);
      return;
    }

    let cancelled = false;
    const loadSummary = async () => {
      let membership;
      try { membership = await getWorkspaceMembership(user.id); } catch (membershipError) {
        if (!cancelled) {
          setLiveSummary(null);
          setLiveError(membershipError instanceof Error ? membershipError.message : "No workspace is provisioned for this account yet.");
        }
        return;
      }

      if (!membership?.workspace_id) {
        if (!cancelled) {
          setLiveSummary(null);
          setLiveError("No workspace is provisioned for this account yet.");
        }
        return;
      }

      const { start, end } = getPeriodBounds(period);
      const [
        summaryResponse,
        inventoryResponse,
        incidentResponse,
        membersResponse,
        flowGovernanceResponse,
      ] = await Promise.all([
        supabase.rpc("get_workspace_summary", {
          p_workspace_id: membership.workspace_id,
          p_period_start: start.toISOString(),
          p_period_end: end.toISOString(),
        }),
        supabase.rpc("get_workspace_inventory", {
          p_workspace_id: membership.workspace_id,
          p_period_start: start.toISOString(),
          p_period_end: end.toISOString(),
          p_limit: 100,
          p_offset: 0,
        }),
        supabase
          .from("incidents")
          .select(
            "id, flow_id, severity, reason, observed_cost_usd, blocked_request_count, evidence",
          )
          .eq("workspace_id", membership.workspace_id)
          .eq("status", "open")
          .order("detected_at", { ascending: false })
          .limit(10),
        supabase.rpc("get_workspace_members", {
          p_workspace_id: membership.workspace_id,
        }),
        supabase
          .from("flows")
          .select("id, budget_owner_member_id")
          .eq("workspace_id", membership.workspace_id),
      ]);

      if (!cancelled) {
        const error =
          summaryResponse.error ||
          inventoryResponse.error ||
          incidentResponse.error ||
          membersResponse.error ||
          flowGovernanceResponse.error;
        if (error) {
          setLiveSummary(null);
          setLiveInventory([]);
          setLiveIncidents([]);
          setLiveMembers([]);
          setLiveIsAdmin(false);
          setBudgetOwnerByFlow({});
          setLiveError(error.message);
        } else {
          setLiveSummary(summaryResponse.data as LiveSummary);
          setLiveInventory(
            (inventoryResponse.data ?? []) as LiveInventoryRow[],
          );
          setLiveIncidents((incidentResponse.data ?? []) as LiveIncident[]);
          setLiveMembers((membersResponse.data ?? []) as LiveMember[]);
          setLiveIsAdmin(membership.role === "admin");
          setBudgetOwnerByFlow(
            Object.fromEntries(
              (flowGovernanceResponse.data ?? []).map((flow) => [
                flow.id,
                flow.budget_owner_member_id,
              ]),
            ),
          );
          setLiveError(null);
        }
      }
    };

    loadSummary();
    return () => {
      cancelled = true;
    };
  }, [isDemoRoute, period, refreshKey, user]);

  const submitReview = async (event: FormEvent) => {
    event.preventDefault();
    if (!reviewFlow) return;
    if (!liveIsAdmin) {
      setReviewError("Only workspace admins can record review decisions.");
      return;
    }
    if (reviewNote.trim().length < 3) {
      setReviewError("Add a short decision note so the review is auditable.");
      return;
    }
    setReviewSaving(true);
    setReviewError(null);
    const { error } = await supabase.rpc("review_flow", {
      p_flow_id: reviewFlow.flow_id,
      p_approval_status: reviewDecision,
      p_environment: reviewEnvironment,
      p_next_review_at:
        reviewDecision === "rejected" || !reviewDate
          ? null
          : new Date(`${reviewDate}T12:00:00Z`).toISOString(),
      p_reason: reviewNote.trim(),
    });
    if (error) {
      setReviewError(error.message);
      setReviewSaving(false);
      return;
    }
    setReviewSaving(false);
    setReviewFlow(null);
    setReviewNote("");
    setReviewExpectedOutcome("");
    setReviewTargetQuantity("");
    setReviewValuePerUnit("");
    setReviewMonthlyValue("");
    setReviewValueAssumptions("");
    setRefreshKey((value) => value + 1);
  };

  const submitResolution = async (event: FormEvent) => {
    event.preventDefault();
    if (!incidentToResolve) return;
    if (!liveIsAdmin) {
      setResolutionError("Only workspace admins can resolve incidents.");
      return;
    }
    if (resolutionNote.trim().length < 3) {
      setResolutionError(
        "Add a short resolution note so the incident history remains explainable.",
      );
      return;
    }
    setResolutionSaving(true);
    setResolutionError(null);
    const { error } = await supabase.rpc("resolve_incident", {
      p_incident_id: incidentToResolve.id,
      p_resolution_note: resolutionNote.trim(),
    });
    if (error) {
      setResolutionError(error.message);
      setResolutionSaving(false);
      return;
    }
    setResolutionSaving(false);
    setIncidentToResolve(null);
    setResolutionNote("");
    setRefreshKey((value) => value + 1);
  };

  const openGovernance = (flow: LiveInventoryRow) => {
    if (!liveIsAdmin) return;
    setGovernanceFlow(flow);
    setGovernanceOwner(flow.accountable_owner_member_id ?? "");
    setGovernanceBudgetOwner(budgetOwnerByFlow[flow.flow_id] ?? "");
    setGovernanceTeam(flow.team_label ?? "");
    setGovernancePurpose(flow.business_purpose ?? "");
    setGovernanceError(null);
  };

  const submitGovernance = async (event: FormEvent) => {
    event.preventDefault();
    if (!governanceFlow) return;
    if (!liveIsAdmin) {
      setGovernanceError("Only workspace admins can edit governance fields.");
      return;
    }
    if (governancePurpose.trim().length < 3) {
      setGovernanceError(
        "Add a short business purpose so the workflow is explainable.",
      );
      return;
    }
    setGovernanceSaving(true);
    setGovernanceError(null);
    const { error } = await supabase.rpc("set_flow_governance", {
      p_flow_id: governanceFlow.flow_id,
      p_accountable_owner_member_id: governanceOwner || null,
      p_budget_owner_member_id: governanceBudgetOwner || null,
      p_team_label: governanceTeam.trim() || null,
      p_business_purpose: governancePurpose.trim(),
      p_reason: "Updated governance from management view",
    });
    if (error) {
      setGovernanceError(error.message);
      setGovernanceSaving(false);
      return;
    }
    setGovernanceSaving(false);
    setGovernanceFlow(null);
    setRefreshKey((value) => value + 1);
  };

  const submitValue = async (event: FormEvent) => {
    event.preventDefault();
    if (!valueFlow) return;
    if (!liveIsAdmin) {
      setValueError("Only workspace admins can edit value estimates.");
      return;
    }
    const numericValues = [
      reviewTargetQuantity,
      reviewValuePerUnit,
      reviewMonthlyValue,
    ]
      .filter(Boolean)
      .map(Number);
    if (numericValues.some((value) => !Number.isFinite(value) || value < 0)) {
      setValueError("Value fields must be nonnegative numbers.");
      return;
    }
    setValueSaving(true);
    setValueError(null);
    const { error } = await supabase.rpc("set_flow_value", {
      p_flow_id: valueFlow.flow_id,
      p_expected_outcome: reviewExpectedOutcome.trim() || null,
      p_target_quantity: reviewTargetQuantity.trim()
        ? Number(reviewTargetQuantity)
        : null,
      p_value_per_unit_usd: reviewValuePerUnit.trim()
        ? Number(reviewValuePerUnit)
        : null,
      p_expected_monthly_value_usd: reviewMonthlyValue.trim()
        ? Number(reviewMonthlyValue)
        : null,
      p_value_source: reviewMonthlyValue.trim() ? reviewValueSource : null,
      p_value_assumptions: reviewValueAssumptions.trim() || null,
      p_reason: "Updated value estimate from management view",
    });
    if (error) {
      setValueError(error.message);
      setValueSaving(false);
      return;
    }
    setValueSaving(false);
    setValueFlow(null);
    setRefreshKey((value) => value + 1);
  };

  const pendingReviews = Math.max(1, 2 - reviewed.length);
  const isLocalPreview =
    !isDemoRoute && Boolean(user) && isLocalPreviewAuthEnabled;
  const isLiveWorkspace =
    !isDemoRoute && isSupabaseConfigured && Boolean(user) && !isLocalPreview;
  const isLive = isLiveWorkspace;
  const spend = liveSummary?.spend_usd ?? (isLiveWorkspace ? 0 : 8421);
  const spendThisMonth = liveSummary?.month_to_date_spend_usd ?? spend;
  const activeWorkflows =
    liveSummary?.active_workflow_count ?? (isLiveWorkspace ? 0 : 12);
  const openIncidents =
    liveSummary?.open_incident_count ?? (isLiveWorkspace ? 0 : 2);
  const now = new Date();
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );
  const elapsedMonthDays =
    (Date.now() - monthStart.getTime()) / (1000 * 60 * 60 * 24);
  const daysInMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const projectedMonthlySpend = isLive
    ? liveSummary && elapsedMonthDays >= 1
      ? (spendThisMonth / elapsedMonthDays) * daysInMonth
      : null
    : 10204;
  const livePendingReviews =
    liveSummary?.pending_review_count ?? pendingReviews;
  const liveOverBudget = liveSummary?.over_budget_count ?? 0;
  const valueEstimate = liveSummary?.value_estimate_usd ?? 0;
  const valueMetrics = calculateValueMetrics(
    isLive ? valueEstimate : 5000,
    isLive ? projectedMonthlySpend : 720,
  );
  const valueMultiple =
    valueMetrics.multiple === null
      ? "N/A"
      : `${valueMetrics.multiple.toFixed(2)}×`;
  const netReturn =
    valueMetrics.netReturnPercent === null
      ? "N/A"
      : `${Math.round(valueMetrics.netReturnPercent)}%`;
  const metrics = [
    [
      "Spend today",
      isLive
        ? liveSummary
          ? formatUsd(liveSummary.spend_today_usd ?? 0)
          : "Unavailable"
        : "$5.52",
      isLive
        ? liveSummary
          ? `${liveSummary.run_count.toLocaleString()} runs in period`
          : "Aggregate query failed"
        : "Synthetic workspace",
      "text-slate-950",
    ],
    [
      "Spend this month",
      isLive
        ? liveSummary
          ? formatUsd(spendThisMonth)
          : "Unavailable"
        : "$8,421",
      isLive
        ? liveSummary
          ? `${liveSummary.month_to_date_token_count?.toLocaleString() ?? 0} tokens month to date`
          : "Aggregate query failed"
        : "↓ 12% vs prior period",
      "text-slate-950",
    ],
    [
      "Projected monthly spend",
      isLive
        ? projectedMonthlySpend === null
          ? "N/A"
          : formatUsd(projectedMonthlySpend)
        : "$10,204",
      isLive
        ? projectedMonthlySpend === null
          ? "Available after one full day"
          : "Linear extrapolation from month to date"
        : "Linear extrapolation",
      "text-slate-950",
    ],
    [
      "Active workflows",
      isLive && !liveSummary ? "Unavailable" : activeWorkflows.toLocaleString(),
      isLive
        ? liveSummary
          ? `${liveSummary.production_count} production`
          : "Aggregate query failed"
        : "9 production · 3 experiment",
      "text-slate-950",
    ],
    [
      "Open anomalies",
      isLive && !liveSummary ? "Unavailable" : openIncidents.toLocaleString(),
      isLive
        ? liveSummary
          ? "Persisted incidents"
          : "Aggregate query failed"
        : "1 needs intervention",
      "text-red-700",
    ],
    [
      "Over budget",
      isLive
        ? liveSummary
          ? liveOverBudget.toLocaleString()
          : "Unavailable"
        : "1",
      isLive
        ? liveSummary
          ? "Current budget checks"
          : "Aggregate query failed"
        : "Out-of-office responder",
      "text-amber-700",
    ],
  ];
  const governance =
    isLive && liveSummary
      ? [
          ["Production", liveSummary.production_count.toLocaleString()],
          ["Approved", liveSummary.approved_count.toLocaleString()],
          ["Missing owner", liveSummary.missing_owner_count.toLocaleString()],
          ["Overdue review", liveSummary.overdue_review_count.toLocaleString()],
        ]
      : isLive
        ? [
            ["Production", "Unavailable"],
            ["Approved", "Unavailable"],
            ["Missing owner", "Unavailable"],
            ["Overdue review", "Unavailable"],
          ]
        : [
            ["Production", "9"],
            ["Approved", "8"],
            ["Missing owner", "1"],
            ["Overdue review", "2"],
          ];
  const memberLabel = (memberId: string | null) => {
    if (!memberId) return "Unassigned";
    const member = liveMembers.find(
      (candidate) => candidate.member_id === memberId,
    );
    return member
      ? `${member.role} · ${member.user_id.slice(0, 8)}`
      : `Member · ${memberId.slice(0, 8)}`;
  };
  const activeLiveInventory = liveInventory.filter((flow) => !flow.archived_at);
  const displayInventory = isLiveWorkspace
    ? activeLiveInventory.map((flow) => ({
        id: flow.flow_id,
        name: flow.name,
        platform: flow.platform,
        model: flow.model,
        owner: memberLabel(flow.accountable_owner_member_id),
        team: flow.team_label ?? "No team",
        environment: flow.environment,
        approval:
          flow.approval_status === "approved"
            ? "Approved"
            : flow.approval_status === "rejected"
              ? "Rejected"
              : "Pending review",
        todayCost: Number(flow.today_cost_usd),
        protection: flow.protection_mode,
        review: flow.last_run_at
          ? `Last telemetry ${new Date(flow.last_run_at).toLocaleDateString()}`
          : "No telemetry",
      }))
    : inventory;
  const liveFlowById = new Map(
    activeLiveInventory.map((flow) => [flow.flow_id, flow]),
  );
  const filteredInventory = displayInventory.filter(
    (flow) =>
      (environmentFilter === "all" || flow.environment === environmentFilter) &&
      (approvalFilter === "all" || flow.approval === approvalFilter) &&
      (ownerFilter === "all" || flow.owner === ownerFilter) &&
      (teamFilter === "all" || flow.team === teamFilter) &&
      (platformFilter === "all" || flow.platform === platformFilter) &&
      (modelFilter === "all" || flow.model === modelFilter),
  );
  const filterOptions = (key: "owner" | "team" | "platform" | "model") =>
    Array.from(new Set(displayInventory.map((flow) => flow[key]))).sort();

  return (
    <main className="min-h-screen bg-[#f7f8fb] text-foreground">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur sticky top-0 z-30">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-5 py-4 lg:px-10">
          <div className="flex items-center gap-4">
            <Link
              to={isDemoRoute ? "/demo" : "/dashboard"}
              className="inline-flex items-center gap-2 text-sm text-ink2 hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />{" "}
              <span className="hidden sm:inline">
                {isDemoRoute ? "Demo dashboard" : "Account dashboard"}
              </span>
            </Link>
            <span className="h-5 w-px bg-slate-200" />
            <div className="font-display text-xl tracking-tight">
              Flow<span className="text-electric-blue">Ledger</span>{" "}
              <span className="font-body text-sm text-ink3">/ Management</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700">
              <Sparkles className="h-3.5 w-3.5" />{" "}
              {isLive
                ? "Live account · authenticated"
                : isLocalPreview
                  ? "Preview account · signed in"
                  : "Demo workspace · synthetic"}
            </div>
            {isLocalPreview && (
              <button
                type="button"
                onClick={signOut}
                className="text-xs font-medium text-slate-500 hover:text-slate-900"
              >
                Sign out
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] px-5 py-8 lg:px-10 lg:py-10">
        <section className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <div className="mb-3 text-xs font-semibold uppercase tracking-[2px] text-electric-blue">
              Management command center
            </div>
            <h1 className="font-display text-4xl tracking-tight text-slate-950 sm:text-5xl">
              Know what is running, who owns it, and what it costs.
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              An executive view of registered AI workflows, governance gaps,
              experiments, and explainable spend.{" "}
              {isLive
                ? "This view is connected to your authenticated workspace and server aggregates."
                : isLocalPreview
                  ? "You are signed in to the local preview; Supabase is not configured, so the data remains synthetic."
                  : "The public view uses an isolated synthetic workspace."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="sr-only" htmlFor="period">
              Reporting period
            </label>
            <select
              id="period"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700"
            >
              <option>This month</option>
              <option>Last 30 days</option>
              <option>This quarter</option>
            </select>
            <button
              type="button"
              onClick={() => setShowFilters((value) => !value)}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:border-slate-500"
            >
              <Filter className="h-4 w-4" /> Filters
            </button>
          </div>
        </section>

        {showFilters && (
          <div className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <label className="text-xs font-medium text-slate-600">
              Environment
              <select
                value={environmentFilter}
                onChange={(event) => setEnvironmentFilter(event.target.value)}
                className="mt-1 block h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm"
              >
                <option value="all">All environments</option>
                <option value="experiment">Experiment</option>
                <option value="staging">Staging</option>
                <option value="production">Production</option>
              </select>
            </label>
            <label className="text-xs font-medium text-slate-600">
              Approval
              <select
                value={approvalFilter}
                onChange={(event) => setApprovalFilter(event.target.value)}
                className="mt-1 block h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm"
              >
                <option value="all">All approvals</option>
                <option value="Approved">Approved</option>
                <option value="Pending review">Pending review</option>
                <option value="Rejected">Rejected</option>
              </select>
            </label>
            {(["owner", "team", "platform", "model"] as const).map((key) => (
              <label
                key={key}
                className="text-xs font-medium capitalize text-slate-600"
              >
                {key}
                <select
                  value={
                    key === "owner"
                      ? ownerFilter
                      : key === "team"
                        ? teamFilter
                        : key === "platform"
                          ? platformFilter
                          : modelFilter
                  }
                  onChange={(event) => {
                    const value = event.target.value;
                    if (key === "owner") setOwnerFilter(value);
                    else if (key === "team") setTeamFilter(value);
                    else if (key === "platform") setPlatformFilter(value);
                    else setModelFilter(value);
                  }}
                  className="mt-1 block h-9 max-w-[180px] rounded-lg border border-slate-300 bg-white px-2 text-sm"
                >
                  <option value="all">All {key}s</option>
                  {filterOptions(key).map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <button
              type="button"
              onClick={() => {
                setEnvironmentFilter("all");
                setApprovalFilter("all");
                setOwnerFilter("all");
                setTeamFilter("all");
                setPlatformFilter("all");
                setModelFilter("all");
              }}
              className="h-9 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700"
            >
              Clear filters
            </button>
            <span className="text-xs text-slate-500">
              {filteredInventory.length} workflow(s) shown
            </span>
          </div>
        )}

        <section className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          {metrics.map(([label, value, note, color]) => (
            <div
              key={label}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {label}
              </div>
              <div
                className={`mt-2 text-2xl font-semibold tabular-nums ${color}`}
              >
                {value}
              </div>
              <div className="mt-1 text-[11px] text-slate-500">{note}</div>
            </div>
          ))}
        </section>

        {liveError && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-800">
            <span className="font-semibold">
              Live workspace data is unavailable.
            </span>{" "}
            No synthetic records have been substituted. {liveError}
          </div>
        )}

        <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(330px,0.65fr)]">
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-start justify-between border-b border-slate-100 px-5 py-4 sm:px-6">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    Critical incidents
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Ranked by observed evidence, not speculative causes.
                  </p>
                </div>
                {!isLive ? (
                  <Link
                    to="/demo/replay"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-electric-blue"
                  >
                    Open sample replay <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                ) : null}
              </div>
              <div className="divide-y divide-slate-100">
                {isLive ? (
                  liveIncidents.length > 0 ? (
                    liveIncidents.map((incident) => {
                      const flow = incident.flow_id
                        ? liveFlowById.get(incident.flow_id)
                        : undefined;
                      return (
                        <div
                          key={incident.id}
                          className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6"
                        >
                          <div className="flex gap-3">
                            <div
                              className={`mt-0.5 rounded-lg p-2 ${incident.severity === "critical" ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"}`}
                            >
                              <CircleAlert className="h-4 w-4" />
                            </div>
                            <div>
                              <div className="flex flex-wrap items-center gap-2 text-sm font-semibold capitalize text-slate-900">
                                {flow?.name ?? "Unassigned workflow"}{" "}
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${incident.severity === "critical" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}
                                >
                                  {incident.severity}
                                </span>
                              </div>
                              <div className="mt-1 text-xs text-slate-500">
                                {flow?.team_label ?? "No team"} ·{" "}
                                {flow?.protection_mode ?? "Unknown protection"}
                              </div>
                              <div className="mt-2 text-xs text-slate-700">
                                {incident.reason} · $
                                {Number(incident.observed_cost_usd).toFixed(2)}{" "}
                                observed · {incident.blocked_request_count}{" "}
                                blocked
                              </div>
                            </div>
                          </div>
                          {flow?.flow_id ? (
                            <Link
                              to={`/flows/${flow.flow_id}`}
                              className="inline-flex h-9 items-center justify-center gap-1 rounded-lg bg-slate-950 px-3 text-xs font-semibold text-white hover:bg-slate-800"
                            >
                              Inspect workflow{" "}
                              <ChevronRight className="h-3.5 w-3.5" />
                            </Link>
                          ) : null}
                        </div>
                      );
                    })
                  ) : (
                    <div className="px-5 py-8 text-sm text-slate-500 sm:px-6">
                      No open incidents in this reporting scope.
                    </div>
                  )
                ) : (
                  <>
                    <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                      <div className="flex gap-3">
                        <div className="mt-0.5 rounded-lg bg-red-50 p-2 text-red-600">
                          <CircleAlert className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900">
                            Out-of-office responder{" "}
                            <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                              Critical
                            </span>
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            Maya Chen · People Ops · Guard connected
                          </div>
                          <div className="mt-2 text-xs text-slate-700">
                            $0.42/min observed · 35× baseline · next request
                            blocked
                          </div>
                        </div>
                      </div>
                      <Link
                        to="/demo/replay"
                        className="inline-flex h-9 items-center justify-center gap-1 rounded-lg bg-slate-950 px-3 text-xs font-semibold text-white hover:bg-slate-800"
                      >
                        Inspect evidence{" "}
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                    <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                      <div className="flex gap-3">
                        <div className="mt-0.5 rounded-lg bg-amber-50 p-2 text-amber-600">
                          <CircleAlert className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-900">
                            Weekly report generator{" "}
                            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                              Needs review
                            </span>
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            Unassigned · Operations · Monitor only
                          </div>
                          <div className="mt-2 text-xs text-slate-700">
                            Stale telemetry · last received 9 days ago
                          </div>
                        </div>
                      </div>
                      <button className="inline-flex h-9 items-center justify-center gap-1 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:border-slate-500">
                        Request owner intervention{" "}
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
                <h2 className="text-sm font-semibold text-slate-900">
                  AI inventory
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Registered workflows only. Coverage is not automatic discovery
                  of employee activity.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-xs">
                  <thead className="border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="px-5 py-3 font-semibold sm:px-6">
                        Workflow
                      </th>
                      <th className="px-3 py-3 font-semibold">Owner / team</th>
                      <th className="px-3 py-3 font-semibold">Environment</th>
                      <th className="px-3 py-3 font-semibold">Approval</th>
                      <th className="px-3 py-3 font-semibold">Today</th>
                      <th className="px-5 py-3 font-semibold"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredInventory.map((flow) => (
                      <tr key={flow.id} className="hover:bg-slate-50">
                        <td className="px-5 py-4 sm:px-6">
                          <div className="font-semibold text-slate-800">
                            {flow.name}
                          </div>
                          <div className="mt-1 text-[11px] text-slate-400">
                            {flow.platform} · {flow.model}
                          </div>
                        </td>
                        <td className="px-3 py-4">
                          <div className="text-slate-700">{flow.owner}</div>
                          <div className="mt-1 text-[11px] text-slate-400">
                            {flow.team}
                          </div>
                        </td>
                        <td className="px-3 py-4 text-slate-700">
                          {flow.environment}
                        </td>
                        <td className="px-3 py-4">
                          <span
                            className={`rounded-full px-2 py-1 text-[10px] font-semibold ${flow.approval === "Approved" ? "bg-emerald/10 text-emerald" : "bg-amber-50 text-amber-700"}`}
                          >
                            {flow.approval}
                          </span>
                        </td>
                        <td className="px-3 py-4 font-semibold tabular-nums text-slate-800">
                          {flow.todayCost === 0
                            ? "No data"
                            : `$${flow.todayCost.toFixed(2)}`}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-3">
                            <Link
                              to={isLive ? `/flows/${flow.id}` : "/demo/replay"}
                              className="text-electric-blue hover:underline"
                            >
                              {isLive ? "Details" : "Inspect replay"}
                            </Link>
                            {isLive && liveIsAdmin && (
                              <button
                                type="button"
                                onClick={() => {
                                  const liveFlow = activeLiveInventory.find(
                                    (candidate) =>
                                      candidate.flow_id === flow.id,
                                  );
                                  if (liveFlow) openGovernance(liveFlow);
                                }}
                                className="text-slate-500 hover:text-slate-900"
                              >
                                Governance
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredInventory.length === 0 && (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-5 py-8 text-center text-sm text-slate-500"
                        >
                          No workflows match these filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            {isLive && activeLiveInventory.length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-[1.5px] text-slate-500">
                  Value coverage
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  User-entered estimates stay separate from observed spending
                  and are never presented as full business ROI.
                </p>
                <div className="mt-4 space-y-2">
                  {activeLiveInventory.map((flow) => (
                    <div
                      key={flow.flow_id}
                      className="flex flex-col gap-2 rounded-xl border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="text-sm text-slate-700">
                        <span className="font-semibold">{flow.name}</span>
                        <span className="ml-2 text-xs text-slate-500">
                          {flow.expected_monthly_value_usd == null
                            ? "No estimate"
                            : `Expected ${formatUsd(Number(flow.expected_monthly_value_usd))}/mo`}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setValueFlow(flow);
                          setReviewExpectedOutcome(flow.expected_outcome ?? "");
                          setReviewTargetQuantity(
                            flow.target_quantity == null
                              ? ""
                              : String(flow.target_quantity),
                          );
                          setReviewValuePerUnit(
                            flow.value_per_unit_usd == null
                              ? ""
                              : String(flow.value_per_unit_usd),
                          );
                          setReviewMonthlyValue(
                            flow.expected_monthly_value_usd == null
                              ? ""
                              : String(flow.expected_monthly_value_usd),
                          );
                          setReviewValueAssumptions(
                            flow.value_assumptions ?? "",
                          );
                          setValueError(null);
                        }}
                        className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:border-slate-500"
                      >
                        Edit estimate
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {isLive && liveIncidents.length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-[1.5px] text-slate-500">
                  Incident actions
                </div>
                <div className="mt-4 space-y-3">
                  {liveIncidents.map((incident) => (
                    <div
                      key={incident.id}
                      className="flex flex-col gap-3 rounded-xl border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="text-sm text-slate-700">
                        <span className="font-semibold">{incident.reason}</span>
                        <span className="ml-2 text-xs text-slate-500">
                          {incident.blocked_request_count} blocked request(s)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setIncidentToResolve(incident);
                          setResolutionError(null);
                        }}
                        className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:border-slate-500"
                      >
                        Resolve with note
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <aside className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[1.5px] text-slate-500">
                <Users className="h-4 w-4" /> Governance coverage
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                {governance.map(([label, value]) => (
                  <div key={label} className="rounded-xl bg-slate-50 p-3">
                    <div className="text-[10px] uppercase tracking-wider text-slate-400">
                      {label}
                    </div>
                    <div className="mt-1 text-xl font-semibold text-slate-900">
                      {value}
                    </div>
                    <div className="mt-1 text-[10px] text-electric-blue">
                      View workflows →
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-xl border border-slate-200 p-3 text-xs leading-5 text-slate-500">
                Counts are separate checks and may overlap. Owner means the
                accountable workflow owner, not a claim about employee
                productivity.
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[1.5px] text-slate-500">
                    Experiments
                  </div>
                  <h2 className="mt-2 text-lg font-semibold text-slate-900">
                    Review queue
                  </h2>
                </div>
                <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-700">
                  {isLive ? livePendingReviews : pendingReviews} pending
                </span>
              </div>
              <div className="mt-4 space-y-3">
                {isLive ? (
                  activeLiveInventory.filter(
                    (flow) => flow.approval_status === "pending",
                  ).length > 0 ? (
                    activeLiveInventory
                      .filter((flow) => flow.approval_status === "pending")
                      .map((flow) => (
                        <div
                          key={flow.flow_id}
                          className="rounded-xl border border-amber-200 bg-amber-50 p-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-semibold text-slate-800">
                                {flow.name}
                              </div>
                              <div className="mt-1 text-xs text-slate-600">
                                {flow.expected_monthly_value_usd == null
                                  ? "Missing value target"
                                  : `Expected monthly value: ${formatUsd(Number(flow.expected_monthly_value_usd))}`}
                              </div>
                              <div className="mt-1 text-xs text-slate-600">
                                {flow.environment} · {flow.protection_mode}
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                setReviewFlow(flow);
                                setReviewEnvironment(flow.environment);
                                setReviewDecision("approved");
                                setReviewExpectedOutcome(
                                  flow.expected_outcome ?? "",
                                );
                                setReviewTargetQuantity(
                                  flow.target_quantity == null
                                    ? ""
                                    : String(flow.target_quantity),
                                );
                                setReviewValuePerUnit(
                                  flow.value_per_unit_usd == null
                                    ? ""
                                    : String(flow.value_per_unit_usd),
                                );
                                setReviewMonthlyValue(
                                  flow.expected_monthly_value_usd == null
                                    ? ""
                                    : String(flow.expected_monthly_value_usd),
                                );
                                setReviewValueAssumptions(
                                  flow.value_assumptions ?? "",
                                );
                                setReviewError(null);
                              }}
                              className="text-xs font-semibold text-amber-800 hover:underline"
                            >
                              Review
                            </button>
                          </div>
                        </div>
                      ))
                  ) : (
                    <div className="rounded-xl border border-slate-200 p-3 text-xs text-slate-500">
                      No pending reviews in this workspace.
                    </div>
                  )
                ) : (
                  <>
                    <div
                      className={`rounded-xl border p-3 ${reviewed.includes("invoice") ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-800">
                            Invoice extraction
                          </div>
                          <div className="mt-1 text-xs text-slate-600">
                            Expected outcome: 400 invoices processed / month
                          </div>
                          <div className="mt-1 text-xs text-slate-600">
                            Value estimate: $5,000/mo · AI cost: $720
                          </div>
                        </div>
                        {reviewed.includes("invoice") ? (
                          <Check className="h-4 w-4 text-emerald" />
                        ) : (
                          <button
                            onClick={() =>
                              setReviewed((items) => [...items, "invoice"])
                            }
                            className="text-xs font-semibold text-amber-800 hover:underline"
                          >
                            Review
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3">
                      <div className="text-sm font-semibold text-slate-800">
                        Support triage
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        Missing value target · next review Sep 30
                      </div>
                      <button className="mt-2 text-xs font-semibold text-electric-blue hover:underline">
                        Add estimate
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-950 p-5 text-white shadow-sm">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[1.5px] text-slate-400">
                <LockKeyhole className="h-4 w-4" /> Value vs AI cost
              </div>
              <div className="mt-4 flex items-end justify-between">
                <div>
                  <div className="text-3xl font-semibold">{valueMultiple}</div>
                  <div className="mt-1 text-xs text-slate-400">
                    {isLive
                      ? "Forecast value / projected cost"
                      : "Value / cost multiple"}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold text-emerald-300">
                    {netReturn}
                  </div>
                  <div className="text-xs text-slate-400">
                    Net return on AI spend
                  </div>
                </div>
              </div>
              <div className="mt-4 border-t border-white/10 pt-3 text-xs leading-5 text-slate-400">
                {isLive
                  ? valueMetrics.multiple === null
                    ? "N/A until user-entered value estimates and observed spend are available."
                    : "Forecast: expected monthly value divided by projected monthly AI cost. This is not full business ROI."
                  : "Based on $5,000 estimated monthly value and $720 AI cost for one covered workflow. User estimate · USD · not full business ROI."}
              </div>
              <div className="mt-3 text-[11px] text-slate-500">
                {isLive
                  ? `Value estimates supplied for ${liveSummary?.value_coverage_count ?? 0} of ${activeLiveInventory.length || activeWorkflows} workflows.`
                  : "Value estimates supplied for 1 of 4 demo workflows."}
              </div>
            </div>
          </aside>
        </section>
        <footer className="mt-8 flex flex-col justify-between gap-3 border-t border-slate-200 pt-5 text-xs text-slate-500 sm:flex-row">
          <span>
            Scope:{" "}
            {isLive
              ? "Authenticated workspace"
              : isLocalPreview
                ? "Preview account · test@gmail.com"
                : "Demo workspace"}{" "}
            · {period} · UTC
          </span>
          <span>
            {isLive
              ? "Spend and governance counts use workspace-scoped server aggregates."
              : isLocalPreview
                ? "Signed-in development preview; synthetic data remains isolated from Supabase."
                : "Public demo management data is illustrative and isolated."}
          </span>
        </footer>
      </div>
      {governanceFlow && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="governance-flow-title"
        >
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[1.5px] text-slate-500">
                  Governance fields
                </div>
                <h2
                  id="governance-flow-title"
                  className="mt-2 text-xl font-semibold text-slate-950"
                >
                  Edit {governanceFlow.name}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Ownership changes are workspace-validated and written to the
                  audit log.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setGovernanceFlow(null)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close governance editor"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={submitGovernance} className="mt-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm text-slate-700">
                  Accountable owner
                  <select
                    value={governanceOwner}
                    onChange={(event) => setGovernanceOwner(event.target.value)}
                    className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3"
                  >
                    <option value="">Unassigned</option>
                    {liveMembers.map((member) => (
                      <option key={member.member_id} value={member.member_id}>
                        {memberLabel(member.member_id)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm text-slate-700">
                  Budget owner
                  <select
                    value={governanceBudgetOwner}
                    onChange={(event) =>
                      setGovernanceBudgetOwner(event.target.value)
                    }
                    className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3"
                  >
                    <option value="">Unassigned</option>
                    {liveMembers.map((member) => (
                      <option key={member.member_id} value={member.member_id}>
                        {memberLabel(member.member_id)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="block text-sm text-slate-700">
                Team
                <label className="sr-only" htmlFor="governance-team">
                  Team
                </label>
                <input
                  id="governance-team"
                  value={governanceTeam}
                  onChange={(event) => setGovernanceTeam(event.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3"
                  placeholder="Finance Operations"
                />
              </label>
              <label className="block text-sm text-slate-700">
                Business purpose
                <textarea
                  value={governancePurpose}
                  onChange={(event) => setGovernancePurpose(event.target.value)}
                  rows={3}
                  required
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                  placeholder="What business process does this workflow support?"
                />
              </label>
              {governanceError && (
                <p className="text-sm text-red-700">{governanceError}</p>
              )}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setGovernanceFlow(null)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={governanceSaving}
                  className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {governanceSaving ? "Saving…" : "Save governance"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {valueFlow && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="value-flow-title"
        >
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[1.5px] text-slate-500">
                  Value estimate
                </div>
                <h2
                  id="value-flow-title"
                  className="mt-2 text-xl font-semibold text-slate-950"
                >
                  Edit {valueFlow.name}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Missing values stay unknown. Assumptions are retained with the
                  workflow and audit entry.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setValueFlow(null)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close value estimate"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={submitValue} className="mt-6 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm text-slate-700">
                  Expected outcome
                  <input
                    value={reviewExpectedOutcome}
                    onChange={(event) =>
                      setReviewExpectedOutcome(event.target.value)
                    }
                    className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3"
                    placeholder="Invoices processed"
                  />
                </label>
                <label className="text-sm text-slate-700">
                  Target quantity
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={reviewTargetQuantity}
                    onChange={(event) =>
                      setReviewTargetQuantity(event.target.value)
                    }
                    className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3"
                  />
                </label>
                <label className="text-sm text-slate-700">
                  Value per unit (USD)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={reviewValuePerUnit}
                    onChange={(event) =>
                      setReviewValuePerUnit(event.target.value)
                    }
                    className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3"
                  />
                </label>
                <label className="text-sm text-slate-700">
                  Expected monthly value (USD)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={reviewMonthlyValue}
                    onChange={(event) =>
                      setReviewMonthlyValue(event.target.value)
                    }
                    className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3"
                  />
                </label>
              </div>
              <label className="block text-sm text-slate-700">
                Value source
                <select
                  value={reviewValueSource}
                  onChange={(event) => setReviewValueSource(event.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3"
                >
                  <option>user estimate</option>
                  <option>manual reported outcome</option>
                  <option>instrumented outcome</option>
                </select>
              </label>
              <label className="block text-sm text-slate-700">
                Assumptions
                <textarea
                  value={reviewValueAssumptions}
                  onChange={(event) =>
                    setReviewValueAssumptions(event.target.value)
                  }
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                  placeholder="How was the estimate derived?"
                />
              </label>
              {valueError && (
                <p className="text-sm text-red-700">{valueError}</p>
              )}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setValueFlow(null)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={valueSaving}
                  className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {valueSaving ? "Saving…" : "Save estimate"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {incidentToResolve && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="resolve-incident-title"
        >
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[1.5px] text-slate-500">
                  Incident resolution
                </div>
                <h2
                  id="resolve-incident-title"
                  className="mt-2 text-xl font-semibold text-slate-950"
                >
                  Close this incident?
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  This changes persisted incident status only. It does not erase
                  runs, spending, or guard evidence.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIncidentToResolve(null)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close resolution"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={submitResolution} className="mt-6 space-y-4">
              <label className="block text-sm text-slate-700">
                Resolution note
                <textarea
                  value={resolutionNote}
                  onChange={(event) => setResolutionNote(event.target.value)}
                  rows={4}
                  required
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                  placeholder="What intervention or policy change addressed the evidence?"
                />
              </label>
              {resolutionError && (
                <p className="text-sm text-red-700">{resolutionError}</p>
              )}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIncidentToResolve(null)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resolutionSaving}
                  className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {resolutionSaving ? "Saving…" : "Resolve incident"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {reviewFlow && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="review-flow-title"
        >
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[1.5px] text-slate-500">
                  Admin review
                </div>
                <h2
                  id="review-flow-title"
                  className="mt-2 text-xl font-semibold text-slate-950"
                >
                  Review {reviewFlow.name}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Promotion changes lifecycle and approval state together. The
                  decision is written to the audit log.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReviewFlow(null)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close review"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={submitReview} className="mt-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm text-slate-700">
                  Decision
                  <select
                    value={reviewDecision}
                    onChange={(event) => setReviewDecision(event.target.value)}
                    className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3"
                  >
                    <option value="approved">Approve</option>
                    <option value="rejected">Reject</option>
                    <option value="pending">Keep pending</option>
                  </select>
                </label>
                <label className="text-sm text-slate-700">
                  Environment
                  <select
                    value={reviewEnvironment}
                    onChange={(event) =>
                      setReviewEnvironment(event.target.value)
                    }
                    className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3"
                  >
                    <option value="experiment">Experiment</option>
                    <option value="staging">Staging</option>
                    <option value="production">Production</option>
                  </select>
                </label>
              </div>
              <label className="block text-sm text-slate-700">
                Next review date
                {reviewDecision === "rejected" ? (
                  <span className="ml-2 text-xs text-slate-400">
                    not required for rejection
                  </span>
                ) : null}
                <input
                  type="date"
                  value={reviewDate}
                  onChange={(event) => setReviewDate(event.target.value)}
                  disabled={reviewDecision === "rejected"}
                  className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 disabled:bg-slate-100"
                />
              </label>
              <label className="block text-sm text-slate-700">
                Decision note
                <textarea
                  value={reviewNote}
                  onChange={(event) => setReviewNote(event.target.value)}
                  rows={3}
                  required
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                  placeholder="Why is this decision appropriate?"
                />
              </label>
              {reviewError && (
                <p className="text-sm text-red-700">{reviewError}</p>
              )}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setReviewFlow(null)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reviewSaving}
                  className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {reviewSaving ? "Saving…" : "Save review"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
};

export default function CommandCenter() {
  const location = useLocation();
  const { user } = useAuth(false);
  const isDemoRoute = location.pathname.startsWith("/demo/");
  const isPreview =
    !isDemoRoute &&
    !isSupabaseConfigured &&
    Boolean(user) &&
    isLocalPreviewAuthEnabled;
  if (isDemoRoute || isPreview)
    return <SampleReviews mode={isDemoRoute ? "demo" : "preview"} />;
  return <LiveCommandCenter />;
}
