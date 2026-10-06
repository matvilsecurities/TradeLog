import React from "react";

function DashboardCard({ title, right, children, className = "" }) {
  return (
    <section className={`td-card ${className}`}>
      <div className="td-card-head">
        <h2>{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

export default React.memo(DashboardCard);
