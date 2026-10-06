import React, { useEffect, useRef, useState } from "react";

function formatImportDate(value) {
  if (!value) return "No trades logged yet";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No trades logged yet";

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatMonth(value) {
  if (!value) {
    return new Date().toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });
  }

  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return "All dates";

  return date.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}

function DashboardHeader({ latestTradeTimestamp, latestTradeDate, onRefresh, onExport = null, accounts = [], filterAccounts = [], activeAccount = null, activeAccountId = "all", accountStatusFilter = "active", onAccountStatusFilterChange = null, onSelectAccount = null, theme = "light", toggleTheme, session = null, onOpenProfile = null }) {
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [dateMenuOpen, setDateMenuOpen] = useState(false);
  const accountMenuRef = useRef(null);
  const filterMenuRef = useRef(null);
  const profileMenuRef = useRef(null);

  useEffect(() => {
    if (!accountMenuOpen && !filterMenuOpen && !profileMenuOpen && !dateMenuOpen) return undefined;
    const handlePointerDown = (event) => {
      if (!accountMenuRef.current?.contains(event.target)) setAccountMenuOpen(false);
      if (!filterMenuRef.current?.contains(event.target)) setFilterMenuOpen(false);
      if (!profileMenuRef.current?.contains(event.target)) setProfileMenuOpen(false);
      if (!event.target.closest?.(".td-date-menu")) setDateMenuOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") { setAccountMenuOpen(false); setFilterMenuOpen(false); setProfileMenuOpen(false); setDateMenuOpen(false); }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [accountMenuOpen, filterMenuOpen, profileMenuOpen, dateMenuOpen]);

  const accountLabel = activeAccountId === "all" ? "All Accounts" : activeAccount?.name || accounts[0]?.name || "Account";
  const metadata = session?.user?.user_metadata || {};
  const firstName = metadata.first_name || metadata.firstName || "";
  const lastName = metadata.last_name || metadata.lastName || "";
  const profileName = `${firstName} ${lastName}`.trim() || metadata.full_name || metadata.name || session?.user?.email?.split("@")[0] || "TradeLog User";
  const profileInitials = `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase() || profileName.replace(/[^a-z0-9]/gi, "").slice(0, 2).toUpperCase() || "TL";
  const statusOptions = [
    { value: "active", label: "Active Accounts", description: "Currently active evaluations and funded accounts" },
    { value: "blown", label: "Blown Accounts", description: "Historical blown, failed, closed or inactive accounts" },
    { value: "passed", label: "Passed Accounts", description: "Historical evaluations marked passed or cleared" },
    { value: "all", label: "All Account Statuses", description: "Active + historical accounts" },
  ];
  const selectedStatus = statusOptions.find((item) => item.value === accountStatusFilter) || statusOptions[0];
  const statusCounts = filterAccounts.reduce((counts, account) => {
    const settings = account?.settings || {};
    const status = String(settings.accountStatus || account?.status || "active").trim().toLowerCase();
    const stage = String(settings.accountStage || "evaluation").trim().toLowerCase();
    const evaluationStatus = String(settings.evaluationStatus || "").trim().toLowerCase();
    const key = ["blown", "failed", "closed", "inactive", "disabled"].some((value) => status.includes(value))
      ? "blown"
      : stage !== "funded" && ["passed", "cleared", "complete", "completed"].some((value) => evaluationStatus.includes(value))
        ? "passed"
        : "active";
    counts[key] += 1;
    counts.all += 1;
    return counts;
  }, { active: 0, blown: 0, passed: 0, all: 0 });

  return (
    <>
      <header className="td-header">
        <div>
          <h1>Dashboard</h1>
          <p>Performance overview</p>
        </div>

        <div className="td-header-actions">
          <div className="td-account-menu" ref={accountMenuRef}>
            <button
              type="button"
              className={`td-account-select ${accountMenuOpen ? "is-open" : ""}`}
              onClick={() => setAccountMenuOpen((open) => !open)}
              aria-haspopup="listbox"
              aria-expanded={accountMenuOpen}
            >
              <span className="td-account-select-icon">▦</span>
              <span className="td-account-select-copy">
                <small>Account</small>
                <strong>{accountLabel}</strong>
              </span>
              <span className="td-account-select-chevron">⌄</span>
            </button>

            {accountMenuOpen && (
              <div className="td-account-dropdown" role="listbox" aria-label="Select trading account">
                <button
                  type="button"
                  role="option"
                  aria-selected={activeAccountId === "all"}
                  className={activeAccountId === "all" ? "active" : ""}
                  onClick={() => { onSelectAccount?.("all"); setAccountMenuOpen(false); }}
                >
                  <span className="td-account-dropdown-avatar">ALL</span>
                  <span>All Accounts</span>
                  {activeAccountId === "all" && <span className="td-account-dropdown-check">✓</span>}
                </button>
                {accounts.length === 0 ? (
                  <div className="td-account-dropdown-empty">No accounts available</div>
                ) : accounts.map((account) => (
                  <button
                    key={account.id}
                    type="button"
                    role="option"
                    aria-selected={account.id === activeAccountId}
                    className={account.id === activeAccountId ? "active" : ""}
                    onClick={() => { onSelectAccount?.(account.id); onAccountStatusFilterChange?.("active"); setAccountMenuOpen(false); }}
                  >
                    <span className="td-account-dropdown-avatar">
                      {(account.name || "A").replace(/[^a-zA-Z0-9]/g, "").slice(0, 2).toUpperCase() || "A"}
                    </span>
                    <span>{account.name || "Trading Account"}</span>
                    {account.id === activeAccountId && <span className="td-account-dropdown-check">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="td-date-menu">
            <button type="button" aria-haspopup="menu" aria-expanded={dateMenuOpen} onClick={() => { setDateMenuOpen(v => !v); setAccountMenuOpen(false); setFilterMenuOpen(false); setProfileMenuOpen(false); }}>▣ {formatMonth(latestTradeDate)}⌄</button>
            {dateMenuOpen && <div className="td-filter-dropdown td-date-dropdown" role="menu">
              <div className="td-filter-dropdown-head"><div><strong>Dashboard date</strong><small>Jump to useful journal views.</small></div></div>
              <button type="button" className="td-filter-option" onClick={() => { onRefresh?.(); setDateMenuOpen(false); }}><span className="td-filter-option-radio">↻</span><span className="td-filter-option-copy"><strong>Refresh latest data</strong><small>Reload the latest journal state.</small></span></button>
              <button type="button" className="td-filter-option" onClick={() => { window.dispatchEvent(new CustomEvent("tradelog:dashboard-date", { detail: { mode: "latest-month" } })); setDateMenuOpen(false); }}><span className="td-filter-option-radio">▣</span><span className="td-filter-option-copy"><strong>Latest trading month</strong><small>Keep the dashboard focused on recent activity.</small></span></button>
              <button type="button" className="td-filter-option" onClick={() => { window.dispatchEvent(new CustomEvent("tradelog:dashboard-date", { detail: { mode: "all" } })); setDateMenuOpen(false); }}><span className="td-filter-option-radio">∞</span><span className="td-filter-option-copy"><strong>All dates</strong><small>Use the complete journal history.</small></span></button>
            </div>}
          </div>
          <div className={`td-filter-menu ${filterMenuOpen ? "is-open" : ""}`} ref={filterMenuRef}>
            <button
              type="button"
              className={`td-filter-trigger ${filterMenuOpen || accountStatusFilter !== "active" ? "is-active" : ""}`}
              onClick={() => { setFilterMenuOpen((open) => !open); setAccountMenuOpen(false); setProfileMenuOpen(false); }}
              aria-haspopup="menu"
              aria-expanded={filterMenuOpen}
            >
              <span>⌁</span> Filters{accountStatusFilter !== "active" && <b className="td-filter-count">1</b>}⌄
            </button>
            {filterMenuOpen && (
              <div className="td-filter-dropdown" role="menu" aria-label="Dashboard trade filters">
                <div className="td-filter-dropdown-head">
                  <div><strong>Filter trades</strong><small>Choose which account history is included in the dashboard.</small></div>
                  {accountStatusFilter !== "active" && (
                    <button type="button" className="td-filter-reset" onClick={() => onAccountStatusFilterChange?.("active")}>Reset</button>
                  )}
                </div>
                <div className="td-filter-section-label">ACCOUNT STATUS</div>
                {statusOptions.map((option) => {
                  const disabled = activeAccountId !== "all";
                  const count = statusCounts[option.value];
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="menuitemradio"
                      aria-checked={accountStatusFilter === option.value}
                      aria-disabled={disabled}
                      disabled={disabled}
                      className={`td-filter-option ${accountStatusFilter === option.value ? "selected" : ""} ${disabled ? "disabled" : ""}`}
                      onClick={() => {
                        onAccountStatusFilterChange?.(option.value);
                        setFilterMenuOpen(false);
                      }}
                    >
                      <span className="td-filter-option-radio">{accountStatusFilter === option.value ? "✓" : ""}</span>
                      <span className="td-filter-option-copy"><strong>{option.label}</strong><small>{option.description}</small></span>
                      <em>{count}</em>
                    </button>
                  );
                })}
                {activeAccountId !== "all" && <div className="td-filter-context-note">A specific account is selected, so account-status filtering is locked to that account. Choose <strong>All Accounts</strong> to filter by status.</div>}
                <div className="td-filter-summary"><span>Showing</span><strong>{activeAccountId === "all" ? selectedStatus.label : accountLabel}</strong></div>
              </div>
            )}
          </div>
          <button
            type="button"
            className="td-theme-icon-button"
            onClick={toggleTheme}
            aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
            title={theme === "light" ? "Dark mode" : "Light mode"}
          >
            {theme === "light" ? "☾" : "☀"}
          </button>
          <button className="td-export" type="button" onClick={() => onExport?.()} title="Export the current dashboard trades as CSV">⇧ Export</button>
          <div className={`td-profile-header-menu ${profileMenuOpen ? "is-open" : ""}`} ref={profileMenuRef}>
            <button type="button" className="td-profile-header-trigger td-profile-header-icon-only" onClick={() => setProfileMenuOpen((open) => !open)} aria-haspopup="menu" aria-expanded={profileMenuOpen} title={`Open profile for ${profileName}`} aria-label="Open profile">
              <span className="td-profile-header-avatar">{profileInitials}</span>
            </button>
            {profileMenuOpen && (
              <div className="td-profile-header-dropdown" role="menu">
                <div className="td-profile-header-summary">
                  <span className="td-profile-header-avatar large">{profileInitials}</span>
                  <div><strong>{profileName}</strong><small>{session?.user?.email || "No email available"}</small></div>
                </div>
                <button type="button" role="menuitem" onClick={() => { setProfileMenuOpen(false); onOpenProfile?.(); }}><span>◉</span><span><strong>My Profile</strong><small>Personal & account details</small></span><b>›</b></button>
                <button type="button" role="menuitem" onClick={() => { setProfileMenuOpen(false); toggleTheme?.(); }}><span>{theme === "light" ? "☾" : "☀"}</span><span><strong>Appearance</strong><small>{theme === "light" ? "Light theme" : "Dark theme"}</small></span><b>›</b></button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="td-sync">
        Last trade logged: {formatImportDate(latestTradeTimestamp)}
        <button type="button" onClick={onRefresh}>⟳ Refresh</button>
      </div>
    </>
  );
}

export default React.memo(DashboardHeader);
