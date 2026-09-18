/**
 * CSV helpers - every export in the app must build cells through `csvCell`.
 *
 * Naive `"${value}"` wrapping corrupts output the moment a value contains a
 * comma, quote, or newline (e.g. customer `Dela "Bong" Cruz`). RFC 4180:
 * double embedded quotes and quote any field containing `,` `"` `\n` `\r`.
 */

/** Escape one value as an RFC-4180 CSV cell. */
export function csvCell(value: unknown): string {
 if (value === null || value === undefined) return "";
 const s = String(value);
 if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
 return s;
}

/** Join already-escaped cells into one CSV row. */
export function csvRow(cells: unknown[]): string {
 return cells.map(csvCell).join(",");
}

/** Trigger a browser download of CSV text. No-op on the server. */
export function downloadCsv(filename: string, lines: string[]): void {
 if (typeof document === "undefined") return;
 const blob = new Blob([lines.join("\n")], { type: "text/csv" });
 const url = URL.createObjectURL(blob);
 const a = document.createElement("a");
 a.href = url;
 a.download = filename;
 document.body.appendChild(a);
 a.click();
 a.remove();
 URL.revokeObjectURL(url);
}
