import { config } from './config/index';
import Fastify, { FastifyError } from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import helmet from '@fastify/helmet';
import compress from '@fastify/compress';
import rateLimit from '@fastify/rate-limit';
import underPressure from '@fastify/under-pressure';
import { Socket } from 'net';
import crypto from 'crypto';
import { connectDB, disconnectDB } from './config/db';
import { redisClient } from './config/redis';
import { apiRoutes } from './routes/api';
import { startWorker, stopWorker } from './worker/jobProcessor';
import { stopNotificationWorker } from './services/notificationQueue';
import { closeBrowser } from './services/scraper';
import { syncPolicies } from './services/casbin';

const app = Fastify({
  logger: {
    level: config.logLevel,
    redact: ['req.headers.authorization', 'req.headers.cookie'],
  },
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

const defaultCorsOrigins = [
  'https://books-library.vijaymeena.dev',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
];

const allowedCorsOrigins = new Set(config.corsOrigins.length > 0 ? config.corsOrigins : defaultCorsOrigins);
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
});

// Register JWT plugin
if (!config.jwtSecret && config.nodeEnv === 'production') {
  throw new Error('JWT_SECRET must be configured in production.');
}

await app.register(jwt, {
  secret: config.jwtSecret || 'super-secret-key-books-library-321!',
});

// Security headers
await app.register(helmet, {
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: false,
});

// Response compression
await app.register(compress, { encodings: ['gzip', 'br'] });

// Rate limiting with optional Redis store
await app.register(rateLimit, {
  max: 100,
  timeWindow: 60 * 1000,
  keyGenerator: (req) => String((req.user as any)?.id || req.ip || req.id),
  ...(redisClient ? { redis: redisClient } : {}),
});

// Under-pressure circuit breaker
await app.register(underPressure, {
  maxEventLoopDelay: 1000,
  maxHeapUsedBytes: 1024 * 1024 * 1024,
  maxRssBytes: 1024 * 1024 * 1024,
  maxEventLoopUtilization: 0.98,
});

app.setErrorHandler((error, request, reply) => {
  const err = error as FastifyError;
  request.log.error({ err }, 'Unhandled request error');
  if (reply.sent) return;
  const statusCode = err.validation ? 400 : err.statusCode && err.statusCode >= 400 ? err.statusCode : 500;
  const message = err.validation
    ? 'Request validation failed.'
    : statusCode >= 500
      ? 'Internal server error.'
      : err.message;
  reply.status(statusCode).send({ error: message, code: err.code, requestId: request.id });
});

// Register API Routes
await app.register(apiRoutes, { prefix: '/api' });

// Simple Health Check
app.get('/health', async () => {
  return { status: 'ok', timestamp: new Date() };
});

/**
 * Start Server & Connect Database
 */
const start = async () => {
  try {
    // 1. Connect MongoDB
    await connectDB();

    // 2. Sync RBAC policies into Casbin
    await syncPolicies();

    // 3. Start Background Job Worker
    startWorker();

    // 4. Bind server port
    const port = config.port;
    const host = config.host;

    await app.listen({ port, host });
    console.log(`[App] Server listening on http://${host}:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

/**
 * Handle Graceful Server Shutdowns
 */
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

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

start();
