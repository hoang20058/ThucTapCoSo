import { ChevronDown, ChevronRight, Shield } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { navigationGroups, defaultRoute } from "../../config/navigation";

function SidebarLink({ to, icon: Icon, label, onNavigate }) {
  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-2xl px-3 py-2 text-sm font-medium transition-all duration-200 ease-premium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:ring-offset-2 focus-visible:ring-offset-app-surface ${
          isActive ? "bg-app-primary text-app-primary-contrast shadow-glow" : "text-app-text/90 hover:bg-app-surface-alt hover:text-app-text"
        }`
      }
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </NavLink>
  );
}

function SidebarGroup({ group, open, onToggle, onNavigate }) {
  const location = useLocation();
  const GroupIcon = group.icon;
  const hasActiveChild = useMemo(
    () => group.children?.some((item) => location.pathname === item.path),
    [group.children, location.pathname]
  );

  useEffect(() => {
    if (hasActiveChild && !open) onToggle(true);
  }, [hasActiveChild, open, onToggle]);

  if (!group.children) {
    return <SidebarLink to={group.path || defaultRoute} icon={group.icon} label={group.label} onNavigate={onNavigate} />;
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => onToggle(!open)}
        aria-expanded={open}
        className={`flex w-full items-center justify-between rounded-2xl px-3 py-2 text-sm font-semibold transition-all duration-200 ease-premium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-focus focus-visible:ring-offset-2 focus-visible:ring-offset-app-surface ${
          hasActiveChild ? "bg-app-surface-alt text-app-text" : "text-app-text/90 hover:bg-app-surface-alt hover:text-app-text"
        }`}
      >
        <span className="flex items-center gap-3">
          <GroupIcon className="h-4 w-4" />
          {group.label}
        </span>
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>
      {open && (
        <div className="ml-3 space-y-2 border-l border-app-border pl-3">
          {group.children.map((item) => (
            <SidebarLink key={item.path} to={item.path} icon={item.icon} label={item.label} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ResponsiveSidebar({ mobileOpen, onClose, onLogout }) {
  const [expanded, setExpanded] = useState({});

  const renderNav = (onNavigate) => (
    <nav className="flex-1 space-y-2 overflow-y-auto pr-1">
      {navigationGroups.map((group) => (
        <SidebarGroup
          key={group.label}
          group={group}
          open={expanded[group.label] ?? true}
          onToggle={(next) => setExpanded((prev) => ({ ...prev, [group.label]: next }))}
          onNavigate={onNavigate}
        />
      ))}
    </nav>
  );

  return (
    <>
      <aside className="hidden h-[calc(100vh-3rem)] w-[300px] shrink-0 rounded-[28px] border border-app-border bg-app-surface/95 p-4 text-app-text shadow-panel backdrop-blur lg:flex lg:flex-col">
        <div className="mb-6 flex items-center gap-3 px-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-app-primary-soft text-app-primary">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <p className="text-lg font-semibold leading-tight">Kho bảo mật</p>
            <p className="text-xs text-app-muted">DApp Password Manager</p>
          </div>
        </div>
        {renderNav(() => {})}

        <button
          type="button"
          className="mt-4 flex w-full items-center gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-left text-sm font-semibold text-rose-600 transition-all duration-200 ease-premium hover:-translate-y-0.5 hover:bg-rose-500/15 active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-app-surface dark:text-rose-300"
          onClick={onLogout}
        >
          Đăng xuất
        </button>
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm lg:hidden" onClick={onClose} />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[86vw] max-w-sm transform border-r border-app-border bg-app-surface p-4 text-app-text shadow-modal transition-transform duration-300 ease-premium lg:hidden ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-app-primary-soft text-app-primary">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <p className="text-lg font-semibold leading-tight">Kho bảo mật</p>
              <p className="text-xs text-app-muted">Menu đa nhiệm</p>
            </div>
          </div>
          <button type="button" className="btn-soft min-h-9 px-3 py-1.5 text-xs" onClick={onClose}>
            Đóng
          </button>
        </div>
        {renderNav(onClose)}

        <button
          type="button"
          className="mt-4 flex w-full items-center gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-left text-sm font-semibold text-rose-600 transition-all duration-200 ease-premium hover:-translate-y-0.5 hover:bg-rose-500/15 active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-app-surface dark:text-rose-300"
          onClick={onLogout}
        >
          Đăng xuất
        </button>
      </aside>
    </>
  );
}
