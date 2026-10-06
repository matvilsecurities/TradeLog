import http from "k6/http";
import { check, sleep } from "k6";
import { Rate, Trend } from "k6/metrics";

const baseUrl = (__ENV.SUPABASE_URL || "").replace(/\/$/, "");
const tokens = JSON.parse(__ENV.TRADELOG_TEST_TOKENS_JSON || "[]");
const errorRate = new Rate("tradelog_errors");
const readLatency = new Trend("tradelog_trade_read_ms");

export const options = {
  scenarios: {
    journal_read: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "1m", target: 100 },
        { duration: "2m", target: 500 },
        { duration: "2m", target: 1000 },
        { duration: "10m", target: 1000 },
        { duration: "1m", target: 0 },
      ],
      gracefulRampDown: "30s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<1000", "p(99)<2000"],
    tradelog_errors: ["rate<0.01"],
  },
};

function authHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    apikey: __ENV.SUPABASE_ANON_KEY,
    "Content-Type": "application/json",
  };
}

export default function () {
  if (!baseUrl || !__ENV.SUPABASE_ANON_KEY || tokens.length === 0) {
    throw new Error("Set SUPABASE_URL, SUPABASE_ANON_KEY and TRADELOG_TEST_TOKENS_JSON before running the load test.");
  }

  const token = tokens[__VU % tokens.length];
  const url = `${baseUrl}/rest/v1/trades?select=id,trade_date,symbol,direction,pnl,account_id,updated_at&order=trade_date.desc,id.desc&limit=100`;
  const response = http.get(url, { headers: authHeaders(token) });
  readLatency.add(response.timings.duration);

  const ok = check(response, {
    "trade read returns 200": (r) => r.status === 200,
    "trade read returns JSON": (r) => String(r.headers["Content-Type"] || "").includes("application/json"),
  });
  errorRate.add(!ok);
  sleep(Math.random() * 2 + 1);
}
