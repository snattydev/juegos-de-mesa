"use strict";

/*
 * Lógica pura de la rueda y de los mazos.
 * Sin DOM: así se puede probar con node (ver test/run-tests.js).
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.BotellaWheel = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function randomFn(rand) {
    return typeof rand === "function" ? rand : Math.random;
  }

  /* Fisher-Yates sobre una copia. */
  function shuffle(items, rand) {
    var r = randomFn(rand);
    var out = items.slice();
    for (var i = out.length - 1; i > 0; i--) {
      var j = Math.floor(r() * (i + 1));
      if (!(j >= 0)) j = 0;
      if (j > i) j = i;
      var tmp = out[i];
      out[i] = out[j];
      out[j] = tmp;
    }
    return out;
  }

  function normalizeAngle(deg) {
    var a = deg % 360;
    return a < 0 ? a + 360 : a;
  }

  function checkCount(playerCount) {
    var n = Math.floor(playerCount);
    if (!isFinite(n) || n < 2) {
      throw new RangeError("Se necesitan al menos 2 jugadores");
    }
    return n;
  }

  /* Índice del sector que queda bajo el puntero. Siempre un entero válido. */
  function pickSector(playerCount, rand) {
    var n = checkCount(playerCount);
    var value = Math.floor(randomFn(rand)() * n);
    if (!isFinite(value)) value = 0;
    return Math.min(Math.max(value, 0), n - 1);
  }

  /* Centro del sector, en grados, medido desde arriba y en sentido horario. */
  function sectorCenter(index, playerCount) {
    var n = checkCount(playerCount);
    var seg = 360 / n;
    return index * seg + seg / 2;
  }

  /*
   * Rotación acumulada para que el centro del sector `index` quede en el
   * puntero (arriba), dando al menos `turns` vueltas desde `current`.
   */
  function rotationFor(index, playerCount, turns, current) {
    var n = checkCount(playerCount);
    var target = normalizeAngle(-sectorCenter(index, n));
    var base = typeof current === "number" && isFinite(current) ? current : 0;
    var minTurns = Math.max(0, Math.floor(typeof turns === "number" ? turns : 0));
    var k = Math.ceil((base + minTurns * 360 - target) / 360);
    var next = k * 360 + target;
    if (next < base) next += 360;
    return next;
  }

  /*
   * Mazo sin repetición: baraja, entrega de a una y rebaraja al agotarse.
   * Si el rebarajado arranca con la misma carta que la última, la corre.
   */
  function createDeck(questions, rand) {
    var source = Array.isArray(questions) ? questions.slice() : [];
    var r = randomFn(rand);
    var queue = [];
    var last = null;

    function refill() {
      queue = shuffle(source, r);
      if (queue.length > 1 && queue[0] === last) {
        var tmp = queue[0];
        queue[0] = queue[1];
        queue[1] = tmp;
      }
    }

    return {
      size: source.length,
      next: function () {
        if (source.length === 0) return null;
        if (queue.length === 0) refill();
        last = queue.shift();
        return last;
      },
      remaining: function () {
        return queue.length;
      },
      reset: function () {
        queue = [];
        last = null;
      }
    };
  }

  return {
    shuffle: shuffle,
    normalizeAngle: normalizeAngle,
    pickSector: pickSector,
    sectorCenter: sectorCenter,
    rotationFor: rotationFor,
    createDeck: createDeck
  };
});
