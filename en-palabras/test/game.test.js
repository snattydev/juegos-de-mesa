"use strict";

/*
 * Pruebas de contenido y lógica pura de En Palabras. Sin dependencias.
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
  const decksFile = path.join(ROOT, "data", "decks.js");
  vm.runInContext(fs.readFileSync(decksFile, "utf8"), sandbox, { filename: "data/decks.js" });
  const appFile = path.join(ROOT, "assets", "app.js");
  vm.runInContext(fs.readFileSync(appFile, "utf8"), sandbox, { filename: "assets/app.js" });
  return {
    decks: sandbox.window.EN_PALABRAS_DECKS,
    core: sandbox.window.EN_PALABRAS_CORE
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
    .replace(/[¿?¡!.,;:…"'()]/g, "")
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

const { decks: DECKS, core: CORE } = loadSandbox();
const DECK_KEYS = Object.keys(DECKS);

console.log("\nContenido");

check("expone los cuatro mazos con 40 preguntas cada uno", () => {
  assert.equal(DECK_KEYS.length, 4);
  DECK_KEYS.forEach((key) => {
    assert.equal(typeof DECKS[key].label, "string");
    assert.equal(typeof DECKS[key].color, "string");
    assert.ok(Array.isArray(DECKS[key].questions));
    assert.equal(DECKS[key].questions.length, 40, key + " tiene " + DECKS[key].questions.length);
  });
});

check("todas las cartas son texto válido, con puntuación final y sin placeholders", () => {
  DECK_KEYS.forEach((key) => {
    DECKS[key].questions.forEach((q, idx) => {
      assert.equal(typeof q, "string", key + "[" + idx + "]");
      assert.ok(q.trim().length > 0, key + "[" + idx + "] vacía");
      assert.equal(q, q.trim(), key + "[" + idx + "] espacios en bordes");
      assert.ok(/[.?]$/.test(q), key + "[" + idx + "] sin cierre (. o ?): " + q);
      assert.ok(!/\{\{|\}\}|___|\[[a-z]+\]/i.test(q), key + "[" + idx + "] placeholder: " + q);
    });
  });
});

check("cero duplicados normalizados dentro ni entre mazos", () => {
  const seen = new Map();
  const dups = [];
  DECK_KEYS.forEach((key) => {
    DECKS[key].questions.forEach((q) => {
      const norm = normalize(q);
      if (seen.has(norm)) dups.push(q + " (" + key + " / " + seen.get(norm) + ")");
      else seen.set(norm, key);
    });
  });
  assert.equal(seen.size, 160);
  assert.deepEqual(dups, []);
});

console.log("\nMazos");

check("buildDeck para 'todas' devuelve MAX_ALL_CARDS (100) cartas únicas sin mutar los mazos", () => {
  const before = JSON.stringify(DECKS);
  const deck = CORE.buildDeck(DECKS, "todas", seeded(17));
  assert.equal(deck.length, CORE.MAX_ALL_CARDS);
  assert.equal(new Set(deck.map((c) => c.text)).size, CORE.MAX_ALL_CARDS);
  assert.ok(deck.every((c) => DECK_KEYS.includes(c.cat) && typeof c.text === "string"));
  assert.equal(JSON.stringify(DECKS), before);
});

check("buildDeck para cada mazo individual devuelve sus 40 preguntas únicas", () => {
  DECK_KEYS.forEach((key) => {
    const deck = CORE.buildDeck(DECKS, key, seeded(99));
    assert.equal(deck.length, 40);
    assert.equal(new Set(deck.map((c) => c.text)).size, 40);
    assert.ok(deck.every((c) => c.cat === key && DECKS[key].questions.includes(c.text)));
  });
});

console.log("\n" + passed + " pruebas pasaron, " + failures.length + " fallaron.");

if (failures.length > 0) {
  process.exit(1);
}
