"use strict";

// Validación del mazo de «Después de las doce».
// Corre con: node test/validate.js  (sin dependencias)

global.window = {};
require("../data/cards.js");

const data = global.window.DESPUES_DATA;
const cards = data.cards;
const finalCards = data.finalCards;

let failures = 0;
let checks = 0;

function check(name, ok, detail) {
  checks += 1;
  if (!ok) {
    failures += 1;
    console.error("✗ " + name + (detail ? " — " + detail : ""));
  } else {
    console.log("✓ " + name);
  }
}

const INTENSITIES = Object.keys(data.intensities);
const TYPES = Object.keys(data.types);
const AUDIENCES = Object.keys(data.audiences);

// 1. Total exacto
check("216 cartas en total", cards.length === 216, "hay " + cards.length);

// 2. Por intensidad: 72 cartas, 24 por tipo, audiences mínimas
INTENSITIES.forEach((intensity) => {
  const byIntensity = cards.filter((c) => c.intensity === intensity);
  check(
    intensity + " tiene 72 cartas",
    byIntensity.length === 72,
    "hay " + byIntensity.length
  );

  TYPES.forEach((type) => {
    const n = byIntensity.filter((c) => c.type === type).length;
    check(intensity + "/" + type + " tiene 24", n === 24, "hay " + n);
  });

  const solo = byIntensity.filter((c) => c.audience === "solo").length;
  const grupo = byIntensity.filter((c) => c.audience === "grupo").length;
  const ambos = byIntensity.filter((c) => c.audience === "ambos").length;
  check(intensity + " tiene >=16 solo", solo >= 16, "hay " + solo);
  check(intensity + " tiene >=16 grupo", grupo >= 16, "hay " + grupo);
  check(intensity + " tiene >=12 ambos", ambos >= 12, "hay " + ambos);
});

// 3. Cero duplicados exactos de texto
const texts = cards.map((c) => c.text);
const seen = new Set();
const dups = new Set();
texts.forEach((t) => {
  if (seen.has(t)) dups.add(t);
  seen.add(t);
});
check(
  "cero duplicados de texto",
  dups.size === 0,
  dups.size > 0 ? "duplicados: " + Array.from(dups).join(" | ") : ""
);

// 4. IDs únicos y campos válidos
const ids = new Set(cards.map((c) => c.id));
check("ids únicos", ids.size === cards.length);

let badField = 0;
cards.forEach((c) => {
  if (!INTENSITIES.includes(c.intensity)) badField += 1;
  if (!TYPES.includes(c.type)) badField += 1;
  if (!AUDIENCES.includes(c.audience)) badField += 1;
  if (typeof c.text !== "string" || c.text.trim() === "") badField += 1;
});
check("campos válidos y texto no vacío en todas", badField === 0, badField + " con problema");

// 5. Sin placeholders/plantillas
const withPlaceholder = cards.filter((c) => c.text.indexOf("{") !== -1 || c.text.indexOf("}") !== -1).length;
check("sin plantillas con placeholders", withPlaceholder === 0);

// 6. El filtro por modo nunca deja un mazo vacío
INTENSITIES.forEach((intensity) => {
  ["duo", "group"].forEach((mode) => {
    const allowed = mode === "duo" ? { solo: true, ambos: true } : { grupo: true, ambos: true };
    const filtered = cards.filter((c) => c.intensity === intensity && allowed[c.audience]);
    check(
      "filtro " + mode + "/" + intensity + " no queda vacío",
      filtered.length > 0,
      "hay " + filtered.length
    );
  });
});

// 7. Hay una carta final por intensidad, y habla en el idioma del modo:
//    la versión de pareja no puede mandar a "elegir a alguien del grupo".
INTENSITIES.forEach((intensity) => {
  const final = finalCards[intensity];
  check("carta final para " + intensity, Boolean(final), final ? "" : "falta");

  ["solo", "grupo"].forEach((mode) => {
    check(
      "carta final " + intensity + "/" + mode + " con texto",
      Boolean(final && typeof final[mode] === "string" && final[mode].trim() !== ""),
      final && final[mode] ? "" : "falta o vacía"
    );
  });

  const solo = (final && final.solo) || "";
  check(
    "carta final " + intensity + "/solo no manda a elegir a nadie",
    !/eleg[ií] a alguien|del grupo|de la ronda/i.test(solo),
    solo ? "dice: " + solo : ""
  );
});

// 8. Ninguna carta elegible en pareja puede pedir una dinámica de grupo.
//    Mismo criterio que la carta final, ahora para todo el mazo: "elegí a
//    alguien", "la persona que elijas", "preguntale a alguien", "alguien de
//    acá" o "a quien más te atrae" necesitan tres personas o más.
const groupMechanics =
  /eleg[ií] a alguien|persona que elijas|preguntale a alguien|alguien de ac[áa]|a qui[eé]n m[áa]s te atrae|alguien del grupo/i;

["solo", "ambos"].forEach((audience) => {
  const leaked = cards.filter((c) => c.audience === audience && groupMechanics.test(c.text));
  check(
    "cartas " + audience + " sin dinámica de grupo",
    leaked.length === 0,
    leaked.map((c) => c.text).join(" | ")
  );
});

console.log("\n" + checks + " chequeos, " + failures + " fallas.");

if (failures > 0) {
  process.exit(1);
}
