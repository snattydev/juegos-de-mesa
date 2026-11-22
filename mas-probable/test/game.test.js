"use strict";

// Test sin dependencias: node test/game.test.js
// Carga los mismos archivos que el navegador y valida contenido y conteo.

const assert = require("node:assert/strict");
const path = require("node:path");

global.window = global;

require(path.join(__dirname, "..", "data", "prompts.js"));
require(path.join(__dirname, "..", "assets", "app.js"));

const PROMPTS = global.MAS_PROBABLE_DATA;
const logic = global.MAS_PROBABLE_LOGIC;

let passed = 0;

function test(name, run) {
  run();
  passed += 1;
  console.log("ok  " + name);
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return function random() {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function players(ids) {
  return ids.map((id, index) => ({
    id: id,
    name: id.toUpperCase(),
    color: "#000000",
    order: index
  }));
}

console.log("\nMazo de consignas");

test("hay exactamente 100 consignas", () => {
  assert.ok(Array.isArray(PROMPTS), "MAS_PROBABLE_DATA debe ser un array");
  assert.equal(PROMPTS.length, 100);
});

test("las 100 consignas son únicas (aun sin mayúsculas ni acentos)", () => {
  const normalized = PROMPTS.map((prompt) =>
    prompt.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  );
  assert.equal(new Set(PROMPTS).size, 100);
  assert.equal(new Set(normalized).size, 100);
});

test("cada consigna es una frase limpia y completa", () => {
  PROMPTS.forEach((prompt) => {
    assert.equal(typeof prompt, "string");
    assert.equal(prompt, prompt.trim(), "sin espacios en los bordes: " + prompt);
    assert.ok(prompt.length >= 12, "consigna demasiado corta: " + prompt);
    assert.equal(prompt[0], prompt[0].toLowerCase(), "empieza en minúscula: " + prompt);
    assert.ok(!/[.!?]$/.test(prompt), "sin puntuación final: " + prompt);
  });
});

test("no hay contenido sexual explícito ni violento en la lista", () => {
  const banned = [/\bsexo\b/i, /\bsexual/i, /\bcoger\b/i, /\bmatar\b/i, /\bsangre\b/i, /\bdesnud/i, /\bpija\b/i];
  PROMPTS.forEach((prompt) => {
    banned.forEach((pattern) => {
      assert.ok(!pattern.test(prompt), "contenido bloqueado " + pattern + " en: " + prompt);
    });
  });
});

console.log("\nMazo y repeticiones");

test("createDeck devuelve las 100 consignas mezcladas sin mutar el original", () => {
  const original = PROMPTS.slice();
  const deck = logic.createDeck(PROMPTS, seededRandom(2024));

  assert.equal(deck.length, 100);
  assert.equal(new Set(deck).size, 100);
  assert.notDeepEqual(deck, original, "el orden debería cambiar con esta semilla");
  assert.deepEqual(PROMPTS, original, "el mazo original no se toca");
});

test("una partida completa de 100 rondas no repite ninguna consigna", () => {
  const queue = logic.createDeck(PROMPTS, seededRandom(7));
  const seen = new Set();

  for (let round = 0; round < 100; round += 1) {
    assert.ok(queue.length > 0, "el mazo se agotó antes de la ronda " + (round + 1));
    const prompt = queue.shift();
    assert.ok(!seen.has(prompt), "consigna repetida en la ronda " + (round + 1) + ": " + prompt);
    seen.add(prompt);
  }

  assert.equal(queue.length, 0);
  assert.equal(seen.size, 100);
});

test("la mezcla es determinista con la misma semilla", () => {
  const first = logic.createDeck(PROMPTS, seededRandom(99));
  const second = logic.createDeck(PROMPTS, seededRandom(99));
  const other = logic.createDeck(PROMPTS, seededRandom(100));

  assert.deepEqual(first, second);
  assert.notDeepEqual(first, other);
});

console.log("\nConteo de votos");

test("cuenta los votos y ordena de más a menos", () => {
  const group = players(["p1", "p2", "p3", "p4"]);
  const votes = { p1: "p2", p2: "p2", p3: "p4", p4: "p1" };
  const results = logic.countVotes(votes, group);

  assert.deepEqual(
    results.map((row) => [row.id, row.votes]),
    [["p2", 2], ["p1", 1], ["p4", 1], ["p3", 0]]
  );
  assert.deepEqual(logic.topIds(results), ["p2"]);
});

test("un empate devuelve a todos los más votados", () => {
  const group = players(["p1", "p2", "p3", "p4"]);
  const votes = { p1: "p2", p2: "p1", p3: "p2", p4: "p1" };
  const results = logic.countVotes(votes, group);

  assert.equal(results[0].votes, 2);
  assert.equal(results[1].votes, 2);
  assert.deepEqual(logic.topIds(results), ["p1", "p2"]);
});

test("un triple empate también se reparte", () => {
  const group = players(["p1", "p2", "p3"]);
  const votes = { p1: "p1", p2: "p2", p3: "p3" };
  const results = logic.countVotes(votes, group);

  assert.deepEqual(logic.topIds(results), ["p1", "p2", "p3"]);
  assert.deepEqual(logic.addRoundScores({}, results), { p1: 1, p2: 1, p3: 1 });
});

test("los empates conservan el orden de la lista de jugadores", () => {
  const group = players(["p1", "p2", "p3", "p4"]);
  const votes = { p1: "p2", p2: "p1", p3: "p2", p4: "p1" };
  const results = logic.countVotes(votes, group);

  assert.deepEqual(results.map((row) => row.id), ["p1", "p2", "p3", "p4"]);
  assert.deepEqual(logic.topIds(results), ["p1", "p2"]);
  assert.equal(results[2].votes, 0);
});

test("ignora votos de gente que no juega y destinos desconocidos", () => {
  const group = players(["p1", "p2"]);
  const votes = { p1: "fantasma", p2: "p1", intruso: "p2" };
  const results = logic.countVotes(votes, group);

  assert.deepEqual(results.map((row) => [row.id, row.votes]), [["p1", 1], ["p2", 0]]);
  assert.deepEqual(logic.topIds(results), ["p1"]);
});

test("sin votos no hay más votado y el ranking no se mueve", () => {
  const group = players(["p1", "p2", "p3"]);
  const results = logic.countVotes({}, group);

  assert.deepEqual(results.map((row) => row.votes), [0, 0, 0]);
  assert.deepEqual(logic.topIds(results), []);
  assert.deepEqual(logic.addRoundScores({ p1: 2 }, results), { p1: 2 });
});

test("el ranking acumulado suma una vez por ronda y por ganador", () => {
  const group = players(["p1", "p2", "p3"]);

  const roundOne = logic.countVotes({ p1: "p2", p2: "p2", p3: "p1" }, group);
  const afterOne = logic.addRoundScores({}, roundOne);
  assert.deepEqual(afterOne, { p2: 1 });

  const roundTwo = logic.countVotes({ p1: "p1", p2: "p3", p3: "p3" }, group);
  const afterTwo = logic.addRoundScores(afterOne, roundTwo);
  assert.deepEqual(afterTwo, { p2: 1, p3: 1 });

  const ranked = logic.rankScores(afterTwo, group);
  assert.deepEqual(ranked.map((row) => [row.id, row.score]), [["p2", 1], ["p3", 1], ["p1", 0]]);
});

test("rankScores ordena por veces y desempata por orden de lista", () => {
  const group = players(["p1", "p2", "p3"]);
  const ranked = logic.rankScores({ p3: 2, p1: 2, p2: 0 }, group);

  assert.deepEqual(ranked.map((row) => [row.id, row.score]), [["p1", 2], ["p3", 2], ["p2", 0]]);
});

test("singular y plural de votos, y nombres unidos", () => {
  assert.equal(logic.formatVoteCount(0), "0 votos");
  assert.equal(logic.formatVoteCount(1), "1 voto");
  assert.equal(logic.formatVoteCount(5), "5 votos");

  assert.equal(logic.joinNames(["Ana"]), "Ana");
  assert.equal(logic.joinNames(["Ana", "Beto"]), "Ana y Beto");
  assert.equal(logic.joinNames(["Ana", "Beto", "Caro"]), "Ana, Beto y Caro");
});

console.log("\n" + passed + " tests pasaron\n");
