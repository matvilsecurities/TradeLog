import { useEffect, useState } from "react";
import {
  fetchForexFactoryCalendar,
  formatNewsTime,
  getNewsForTrade,
} from "../../services/forexFactory.js";

function TradeNewsContext({ trade, checked, onMarkChecked }) {
  const [status, setStatus] = useState("loading");
  const [events, setEvents] = useState([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    setStatus("loading");
    setMessage("");

    fetchForexFactoryCalendar()
      .then((result) => {
        if (!active) return;
        setEvents(getNewsForTrade(result.events, trade));
        setStatus(result.error ? "stale" : "ready");
        if (result.error) setMessage("Using cached calendar data; refresh failed.");
      })
      .catch((error) => {
        if (!active) return;
        setEvents([]);
        setStatus("error");
        setMessage(error?.message || "News feed unavailable");
      });

    return () => { active = false; };
  }, [trade?.date, trade?.time, trade?.symbol]);

  const hasHighImpact = events.length > 0;
  const feedUnavailable = status === "error";

  return (
    <div className={`td-news-context ${hasHighImpact ? "is-alert" : "is-clear"} ${feedUnavailable ? "is-unavailable" : ""}`}>
      <div className="td-news-head">
        <div className="td-news-title-wrap">
          <span className="td-news-title">News intelligence</span>
          <span className="td-news-meta">Forex Factory · USD · ±90 min</span>
        </div>
        <button type="button" onClick={onMarkChecked} className={`td-news-check ${checked ? "is-checked" : ""}`}>
          {checked ? "✓ Checked" : "Mark checked"}
        </button>
      </div>

      <div className="td-news-status">
        {status === "loading" && "Checking scheduled high-impact events…"}
        {status !== "loading" && feedUnavailable && "Unable to verify high-impact USD news around this trade time."}
        {status !== "loading" && !feedUnavailable && !hasHighImpact && "No high-impact USD event detected around this trade time."}
        {hasHighImpact && `⚠ ${events.length} high-impact USD event${events.length === 1 ? "" : "s"} near this trade`}
      </div>

      {message && <div className="td-news-message">{message}</div>}

      {hasHighImpact && (
        <div className="td-news-events">
          {events.map((event) => (
            <div key={event.id} className="td-news-event">
              <span>{event.title}</span>
              <strong>{event.country} · {formatNewsTime(event.timestamp)}</strong>
            </div>
          ))}
        </div>
      )}

      {status === "error" && (
        <div className="td-news-footnote">The calendar could not be reached. Verify the feed connection before treating this as a clean-news confirmation.</div>
      )}

      <div className="td-news-source">
        Source: <a href="https://www.forexfactory.com/calendar" target="_blank" rel="noreferrer">Forex Factory calendar ↗</a>
      </div>
    </div>
  );
}

export default TradeNewsContext;
