export function formatMoney(value) {
  const n = Number(value) || 0;
  const sign = n > 0 ? "+" : n < 0 ? "-" : "";

  return `${sign}$${Math.abs(n).toLocaleString("en-US", {
    maximumFractionDigits: 0,
  })}`;
}

export function formatDateLabel(date) {
  const parsed = parseDateKey(date);
  if (!parsed) return "—";

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}


export function normalizeDateKey(value) {
  if (!value) return null;
  const key = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : null;
}

export function parseDateKey(value) {
  const key = normalizeDateKey(value);
  if (!key) return null;

  const date = new Date(`${key}T12:00:00`);
  if (Number.isNaN(date.getTime())) return null;

  const [year, month, day] = key.split("-").map(Number);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }

  return date;
}
