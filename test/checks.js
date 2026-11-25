#!/usr/bin/env node
"use strict";

/**
 * Chequeos de coherencia del repo.
 *
 * Verifica estructura, descubrimiento en shared/games.js, assets compartidos,
 * links de README/AGENTS, conteos contra los datasets, coherencia de contenido,
 * sintaxis JS y ejecución de todas las suites de tests.
 *
 * Uso:  node test/checks.js
 * Sale con código 1 si algo falla.
 */

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
let fallas = 0;
let chequeos = 0;

function ok(cond, mensaje, detalle) {
  chequeos++;
  if (cond) return true;
  fallas++;
  console.log(`  FALLA  ${mensaje}${detalle ? `  (${detalle})` : ""}`);
  return false;
}

function leer(p) {
  return fs.readFileSync(p, "utf8");
}

function primeraFrase(texto, termino) {
  const linea = texto.split("\n").find((l) => l.includes(termino));
  return linea ? linea.trim().slice(0, 80) : `no menciona "${termino}"`;
}

const CATALOG = require(path.join(ROOT, "shared", "games.js"));
const JUEGOS = CATALOG.games;

/* ---------- 1. estructura y descubrimiento ---------- */

console.log("\n1. Estructura y descubrimiento");

const ROOT_IGNORE_DIRS = new Set([
  ".git",
  ".vercel",
  ".githooks",
  "node_modules",
  "shared",
  "test",
  "scripts"
]);

const declaredSlugs = new Set(JUEGOS.map((g) => g.slug));
for (const entry of fs.readdirSync(ROOT, { withFileTypes: true })) {
  if (!entry.isDirectory() || ROOT_IGNORE_DIRS.has(entry.name)) continue;
  ok(declaredSlugs.has(entry.name), `carpeta raíz declarada en shared/games.js: ${entry.name}/`);
}

const ROOT_FILES = [
  "AGENTS.md",
  "CLAUDE.md",
  "README.md",
  "index.html",
  "vercel.json",
  ".editorconfig",
  "shared/games.js",
  "shared/theme.js",
  "shared/chrome.css",
  "shared/chrome.js",
  "scripts/serve.js",
  ".githooks/commit-msg",
  ".githooks/pre-commit",
  "test/shared.test.js"
];

for (const rel of ROOT_FILES) {
  ok(fs.existsSync(path.join(ROOT, rel)), `archivo raíz existe: ${rel}`);
}

for (const juego of JUEGOS) {
  const dir = path.join(ROOT, juego.slug);
  ok(fs.existsSync(dir), `${juego.slug}/ existe`);
  ok(fs.existsSync(path.join(dir, "index.html")), `${juego.slug}/index.html existe`);
  ok(fs.existsSync(path.join(dir, "README.md")), `${juego.slug}/README.md existe`);
  ok(fs.existsSync(path.join(dir, "AGENTS.md")), `${juego.slug}/AGENTS.md existe`);
  ok(fs.existsSync(path.join(dir, "assets", "app.js")), `${juego.slug}/assets/app.js existe`);
  ok(fs.existsSync(path.join(dir, "assets", "styles.css")), `${juego.slug}/assets/styles.css existe`);
  ok(fs.existsSync(path.join(dir, "data")), `${juego.slug}/data/ existe`);
  ok(fs.existsSync(path.join(dir, juego.dataFile)), `${juego.slug}/${juego.dataFile} existe`);
  ok(fs.existsSync(path.join(dir, "test", "game.test.js")), `${juego.slug}/test/game.test.js existe`);
}

/* ---------- 2. índice y assets compartidos ---------- */

console.log("\n2. Índice y assets compartidos");

const CREDIT_HTML = '<p class="credit">Proyecto hobby hecho con amor por <strong>snatty</strong>.</p>';
const htmlIndice = leer(path.join(ROOT, "index.html"));

ok(/<html[^>]*\blang="es-AR"/.test(htmlIndice), 'index.html declara lang="es-AR"');
ok(/<html[^>]*\bdata-page="hub"/.test(htmlIndice), 'index.html declara data-page="hub"');
ok(htmlIndice.includes("shared/theme.js"), "index.html carga shared/theme.js");
ok(htmlIndice.includes("shared/chrome.css"), "index.html carga shared/chrome.css");
ok(htmlIndice.includes("shared/games.js"), "index.html carga shared/games.js");
ok(htmlIndice.includes("shared/chrome.js"), "index.html carga shared/chrome.js");
ok(htmlIndice.includes('id="gamesGrid"'), "index.html declara #gamesGrid");
ok(htmlIndice.includes('id="introDialog"'), "index.html declara #introDialog");
ok(htmlIndice.includes(CREDIT_HTML), "index.html tiene el footer credit exacto");

for (const juego of JUEGOS) {
  const dir = path.join(ROOT, juego.slug);
  const html = leer(path.join(dir, "index.html"));

  const scriptRefs = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]);
  const styleRefs = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)].map((m) => m[1]);
  const localRefs = [...scriptRefs, ...styleRefs].filter(
    (ref) => !/^(https?:|data:)/.test(ref)
  );

  for (const ref of localRefs) {
    ok(fs.existsSync(path.resolve(dir, ref)), `${juego.slug}/index.html ref responde: ${ref}`);
  }

  ok(html.includes("../shared/chrome.css"), `${juego.slug}: carga ../shared/chrome.css`);
  ok(html.includes("../shared/chrome.js"), `${juego.slug}: carga ../shared/chrome.js`);

  if (juego.darkOnly) {
    ok(
      /<html[^>]*\bdata-theme-mode="dark-only"/.test(html),
      `${juego.slug}: declara data-theme-mode="dark-only"`
    );
  } else {
    ok(html.includes("../shared/theme.js"), `${juego.slug}: carga ../shared/theme.js`);
    ok(
      !html.includes(`${juego.slug}-theme`),
      `${juego.slug}: no usa clave inline ${juego.slug}-theme`
    );
  }

  ok(!html.includes('id="hub-nav-style"'), `${juego.slug}: sin bloque inline #hub-nav-style`);
  ok(!html.includes('id="hubFab"'), `${juego.slug}: sin botón #hubFab duplicado en HTML`);
  ok(/<html[^>]*\blang="es-AR"/.test(html), `${juego.slug}: declara lang="es-AR"`);
  ok(html.includes('rel="icon"'), `${juego.slug}: tiene favicon`);
  ok(html.includes(CREDIT_HTML), `${juego.slug}: tiene el footer credit exacto`);
  ok(html.includes('id="howDialog"'), `${juego.slug}: tiene diálogo #howDialog`);

  const mains = (html.match(/<main\b/g) || []).length;
  ok(mains === 1, `${juego.slug}: exactamente 1 <main>`, `encontré ${mains}`);
}

/* ---------- 3. links de los README y AGENTS ---------- */

console.log("\n3. Links de los README y AGENTS");

const docFiles = [
  path.join(ROOT, "README.md"),
  path.join(ROOT, "AGENTS.md"),
  path.join(ROOT, "CLAUDE.md")
];
for (const juego of JUEGOS) {
  docFiles.push(path.join(ROOT, juego.slug, "README.md"));
  docFiles.push(path.join(ROOT, juego.slug, "AGENTS.md"));
}

for (const docPath of docFiles) {
  const texto = leer(docPath);
  const rel = path.relative(ROOT, docPath);
  const dir = path.dirname(docPath);
  const links = [...texto.matchAll(/\]\(([^)\s]+)\)/g)]
    .map((m) => m[1].split("#")[0])
    .filter((l) => l && !/^(https?:|mailto:|#)/.test(l));

  for (const l of links) {
    ok(fs.existsSync(path.join(dir, l)), `${rel}: link ${l}`);
  }
}

const rootReadme = leer(path.join(ROOT, "README.md"));
for (const juego of JUEGOS) {
  ok(rootReadme.includes(`(${juego.slug}/)`), `README.md enlaza (${juego.slug}/)`);
  const gameReadme = leer(path.join(ROOT, juego.slug, "README.md"));
  ok(
    gameReadme.includes("node test/game.test.js"),
    `${juego.slug}/README.md documenta node test/game.test.js`
  );
}

/* ---------- 4. conteos que los README afirman ---------- */

console.log("\n4. Conteos contra el código");

function conDatosGlobal(archivo, nombreGlobal) {
  const sandbox = { window: {} };
  const codigo = leer(archivo);
  const fn = new Function("window", `${codigo}\nreturn window.${nombreGlobal};`);
  return fn(sandbox.window);
}

// botella: tres mazos de 45
{
  const d = conDatosGlobal(path.join(ROOT, "botella", "data", "questions.js"), "BOTELLA_DECKS");
  const n = Object.keys(d).length;
  ok(n === 3, "botella: 3 mazos", `encontré ${n}`);
  for (const [k, v] of Object.entries(d)) {
    ok(v.questions.length === 45, `botella: ${k} tiene 45`, `encontré ${v.questions.length}`);
  }
  const readme = leer(path.join(ROOT, "botella", "README.md"));
  ok(/45 preguntas/.test(readme), "botella/README dice 45 preguntas", primeraFrase(readme, "pregunta"));
}

// yo-nunca: tres niveles de 120
{
  const d = conDatosGlobal(path.join(ROOT, "yo-nunca", "data", "statements.js"), "YO_NUNCA_DATA");
  for (const [k, v] of Object.entries(d)) {
    ok(Array.isArray(v) && v.length === 120, `yo-nunca: ${k} tiene 120`, `encontré ${v && v.length}`);
  }
  const readme = leer(path.join(ROOT, "yo-nunca", "README.md"));
  ok(/120 frases/.test(readme), "yo-nunca/README dice 120 frases", primeraFrase(readme, "frase"));
  ok(readme.includes("2 a 12"), "yo-nunca/README dice 2 a 12");
}

// mas-probable: 100 consignas
{
  const d = conDatosGlobal(path.join(ROOT, "mas-probable", "data", "prompts.js"), "MAS_PROBABLE_DATA");
  ok(Array.isArray(d) && d.length === 100, "mas-probable: 100 consignas", `encontré ${Array.isArray(d) ? d.length : typeof d}`);
  const readme = leer(path.join(ROOT, "mas-probable", "README.md"));
  ok(/100 consignas/.test(readme), "mas-probable/README dice 100 consignas", primeraFrase(readme, "consigna"));
  ok(readme.includes("3 a 12"), "mas-probable/README dice 3 a 12");
}

// incomodometro: 80 situaciones
{
  const d = conDatosGlobal(path.join(ROOT, "incomodometro", "data", "prompts.js"), "INCOMODOMETRO_DATA");
  ok(Array.isArray(d) && d.length === 80, "incomodometro: 80 situaciones", `encontré ${Array.isArray(d) ? d.length : typeof d}`);
  const readme = leer(path.join(ROOT, "incomodometro", "README.md"));
  ok(/80 situaciones/.test(readme), "incomodometro/README dice 80 situaciones", primeraFrase(readme, "situaciones"));
  ok(readme.includes("3 a 12"), "incomodometro/README dice 3 a 12");
}

// en-palabras: cuatro mazos de 40
{
  const d = conDatosGlobal(path.join(ROOT, "en-palabras", "data", "decks.js"), "EN_PALABRAS_DECKS");
  const mazos = Object.keys(d);
  ok(mazos.length === 4, "en-palabras: 4 mazos", `encontré ${mazos.length}`);
  for (const [k, v] of Object.entries(d)) {
    const n = (v.questions || v).length;
    ok(n === 40, `en-palabras: ${k} tiene 40`, `encontré ${n}`);
  }
  const readme = leer(path.join(ROOT, "en-palabras", "README.md"));
  ok(/40 preguntas/.test(readme), "en-palabras/README dice 40 preguntas", primeraFrase(readme, "preguntas"));
}

// charadas: 4 categorías de 120 + mezcla
{
  const d = conDatosGlobal(path.join(ROOT, "charadas", "data", "words.js"), "CHARADAS_DATA");
  const reales = d.categories.filter((c) => !c.mixed);
  ok(reales.length === 4, "charadas: 4 categorías reales", `encontré ${reales.length}`);
  ok(d.items.length === 480, "charadas: 480 items", `encontré ${d.items.length}`);
  const readme = leer(path.join(ROOT, "charadas", "README.md"));
  ok(/480/.test(readme), "charadas/README dice 480", primeraFrase(readme, "480"));
}

// ahorcado: cuatro mazos de 40 + mezcla
{
  const d = conDatosGlobal(path.join(ROOT, "ahorcado", "data", "words.js"), "AHORCADO_DATA");
  const reales = d.categories.filter((c) => !c.mixed);
  ok(reales.length === 4, "ahorcado: 4 mazos reales", `encontré ${reales.length}`);
  ok(d.items.length === 160, "ahorcado: 160 palabras", `encontré ${d.items.length}`);
  for (const cat of reales) {
    const n = d.items.filter((item) => item.category === cat.id).length;
    ok(n === 40, `ahorcado: ${cat.id} tiene 40`, `encontré ${n}`);
  }
  const readme = leer(path.join(ROOT, "ahorcado", "README.md"));
  ok(/Cuatro mazos de 40 palabras/.test(readme), "ahorcado/README dice cuatro mazos de 40 palabras", primeraFrase(readme, "mazos"));
  ok(/160 en total/.test(readme), "ahorcado/README dice 160 en total", primeraFrase(readme, "160"));
}

// después de las doce: 216 cartas
{
  const d = conDatosGlobal(path.join(ROOT, "despues-de-las-doce", "data", "cards.js"), "DESPUES_DATA");
  ok(d.cards.length === 216, "despues-de-las-doce: 216 cartas", `encontré ${d.cards.length}`);
  const readme = leer(path.join(ROOT, "despues-de-las-doce", "README.md"));
  ok(/216 cartas/.test(readme), "despues-de-las-doce/README dice 216 cartas", primeraFrase(readme, "216"));
  ok(!/\+\s*18|mayores de 18/i.test(readme) || readme.includes("Para adultos"),
     "despues-de-las-doce: el aviso de edad es explícito, no colado");
}

// hdp: 74 negras y 244 blancas
{
  const cards = require(path.join(ROOT, "hdp", "data", "cards.js"));
  ok(cards.BLACK.length === 74, "hdp: 74 negras", `encontré ${cards.BLACK.length}`);
  ok(cards.WHITE.length === 244, "hdp: 244 blancas", `encontré ${cards.WHITE.length}`);
  const readme = leer(path.join(ROOT, "hdp", "README.md"));
  ok(readme.includes("74") && readme.includes("244"), "hdp/README dice 74 y 244");
}

/* ---------- 5. coherencia de contenido ---------- */

console.log("\n5. Coherencia de contenido");
const readmes = [path.join(ROOT, "README.md"), ...JUEGOS.map((g) => path.join(ROOT, g.slug, "README.md"))];
const todosLosReadmes = readmes.map((r) => [path.relative(ROOT, r), leer(r)]);

// las etiquetas de intensidad no llevan edad (decisión del repo)
for (const [rel, texto] of todosLosReadmes) {
  const sospechosas = texto.split("\n").filter((l) =>
    /(suave|media|picante|previa|caliente|sin filtro)/i.test(l) && /\+\s*18|mayores de 18/i.test(l)
  );
  ok(sospechosas.length === 0, `${rel}: ninguna intensidad etiquetada con edad`,
     sospechosas[0] && sospechosas[0].trim().slice(0, 60));
}

// HDP no tiene servidor: que ningún README lo mande a correr node server.js
for (const [rel, texto] of todosLosReadmes) {
  ok(!/node\s+(hdp\/)?server\.js/.test(texto), `${rel}: no manda a correr server.js`);
}

// Ningún juego publicado dice "no se publica"
for (const juego of JUEGOS) {
  const htmlPath = path.join(ROOT, juego.slug, "index.html");
  const readmePath = path.join(ROOT, juego.slug, "README.md");
  ok(!/no se publica/i.test(leer(htmlPath)), `${juego.slug}/index.html: sin texto "no se publica"`);
  ok(!/no se publica/i.test(leer(readmePath)), `${juego.slug}/README.md: sin texto "no se publica"`);
}

// el README raíz declara la URL pública
{
  ok(/https:\/\/juegos-de-mesa-seven\.vercel\.app/.test(rootReadme), "README raíz publica la URL del sitio");
  ok(/push a `main`/.test(rootReadme), "README raíz explica que el push despliega");
}

/* ---------- 6. sintaxis JS ---------- */

console.log("\n6. Sintaxis");
function jsFiles(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === ".git" || e.name === ".vercel") continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) jsFiles(p, acc);
    else if (e.name.endsWith(".js")) acc.push(p);
  }
  return acc;
}
const archivos = [...jsFiles(ROOT), path.join(ROOT, ".githooks", "commit-msg")];
for (const f of archivos) {
  try {
    execFileSync(process.execPath, ["--check", f], { stdio: "pipe" });
    chequeos++;
  } catch (e) {
    fallas++;
    console.log(`  FALLA  sintaxis: ${path.relative(ROOT, f)}`);
  }
}
console.log(`  ${archivos.length} archivos .js revisados`);

/* ---------- 7. suites de tests ---------- */

console.log("\n7. Suites de tests");
const suites = [
  path.join(ROOT, "test", "shared.test.js"),
  ...JUEGOS.map((g) => path.join(ROOT, g.slug, "test", "game.test.js"))
];

for (const suite of suites) {
  const rel = path.relative(ROOT, suite);
  try {
    execFileSync(process.execPath, [suite], { stdio: "pipe", encoding: "utf8" });
    ok(true, `suite ${rel}`);
    console.log(`  ok   ${rel}`);
  } catch (e) {
    const out = [e.stdout, e.stderr].filter(Boolean).join("\n").trim();
    ok(false, `suite ${rel}`, out.split("\n").slice(-3).join(" | "));
  }
}

/* ---------- resumen ---------- */

console.log(`\n${chequeos} chequeos, ${fallas} fallas.`);
process.exit(fallas === 0 ? 0 : 1);
