import { config } from './config/index';
import Fastify, { FastifyError } from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import helmet from '@fastify/helmet';
import compress from '@fastify/compress';
import rateLimit from '@fastify/rate-limit';
import underPressure from '@fastify/under-pressure';
import { Socket } from 'node:net';
import crypto from 'node:crypto';
import { connectDB, disconnectDB } from './config/db';
import { redisClient } from './config/redis';
import { apiRoutes } from './routes/api';
import { healthRoutes } from './routes/health';
import { startWorker, stopWorker } from './worker/jobProcessor';
import { stopNotificationWorker } from './services/notificationQueue';
import { closeBrowser } from './services/scraper';
import { seedRoles } from './services/seed';

const isProduction = config.nodeEnv === 'production';

const loggerOptions: any = {
  level: config.logLevel,
  redact: ['req.headers.authorization', 'req.headers.cookie'],
};

if (!isProduction) {
  loggerOptions.transport = {
    target: 'pino-pretty',
    options: {
      colorize: true,
      levelFirst: true,
      translateTime: false,
      singleLine: true,
      messageFormat: '{msg}{if req.method} {req.method}{end}{if req.url} {req.url}{end}',
      ignore: 'pid,hostname,req,res',
    },
  };
}

const app = Fastify({
  logger: loggerOptions,
  forceCloseConnections: true,
  requestIdHeader: 'x-request-id',
  genReqId: () => crypto.randomUUID(),
});
const activeSockets = new Set<Socket>();
const SHUTDOWN_TIMEOUT_MS = config.shutdownTimeoutMs;
let isShuttingDown = false;

app.server.on('connection', (socket) => {
  activeSockets.add(socket);
  socket.on('close', () => activeSockets.delete(socket));
});

// --- SAFE CORS ALLOWLISHING STRUCTURE ---
const defaultCorsOrigins = [
  config.frontendOrigin,
  'https://books-library.vijaymeena.dev',
  'https://novels-library.vijaymeena.dev',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
].filter(Boolean);

// Ensure we handle both dynamic env arrays and string comma boundaries safely
const parsedConfigOrigins = Array.isArray(config.corsOrigins)
  ? config.corsOrigins
  : (config.corsOrigins ? (config.corsOrigins as string).split(',').map(s => s.trim()) : []);

const allowedCorsOrigins = new Set(
  parsedConfigOrigins.length > 0 ? parsedConfigOrigins : defaultCorsOrigins
);
const localDevOriginPattern = /^https?:\/\/(?:localhost|127\.0\.0\.1):\d+$/;

// Register CORS
await app.register(cors, {
  origin: (origin, callback) => {
    if (!origin || allowedCorsOrigins.has(origin) || localDevOriginPattern.test(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`Origin ${origin} is not allowed by CORS`), false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true // Required for safe cross-subdomain cookie tracking
});

app.log.info({ allowedCorsOrigins: [...allowedCorsOrigins] }, 'CORS allowlist initialized');

if (!config.jwtSecret && isProduction) {
  throw new Error('JWT_SECRET must be configured in production.');
}

await app.register(jwt, {
  secret: config.jwtSecret || 'super-secret-key-books-library-321!',
});

// Security headers with array-mapped safe Set conversion
await app.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", ...Array.from(allowedCorsOrigins)], 
    },
  },
  crossOriginResourcePolicy: { 
    policy: "cross-origin" 
  },
});

await app.register(compress, { encodings: ['gzip', 'br'] });

await app.register(rateLimit, {
  max: config.rateLimitMax,
  timeWindow: config.rateLimitWindowMs,
  keyGenerator: (req) => String((req.user as any)?.id || req.ip || req.id),
  ...(redisClient ? { redis: redisClient } : {}),
});

await app.register(underPressure, {
  maxEventLoopDelay: 1000,
  maxHeapUsedBytes: 1024 * 1024 * 1024,
  maxRssBytes: 1024 * 1024 * 1024,
  maxEventLoopUtilization: 0.98,
});

// --- HARDENED PRODUCTION ERROR HANDLER ---
app.setErrorHandler((error, request, reply) => {
  const err = error as FastifyError;
  request.log.error({ err }, 'Unhandled request error');
  
  if (reply.sent) return;
  
  let statusCode = err.statusCode || 500;
  if (err.validation) statusCode = 400;

  let message: string;
  if (err.validation) {
    message = 'Request validation failed.';
  } else if (statusCode === 429) {
    message = 'Too many requests. Please try again later.';
  } else if (statusCode >= 500) {
    message = 'Internal server error.';
  } else {
    // Standard safe message for client consumption without leaking internal logic
    message = isProduction ? 'Request could not be processed.' : err.message;
  }

  reply.status(statusCode).send({ 
    error: message, 
    code: err.code || 'UNKNOWN_ERROR', 
    requestId: request.id 
  });
});

// Register API Routes
await app.register(apiRoutes, { prefix: '/api' });
await app.register(healthRoutes, { prefix: '/health' });

const start = async () => {
  try {
    await connectDB();
    await seedRoles();
    startWorker();

    const port = config.port;
    const host = config.host;

    await app.listen({ port, host });
    console.log(`[App] Server listening on http://${host}:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeout: NodeJS.Timeout;

  const timeoutPromise = new Promise<T>((_, reject) => {
    timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
    timeout.unref();
  });

  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeout));
}

function forceCloseHttpConnections() {
  app.server.closeIdleConnections?.();
  app.server.closeAllConnections?.();

  for (const socket of activeSockets) {
    socket.destroy();
  }
  activeSockets.clear();
}

const handleShutdown = async (signal: string) => {
  if (isShuttingDown) {
    console.log(`[App] Received ${signal} during shutdown. Forcing exit.`);
    forceCloseHttpConnections();
    process.exit(1);
  }

  isShuttingDown = true;
  console.log(`[App] Received ${signal}. Shutting down...`);

  const hardExitTimer = setTimeout(() => {
    console.error(`[App] Shutdown exceeded ${SHUTDOWN_TIMEOUT_MS}ms. Forcing process exit.`);
    forceCloseHttpConnections();
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  hardExitTimer.unref();

  try {
    stopWorker();
    forceCloseHttpConnections();

    await Promise.allSettled([
      withTimeout(app.close(), 3000, 'Timed out closing Fastify server.'),
      withTimeout(closeBrowser(), 3000, 'Timed out closing Puppeteer browser.'),
      withTimeout(disconnectDB(), 3000, 'Timed out disconnecting MongoDB.'),
      withTimeout(stopNotificationWorker(), 3000, 'Timed out stopping notification worker.'),
    ]);

    clearTimeout(hardExitTimer);
    console.log('[App] Shutdown complete.');
    process.exit(0);
  } catch (err) {
    clearTimeout(hardExitTimer);
    console.error('[App] Error during graceful shutdown:', err);
    forceCloseHttpConnections();
    process.exit(1);
  }
};

export {
  app,
  start,
  handleShutdown,
  withTimeout,
  forceCloseHttpConnections,
  activeSockets,
  SHUTDOWN_TIMEOUT_MS,
  isShuttingDown,
};

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

if (!process.env.VITEST) {
  start();
}