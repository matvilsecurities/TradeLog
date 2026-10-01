import React from "react";
import { V } from "../../constants.js";
import { reportClientError } from "../../services/telemetry.js";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    reportClientError(error, { operation: "react-error-boundary", componentStack: String(info?.componentStack || "").slice(0, 4000) });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        role="alert"
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: "2rem",
          background: V.bg,
          color: V.text,
          fontFamily: V.font,
        }}
      >
        <div
          style={{
            width: "min(560px, 100%)",
            padding: "2rem",
            border: `1px solid ${V.border}`,
            borderRadius: V.radiusLg,
            background: V.surface,
            boxShadow: "0 18px 60px rgba(0,0,0,.28)",
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: V.muted, marginBottom: 10 }}>
            TradeLog Runtime Error
          </div>
          <h1 style={{ margin: "0 0 .6rem", fontSize: 24 }}>Something went wrong</h1>
          <p style={{ margin: "0 0 1.25rem", color: V.muted, lineHeight: 1.6 }}>
            The workspace hit an unexpected error. Your saved Supabase data is not deleted by this screen.
            Try again, and if the problem continues, refresh the page. The error has been recorded for production diagnostics when monitoring is configured.
          </p>
          {import.meta.env.DEV && this.state.error?.message && (
            <pre style={{ overflowX: "auto", padding: "1rem", borderRadius: V.radius, background: V.bg, color: V.muted, fontSize: 12 }}>
              {this.state.error.message}
            </pre>
          )}
          <button
            type="button"
            onClick={this.handleRetry}
            style={{ marginTop: "1rem", padding: ".7rem 1rem", borderRadius: V.radius, border: `1px solid ${V.border}`, background: V.accent, color: "#fff", cursor: "pointer", fontWeight: 700 }}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }
}
