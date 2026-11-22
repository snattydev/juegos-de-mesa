"use strict";

// Verificación sin dependencias: node tests/check.js
// Carga statements.js y app.js en un contexto aislado (sin DOM), valida el
// contenido y simula partidas completas del mazo.

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const LEVELS = ["suave", "media", "picante"];
const PREFIX = "Yo nunca… ";
const PER_LEVEL = 120;

let passed = 0;
const failures = [];

function check(condition, message) {
  if (condition) {
    passed += 1;
    return;
  }
  failures.push(message);
  console.error("FAIL  " + message);
}

function loadSandbox() {
  const sandbox = { window: {}, console: console };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  const dataFile = path.join(root, "data/statements.js");
  vm.runInContext(fs.readFileSync(dataFile, "utf8"), sandbox, { filename: dataFile });

  const appFile = path.join(root, "assets/app.js");
  vm.runInContext(fs.readFileSync(appFile, "utf8"), sandbox, { filename: appFile });

  return sandbox;
}

const sandbox = loadSandbox();
const data = sandbox.window.YO_NUNCA_DATA;
const core = sandbox.window.YO_NUNCA_CORE;

check(Boolean(data), "data/statements.js define window.YO_NUNCA_DATA");
check(Boolean(core), "assets/app.js exporta window.YO_NUNCA_CORE");
check(Array.isArray(core.LEVELS) && core.LEVELS.join(",") === LEVELS.join(","), "las intensidades son suave, media y picante");

const all = [];
const seen = new Map();

LEVELS.forEach(function (level) {
  const list = data[level];
  check(Array.isArray(list), level + ": la lista existe");
  if (!Array.isArray(list)) return;

  check(list.length === PER_LEVEL, level + ": " + PER_LEVEL + " frases (tiene " + list.length + ")");

  const local = new Set();

  list.forEach(function (phrase, index) {
    const where = level + "[" + index + "]";

    check(typeof phrase === "string", where + ": es texto");
    if (typeof phrase !== "string") return;

    check(phrase.indexOf(PREFIX) === 0, where + ": empieza con «" + PREFIX.trim() + "»");
    check(/\.$/.test(phrase), where + ": termina en punto");
    check(phrase.length <= 110, where + ": no supera 110 caracteres (" + phrase.length + ")");
    check(!/_{2,}|\{\{|\}\}|%s|\[[a-z]+\]/i.test(phrase), where + ": no tiene placeholders");
    check(!/\p{Extended_Pictographic}/u.test(phrase), where + ": no tiene emojis");
    check(!/ {2,}/.test(phrase), where + ": no tiene espacios dobles");
    check(phrase === phrase.trim(), where + ": no tiene espacios en los bordes");

    check(!local.has(phrase), where + ": no se repite dentro de " + level);
    local.add(phrase);

    check(!seen.has(phrase), where + ": no se repite en otro nivel (también está en " + seen.get(phrase) + ")");
    if (!seen.has(phrase)) seen.set(phrase, level);

    all.push(phrase);
  });

  check(local.size === PER_LEVEL, level + ": las " + PER_LEVEL + " frases son únicas (" + local.size + ")");
});

check(all.length === PER_LEVEL * LEVELS.length, "hay " + (PER_LEVEL * LEVELS.length) + " frases en total (" + all.length + ")");
check(seen.size === all.length, "no hay duplicados entre niveles (" + seen.size + " únicas)");

// Mazo: se baraja sin mutar la fuente y se consume sin repetir.
LEVELS.forEach(function (level) {
  const source = data[level];
  const before = source.slice();
  const deck = core.buildDeck(level);

  check(Array.isArray(deck) && deck.length === PER_LEVEL, level + ": el mazo tiene " + PER_LEVEL + " cartas");
  check(deck !== source, level + ": el mazo es un array nuevo");
  check(source.join("\u0000") === before.join("\u0000"), level + ": barajar no muta la fuente");
  check(new Set(deck).size === PER_LEVEL, level + ": el mazo no trae cartas repetidas");
  check(deck.slice().sort().join("\u0000") === source.slice().sort().join("\u0000"), level + ": el mazo conserva todas las frases");
});

// Simulación: 20 partidas completas por nivel, sin una sola repetición.
let runs = 0;
let draws = 0;
let repeated = 0;

LEVELS.forEach(function (level) {
  for (let round = 0; round < 20; round += 1) {
    const run = core.createRun(level);
    const seenCards = new Set();
    let card = run.next();

    while (card !== null) {
      if (seenCards.has(card)) repeated += 1;
      seenCards.add(card);
      draws += 1;
      card = run.next();
    }

    if (seenCards.size !== PER_LEVEL) repeated += 1;
    if (run.drawn !== PER_LEVEL || run.remaining !== 0) repeated += 1;
    if (run.next() !== null) repeated += 1;
    runs += 1;
  }
});

check(repeated === 0, "20 partidas por nivel sin repeticiones ni cartas de más (" + repeated + " fallas)");
check(draws === runs * PER_LEVEL, "se repartieron " + draws + " cartas en " + runs + " partidas");

// El orden barajado no es el orden del archivo (5 intentos, azar real).
let different = false;
for (let attempt = 0; attempt < 5 && !different; attempt += 1) {
  const run = core.createRun("suave");
  const first = run.next();
  if (first !== data.suave[0]) different = true;
}
check(different, "el barajado cambia el orden de salida");

console.log("");
console.log("Frases: " + data.suave.length + " suave + " + data.media.length + " media + " + data.picante.length + " picante = " + all.length + " únicas");
console.log("Mazo: " + runs + " partidas completas, " + draws + " cartas repartidas, 0 repetidas");
console.log(passed + " checks OK, " + failures.length + " fallas");

if (failures.length > 0) {
  process.exitCode = 1;
}
