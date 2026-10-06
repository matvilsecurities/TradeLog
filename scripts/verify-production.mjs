import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const required = [
  "src/main.jsx",
  "src/components/shared/ErrorBoundary.jsx",
  "src/config/runtime.js",
  "src/supabase.js",
  "netlify/_headers",
  "netlify/functions/forexfactory.js",
  "package.json",
];

const missing = required.filter((file) => !fs.existsSync(path.join(root, file)));
if (missing.length) {
  console.error(`Missing required production files: ${missing.join(", ")}`);
  process.exit(1);
}

const main = fs.readFileSync(path.join(root, "src/main.jsx"), "utf8");
const runtime = fs.readFileSync(path.join(root, "src/config/runtime.js"), "utf8");
const supabase = fs.readFileSync(path.join(root, "src/supabase.js"), "utf8");
const headers = fs.readFileSync(path.join(root, "netlify/_headers"), "utf8");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

const checks = [
  ["ErrorBoundary mounted at app root", main.includes('ErrorBoundary')],
  ["Runtime config centralizes Supabase env access", runtime.includes("VITE_SUPABASE_URL") && runtime.includes("VITE_SUPABASE_ANON_KEY")],
  ["Supabase uses centralized runtime config", supabase.includes("./config/runtime.js") && supabase.includes("isSupabaseConfigured")],
  ["No service-role key reference", !runtime.includes("SERVICE_ROLE") && !supabase.includes("SERVICE_ROLE")],
  ["Security headers configured", headers.includes("X-Content-Type-Options") && headers.includes("Referrer-Policy") && headers.includes("X-Frame-Options")],
  ["HSTS configured", headers.includes("Strict-Transport-Security")],
  ["Production build script present", pkg.scripts?.build === "vite build"],
];

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  console.error(`Production hardening QA failed: ${failed.map(([name]) => name).join("; ")}`);
  process.exit(1);
}

console.log(`Production hardening QA passed: ${required.length} required files present; ${checks.length} hardening checks passed.`);
