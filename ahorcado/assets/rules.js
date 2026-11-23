/* Reglas del Ahorcado, sin DOM ni almacenamiento: la usa la página y también
   los tests bajo Node. Se exporta como módulo y como global. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.AHORCADO_RULES = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var LETTERS = "ABCDEFGHIJKLMNÑOPQRSTUVWXYZ".split("");
  var MAX_MISSES = 6;

  function start(word) {
    return { word: String(word), guessed: [], misses: [], status: "playing" };
  }

  function clone(round) {
    return {
      word: round.word,
      guessed: round.guessed.slice(),
      misses: round.misses.slice(),
      status: round.status
    };
  }

  function isSolved(round) {
    return round.word.split("").every(function (letter) {
      return round.guessed.indexOf(letter) !== -1;
    });
  }

  /* Devuelve una ronda nueva: nunca muta la que recibe. Una letra ya usada,
     una que no es letra o una ronda terminada dejan todo igual. */
  function guess(round, letter) {
    var next = clone(round);
    if (next.status !== "playing") return next;
    if (LETTERS.indexOf(letter) === -1) return next;
    if (next.guessed.indexOf(letter) !== -1) return next;

    next.guessed.push(letter);

    if (next.word.indexOf(letter) === -1) {
      next.misses.push(letter);
    }

    if (isSolved(next)) {
      next.status = "won";
    } else if (next.misses.length >= MAX_MISSES) {
      next.status = "lost";
    }

    return next;
  }

  /* Una entrada por letra de la palabra; `shown` dice si se destapa. */
  function mask(round, revealAll) {
    return round.word.split("").map(function (letter) {
      return { letter: letter, shown: Boolean(revealAll) || round.guessed.indexOf(letter) !== -1 };
    });
  }

  return {
    LETTERS: LETTERS,
    MAX_MISSES: MAX_MISSES,
    start: start,
    guess: guess,
    mask: mask,
    isSolved: isSolved
  };
});
