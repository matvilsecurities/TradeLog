const getTVSymbol = (sym) =>
  sym === "MNQ" ? "CME_MINI:NQ1!" : "COMEX:MGC1!";

let tvScriptPromise = null;

const loadTradingViewScript = () => {
  if (typeof window !== "undefined" && window.TradingView) return Promise.resolve();
  if (tvScriptPromise) return tvScriptPromise;

  tvScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/tv.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      tvScriptPromise = null;
      reject(new Error("Failed to load TradingView script"));
    };
    document.head.appendChild(script);
  });

  return tvScriptPromise;
};

export { getTVSymbol, loadTradingViewScript };
