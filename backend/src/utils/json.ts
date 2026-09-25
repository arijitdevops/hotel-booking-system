/**
 * Helpers for the JSON-encoded columns SQLite forces on us (SQLite has no
 * native array/JSON column type, so amenity lists are stored as text).
 */

/** Parses a JSON array of strings, returning [] for anything unexpected. */
export function parseStringArray(value: string | null | undefined): string[] {
  if (!value) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((item): item is string => typeof item === 'string');
  } catch {
    return [];
  }
}

export function serialiseStringArray(values: readonly string[]): string {
  return JSON.stringify([...values]);
}
