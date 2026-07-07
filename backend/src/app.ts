import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import { Socket } from "net";
import { connectDB, disconnectDB } from "./config/db.js";
import { apiRoutes } from "./routes/api.js";
import { startWorker, stopWorker } from "./worker/jobProcessor.js";
import { closeBrowser } from "./services/scraper.js";

const app = Fastify({
	logger: true,
	forceCloseConnections: true,
});
const activeSockets = new Set<Socket>();
const SHUTDOWN_TIMEOUT_MS = Number.parseInt(process.env.SHUTDOWN_TIMEOUT_MS || "8000", 10);
let isShuttingDown = false;

app.server.on("connection", (socket) => {
	activeSockets.add(socket);
	socket.on("close", () => activeSockets.delete(socket));
});

const defaultCorsOrigins = [
	"novels-library.vijaymeena.dev",
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
await app.register(jwt, {
	secret: process.env.JWT_SECRET || "super-secret-key-novels-library-321!",
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

		// 2. Start Background Job Worker
		startWorker();

		// 3. Bind server port
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
