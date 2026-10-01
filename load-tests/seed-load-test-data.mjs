import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const count = Number.parseInt(process.env.TRADELOG_TEST_USER_COUNT || "10", 10);
const tradesPerUser = Number.parseInt(process.env.TRADELOG_TRADES_PER_USER || "100", 10);
const prefix = process.env.TRADELOG_TEST_EMAIL_PREFIX || "tradelog-loadtest";
const domain = process.env.TRADELOG_TEST_EMAIL_DOMAIN || "example.invalid";
const password = process.env.TRADELOG_TEST_PASSWORD;

if (!url || !anonKey || !password) {
  throw new Error("Set SUPABASE_URL, SUPABASE_ANON_KEY, and TRADELOG_TEST_PASSWORD.");
}
if (!Number.isInteger(count) || count < 1 || count > 1000) {
  throw new Error("TRADELOG_TEST_USER_COUNT must be an integer from 1 to 1000.");
}
if (!Number.isInteger(tradesPerUser) || tradesPerUser < 1 || tradesPerUser > 1000) {
  throw new Error("TRADELOG_TRADES_PER_USER must be an integer from 1 to 1000.");
}

const makeClient = () => createClient(url, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});

const round = (value, decimals = 2) => Number(value.toFixed(decimals));
const isoDate = (index) => {
  const base = new Date("2026-09-01T00:00:00Z");
  base.setUTCDate(base.getUTCDate() + (index % 26));
  return base.toISOString().slice(0, 10);
};

let accountsCreated = 0;
let accountsExisting = 0;
let tradesCreated = 0;
const failures = [];

for (let userIndex = 1; userIndex <= count; userIndex += 1) {
  const email = `${prefix}-${String(userIndex).padStart(4, "0")}@${domain}`;
  const client = makeClient();

  const { data: sessionData, error: authError } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (authError || !sessionData.user || !sessionData.session) {
    failures.push({ user: email, stage: "sign-in", message: authError?.message || "No session returned" });
    continue;
  }

  const userId = sessionData.user.id;

  const account = {
    user_id: userId,
    account_id: "primary",
    name: "Load Test Primary",
    status: "active",
    stage: "evaluation",
    platform: "Tradovate",
    market: "Futures",
    vendor: "LoadTest",
    account_size: 50000,
    timezone: "Asia/Kolkata",
    settings: { loadTest: true, generatedBy: "TradeLog load-test seed" },
  };

  const { data: accountData, error: accountError } = await client
    .from("accounts")
    .upsert(account, { onConflict: "user_id,account_id", ignoreDuplicates: true })
    .select("id, account_id")
    .maybeSingle();

  if (accountError) {
    failures.push({ user: email, stage: "account", message: accountError.message });
    continue;
  }

  if (!accountData?.id) {
    const { data: existingAccount, error: existingError } = await client
      .from("accounts")
      .select("id, account_id")
      .eq("account_id", "primary")
      .maybeSingle();
    if (existingError || !existingAccount) {
      failures.push({ user: email, stage: "account-read", message: existingError?.message || "Primary account not found" });
      continue;
    }
    accountsExisting += 1;
  } else {
    accountsCreated += 1;
  }

  for (let tradeIndex = 1; tradeIndex <= tradesPerUser; tradeIndex += 1) {
    const direction = tradeIndex % 2 === 0 ? "Short" : "Long";
    const symbol = tradeIndex % 3 === 0 ? "MGC" : "MNQ";
    const entry = symbol === "MNQ" ? 18000 + (tradeIndex % 100) * 2 : 2600 + (tradeIndex % 100) * 0.5;
    const move = direction === "Long" ? (tradeIndex % 11 - 5) * (symbol === "MNQ" ? 2 : 0.5) : (5 - tradeIndex % 11) * (symbol === "MNQ" ? 2 : 0.5);
    const exit = round(entry + move, symbol === "MNQ" ? 2 : 2);
    const pnl = round((exit - entry) * (direction === "Long" ? 2 : -2), 2);
    const tradeDate = isoDate(tradeIndex + userIndex);
    const entryHour = 17 + (tradeIndex % 4);
    const entryMinute = (tradeIndex * 7) % 60;
    const exitMinute = (entryMinute + 12) % 60;

    const trade = {
      trade_date: tradeDate,
      entry_time: `${String(entryHour).padStart(2, "0")}:${String(entryMinute).padStart(2, "0")}:00`,
      exit_time: `${String(entryHour).padStart(2, "0")}:${String(exitMinute).padStart(2, "0")}:00`,
      symbol,
      direction,
      session: "New York",
      entry_price: entry,
      exit_price: exit,
      quantity: 1,
      stop_loss: round(entry + (direction === "Long" ? -10 : 10), 2),
      take_profit: round(entry + (direction === "Long" ? 20 : -20), 2),
      pnl,
      planned_risk: 100,
      mood: "neutral",
      setup_score: 8,
      grade: pnl >= 0 ? "A" : "B",
      account_id: "primary",
      source: "load-test",
      client_operation_id: `loadtest-${userIndex}-${tradeIndex}`,
    };

    const { error: tradeError } = await client.rpc("tradelog_save_trade_with_mistakes", {
      p_trade: trade,
      p_mistakes: [],
      p_expected_updated_at: null,
      p_client_operation_id: trade.client_operation_id,
    });

    if (tradeError) {
      failures.push({
        user: email,
        stage: "trade",
        trade: tradeIndex,
        message: tradeError.message,
      });
      break;
    }
    tradesCreated += 1;
  }

  console.log(`${email}: ${tradesPerUser} trade target processed`);
}

console.log("");
console.log(`Users targeted: ${count}`);
console.log(`Accounts created: ${accountsCreated}`);
console.log(`Accounts already present: ${accountsExisting}`);
console.log(`Trades created: ${tradesCreated}`);
console.log(`Expected trades: ${count * tradesPerUser}`);
console.log(`Failures: ${failures.length}`);

if (failures.length) {
  console.log("Failures:");
  for (const failure of failures.slice(0, 25)) {
    console.log(JSON.stringify(failure));
  }
  if (failures.length > 25) console.log(`... ${failures.length - 25} additional failures omitted`);
  process.exitCode = 2;
}
