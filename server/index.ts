import express, { type Request, Response, NextFunction } from "express";
import * as routes from "./routes.js";
import { setupVite, serveStatic, log } from "./vite.js";
import { registerFarcasterRoutes } from './routes-farcaster.js';

const app = express();

// CORS middleware - allow requests from Vercel
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

app.get('/api/ping', (_req, res) => {
  res.json({ ok: true, env: app.get('env') });
});

(async () => {
  console.log('[SERVER] Registering routes...');
  const server = await routes.registerRoutes(app);
  console.log('[SERVER] Main routes registered');
  
  registerFarcasterRoutes(app);
  console.log('[SERVER] Farcaster routes registered');
  
  try { await (routes as any).warmNews?.(); } catch {}
  const REFRESH_MINUTES = parseInt(process.env.NEWS_REFRESH_MINUTES || '60', 10);
  if (Number.isFinite(REFRESH_MINUTES) && REFRESH_MINUTES > 0) {
    setInterval(() => {
      (routes as any).warmNews?.().catch(() => {});
    }, REFRESH_MINUTES * 60 * 1000);
  }

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = parseInt(process.env.PORT || '3001', 10);
  server.listen(port, () => {
    log(`serving on http://localhost:${port}`);
  });
})();
