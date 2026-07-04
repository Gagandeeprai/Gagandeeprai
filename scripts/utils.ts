import { createHash } from "crypto";

/**
 * Format numbers cleanly (e.g. 1250 -> 1.3k, 950 -> 950).
 */
export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, "") + "m";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  }
  return num.toString();
}

/**
 * Escape XML special characters to prevent rendering or structure breaks in SVGs.
 */
export function escapeXml(str: string): string {
  return str.replace(/[<>&'"]/g, (char) => {
    switch (char) {
      case "<": return "&lt;";
      case ">": return "&gt;";
      case "&": return "&amp;";
      case "'": return "&apos;";
      case "\"": return "&quot;";
      default: return char;
    }
  });
}

/**
 * Get date string (YYYY-MM-DD) adjusted for a specific timezone offset in hours.
 */
export function getLocalDateString(date: Date, offsetHours: number): string {
  const utc = date.getTime() + date.getTimezoneOffset() * 60000;
  const localDate = new Date(utc + 3600000 * offsetHours);
  const yyyy = localDate.getFullYear();
  const mm = String(localDate.getMonth() + 1).padStart(2, "0");
  const dd = String(localDate.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Calculate dates in range from start to end (inclusive) as YYYY-MM-DD array.
 */
export function getDateRange(startDateStr: string, endDateStr: string): string[] {
  const dates: string[] = [];
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    dates.push(`${yyyy}-${mm}-${dd}`);
  }
  return dates;
}

/**
 * Get SHA-256 hash of a string.
 */
export function getHash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}
