#!/usr/bin/env node
"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");

const ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.argv[2] || process.env.PORT || 8080);

if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  console.error(`Puerto inválido: ${process.argv[2] || process.env.PORT}`);
  process.exit(1);
}

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8"
};

function resolveFilePath(urlPath) {
  let cleanPath;
  try {
    cleanPath = decodeURIComponent(urlPath.split("?")[0]);
  } catch (err) {
    return null;
  }

  const relative = cleanPath.replace(/^\/+/, "");
  const resolved = path.resolve(ROOT, relative || "index.html");

  if (resolved !== ROOT && !resolved.startsWith(ROOT + path.sep)) {
    return null;
  }

  try {
    const stat = fs.statSync(resolved);
    if (stat.isDirectory()) {
      const indexFile = path.join(resolved, "index.html");
      return fs.existsSync(indexFile) ? indexFile : null;
    }
    return resolved;
  } catch (err) {
    return null;
  }
}

function getLanAddresses() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const entries of Object.values(interfaces)) {
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      if (entry.family === "IPv4" && !entry.internal) {
        ips.push(entry.address);
      }
    }
  }
  return ips;
}

const server = http.createServer((req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Method Not Allowed");
    return;
  }

  const filePath = resolveFilePath(req.url || "/");
  if (!filePath) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not Found");
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Internal Server Error");
      return;
    }
    res.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": "no-store"
    });
    if (req.method === "HEAD") {
      res.end();
    } else {
      res.end(content);
    }
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Sirviendo juegos-de-mesa en:`);
  console.log(`  Local: http://localhost:${PORT}/`);
  for (const ip of getLanAddresses()) {
    console.log(`  Red:   http://${ip}:${PORT}/`);
  }
});
