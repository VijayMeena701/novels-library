import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as dotenvConfig } from 'dotenv';
import { z } from 'zod';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load the backend .env file once. Scripts that import this module share the same values.
dotenvConfig({ path: path.resolve(__dirname, '../../.env') });

function toCamelCase(str: string): string {
  return str
    .toLowerCase()
    .split('_')
    .map((word, index) => (index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join('');
}

const camelEnv = Object.fromEntries(Object.entries(process.env).map(([k, v]) => [toCamelCase(k), v])) as Record<
  string,
  string | undefined
>;

// ADMIN_EMAIL and ADMIN_EMAILS are both used historically; combine them into one list.
const adminEmails = [
  ...(camelEnv.adminEmails || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  ...(camelEnv.adminEmail || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
].join(',');

camelEnv.adminEmails = adminEmails;
delete camelEnv.adminEmail;

function int(defaultValue: number, min: number, max: number) {
  return z.preprocess((val) => {
    if (val === undefined || val === '') return defaultValue;
    if (typeof val !== 'string' && typeof val !== 'number') return defaultValue;
    const parsed = Number.parseInt(String(val), 10);
    if (!Number.isFinite(parsed)) return defaultValue;
    return Math.min(max, Math.max(min, parsed));
  }, z.number());
}

function bool(defaultValue: boolean) {
  return z.preprocess((val) => {
    if (val === undefined || val === '') return defaultValue;
    if (typeof val === 'boolean') return val;
    if (typeof val === 'number') return val === 1;
    if (typeof val !== 'string') return defaultValue;
    return val.toLowerCase() === 'true' || val === '1';
  }, z.boolean());
}

function csv(defaultValue: string[] = []) {
  return z.preprocess((val) => {
    if (typeof val !== 'string' || val === '') return defaultValue;
    return val
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }, z.array(z.string()));
}

const schema = z.object({
  nodeEnv: z.preprocess(
    (val) => (val === undefined || val === '' ? 'development' : val),
    z.enum(['development', 'production', 'test']),
  ),

  mongodbUri: z.string().min(1).default('mongodb://127.0.0.1:27017/novels-library'),
  jwtSecret: z.string().min(1).optional(),
  corsOrigins: csv([]),
  port: int(5050, 1, 65535),
  host: z.string().default('0.0.0.0'),
  logLevel: z.string().default('info'),
  shutdownTimeoutMs: int(8000, 0, 300000),

  redisUrl: z.string().default('redis://127.0.0.1:6379'),
  redisEnabled: bool(false),

  adminEmails: csv([]),

  aiTranslationProvider: z.preprocess(
    (val) => (val === undefined || val === '' ? 'openai' : val),
    z.enum(['openai', 'gemini']),
  ),
  geminiApiKey: z.string().optional(),
  openaiApiKey: z.string().optional(),
  geminiTranslationModel: z.string().default('gemini-2.0-flash'),
  openaiTranslationModel: z.string().default('gpt-5-mini'),
  defaultTranslationTargetLanguage: z.string().default('English'),
  aiTranslationMaxInputChars: int(60000, 1000, 200000),
  aiTranslationTimeoutMs: int(60000, 5000, 300000),

  scraperHeadless: bool(true),
  scraperUserDataDir: z.string().default('.scraper-profile'),
  scraperNavigationTimeoutMs: int(30000, 5000, 120000),
  scraperRenderWaitMs: int(750, 0, 30000),
  scraperChallengeWaitMs: int(15000, 1000, 120000),
  scraperChapterDelayMs: int(0, 0, 10000),
  scraperChapterConcurrency: int(8, 1, 10),
  scraperListPageConcurrency: int(3, 1, 10),
  recoverProcessingJobsOnStart: bool(true),

  googleClientId: z.string().optional(),
  googleClientSecret: z.string().optional(),
  googleCallbackUrl: z.string().optional(),
  frontendOrigin: z.string().default('http://localhost:3000'),

  smtpHost: z.string().optional(),
  smtpPort: int(587, 1, 65535),
  smtpUser: z.string().optional(),
  smtpPass: z.string().optional(),
  smtpFrom: z.string().default('"Book Library Alert" <noreply@books.local>'),

  coverStorageDir: z.string().default(path.join(process.cwd(), 'storage')),
  coverDownloadTimeoutMs: int(20000, 1000, 120000),
  coverImageMaxBytes: int(10 * 1024 * 1024, 1024, 50 * 1024 * 1024),

  // MongoDB backup/restore scripts
  sourceMongodbUri: z.string().optional(),
  targetMongodbUri: z.string().optional(),
  backupDir: z.string().optional(),
  backupDatabase: z.string().optional(),
  mongodbToolsDir: z.string().optional(),
  includeAtlas: bool(false),
  dumpUsers: bool(false),
  restoreDrop: bool(false),
  restoreStopOnError: bool(false),

  atlasPublicKey: z.string().optional(),
  atlasPrivateKey: z.string().optional(),
  atlasGroupId: z.string().optional(),
  atlasAppId: z.string().optional(),
  atlasAppInternalId: z.string().optional(),
  appServicesDir: z.string().optional(),
});

const config = schema.parse(camelEnv);

export { config };
export type Config = z.infer<typeof schema>;
