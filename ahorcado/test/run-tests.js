"use strict";

/*
 * Pruebas de contenido y de reglas del Ahorcado. Sin dependencias.
 *   node test/run-tests.js
 */

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert");

const ROOT = path.join(__dirname, "..");
const RULES = require(path.join(ROOT, "assets", "rules.js"));

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

function loadData() {
  const sandbox = { window: {} };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  const file = path.join(ROOT, "data", "words.js");
  vm.runInContext(fs.readFileSync(file, "utf8"), sandbox, { filename: "data/words.js" });
  return sandbox.window.AHORCADO_DATA;
}

const DATA = loadData();
const REAL = DATA.categories.filter((c) => !c.mixed);
const PER_DECK = 40;
const WORD_RE = /^[A-ZÑ]{4,13}$/;

console.log("\nContenido");

check("expone cinco categorías, cuatro reales", () => {
  assert.ok(DATA && Array.isArray(DATA.categories), "window.AHORCADO_DATA no existe");
  assert.strictEqual(DATA.categories.length, 5);
  assert.strictEqual(REAL.length, 4);
});

check("Mezcla está declarada como compuesta, no por su id", () => {
  const mixed = DATA.categories.filter((c) => c.mixed);
  assert.strictEqual(mixed.length, 1);
  assert.strictEqual(mixed[0].id, "mezcla");
});

check("cada categoría real tiene " + PER_DECK + " palabras", () => {
  REAL.forEach((cat) => {
    const words = DATA.items.filter((item) => item.category === cat.id);
    assert.strictEqual(words.length, PER_DECK, cat.id + " tiene " + words.length);
  });
});

check("ninguna palabra pertenece a Mezcla", () => {
  const stray = DATA.items.filter((item) => item.category === "mezcla");
  assert.strictEqual(stray.length, 0);
});

check("todo item tiene categoría existente y palabra", () => {
  const ids = DATA.categories.map((c) => c.id);
  DATA.items.forEach((item) => {
    assert.ok(ids.indexOf(item.category) !== -1, "categoría desconocida: " + item.category);
    assert.strictEqual(typeof item.word, "string");
    assert.ok(item.word.length > 0);
  });
});

check("las palabras son mayúsculas, sin tildes, espacios ni guiones", () => {
  const malas = [];
  DATA.items.forEach((item) => {
    if (!WORD_RE.test(item.word)) malas.push(item.word);
  });
  assert.strictEqual(malas.length, 0, "palabras inválidas: " + malas.join(", "));
});

check("las letras de cada palabra están en el teclado", () => {
  const problemas = [];
  DATA.items.forEach((item) => {
    item.word.split("").forEach((letter) => {
      if (RULES.LETTERS.indexOf(letter) === -1) problemas.push(item.word + " (" + letter + ")");
    });
  });
  assert.deepStrictEqual(problemas, []);
});

check("no hay palabras repetidas dentro de un mazo ni entre mazos", () => {
  const seen = new Map();
  const dup = [];
  DATA.items.forEach((item) => {
    if (seen.has(item.word)) dup.push(item.word);
    seen.set(item.word, item.category);
  });
  assert.deepStrictEqual(dup, []);
});

check("ninguna palabra agota el margen de errores por sí sola", () => {
  /* Peor caso: el jugador prueba letras hasta acertar todas. Si una palabra
     necesita más de seis fallos para resolverse, no se puede ganar nunca. */
  DATA.items.forEach((item) => {
    const word = item.word;
    const letrasPalabra = new Set(word.split(""));
    const letrasFuera = RULES.LETTERS.filter((letter) => !letrasPalabra.has(letter));
    assert.ok(letrasFuera.length >= RULES.MAX_MISSES, word + " deja menos de seis errores posibles");
  });
});

console.log("\nReglas");

check("arranca sin letras usadas ni errores", () => {
  const round = RULES.start("RANA");
  assert.deepStrictEqual(round.guessed, []);
  assert.deepStrictEqual(round.misses, []);
  assert.strictEqual(round.status, "playing");
});

check("acertar no suma errores y destapa la letra", () => {
  const round = RULES.guess(RULES.start("RANA"), "A");
  assert.deepStrictEqual(round.misses, []);
  const shown = RULES.mask(round).map((s) => (s.shown ? s.letter : "_")).join("");
  assert.strictEqual(shown, "_A_A");
});

check("errar suma un error y dibuja una parte", () => {
  const round = RULES.guess(RULES.start("RANA"), "Z");
  assert.deepStrictEqual(round.misses, ["Z"]);
  assert.deepStrictEqual(RULES.mask(round).map((s) => (s.shown ? s.letter : "_")).join(""), "____");
});

check("repetir una letra no cambia nada", () => {
  const first = RULES.guess(RULES.start("RANA"), "Z");
  const again = RULES.guess(first, "Z");
  assert.deepStrictEqual(again, first);
});

check("no acepta caracteres que no son letras del teclado", () => {
  const round = RULES.guess(RULES.start("RANA"), "1");
  assert.deepStrictEqual(round.guessed, []);
  const tilde = RULES.guess(RULES.start("RANA"), "Á");
  assert.deepStrictEqual(tilde.guessed, []);
});

check("no muta la ronda anterior", () => {
  const round = RULES.start("RANA");
  RULES.guess(round, "A");
  assert.deepStrictEqual(round.guessed, []);
});

check("seis errores terminan la partida", () => {
  let round = RULES.start("ZAPALLO");
  ["B", "C", "D", "F", "G", "H"].forEach((letter) => {
    round = RULES.guess(round, letter);
  });
  assert.strictEqual(round.misses.length, RULES.MAX_MISSES);
  assert.strictEqual(round.status, "lost");
});

check("cinco errores todavía dejan jugar", () => {
  let round = RULES.start("ZAPALLO");
  ["B", "C", "D", "F", "G"].forEach((letter) => {
    round = RULES.guess(round, letter);
  });
  assert.strictEqual(round.status, "playing");
});

check("completar todas las letras gana", () => {
  let round = RULES.start("RANA");
  ["R", "A", "N"].forEach((letter) => {
    round = RULES.guess(round, letter);
  });
  assert.strictEqual(round.status, "won");
});

check("una partida terminada ya no acepta letras", () => {
  let round = RULES.start("RANA");
  ["R", "A", "N"].forEach((letter) => {
    round = RULES.guess(round, letter);
  });
  const after = RULES.guess(round, "Z");
  assert.deepStrictEqual(after.guessed, round.guessed);
  assert.deepStrictEqual(after.misses, round.misses);
});

check("la Ñ se juega como letra aparte de la N", () => {
  let round = RULES.start("ARAÑA");
  round = RULES.guess(round, "N");
  assert.deepStrictEqual(RULES.mask(round).map((s) => (s.shown ? s.letter : "_")).join(""), "_____");
  round = RULES.guess(round, "Ñ");
  assert.deepStrictEqual(RULES.mask(round).map((s) => (s.shown ? s.letter : "_")).join(""), "___Ñ_");
});

check("el destape final muestra la palabra entera", () => {
  const round = RULES.start("MEDIALUNA");
  const shown = RULES.mask(round, true).every((s) => s.shown);
  assert.ok(shown);
});

console.log("\n" + passed + " pruebas pasaron, " + failures.length + " fallaron.");

if (failures.length > 0) {
  process.exit(1);
}
