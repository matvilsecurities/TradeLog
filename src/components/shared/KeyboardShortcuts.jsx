import { useEffect } from "react";

export default function KeyboardShortcuts({ onNewTrade, onRisk, onAnalytics, onTradeLog }) {
  useEffect(() => {
    const handler = (event) => {
      const target = event.target;
      if (target?.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const key = event.key.toLowerCase();
      if (key === "escape") return;
      if (key === "n") { event.preventDefault(); onNewTrade(); }
      if (key === "r") { event.preventDefault(); onRisk(); }
      if (key === "a") { event.preventDefault(); onAnalytics(); }
      if (key === "t") { event.preventDefault(); onTradeLog(); }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onNewTrade, onRisk, onAnalytics, onTradeLog]);

  return null;
}
