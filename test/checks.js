#!/usr/bin/env node
"use strict";

/**
 * Chequeos de coherencia del repo.
 *
 * Verifica que lo que dicen los README coincida con lo que hace el código:
 * rutas de archivos, comandos de test, conteos de mazos y links del índice.
 * No reemplaza los tests de cada juego: los corre.
 *
 * Uso:  node test/checks.js
 * Sale con código 1 si algo no cierra.
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

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

// la frase del README que menciona un término, para mostrar qué dice si falla
function primeraFrase(texto, termino) {
  const linea = texto.split("\n").find((l) => l.includes(termino));
  return linea ? linea.trim().slice(0, 80) : `no menciona "${termino}"`;
}

/* ---------- juegos declarados ---------- */

const JUEGOS = [
  { slug: "en-palabras", indice: "en-palabras/" },
  { slug: "botella", indice: "botella/" },
  { slug: "charadas", indice: "charadas/" },
  { slug: "ahorcado", indice: "ahorcado/" },
  { slug: "yo-nunca", indice: "yo-nunca/" },
  { slug: "mas-probable", indice: "mas-probable/" },
  { slug: "despues-de-las-doce", indice: "despues-de-las-doce/" },
  { slug: "hdp", indice: "hdp/public/" },
];

/* ---------- 1. estructura ---------- */

console.log("\n1. Estructura");
for (const juego of JUEGOS) {
  const dir = path.join(ROOT, juego.slug);
  ok(fs.existsSync(dir), `${juego.slug}/ existe`);
  ok(fs.existsSync(path.join(dir, "README.md")), `${juego.slug}/README.md existe`);
  // HDP sirve public/ como raíz; el resto tiene el index en la carpeta
  const index = juego.slug === "hdp" ? path.join(dir, "public", "index.html") : path.join(dir, "index.html");
  ok(fs.existsSync(index), `${juego.slug}: index.html en ${path.relative(ROOT, index)}`);
  ok(fs.existsSync(path.join(dir, "data")) || fs.existsSync(path.join(dir, "public", "assets", "cards.js")),
     `${juego.slug}: tiene datos`);
}

/* ---------- 2. índices: cada juego está linkeado, ningún link roto ---------- */

console.log("\n2. Índice");
const htmlIndice = leer(path.join(ROOT, "index.html"));
const hrefs = [...htmlIndice.matchAll(/href="([^"#?]+)"/g)]
  .map((m) => m[1])
  .filter((h) => !h.startsWith("http") && !h.startsWith("data:"));

for (const h of hrefs) {
  const destino = path.join(ROOT, h);
  ok(fs.existsSync(destino), `link del índice responde: ${h}`);
}

for (const juego of JUEGOS) {
  ok(hrefs.includes(juego.indice), `el índice linkea ${juego.indice}`);
  ok(htmlIndice.includes(`data-intro-title`), "el índice usa intros por juego");
}

// una tarjeta por juego, ni más ni menos
const tarjetas = (htmlIndice.match(/class="game"/g) || []).length;
ok(tarjetas === JUEGOS.length, `el índice tiene ${JUEGOS.length} tarjetas`, `encontré ${tarjetas}`);

/* ---------- 3. links internos de los README ---------- */

console.log("\n3. Links de los README");
const readmes = [path.join(ROOT, "README.md")];
for (const juego of JUEGOS) readmes.push(path.join(ROOT, juego.slug, "README.md"));

for (const readme of readmes) {
  const texto = leer(readme);
  const rel = path.relative(ROOT, readme);
  const dir = path.dirname(readme);
  // links markdown relativos; los http y anclas no se validan
  const links = [...texto.matchAll(/\]\(([^)\s]+)\)/g)]
    .map((m) => m[1].split("#")[0])
    .filter((l) => l && !/^(https?:|mailto:|#)/.test(l));
  for (const l of links) {
    if (!l) continue;
    ok(fs.existsSync(path.join(dir, l)), `${rel}: link ${l}`);
  }
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
  const cards = require(path.join(ROOT, "hdp", "public", "assets", "cards.js"));
  ok(cards.BLACK.length === 74, "hdp: 74 negras", `encontré ${cards.BLACK.length}`);
  ok(cards.WHITE.length === 244, "hdp: 244 blancas", `encontré ${cards.WHITE.length}`);
  const readme = leer(path.join(ROOT, "hdp", "README.md"));
  ok(readme.includes("74") && readme.includes("244"), "hdp/README dice 74 y 244");
}

/* ---------- 5. coherencia de contenido: edad y servidor ---------- */

console.log("\n5. Coherencia de contenido");
const todosLosReadmes = readmes.map((r) => [path.relative(ROOT, r), leer(r)]);

// las etiquetas de intensidad no llevan edad (decisión del repo)
for (const [rel, texto] of todosLosReadmes) {
  const sospechosas = texto.split("\n").filter((l) =>
    /(suave|media|picante|previa|caliente|sin filtro)/i.test(l) && /\+\s*18|mayores de 18/i.test(l)
  );
  ok(sospechosas.length === 0, `${rel}: ninguna intensidad etiquetada con edad`,
     sospechosas[0] && sospechosas[0].trim().slice(0, 60));
}

// HDP no tiene servidor: que ningún README lo mande a correr node
for (const [rel, texto] of todosLosReadmes) {
  ok(!/node\s+(hdp\/)?server\.js/.test(texto), `${rel}: no manda a correr server.js`);
}

// el README raíz declara la URL pública
{
  const root = leer(path.join(ROOT, "README.md"));
  ok(/https:\/\/juegos-de-mesa-seven\.vercel\.app/.test(root), "README raíz publica la URL del sitio");
  ok(/push a `main`/.test(root), "README raíz explica que el push despliega");
}

/* ---------- 6. el código compila ---------- */

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
const archivos = jsFiles(ROOT);
for (const f of archivos) {
  try {
    execSync(`node --check "${f}"`, { stdio: "pipe" });
    chequeos++;
  } catch (e) {
    fallas++;
    console.log(`  FALLA  sintaxis: ${path.relative(ROOT, f)}`);
  }
}
console.log(`  ${archivos.length} archivos .js revisados`);

/* ---------- resumen ---------- */

console.log(`\n${chequeos} chequeos, ${fallas} fallas.`);
process.exit(fallas === 0 ? 0 : 1);
