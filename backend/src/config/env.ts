// Loads backend/.env into process.env before anything reads it. Harmless when
// the file is absent (CI and production inject real environment variables).
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

loadDotenv({ quiet: true });

/**
 * Runtime configuration.
 *
 * Every value the application depends on is declared here and validated once,
 * at startup. Anything missing or malformed aborts the process immediately
 * instead of failing later with an undefined value.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),

  /** SQLite database file, relative to the backend/ directory, or `:memory:`. */
  DATABASE_FILE: z.string().min(1).default('./data/hotel.db'),

  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().min(1).default('7d'),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(10),

  CORS_ORIGIN: z.string().min(1).default('http://localhost:5173'),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().int().positive().default(15),

  TAX_PERCENT: z.coerce.number().min(0).max(100).default(12),
  FREE_CANCELLATION_HOURS: z.coerce.number().int().min(0).default(48),
  CANCELLATION_FEE_PERCENT: z.coerce.number().min(0).max(100).default(25),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    // Logging is not available yet at this point in the boot sequence.
    console.error(`Invalid environment configuration:\n${details}`);
    console.error('Copy backend/.env.example to backend/.env and fill in the blanks.');
    process.exit(1);
  }

  return parsed.data;
}

export const env: Env = loadEnv();

export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';

/** Allowed CORS origins, comma separated in the environment variable. */
export const corsOrigins: string[] = env.CORS_ORIGIN.split(',')
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);
