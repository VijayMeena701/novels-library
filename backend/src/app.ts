import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import helmet from "@fastify/helmet";
import compress from "@fastify/compress";
import rateLimit from "@fastify/rate-limit";
import underPressure from "@fastify/under-pressure";
import { Socket } from "net";
import crypto from "crypto";
import { connectDB, disconnectDB } from "./config/db.js";
import { redisClient } from "./config/redis.js";
import { apiRoutes } from "./routes/api.js";
import { startWorker, stopWorker } from "./worker/jobProcessor.js";
import { stopNotificationWorker } from "./services/notificationQueue.js";
import { closeBrowser } from "./services/scraper.js";
import { seedRbac } from "./seed/index.js";

const app = Fastify({
	logger: {
		level: process.env.LOG_LEVEL || 'info',
		redact: ['req.headers.authorization', 'req.headers.cookie'],
	},
	forceCloseConnections: true,
	requestIdHeader: 'x-request-id',
	genReqId: () => crypto.randomUUID(),
});
const activeSockets = new Set<Socket>();
const SHUTDOWN_TIMEOUT_MS = Number.parseInt(process.env.SHUTDOWN_TIMEOUT_MS || "8000", 10);
let isShuttingDown = false;

app.server.on("connection", (socket) => {
	activeSockets.add(socket);
	socket.on("close", () => activeSockets.delete(socket));
});

const defaultCorsOrigins = [
	"https://books-library.vijaymeena.dev",
	"http://localhost:3000",
	"http://127.0.0.1:3000",
	"http://localhost:3001",
	"http://127.0.0.1:3001",
];

const corsOrigins = (process.env.CORS_ORIGINS || "")
	.split(",")
	.map((origin) => origin.trim())
	.filter(Boolean);
const allowedCorsOrigins = new Set(corsOrigins.length > 0 ? corsOrigins : defaultCorsOrigins);
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
	methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
	allowedHeaders: ["Content-Type", "Authorization"],
});

// Register JWT plugin
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret && process.env.NODE_ENV === 'production') {
	throw new Error('JWT_SECRET must be configured in production.');
}

await app.register(jwt, {
	secret: jwtSecret || "super-secret-key-books-library-321!",
});

// Security headers
await app.register(helmet, {
	contentSecurityPolicy: false,
	crossOriginResourcePolicy: false,
});

// Response compression
await app.register(compress, { encodings: ["gzip", "br"] });

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
	request.log.error({ err: error }, 'Unhandled request error');
	if (reply.sent) return;
	const statusCode = error.validation ? 400 : error.statusCode && error.statusCode >= 400 ? error.statusCode : 500;
	const message = error.validation ? 'Request validation failed.' : statusCode >= 500 ? 'Internal server error.' : error.message;
	reply.status(statusCode).send({ error: message, code: error.code, requestId: request.id });
});

// Register API Routes
await app.register(apiRoutes, { prefix: "/api" });

// Simple Health Check
app.get("/health", async () => {
	return { status: "ok", timestamp: new Date() };
});

/**
 * Start Server & Connect Database
 */
const start = async () => {
	try {
		// 1. Connect MongoDB
		await connectDB();

		// 2. Seed RBAC roles and capabilities and load Casbin policies
		await seedRbac();

		// 3. Start Background Job Worker
		startWorker();

		// 4. Bind server port
		const port = parseInt(process.env.PORT || "5050", 10);
		const host = process.env.HOST || "0.0.0.0";

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
			withTimeout(app.close(), 3000, "Timed out closing Fastify server."),
			withTimeout(closeBrowser(), 3000, "Timed out closing Puppeteer browser."),
			withTimeout(disconnectDB(), 3000, "Timed out disconnecting MongoDB."),
			withTimeout(stopNotificationWorker(), 3000, "Timed out stopping notification worker."),
		]);

		clearTimeout(hardExitTimer);
		console.log("[App] Shutdown complete.");
		process.exit(0);
	} catch (err) {
		clearTimeout(hardExitTimer);
		console.error("[App] Error during graceful shutdown:", err);
		forceCloseHttpConnections();
		process.exit(1);
	}
};

process.on("SIGINT", () => handleShutdown("SIGINT"));
process.on("SIGTERM", () => handleShutdown("SIGTERM"));

start();
