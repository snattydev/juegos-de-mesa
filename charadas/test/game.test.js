"use strict";

/*
 * Pruebas de contenido y lógica pura de Charadas. Sin dependencias.
 *   node test/game.test.js
 */

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");

const ROOT = path.join(__dirname, "..");

function loadSandbox() {
  const sandbox = { window: {} };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  const wordsFile = path.join(ROOT, "data", "words.js");
  vm.runInContext(fs.readFileSync(wordsFile, "utf8"), sandbox, { filename: "data/words.js" });
  const appFile = path.join(ROOT, "assets", "app.js");
  vm.runInContext(fs.readFileSync(appFile, "utf8"), sandbox, { filename: "assets/app.js" });
  return {
    data: sandbox.window.CHARADAS_DATA,
    core: sandbox.window.CharadasCore
  };
}

function seeded(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normalize(text) {
  return String(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

let passed = 0;
const failures = [];

function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log("  ok   " + name);
  } catch (error) {
    failures.push({ name, error });
    console.log("  FAIL " + name);
    console.log("       " + String(error && error.message ? error.message : error));
  }
}

const { data: DATA, core: CORE } = loadSandbox();
const REAL = DATA.categories.filter((c) => !c.mixed);
const PER_DECK = 120;

console.log("\nContenido");

check("expone cinco categorías, cuatro reales y Mezcla compuesta", () => {
  assert.ok(DATA && Array.isArray(DATA.categories) && Array.isArray(DATA.items));
  assert.equal(DATA.categories.length, 5);
  assert.equal(REAL.length, 4);
  const mixed = DATA.categories.filter((c) => c.mixed);
  assert.equal(mixed.length, 1);
  assert.equal(mixed[0].id, "mezcla");
});

check("cada categoría real tiene " + PER_DECK + " items y son 480 en total", () => {
  assert.equal(DATA.items.length, 480);
  REAL.forEach((cat) => {
    const count = DATA.items.filter((item) => item.category === cat.id).length;
    assert.equal(count, PER_DECK, cat.id + " tiene " + count);
  });
});

check("ningún item pertenece a Mezcla y todos tienen categoría válida", () => {
  const realIds = new Set(REAL.map((c) => c.id));
  DATA.items.forEach((item) => {
    assert.notEqual(item.category, "mezcla");
    assert.ok(realIds.has(item.category), "categoría desconocida: " + item.category);
    assert.equal(typeof item.text, "string");
    assert.ok(item.text.trim().length > 0);
  });
});

check("no hay duplicados normalizados en los 480 items", () => {
  const seen = new Map();
  const dups = [];
  DATA.items.forEach((item) => {
    const key = normalize(item.text);
    if (seen.has(key)) dups.push(item.text + " (" + item.category + " / " + seen.get(key) + ")");
    else seen.set(key, item.category);
  });
  assert.deepEqual(dups, []);
});

console.log("\nLógica pura");

check("shuffle no muta el array original y conserva los elementos", () => {
  const source = [1, 2, 3, 4, 5, 6];
  const snapshot = source.slice();
  const out = CORE.shuffle(source, seeded(42));
  assert.deepEqual(source, snapshot);
  assert.deepEqual(out.slice().sort(), snapshot.slice().sort());
});

check("buildPool arma 120 items por categoría real y 480 para Mezcla", () => {
  REAL.forEach((cat) => {
    const pool = CORE.buildPool(DATA, cat.id);
    assert.equal(pool.length, 120);
    assert.ok(pool.every((item) => item.category === cat.id));
  });
  const mixed = CORE.buildPool(DATA, "mezcla");
  assert.equal(mixed.length, 480);
});

check("evaluateTilt dispara acierto arriba, paso abajo y bloquea hasta volver al centro", () => {
  const th = CORE.TILT_THRESHOLD;
  const rel = CORE.TILT_RELEASE;

  const neutral = CORE.evaluateTilt(60, 60, false, th, rel);
  assert.deepEqual({ action: neutral.action, locked: neutral.locked }, { action: null, locked: false });

  // Con baseline positivo (60), inclinar hacia arriba baja beta (< 60 - th)
  const hit = CORE.evaluateTilt(60 - th - 5, 60, false, th, rel);
  assert.deepEqual({ action: hit.action, locked: hit.locked }, { action: "hit", locked: true });

  // Mientras sigue inclinado y locked=true no vuelve a disparar
  const stillTilted = CORE.evaluateTilt(60 - th - 10, 60, true, th, rel);
  assert.deepEqual({ action: stillTilted.action, locked: stillTilted.locked }, { action: null, locked: true });

  // Al volver dentro de +-release, destraba sin disparar
  const released = CORE.evaluateTilt(60 - rel + 2, 60, true, th, rel);
  assert.deepEqual({ action: released.action, locked: released.locked }, { action: null, locked: false });

  // Inclinar hacia abajo suma delta > th -> pass
  const pass = CORE.evaluateTilt(60 + th + 5, 60, false, th, rel);
  assert.deepEqual({ action: pass.action, locked: pass.locked }, { action: "pass", locked: true });

  // Con baseline negativo, direction es -1 y mantiene el sentido arriba/abajo
  const negHit = CORE.evaluateTilt(-60 + th + 5, -60, false, th, rel);
  assert.deepEqual({ action: negHit.action, locked: negHit.locked }, { action: "hit", locked: true });
});

console.log("\n" + passed + " pruebas pasaron, " + failures.length + " fallaron.");

if (failures.length > 0) {
  process.exit(1);
}
