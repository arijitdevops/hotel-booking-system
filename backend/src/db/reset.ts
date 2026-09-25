/**
 * Deletes the SQLite file (plus its WAL/SHM side files), recreates the schema
 * and loads the demo data. Destroys everything in DATABASE_FILE.
 */
import { rmSync } from 'node:fs';
import path from 'node:path';

import { env } from '../config/env';

async function main(): Promise<void> {
  if (env.DATABASE_FILE !== ':memory:') {
    // Same resolution rule as src/db/client.ts. The client module is only
    // imported afterwards (by the seed), so no handle is open yet.
    const file = path.resolve(process.cwd(), env.DATABASE_FILE);
    for (const suffix of ['', '-wal', '-shm', '-journal']) {
      rmSync(`${file}${suffix}`, { force: true });
    }
    console.log(`Removed ${file}`);
  }

  const { seedDatabase } = await import('./seed');
  await seedDatabase();
}

main().catch((error: unknown) => {
  console.error('Reset failed:', error);
  process.exitCode = 1;
});
