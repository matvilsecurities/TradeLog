import React, { useMemo, useState } from "react";
import { supabase } from "../../supabase.js";

function initials(firstName, lastName, email) {
  const value = `${firstName || ""}${lastName || ""}`.trim();
  if (value) return value.slice(0, 2).toUpperCase();
  return (email || "TL").replace(/[^a-z0-9]/gi, "").slice(0, 2).toUpperCase() || "TL";
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit"
  });
}

function formatMemberSince(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("en-US", { month: "short", year: "numeric" });
}

export default function ProfileCenter({ session, theme, toggleTheme, onSignOut }) {
  const user = session?.user;
  const metadata = user?.user_metadata || {};
  const [firstName, setFirstName] = useState(metadata.first_name || metadata.firstName || "");
  const [lastName, setLastName] = useState(metadata.last_name || metadata.lastName || "");
  const [displayName, setDisplayName] = useState(metadata.full_name || metadata.name || "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const display = useMemo(() => {
    const full = `${firstName} ${lastName}`.trim();
    return full || displayName || user?.email?.split("@")[0] || "TradeLog User";
  }, [firstName, lastName, displayName, user?.email]);

  const avatar = initials(firstName, lastName, user?.email);
  const provider = user?.app_metadata?.provider || "email";
  const authenticated = Boolean(user);
  const emailVerified = Boolean(user?.email_confirmed_at);

  const saveProfile = async (event) => {
    event.preventDefault();
    if (!supabase || !user) return;
    setSaving(true);
    setMessage("");
    try {
      const fullName = `${firstName} ${lastName}`.trim() || displayName.trim();
      const { error } = await supabase.auth.updateUser({
        data: {
          ...metadata,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          full_name: fullName,
          name: fullName,
        },
      });
      if (error) throw error;
      setDisplayName(fullName);
      setMessage("Profile updated successfully.");
    } catch (error) {
      setMessage(error?.message || "Unable to update profile.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="tl-profile-page">
      <div className="tl-profile-page-head">
        <div>
          <div className="tl-profile-eyebrow">ACCOUNT</div>
          <h1>My Profile</h1>
          <p>Manage your personal information, contact details and workspace preferences.</p>
        </div>
        <div className="tl-profile-top-actions">
          <button type="button" className="tl-profile-header-btn" onClick={toggleTheme}>
            {theme === "light" ? "☼" : "☾"} {theme === "light" ? "Light" : "Dark"}
          </button>
          <button type="button" className="tl-profile-header-btn" onClick={onSignOut}>Sign out</button>
        </div>
      </div>

      <section className="tl-profile-hero">
        <div className="tl-profile-identity">
          <div className="tl-profile-avatar-large">{avatar}</div>
          <div className="tl-profile-identity-copy">
            <h2>{display}</h2>
            <p>{user?.email || "No email available"}</p>
            <div className="tl-profile-badges">
              <span className="tl-profile-badge tl-profile-badge-green">● {authenticated ? "Authenticated" : "Unavailable"}</span>
              <span className="tl-profile-badge tl-profile-badge-purple">{emailVerified ? "Email verified" : "Verification pending"}</span>
            </div>
          </div>
        </div>
        <div className="tl-profile-user-id">
          <small>User ID</small>
          <strong>{user?.id ? `${user.id.slice(0, 8)}…${user.id.slice(-6)}` : "—"}</strong>
        </div>
      </section>

      <section className="tl-profile-kpis">
        <div className="tl-profile-kpi">
          <div className="tl-profile-kpi-top"><span>Account Status</span><b>✓</b></div>
          <strong>{authenticated ? "Active" : "Unavailable"}</strong>
          <small>{authenticated ? "Account in good standing" : "Authentication unavailable"}</small>
        </div>
        <div className="tl-profile-kpi">
          <div className="tl-profile-kpi-top"><span>Member Since</span><b>◷</b></div>
          <strong>{formatMemberSince(user?.created_at)}</strong>
          <small>Account created</small>
        </div>
        <div className="tl-profile-kpi">
          <div className="tl-profile-kpi-top"><span>Last Sign In</span><b>↗</b></div>
          <strong>{user?.last_sign_in_at ? "Recent" : "—"}</strong>
          <small>{formatDate(user?.last_sign_in_at)}</small>
        </div>
        <div className="tl-profile-kpi">
          <div className="tl-profile-kpi-top"><span>Security</span><b>⌾</b></div>
          <strong>Secure</strong>
          <small>{provider === "email" ? "Email authentication enabled" : `${provider} authentication enabled`}</small>
        </div>
      </section>

      <div className="tl-profile-grid">
        <section className="tl-profile-card">
          <div className="tl-profile-card-head"><div><h3>Personal information</h3><p>Your name shown across TradeLog.</p></div><span>01</span></div>
          <form onSubmit={saveProfile} className="tl-profile-form">
            <label><span>First name</span><input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" autoComplete="given-name" /></label>
            <label><span>Last name</span><input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last name" autoComplete="family-name" /></label>
            <label className="tl-profile-field-full"><span>Display name</span><input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Display name" autoComplete="name" /></label>
            <div className="tl-profile-form-footer">
              <span className={message.includes("successfully") ? "success" : "error"}>{message}</span>
              <button type="submit" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>
            </div>
          </form>
        </section>

        <section className="tl-profile-card">
          <div className="tl-profile-card-head"><div><h3>Contact information</h3><p>Authentication and contact details.</p></div><span>02</span></div>
          <div className="tl-profile-details">
            <div><small>Email</small><strong>{user?.email || "—"}</strong><em>{emailVerified ? "Verified" : "Verification pending"}</em></div>
            <div><small>Phone</small><strong>{user?.phone || "Not added"}</strong><em>{user?.phone ? "Authentication phone" : "No phone linked"}</em></div>
            <div><small>Created</small><strong>{formatDate(user?.created_at)}</strong></div>
            <div><small>Last sign in</small><strong>{formatDate(user?.last_sign_in_at)}</strong></div>
          </div>
        </section>

        <section className="tl-profile-card">
          <div className="tl-profile-card-head"><div><h3>Preferences</h3><p>Personalize your TradeLog workspace.</p></div><span>03</span></div>
          <div className="tl-profile-preference">
            <div><strong>Appearance</strong><small>Choose your visual theme.</small></div>
            <button type="button" onClick={toggleTheme}><span>{theme === "light" ? "☼" : "☾"}</span>{theme === "light" ? "Light" : "Dark"}</button>
          </div>
          <div className="tl-profile-preference">
            <div><strong>Security</strong><small>Authentication is handled securely.</small></div>
            <span className="tl-profile-secure">Secure</span>
          </div>
        </section>

        <section className="tl-profile-card">
          <div className="tl-profile-card-head"><div><h3>Account details</h3><p>Technical information for this TradeLog account.</p></div><span>04</span></div>
          <div className="tl-profile-details">
            <div><small>Provider</small><strong>{provider}</strong></div>
            <div><small>Role</small><strong>{user?.role || "authenticated"}</strong></div>
            <div className="tl-profile-field-full"><small>User ID</small><strong className="tl-profile-mono">{user?.id || "—"}</strong></div>
          </div>
        </section>
      </div>
    </div>
  );
}
