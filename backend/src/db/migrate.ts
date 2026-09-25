/**
 * Applies pending SQL migrations from backend/drizzle to DATABASE_FILE.
 * The API also runs this on start, so calling it by hand is optional.
 */
import { disconnectDatabase, resolveDatabaseFile, runMigrations } from './client';

runMigrations();
console.log(`Migrations applied to ${resolveDatabaseFile()}`);
void disconnectDatabase();
