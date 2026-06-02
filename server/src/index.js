import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { config } from "./config.js";
import { initializeDatabase } from "./db/index.js";
import { withRole } from "./middleware/role.js";
import { artifactsRouter } from "./routes/artifacts.js";
import { aiRouter } from "./routes/ai.js";

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientDistDir = path.resolve(__dirname, "../../client/dist");
const clientDistIndex = path.join(clientDistDir, "index.html");
const hasBuiltClient = fs.existsSync(clientDistIndex);

app.use(cors({ origin: config.corsOrigin }));
app.use((req, res, next) => {
  if (req.method === "GET" || req.method === "HEAD") {
    return next();
  }

  const contentType = req.headers["content-type"] || "";
  if (!contentType.includes("application/json")) {
    return next();
  }

  let raw = "";
  req.setEncoding("utf8");
  req.on("data", (chunk) => {
    raw += chunk;
    if (raw.length > 5 * 1024 * 1024) {
      res.status(413).json({ error: "Payload too large" });
      req.destroy();
    }
  });
  req.on("end", () => {
    if (!raw) {
      req.body = {};
      return next();
    }

    try {
      req.body = JSON.parse(raw);
      return next();
    } catch {
      return res.status(400).json({ error: "Invalid JSON body" });
    }
  });
});
app.use(withRole);

app.get("/api/health", (_, res) => {
  res.json({ ok: true, service: "agilesync-ai-server" });
});

app.use("/api", artifactsRouter);
app.use("/api", aiRouter);

if (hasBuiltClient) {
  app.use(express.static(clientDistDir));
}

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) {
    return next();
  }

  if (hasBuiltClient) {
    return res.sendFile(clientDistIndex);
  }

  return res.status(503).send(`
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>AgileSync AI</title>
        <style>
          body { font-family: sans-serif; padding: 32px; background: #f8fafc; color: #0f172a; }
          code { background: #e2e8f0; padding: 2px 6px; border-radius: 6px; }
        </style>
      </head>
      <body>
        <h1>Client build not found</h1>
        <p>Run <code>npm run build</code> from the workspace root for a production build, or <code>npm run dev</code> for local development.</p>
      </body>
    </html>
  `);
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Unexpected server error" });
  next();
});

await initializeDatabase();

function startServer(port, attemptsLeft = 10) {
  const server = app.listen(port, () => {
    console.log(`AgileSync AI API listening on port ${port}`);
  });

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE" && attemptsLeft > 0) {
      const nextPort = Number(port) + 1;
      console.warn(`Port ${port} is busy, retrying on ${nextPort}...`);
      startServer(nextPort, attemptsLeft - 1);
      return;
    }

    console.error(error);
    process.exit(1);
  });
}

startServer(Number(config.port));
