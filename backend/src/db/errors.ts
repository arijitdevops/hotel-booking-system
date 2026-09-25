/**
 * Helpers for recognising SQLite constraint errors.
 *
 * better-sqlite3 throws `SqliteError` with a `code` such as
 * `SQLITE_CONSTRAINT_UNIQUE`; Drizzle may wrap it in an error whose `cause`
 * is the original, so both levels are inspected.
 */

interface SqliteLikeError {
  code?: unknown;
  message?: unknown;
  cause?: unknown;
}

function sqliteError(error: unknown): SqliteLikeError | null {
  let current: unknown = error;
  for (let depth = 0; depth < 3 && current; depth += 1) {
    const candidate = current as SqliteLikeError;
    if (typeof candidate.code === 'string' && candidate.code.startsWith('SQLITE_')) {
      return candidate;
    }
    current = candidate.cause;
  }
  return null;
}

/** SQLite error code (e.g. `SQLITE_CONSTRAINT_UNIQUE`) or null. */
export function sqliteErrorCode(error: unknown): string | null {
  const found = sqliteError(error);
  return found ? String(found.code) : null;
}

/** True for a UNIQUE violation, optionally on a column whose name contains `column`. */
export function isUniqueViolation(error: unknown, column?: string): boolean {
  const found = sqliteError(error);
  if (!found || (found.code !== 'SQLITE_CONSTRAINT_UNIQUE' && found.code !== 'SQLITE_CONSTRAINT_PRIMARYKEY')) {
    return false;
  }
  return column === undefined || String(found.message ?? '').includes(column);
}
