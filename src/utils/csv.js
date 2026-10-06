export function escapeCsvValue(value) {
  const text = value == null
    ? ""
    : typeof value === "object"
      ? JSON.stringify(value)
      : String(value);

  return /[",\n\r]/.test(text)
    ? `"${text.replace(/"/g, '""')}"`
    : text;
}

export function rowsToCsv(rows = [], columns = null) {
  const safeRows = Array.isArray(rows) ? rows : [];
  if (!safeRows.length && !Array.isArray(columns)) return "";

  const keys = Array.isArray(columns) && columns.length
    ? columns.map(String)
    : Array.from(new Set(safeRows.flatMap((row) => Object.keys(row || {}))));

  const header = keys.map(escapeCsvValue).join(",");
  const body = safeRows.map((row) => keys.map((key) => escapeCsvValue(row?.[key])).join(","));
  return [header, ...body].join("\n");
}

export function exportRowsToCsv(rows = [], columns = null) {
  return rowsToCsv(rows, columns);
}
