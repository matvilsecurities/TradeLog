const RELEASE = String(import.meta.env.VITE_APP_VERSION || "unknown");
const ENVIRONMENT = String(import.meta.env.MODE || "production");

export function reportClientError(error, context = {}) {
  const normalized = error instanceof Error ? error : new Error(String(error || "Unknown client error"));
  const safeContext = {
    release: RELEASE,
    environment: ENVIRONMENT,
    route: typeof window !== "undefined" ? window.location.pathname : "unknown",
    operation: context.operation || "unknown",
    code: context.code || error?.code || error?.status || null,
    ...context,
  };

  // Compatible with Sentry or another externally loaded reporter. The app
  // remains dependency-free until a production monitoring vendor is selected.
  try {
    if (typeof window !== "undefined" && window.Sentry?.captureException) {
      window.Sentry.captureException(normalized, { extra: safeContext });
    }
  } catch {
    // Monitoring must never break the application.
  }

  if (import.meta.env.DEV) {
    console.error("TradeLog telemetry", normalized, safeContext);
  }
}
