import type { ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { BarChart3, BookOpen, LayoutDashboard, LogOut, PlayCircle, RotateCcw, Settings2, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { to: "/analytics", label: "Spending", icon: BarChart3 },
  { to: "/command-center", label: "Reviews", icon: SlidersHorizontal },
  { to: "/setup", label: "Settings", icon: Settings2 },
  { to: "/docs", label: "Help", icon: BookOpen },
];

type AppShellProps = {
  children: ReactNode;
  userLabel?: string | null;
  workspaceLabel?: string;
  preview?: boolean;
  demo?: boolean;
  onSignOut?: () => void;
  onReset?: () => void;
};

export default function AppShell({ children, userLabel, workspaceLabel = "My workspace", preview = false, demo = false, onSignOut, onReset }: AppShellProps) {
  const helpItem = { to: demo ? "/docs?mode=demo" : preview ? "/docs?mode=preview" : "/docs?mode=account", label: "Help", icon: BookOpen };
  const visibleNavItems = demo
    ? [{ to: "/demo", label: "Overview", icon: LayoutDashboard }, { to: "/demo/spending", label: "Spending", icon: BarChart3 }, { to: "/demo/management", label: "Reviews", icon: SlidersHorizontal }, { to: "/demo/replay?mode=demo", label: "Example replay", icon: PlayCircle }, helpItem]
    : preview ? [navItems[0], navItems[1], navItems[2], { to: "/demo/replay?mode=preview", label: "Example replay", icon: PlayCircle }, helpItem] : [...navItems.slice(0, 4), helpItem];
  return (
    <div className="min-h-screen bg-[#f7f8fa] text-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-5 px-4 sm:px-6 lg:px-8">
          <Link to="/" className="shrink-0 text-[17px] font-semibold tracking-[-0.02em]">
            Flow<span className="text-blue-600">Ledger</span>
          </Link>
          <div className="hidden h-5 w-px bg-slate-200 sm:block" />
          <div className="hidden min-w-0 sm:block">
            <div className="truncate text-xs font-medium text-slate-700">{workspaceLabel}</div>
            <div className="text-[10px] text-slate-400">{demo ? "Public demo · synthetic" : preview ? "Local preview · signed in" : "Authenticated workspace"}</div>
          </div>
          <nav className="ml-auto hidden items-center gap-1 md:flex" aria-label="Workspace navigation">
            {visibleNavItems.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} className={({ isActive }) => cn("inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors", isActive ? "bg-blue-50 text-blue-700" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900")}>
                <Icon className="h-3.5 w-3.5" />{label}
              </NavLink>
            ))}
          </nav>
          {userLabel ? <span className="hidden max-w-40 truncate text-xs text-slate-400 lg:block">{userLabel}</span> : null}
          {onReset ? <button type="button" onClick={onReset} className="hidden h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 lg:inline-flex"><RotateCcw className="h-3.5 w-3.5" />Reset sample</button> : null}
          {onSignOut ? <button type="button" onClick={onSignOut} className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900"><LogOut className="h-3.5 w-3.5" /><span className="hidden sm:inline">Sign out</span></button> : null}
        </div>
        <nav className="flex overflow-x-auto border-t border-slate-100 px-3 md:hidden" aria-label="Mobile workspace navigation">
          {visibleNavItems.map(({ to, label }) => <NavLink key={to} to={to} className={({ isActive }) => cn("shrink-0 border-b-2 px-3 py-2 text-xs font-medium", isActive ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500")}>{label}</NavLink>)}
          {onReset ? <button type="button" onClick={onReset} className="shrink-0 px-3 py-2 text-xs font-medium text-slate-500">Reset sample</button> : null}
        </nav>
      </header>
      <main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
