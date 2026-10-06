export default async function handler(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state") || "";
  const oauthError = url.searchParams.get("error");
  const description = url.searchParams.get("error_description") || "";
  const targetOrigin = `${url.protocol}//${url.host}`;

  // Serialize for safe embedding in an inline <script>: JSON.stringify alone does not
  // escape "<", so "</script>" in a query parameter could break out (reflected XSS).
  const safeJson = (value) => JSON.stringify(value)
    .replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
  const send = (payload) => {
    const nonce = crypto.randomUUID().replace(/-/g, "");
    const script = `window.opener&&window.opener.postMessage(${safeJson({ type: "tradelog-tradovate-oauth", ...payload })}, ${safeJson(targetOrigin)});window.close();`;
    return new Response(`<!doctype html><html><body><script nonce="${nonce}">${script}</script><p>You can close this window.</p></body></html>`, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
        "Content-Security-Policy": `default-src 'none'; script-src 'nonce-${nonce}'; base-uri 'none'; frame-ancestors 'none'`,
      },
    });
  };

  if (oauthError) return send({ error: oauthError, error_description: description, state });
  if (!code) return send({ error: "missing_code", error_description: "No OAuth authorization code was returned.", state });

  const clientId = String(process.env.NT_CLIENT_ID || "").trim();
  const clientSecret = String(process.env.NT_CLIENT_SECRET || "").trim();
  const redirectUri = String(process.env.NT_OAUTH_REDIRECT_URI || `${url.origin}/.netlify/functions/tradovate-oauth-callback`).trim();
  const environment = String(process.env.NT_ENVIRONMENT || "live").toLowerCase() === "demo" ? "demo" : "live";
  if (!clientId || !clientSecret) return send({ error: "server_not_configured", error_description: "Tradovate OAuth server credentials are not configured.", state });

  const exchangeUrl = environment === "demo" ? "https://live-api-d.tradovate.com/auth/oauthtoken" : "https://live.tradovateapi.com/auth/oauthtoken";
  try {
    const form = new URLSearchParams({ grant_type: "authorization_code", client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, code });
    const response = await fetch(exchangeUrl, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" }, body: form });
    const data = await response.json();
    if (!response.ok || data?.error) return send({ error: data?.error || `oauth_http_${response.status}`, error_description: data?.error_description || "Tradovate OAuth exchange failed.", state });
    return send({ access_token: data.access_token, expires_in: data.expires_in, apiHosts: data.apiHosts || null, name: data.name || "Tradovate", state });
  } catch (error) {
    return send({ error: "oauth_exchange_failed", error_description: error?.message || "Unable to exchange authorization code.", state });
  }
}
