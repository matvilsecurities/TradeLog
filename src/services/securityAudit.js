const SECRET_PATTERNS = [/NT_CLIENT_SECRET\s*=\s*[^\s]+/i, /VITE_.*SECRET/i, /SUPABASE_SERVICE_ROLE/i, /BEGIN (RSA|EC|OPENSSH|PRIVATE) KEY/i];
const SENSITIVE_STORAGE = /(secret|password|clientsecret|access_token|refresh_token)/i;

export function runSecurityAudit({ envText = "", sourceText = "", localStorageKeys = [] } = {}) {
  const findings = [];
  if (SECRET_PATTERNS.some((pattern) => pattern.test(envText))) findings.push({ severity: "critical", code: "SECRET_IN_CLIENT_ENV", message: "A server secret appears in client-visible environment configuration." });
  if (SECRET_PATTERNS.some((pattern) => pattern.test(sourceText))) findings.push({ severity: "critical", code: "SECRET_IN_SOURCE", message: "A credential/private-key pattern appears in client source." });
  const unsafeKeys = localStorageKeys.filter((key) => SENSITIVE_STORAGE.test(key));
  if (unsafeKeys.length) findings.push({ severity: "warning", code: "SENSITIVE_STORAGE_KEY", message: `Sensitive-looking localStorage keys detected: ${unsafeKeys.join(", ")}` });
  findings.push({ severity: "info", code: "OAUTH_SECRET_SERVER_SIDE", message: "OAuth client secrets must remain server-side; only public client identifiers may be exposed to Vite." });
  findings.push({ severity: "info", code: "READ_ONLY_CONNECTORS", message: "Current connector architecture exposes read-only synchronization; no order placement capability is registered." });
  return { findings, critical: findings.filter((item) => item.severity === "critical").length, warnings: findings.filter((item) => item.severity === "warning").length, status: findings.some((item) => item.severity === "critical") ? "fail" : "pass" };
}
