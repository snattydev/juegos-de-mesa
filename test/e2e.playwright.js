#!/usr/bin/env node
"use strict";

/**
 * Pruebas end-to-end con Playwright (viewport móvil).
 *
 * Cubre:
 *   1. Pop-up de descripción de una sola vez en el hub (index.html).
 *   2. Código de sala de 6 caracteres en HDP (creación, validación, ?sala=).
 *   3. Partida multijugador P2P real por WebRTC entre 3 celulares aislados
 *      conectados solo con el código de 6 caracteres (lobby → ronda → juez → resultado).
 *
 * Uso:  node test/e2e.playwright.js
 */

const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const os = require("node:os");
const assert = require("node:assert/strict");

const ROOT = path.resolve(__dirname, "..");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json; charset=utf-8",
};

function loadPlaywright() {
  const candidates = [];
  if (process.env.PLAYWRIGHT_PATH) candidates.push(process.env.PLAYWRIGHT_PATH);
  candidates.push("playwright", "playwright-core");

  const linksDir = path.join(os.homedir(), ".cache", "ms-playwright", ".links");
  if (fs.existsSync(linksDir)) {
    for (const file of fs.readdirSync(linksDir)) {
      try {
        const target = fs.readFileSync(path.join(linksDir, file), "utf8").trim();
        if (target) candidates.push(target);
      } catch (_) {}
    }
  }

  for (const mod of candidates) {
    try {
      const pw = require(mod);
      if (pw && pw.chromium) return pw;
    } catch (_) {}
  }

  throw new Error(
    "No se encontró playwright ni playwright-core. Pasá PLAYWRIGHT_PATH=/ruta/a/playwright-core."
  );
}

function createTestServer() {
  // Relay SSE compatible con ntfy.sh para probar señalización entre contextos aislados.
  const topics = new Map(); // topic -> { clients: Set<res>, history: Array<{ ts, raw }> }

  function getTopic(name) {
    if (!topics.has(name)) {
      topics.set(name, { clients: new Set(), history: [] });
    }
    return topics.get(name);
  }

  const server = http.createServer((req, res) => {
    const reqUrl = new URL(req.url || "/", "http://127.0.0.1");

    if (reqUrl.pathname.startsWith("/__signal__/")) {
      const rest = reqUrl.pathname.slice("/__signal__/".length);
      const isSse = rest.endsWith("/sse");
      const topicName = decodeURIComponent(isSse ? rest.slice(0, -4) : rest);
      const topic = getTopic(topicName);

      if (req.method === "OPTIONS") {
        res.writeHead(204, {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "*",
        });
        res.end();
        return;
      }

      if (req.method === "GET" && isSse) {
        res.writeHead(200, {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "Access-Control-Allow-Origin": "*",
        });
        res.write(": open\n\n");
        if (reqUrl.searchParams.has("since")) {
          const cutoff = Date.now() - 15000;
          for (const item of topic.history) {
            if (item.ts >= cutoff) {
              res.write("data: " + JSON.stringify({ event: "message", message: item.raw }) + "\n\n");
            }
          }
        }
        topic.clients.add(res);
        req.on("close", () => topic.clients.delete(res));
        return;
      }

      if (req.method === "POST") {
        const chunks = [];
        req.on("data", (c) => chunks.push(c));
        req.on("end", () => {
          const raw = Buffer.concat(chunks).toString("utf8");
          topic.history.push({ ts: Date.now(), raw });
          const frame = "data: " + JSON.stringify({ event: "message", message: raw }) + "\n\n";
          for (const client of topic.clients) {
            try {
              client.write(frame);
            } catch (_) {}
          }
          res.writeHead(200, {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          });
          res.end(JSON.stringify({ ok: true }));
        });
        return;
      }

      res.writeHead(405);
      res.end();
      return;
    }

    // Estáticos del repo
    let rel = decodeURIComponent(reqUrl.pathname).replace(/^\/+/, "");
    let filePath = path.resolve(ROOT, rel || "index.html");
    if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    try {
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) filePath = path.join(filePath, "index.html");
      const data = fs.readFileSync(filePath);
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
        "Cache-Control": "no-store",
      });
      res.end(data);
    } catch (_) {
      res.writeHead(404);
      res.end("Not Found");
    }
  });

  return server;
}

const MOBILE_CONTEXT = {
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
};

async function run() {
  const pw = loadPlaywright();
  const server = createTestServer();

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const browser = await pw.chromium.launch({ headless: true });
  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      passed += 1;
      console.log(`  ok   ${name}`);
    } catch (err) {
      failed += 1;
      console.log(`  FAIL ${name}`);
      console.log(`       ${err && err.stack ? err.stack.split("\n").slice(0, 3).join("\n       ") : err}`);
    }
  }

  console.log("\nPlaywright E2E (móvil 390x844)");

  try {
    await test("hub: pop-up de descripción se muestra una sola vez por juego", async () => {
      const context = await browser.newContext(MOBILE_CONTEXT);
      const page = await context.newPage();

      await page.goto(baseUrl + "/", { waitUntil: "domcontentloaded" });

      const hdpCard = page.locator('a.game[data-intro-slug="hdp"]');
      const ahorcadoCard = page.locator('a.game[data-intro-slug="ahorcado"]');
      const dialog = page.locator("#introDialog");

      // 1. Primera vez que toca HDP: se abre el pop-up con título y descripción.
      await hdpCard.click();
      await dialog.waitFor({ state: "visible" });
      assert.equal(await page.locator("#introTitle").textContent(), "HDP");
      assert.ok((await page.locator("#introText").textContent()).includes("código"));

      // 2. Si cierra sin confirmar (Escape), todavía no cuenta como vista.
      await page.keyboard.press("Escape");
      await dialog.waitFor({ state: "hidden" });

      await hdpCard.click();
      await dialog.waitFor({ state: "visible" });

      // 3. Al tocar Ok navega a HDP y guarda que ya vio esa intro.
      await Promise.all([
        page.waitForURL(/\/hdp\/$/),
        page.locator("#introGo").click(),
      ]);

      // 4. Al volver al hub y tocar HDP otra vez, entra directo sin pop-up.
      await page.goto(baseUrl + "/", { waitUntil: "domcontentloaded" });
      await Promise.all([
        page.waitForURL(/\/hdp\/$/),
        hdpCard.click(),
      ]);

      // 5. Otro juego no visto (Ahorcado) sí muestra el pop-up la primera vez.
      await page.goto(baseUrl + "/", { waitUntil: "domcontentloaded" });
      await ahorcadoCard.click();
      await dialog.waitFor({ state: "visible" });
      assert.equal(await page.locator("#introTitle").textContent(), "Ahorcado");

      await context.close();
    });

    await test("hdp: genera código de 6 caracteres, valida formato y precarga ?sala=", async () => {
      const context = await browser.newContext(MOBILE_CONTEXT);
      await context.addInitScript((url) => {
        window.HDP_SIGNAL_URL = url;
      }, baseUrl + "/__signal__");

      const page = await context.newPage();
      await page.goto(baseUrl + "/hdp/", { waitUntil: "domcontentloaded" });

      // Código corto inválido muestra toast de error.
      await page.fill("#nameInput", "Sofi");
      await page.fill("#codeInput", "ab1");
      await page.click("#joinBtn");
      await page.waitForFunction(() => {
        const t = document.getElementById("toast");
        return t && t.getAttribute("data-show") === "true" && t.textContent.includes("6 caracteres");
      });

      // Crear sala genera código de 6 caracteres visibles en lobby.
      await page.fill("#nameInput", "Sofi");
      await page.click('#createForm button[type="submit"]');
      await page.locator("#viewLobby").waitFor({ state: "visible" });

      const code = (await page.locator("#roomCodeValue").textContent()).trim();
      assert.match(code, /^[A-Z2-9]{6}$/, `código inválido: ${code}`);

      // Abrir link ?sala=<CODE> precarga el input en mayúsculas.
      const linkPage = await context.newPage();
      await linkPage.goto(baseUrl + "/hdp/?sala=" + code.toLowerCase(), {
        waitUntil: "domcontentloaded",
      });
      assert.equal(await linkPage.locator("#codeInput").inputValue(), code);

      await context.close();
    });

    await test("hdp: 3 celulares aislados se conectan con código de 6 caracteres y juegan una ronda WebRTC", async () => {
      const makeMobileContext = async () => {
        const ctx = await browser.newContext(MOBILE_CONTEXT);
        await ctx.addInitScript((url) => {
          window.HDP_SIGNAL_URL = url;
        }, baseUrl + "/__signal__");
        return ctx;
      };

      const hostCtx = await makeMobileContext();
      const g1Ctx = await makeMobileContext();
      const g2Ctx = await makeMobileContext();

      try {
        const hostPage = await hostCtx.newPage();
        const g1Page = await g1Ctx.newPage();
        const g2Page = await g2Ctx.newPage();

        await Promise.all([
          hostPage.goto(baseUrl + "/hdp/", { waitUntil: "domcontentloaded" }),
          g1Page.goto(baseUrl + "/hdp/", { waitUntil: "domcontentloaded" }),
          g2Page.goto(baseUrl + "/hdp/", { waitUntil: "domcontentloaded" }),
        ]);

        // Host crea sala y obtiene código de 6 caracteres.
        await hostPage.fill("#nameInput", "Sofi");
        await hostPage.click('#createForm button[type="submit"]');
        await hostPage.locator("#viewLobby").waitFor({ state: "visible" });
        const roomCode = (await hostPage.locator("#roomCodeValue").textContent()).trim();
        assert.match(roomCode, /^[A-Z2-9]{6}$/);

        // Invitado 1 entra escribiendo el código en minúsculas.
        await g1Page.fill("#nameInput", "Mateo");
        await g1Page.fill("#codeInput", roomCode.toLowerCase());
        assert.equal(await g1Page.locator("#codeInput").inputValue(), roomCode);
        await g1Page.click("#joinBtn");

        // Invitado 2 entra con el mismo código.
        await g2Page.fill("#nameInput", "Luli");
        await g2Page.fill("#codeInput", roomCode);
        await g2Page.click("#joinBtn");

        // Todos llegan al lobby con 3 jugadores.
        await Promise.all([
          g1Page.locator("#viewLobby").waitFor({ state: "visible", timeout: 12000 }),
          g2Page.locator("#viewLobby").waitFor({ state: "visible", timeout: 12000 }),
          hostPage.waitForFunction(
            () => document.getElementById("playerCount")?.textContent === "3",
            null,
            { timeout: 12000 }
          ),
        ]);

        // Host arranca la partida.
        await hostPage.click("#startBtn");

        // Host es juez; invitados ven sus 10 cartas blancas.
        await Promise.all([
          hostPage.locator("#viewJudge").waitFor({ state: "visible" }),
          g1Page.locator("#viewRound").waitFor({ state: "visible" }),
          g2Page.locator("#viewRound").waitFor({ state: "visible" }),
        ]);

        assert.equal(await g1Page.locator("#hand .white-card").count(), 10);
        assert.equal(await g2Page.locator("#hand .white-card").count(), 10);

        // Determinar cuántas cartas pide la carta negra (1 o 2) y jugar en ambos invitados.
        async function submitCards(page) {
          const pick = await page.evaluate(() => {
            const strong = document.querySelector("#roundInstruction strong");
            return strong ? Number(strong.textContent) : 1;
          });
          for (let i = 0; i < pick; i++) {
            await page.locator("#hand .white-card").nth(i).click();
          }
          await page.click("#playBtn");
        }

        await submitCards(g1Page);
        await submitCards(g2Page);

        // Host pasa automáticamente a #viewJudging con 2 respuestas anónimas.
        await hostPage.locator("#viewJudging").waitFor({ state: "visible", timeout: 10000 });
        assert.equal(await hostPage.locator("#judgingChoices .choice").count(), 2);

        // Host elige la primera respuesta -> todos pasan a #viewReveal con ganadora.
        await hostPage.locator("#judgingChoices .choice").first().click();

        await Promise.all([
          hostPage.locator("#viewReveal").waitFor({ state: "visible", timeout: 10000 }),
          g1Page.locator("#viewReveal").waitFor({ state: "visible", timeout: 10000 }),
          g2Page.locator("#viewReveal").waitFor({ state: "visible", timeout: 10000 }),
        ]);

        assert.equal(await hostPage.locator('#revealChoices .choice[data-winner="true"]').count(), 1);
      } finally {
        await hostCtx.close();
        await g1Ctx.close();
        await g2Ctx.close();
      }
    });
  } finally {
    await browser.close();
    server.close();
  }

  console.log(`\n${passed} pruebas E2E pasaron, ${failed} fallaron.`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
