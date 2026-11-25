"use strict";

/*
 * Pruebas de contenido y de lógica pura. Sin dependencias.
 *   node test/game.test.js
 */

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert");

const ROOT = path.join(__dirname, "..");
const WHEEL = require(path.join(ROOT, "assets", "wheel.js"));

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

function loadDecks() {
  const sandbox = { window: {} };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  const file = path.join(ROOT, "data", "questions.js");
  vm.runInContext(fs.readFileSync(file, "utf8"), sandbox, { filename: "data/questions.js" });
  return sandbox.window.BOTELLA_DECKS;
}

/* Seeded RNG (mulberry32) para que las pruebas sean reproducibles. */
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

const LEVELS = ["suave", "media", "picante"];
const PER_DECK = 45;

console.log("\nContenido");

const DECKS = loadDecks();

check("expone los tres mazos", () => {
  assert.ok(DECKS, "window.BOTELLA_DECKS no existe");
  LEVELS.forEach((level) => {
    assert.ok(DECKS[level], "falta el mazo " + level);
    assert.ok(Array.isArray(DECKS[level].questions), level + " no tiene questions[]");
    assert.strictEqual(typeof DECKS[level].label, "string");
  });
});

check("cada mazo tiene " + PER_DECK + " preguntas", () => {
  LEVELS.forEach((level) => {
    assert.strictEqual(
      DECKS[level].questions.length,
      PER_DECK,
      level + " tiene " + DECKS[level].questions.length
    );
  });
});

const normalize = (text) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[¿?¡!.,;:…"'()]/g, "")
    .replace(/\s+/g, " ")
    .trim();

check("todas las preguntas son texto con signo de pregunta", () => {
  LEVELS.forEach((level) => {
    DECKS[level].questions.forEach((question, index) => {
      assert.strictEqual(typeof question, "string", level + "[" + index + "] no es string");
      assert.ok(question.trim().length > 0, level + "[" + index + "] está vacía");
      assert.ok(question.endsWith("?"), level + "[" + index + "] no cierra con ?");
      assert.ok(question.length <= 110, level + "[" + index + "] es muy larga: " + question.length);
    });
  });
});

check("sin repeticiones dentro de cada mazo", () => {
  LEVELS.forEach((level) => {
    const seen = new Map();
    DECKS[level].questions.forEach((question) => {
      const key = normalize(question);
      assert.ok(!seen.has(key), "repetida en " + level + ": " + question);
      seen.set(key, true);
    });
  });
});

check("sin repeticiones entre mazos", () => {
  const seen = new Map();
  LEVELS.forEach((level) => {
    DECKS[level].questions.forEach((question) => {
      const key = normalize(question);
      assert.ok(
        !seen.has(key),
        "repetida entre " + seen.get(key) + " y " + level + ": " + question
      );
      seen.set(key, true);
    });
  });
});

check("los mazos no comparten etiqueta", () => {
  const labels = LEVELS.map((level) => DECKS[level].label.toLowerCase());
  assert.strictEqual(new Set(labels).size, labels.length);
});

console.log("\nRueda");

check("pickSector devuelve enteros válidos para 2 a 12 jugadores", () => {
  const rand = seeded(42);
  for (let n = 2; n <= 12; n++) {
    const seen = new Set();
    for (let i = 0; i < 4000; i++) {
      const index = WHEEL.pickSector(n, rand);
      assert.strictEqual(typeof index, "number");
      assert.ok(Number.isInteger(index), "no es entero: " + index);
      assert.ok(index >= 0 && index < n, "fuera de rango con n=" + n + ": " + index);
      seen.add(index);
    }
    assert.strictEqual(seen.size, n, "con n=" + n + " nunca salieron " + (n - seen.size) + " sectores");
  }
});

check("pickSector rechaza menos de 2 jugadores", () => {
  assert.throws(() => WHEEL.pickSector(1), RangeError);
  assert.throws(() => WHEEL.pickSector(0), RangeError);
});

check("rotationFor deja el sector elegido justo bajo el puntero", () => {
  for (let n = 2; n <= 12; n++) {
    let current = 0;
    for (let index = 0; index < n; index++) {
      const next = WHEEL.rotationFor(index, n, 6, current);
      const landing = WHEEL.normalizeAngle(WHEEL.sectorCenter(index, n) + next);
      const delta = Math.min(landing, 360 - landing);
      assert.ok(delta < 1e-9, "n=" + n + " index=" + index + " queda a " + delta + "deg");
      assert.ok(next - current >= 6 * 360 - 1e-9, "n=" + n + " no dio 6 vueltas");
      current = next;
    }
  }
});

check("rotationFor avanza siempre y no repite el ángulo de llegada", () => {
  const rand = seeded(7);
  const n = 7;
  let current = 0;
  const landings = new Set();
  for (let i = 0; i < 50; i++) {
    const index = WHEEL.pickSector(n, rand);
    const next = WHEEL.rotationFor(index, n, 5, current);
    assert.ok(next > current, "la rotación no avanzó");
    landings.add(WHEEL.normalizeAngle(next).toFixed(6));
    current = next;
  }
  assert.ok(landings.size > 1, "siempre cae en el mismo ángulo absoluto");
});

check("shuffle no muta el original y conserva los elementos", () => {
  const source = [1, 2, 3, 4, 5, 6, 7, 8];
  const copy = source.slice();
  const out = WHEEL.shuffle(source, seeded(3));
  assert.deepStrictEqual(source, copy, "mutó el array original");
  assert.deepStrictEqual(out.slice().sort(), copy.slice().sort());
});

console.log("\nMazos");

check("createDeck entrega las 45 sin repetir antes de rebarajar", () => {
  const rand = seeded(11);
  const questions = DECKS.media.questions;
  const deck = WHEEL.createDeck(questions, rand);
  const drawn = [];
  for (let i = 0; i < questions.length; i++) drawn.push(deck.next());
  assert.deepStrictEqual(new Set(drawn).size, questions.length);
  drawn.forEach((question) => assert.ok(questions.indexOf(question) !== -1));
});

check("createDeck rebaraja sin repetir la última pregunta", () => {
  const rand = seeded(19);
  const questions = DECKS.picante.questions;
  const deck = WHEEL.createDeck(questions, rand);
  let previous = null;
  for (let i = 0; i < questions.length * 3; i++) {
    const question = deck.next();
    assert.ok(typeof question === "string" && question.length > 0);
    assert.notStrictEqual(question, previous, "repitió dos veces seguidas en el draw " + i);
    previous = question;
  }
});

check("createDeck con mazo vacío devuelve null", () => {
  const deck = WHEEL.createDeck([], seeded(1));
  assert.strictEqual(deck.next(), null);
});

console.log("");
if (failures.length) {
  console.log("FALLARON " + failures.length + " pruebas, pasaron " + passed + ".");
  process.exit(1);
}
console.log("Todo bien: " + passed + " pruebas.");
