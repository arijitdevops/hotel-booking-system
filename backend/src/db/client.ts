import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

import { env } from '../config/env';
import { logger } from '../config/logger';
import * as schema from './schema';

export type AppDatabase = BetterSQLite3Database<typeof schema>;
/** The root handle or a transaction handle: both expose the same query API. */
export type DatabaseClient = Pick<AppDatabase, 'select' | 'insert' | 'update' | 'delete' | 'query'>;

/**
 * Resolves DATABASE_FILE. Relative paths are resolved from the backend
 * package directory (where npm scripts run), `:memory:` is passed through.
 */
export function resolveDatabaseFile(file: string = env.DATABASE_FILE): string {
  if (file === ':memory:') {
    return file;
  }
  const absolute = path.resolve(process.cwd(), file);
  mkdirSync(path.dirname(absolute), { recursive: true });
  return absolute;
}

/**
 * Locates backend/drizzle (the generated SQL migrations) by walking up from
 * this file, so it works from `src/` under tsx and from `dist/src/` after a build.
 */
export function migrationsFolder(): string {
  let dir = __dirname;
  for (let depth = 0; depth < 5; depth += 1) {
    const candidate = path.join(dir, 'drizzle');
    if (existsSync(path.join(candidate, 'meta', '_journal.json'))) {
      return candidate;
    }
    dir = path.dirname(dir);
  }
  throw new Error('Could not find the drizzle/ migrations folder');
}

function open(file: string): { sqlite: Database.Database; db: AppDatabase } {
  const sqlite = new Database(file);
  // WAL gives far better read concurrency for the availability queries, and
  // SQLite leaves foreign key enforcement off unless it is asked for.
  if (file !== ':memory:') {
    sqlite.pragma('journal_mode = WAL');
  }
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('busy_timeout = 5000');
  return { sqlite, db: drizzle(sqlite, { schema }) };
}

type DbGlobal = typeof globalThis & {
  __hotelDb?: { sqlite: Database.Database; db: AppDatabase };
};
const globalForDb = globalThis as DbGlobal;

// Cached on globalThis so `tsx watch` reloads do not leak file handles.
const handle = globalForDb.__hotelDb ?? open(resolveDatabaseFile());
globalForDb.__hotelDb = handle;

export const sqlite = handle.sqlite;
export const db: AppDatabase = handle.db;

/** Applies any pending migrations. Safe to call on every start. */
export function runMigrations(): void {
  migrate(db, { migrationsFolder: migrationsFolder() });
}

export async function connectDatabase(): Promise<void> {
  runMigrations();
  logger.info({ file: resolveDatabaseFile() }, 'Database ready (migrations applied)');
}

export async function disconnectDatabase(): Promise<void> {
  if (sqlite.open) {
    sqlite.close();
  }
  delete globalForDb.__hotelDb;
  logger.info('Database connection closed');
}
