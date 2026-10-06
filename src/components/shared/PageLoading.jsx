export default function PageLoading({ label = "Loading workspace…" }) {
  return (
    <div className="td-page-loading" role="status" aria-live="polite">
      <div className="td-loading-mark"><span /></div>
      <div>
        <strong>TradeLog</strong>
        <p>{label}</p>
      </div>
    </div>
  );
}
