import { defineConfig } from 'drizzle-kit';

/**
 * drizzle-kit configuration: `npm run db:generate` diffs src/db/schema.ts
 * against the snapshots in drizzle/meta and writes a new SQL migration.
 */
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env['DATABASE_FILE'] ?? './data/hotel.db',
  },
});
