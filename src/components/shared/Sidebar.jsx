import { useEffect, useState } from "react";
import matvilLogo from "../../assets/matvil-logo.png";
import {
  LayoutDashboard,
  BookOpen,
  ClipboardCheck,
  Target,
  LineChart,
  BookMarked,
  BarChart3,
  Crosshair,
  BrainCircuit,
  NotebookText,
  CalendarDays,
  User,
  ShieldAlert,
  Newspaper,
  Calculator,
  CircleAlert,
  Bell,
  ShieldCheck,
  Building2,
  Wallet,
  Database,
  LayoutGrid,
  Wrench,
  Settings,
  CircleUserRound,
  ChevronUp,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Plus,
  Sparkles,
  Moon,
  Sun,
  PanelLeft,
} from "lucide-react";

// Icon shown for each collapsible section-group trigger (Analysis / Account / Tools).
const GROUP_ICONS = {
  Analysis: BrainCircuit,
  Account: User,
  Tools: Wrench,
};

const ACCOUNT_SETTINGS = [
  ["alerts", Bell, "Account Alerts", "Notifications & alerts"],
  ["compliance", ShieldCheck, "Compliance Center", "Rules & monitoring"],
  ["propfirm", Building2, "Prop Firm Setup", "Firms, rules & limits"],
  ["portfolio", Wallet, "Multi-Account Center", "Manage multiple accounts"],
  ["data", Database, "Data Center", "Import, export & backup"],
];

const WORKSPACE_ITEMS = [
  ["dashboard", LayoutDashboard, "Dashboard"],
  ["trades", BookOpen, "Trade Log"],
  ["playbook", BookMarked, "Playbook"],
  ["review", ClipboardCheck, "Trade Review"],
  ["plan", Target, "Trading Plan"],
  ["charts", LineChart, "Chart Workspace"],
];

const NAV_GROUPS = [
  {
    label: "Analysis",
    items: [
      ["analytics", BarChart3, "Performance"],
      ["edge", Crosshair, "Edge Analysis"],
      ["intelligence", Sparkles, "Trade Intelligence"],
      ["journalintelligence", NotebookText, "Journal Intelligence"],
      ["calendar", CalendarDays, "Calendar"],
    ],
  },
  { label: "Account", items: [["account", User, "Account Center"]] },
  {
    label: "Tools",
    items: [
      ["risk", ShieldAlert, "Risk Manager"],
      ["news", Newspaper, "News Intelligence"],
      ["sltp", Calculator, "SL / TP Calculator"],
      ["missed", CircleAlert, "Missed Trades"],
    ],
  },
];

// Small helper so every nav icon renders at a consistent, crisp size/weight.
const NavIcon = ({ icon: Icon, size = 15 }) => <Icon size={size} strokeWidth={1.75} aria-hidden="true" />;

function Sidebar({ view, setView, onAdd, theme, toggleTheme, mobileOpen = false, alertCount = 0 }) {
  const settingViews = ACCOUNT_SETTINGS.map(([id]) => id).concat("apexsettings");
  const profileViews = ["profile"];
  const workspaceViews = WORKSPACE_ITEMS.map(([id]) => id);
  const [workspaceOpen, setWorkspaceOpen] = useState(workspaceViews.includes(view));
  const [analysisOpen, setAnalysisOpen] = useState(NAV_GROUPS[0].items.some(([id]) => id === view));
  const [accountOpen, setAccountOpen] = useState(NAV_GROUPS[1].items.some(([id]) => id === view));
  const [toolsOpen, setToolsOpen] = useState(NAV_GROUPS[2].items.some(([id]) => id === view));
  const [accountSettingsOpen, setAccountSettingsOpen] = useState(settingViews.includes(view));
  const [collapsed, setCollapsed] = useState(() => typeof window !== "undefined" && window.localStorage.getItem("tradelog:sidebar-collapsed") === "true");
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    window.localStorage.setItem("tradelog:sidebar-collapsed", String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    if (workspaceViews.includes(view)) setWorkspaceOpen(true);
    if (NAV_GROUPS[0].items.some(([id]) => id === view)) setAnalysisOpen(true);
    if (NAV_GROUPS[1].items.some(([id]) => id === view)) setAccountOpen(true);
    if (NAV_GROUPS[2].items.some(([id]) => id === view)) setToolsOpen(true);
    if (settingViews.includes(view)) setAccountSettingsOpen(true);
    if (profileViews.includes(view)) setProfileOpen(true);
  }, [view]);

  const goWorkspace = (id) => { setWorkspaceOpen(true); setView(id); };
  const goSetting = (id) => { setAccountSettingsOpen(true); setView(id); };

  const sectionState = {
    Analysis: [analysisOpen, setAnalysisOpen, "analytics"],
    Account: [accountOpen, setAccountOpen, "account"],
    Tools: [toolsOpen, setToolsOpen, "risk"],
  };

  const renderSectionDropdown = (group) => {
    const [open, setOpen] = sectionState[group.label];
    const hasActive = group.items.some(([id]) => id === view);
    const GroupIcon = GROUP_ICONS[group.label];
    return (
      <div className={`td-nav-group td-section-dropdown-group ${open ? "is-open" : ""}`} key={group.label}>
        <span className="td-nav-label">{group.label}</span>
        <button
          type="button"
          title={collapsed ? group.label : undefined}
          className={`td-section-dropdown-trigger ${hasActive ? "active" : ""}`}
          onClick={() => {
            if (collapsed) { setCollapsed(false); setOpen(true); }
            else setOpen((value) => !value);
          }}
          aria-expanded={collapsed ? undefined : open}
          aria-controls={`td-${group.label.toLowerCase()}-menu`}
        >
          <span className="td-section-dropdown-icon"><NavIcon icon={GroupIcon} /></span>
          <span className="td-section-dropdown-copy"><strong>{group.label}</strong><small>{group.label === "Analysis" ? "Performance & intelligence" : group.label === "Account" ? "Account overview" : "Trading tools & utilities"}</small></span>
          <span className="td-section-dropdown-chevron">{open ? <ChevronUp size={13} strokeWidth={2} /> : <ChevronDown size={13} strokeWidth={2} />}</span>
        </button>
        <div id={`td-${group.label.toLowerCase()}-menu`} className={`td-section-dropdown-menu ${open ? "is-open" : ""}`}>
          {group.items.map(navButton)}

        </div>
      </div>
    );
  };

  const navButton = ([id, Icon, label]) => (
    <button key={id} type="button" title={collapsed ? label : undefined} className={view === id ? "active" : ""} onClick={() => setView(id)}>
      <span><NavIcon icon={Icon} /></span><span className="td-nav-text">{label}</span>
    </button>
  );

  return (
    <aside className={`td-sidebar${mobileOpen ? " td-sidebar-open" : ""}${collapsed ? " td-sidebar-collapsed" : ""}`} aria-label="TradeLog sidebar">
      <div className="td-sidebar-head">
        <div className="td-brand" title="TradeLog">
          <span className="td-brand-mark"><img src={matvilLogo} alt="TradeLog" /></span>
          <span className="td-brand-name">TradeLog</span>
        </div>
        <button type="button" className="td-sidebar-collapse" onClick={() => setCollapsed(v => !v)} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          <span>{collapsed ? <ChevronRight size={15} strokeWidth={2} /> : <ChevronLeft size={15} strokeWidth={2} />}</span>
        </button>
      </div>



      <button type="button" className="td-add" onClick={onAdd} title={collapsed ? "Log trade" : undefined}>
        <span className="td-add-icon"><Plus size={15} strokeWidth={2.25} aria-hidden="true" /></span><span className="td-add-text">Log trade</span><span className="td-add-shortcut">N</span>
      </button>

      <nav className="td-nav" aria-label="TradeLog navigation">
        <div className={`td-nav-group td-workspace-group ${workspaceOpen ? "is-open" : ""}`}>
          <button
            type="button"
            title={collapsed ? "Workspace" : undefined}
            className={`td-workspace-trigger ${workspaceViews.includes(view) ? "active" : ""}`}
            onClick={() => {
              if (collapsed) {
                setCollapsed(false);
                setWorkspaceOpen(true);
              } else {
                setWorkspaceOpen((open) => !open);
              }
            }}
            aria-expanded={collapsed ? undefined : workspaceOpen}
            aria-controls="td-workspace-menu"
          >
            <span className="td-workspace-icon"><NavIcon icon={LayoutGrid} /></span>
            <span className="td-workspace-copy"><strong>Workspace</strong><small>Journal &amp; trading views</small></span>
            <span className="td-workspace-chevron">{workspaceOpen ? <ChevronUp size={13} strokeWidth={2} /> : <ChevronDown size={13} strokeWidth={2} />}</span>
          </button>
          <div id="td-workspace-menu" className={`td-workspace-menu ${workspaceOpen ? "is-open" : ""}`}>
            {WORKSPACE_ITEMS.map((item) => (
              <button key={item[0]} type="button" title={collapsed ? item[2] : undefined} className={view === item[0] ? "active" : ""} onClick={() => goWorkspace(item[0])}>
                <span><NavIcon icon={item[1]} /></span><span className="td-nav-text">{item[2]}</span>
              </button>
            ))}
          </div>
        </div>

        {renderSectionDropdown(NAV_GROUPS[0])}
        {renderSectionDropdown(NAV_GROUPS[1])}

        <div className={`td-nav-group td-account-settings-group ${accountSettingsOpen ? "is-open" : ""}`}>
          <span className="td-nav-label">Account Settings</span>
          <button type="button" title={collapsed ? "Account Settings" : undefined} className={`td-account-settings-trigger ${settingViews.includes(view) ? "active" : ""}`} onClick={() => { if (collapsed) { setCollapsed(false); setAccountSettingsOpen(true); } else setAccountSettingsOpen(v => !v); }} aria-expanded={collapsed ? undefined : accountSettingsOpen} aria-controls="td-account-settings-menu">
            <span className="td-account-settings-icon"><NavIcon icon={Settings} /></span>
            <span className="td-account-settings-copy"><strong>Account Settings</strong><small>Manage account related settings</small></span>
            <span className="td-account-settings-chevron">{accountSettingsOpen ? <ChevronUp size={13} strokeWidth={2} /> : <ChevronDown size={13} strokeWidth={2} />}</span>
          </button>
          <div id="td-account-settings-menu" className={`td-account-settings-menu ${accountSettingsOpen ? "is-open" : ""}`}>
            {ACCOUNT_SETTINGS.map(([id, Icon, label, description]) => (
              <button key={id} type="button" title={collapsed ? label : undefined} className={view === id ? "active" : ""} onClick={() => goSetting(id)}>
                <span className="td-setting-icon"><NavIcon icon={Icon} /></span>
                <span className="td-setting-copy"><strong>{label}</strong><small>{description}</small></span>
                {id === "alerts" && alertCount > 0 && <b className="td-alert-count">{alertCount > 99 ? "99+" : alertCount}</b>}
                <span className="td-setting-arrow"><ChevronRight size={12} strokeWidth={2} /></span>
              </button>
            ))}
          </div>
        </div>

        {renderSectionDropdown(NAV_GROUPS[2])}

        <div className={`td-nav-group td-profile-group ${profileOpen ? "is-open" : ""}`}>
          <span className="td-nav-label">Profile</span>
          <button
            type="button"
            className={`td-profile-trigger ${profileOpen || profileViews.includes(view) ? "active" : ""}`}
            title={collapsed ? "Profile" : undefined}
            onClick={() => {
              if (collapsed) setCollapsed(false);
              setProfileOpen((open) => !open);
            }}
            aria-expanded={profileOpen}
            aria-controls="td-profile-menu"
          >
            <span className="td-profile-icon"><NavIcon icon={CircleUserRound} /></span>
            <span className="td-profile-copy"><strong>Profile</strong><small>Appearance & preferences</small></span>
            <span className="td-profile-chevron">{profileOpen ? <ChevronUp size={13} strokeWidth={2} /> : <ChevronDown size={13} strokeWidth={2} />}</span>
          </button>

          <div id="td-profile-menu" className={`td-profile-menu ${profileOpen ? "is-open" : ""}`}>
            <button type="button" onClick={() => { setProfileOpen(false); setView("profile"); }} className={view === "profile" ? "active" : ""}>
              <span><NavIcon icon={CircleUserRound} /></span>
              <span><strong>My Profile</strong><small>Personal & account details</small></span>
              <b><ChevronRight size={12} strokeWidth={2} /></b>
            </button>
            <button type="button" onClick={toggleTheme} title={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}>
              <span><NavIcon icon={PanelLeft} /></span>
              <span><strong>Appearance</strong><small>{theme === "light" ? "Light theme" : "Dark theme"}</small></span>
              <b>{theme === "light" ? <Moon size={13} strokeWidth={2} /> : <Sun size={13} strokeWidth={2} />}</b>
            </button>
            <button type="button" onClick={() => setCollapsed((value) => !value)} title="Toggle sidebar density">
              <span><NavIcon icon={PanelLeft} /></span>
              <span><strong>Navigation</strong><small>{collapsed ? "Compact sidebar" : "Expanded sidebar"}</small></span>
              <b><ChevronRight size={12} strokeWidth={2} /></b>
            </button>
          </div>
        </div>
      </nav>

      <div className="td-sidebar-bottom" aria-hidden="true" />
    </aside>
  );
}

export default Sidebar;
