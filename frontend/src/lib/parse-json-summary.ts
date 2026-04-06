/**
 * Safely parse a raw JSON string and return a brief key-value summary.
 * Handles nested objects/arrays by stringifying them instead of [object Object].
 */
export function parseJsonSummary(raw: string | null): string | null {
  if (!raw) return null
  try {
    const obj = JSON.parse(raw)
    const entries = Object.entries(obj).slice(0, 3)
    return entries
      .map(
        ([k, v]) =>
          `${k}: ${typeof v === "object" && v !== null ? JSON.stringify(v) : v}`,
      )
      .join(", ")
  } catch {
    return null
  }
}
