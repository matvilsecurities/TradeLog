import React, { useEffect, useRef, useState } from "react";
import "../../styles/zellaScore.css";

export default function DashboardDropdown({ value, options = [], onChange, ariaLabel = "Select option", className = "" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const selected = options.find((option) => option.value === value) || options[0];

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!ref.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={ref} className={`zella-period-dropdown td-dashboard-dropdown ${className} ${open ? "is-open" : ""}`}>
      <button
        type="button"
        className="zella-period-trigger"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
      >
        <span>{selected?.label || "Select"}</span>
        <span className="zella-period-chevron" aria-hidden="true" />
      </button>
      {open && (
        <div className="zella-period-menu" role="listbox" aria-label={ariaLabel}>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              className={`zella-period-option ${option.value === value ? "is-selected" : ""}`}
              onClick={() => {
                onChange?.(option.value);
                setOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
