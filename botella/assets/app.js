"use strict";

(function () {
  var DECKS = window.BOTELLA_DECKS;
  var WHEEL = window.BotellaWheel;

  if (!DECKS) {
    throw new Error("No se cargaron los mazos: revisá data/questions.js");
  }
  if (!WHEEL) {
    throw new Error("No se cargó la lógica de la rueda: revisá assets/wheel.js");
  }

  var LEVELS = ["suave", "media", "picante"];
  var MIN_PLAYERS = 2;
  var MAX_PLAYERS = 12;
  var NAME_MAX = 16;
  var STORE_KEY = "botella-v1";
  var SPIN_MS = 4000;
  var REDUCED_MS = 500;

  var CROSS_SVG =
    '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.8" ' +
    'stroke-linecap="round" aria-hidden="true"><path d="M2.6 2.6l6.8 6.8M9.4 2.6L2.6 9.4"/></svg>';

  var $ = function (id) { return document.getElementById(id); };

  var viewSetup = $("viewSetup");
  var viewGame = $("viewGame");
  var addForm = $("addForm");
  var nameInput = $("nameInput");
  var chipsEl = $("chips");
  var emptyNote = $("emptyNote");
  var nameMsg = $("nameMsg");
  var playersCount = $("playersCount");
  var levelGroup = $("levelGroup");
  var levelHint = $("levelHint");
  var startBtn = $("startBtn");
  var startNote = $("startNote");
  var editBtn = $("editBtn");
  var roundLabel = $("roundLabel");
  var levelTag = $("levelTag");
  var stage = $("stage");
  var wheelWrap = $("wheelWrap");
  var wheelEl = $("wheel");
  var wheelLabels = $("wheelLabels");
  var result = $("result");
  var resultName = $("resultName");
  var qcard = $("qcard");
  var qcardTag = $("qcardLevel");
  var qcardText = $("qcardText");
  var dockSpin = $("dockSpin");
  var dockResult = $("dockResult");
  var spinBtn = $("spinBtn");
  var spinHint = $("spinHint");
  var spinStatus = $("spinStatus");
  var againBtn = $("againBtn");
  var nextQBtn = $("nextQBtn");
  var howDialog = $("howDialog");
  var closeHowBtn = $("closeHowBtn");
  var themeToggle = $("themeToggle");
  var themeColorMeta = document.querySelector('meta[name="theme-color"]');
  var themeSchemeMeta = document.querySelector('meta[name="color-scheme"]');

  var state = {
    players: [],
    level: "suave",
    round: 1,
    rotation: 0,
    spinning: false,
    pendingIndex: -1,
    deck: null,
    turn: ""
  };

  var spinTimer = 0;
  var resizeTimer = 0;

  /* ---------- Utilidades ---------- */

  function round3(value) {
    return Math.round(value * 1000) / 1000;
  }

  function shorten(text, max) {
    if (text.length <= max) return text;
    return text.slice(0, max - 1).trim() + "…";
  }

  function prefersReduced() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  function vibrate(pattern) {
    if (typeof navigator.vibrate === "function") {
      try {
        navigator.vibrate(pattern);
      } catch (error) {
        /* algunos navegadores lo bloquean sin gesto; no es crítico */
      }
    }
  }

  function announce(text) {
    spinStatus.textContent = text;
  }

  /* ---------- Persistencia ---------- */

  function load() {
    var data = null;
    try {
      var raw = window.localStorage.getItem(STORE_KEY);
      if (raw) data = JSON.parse(raw);
    } catch (error) {
      return;
    }
    if (!data || typeof data !== "object") return;

    if (Array.isArray(data.players)) {
      var seen = [];
      data.players.forEach(function (item) {
        if (typeof item !== "string") return;
        var name = item.replace(/\s+/g, " ").trim().slice(0, NAME_MAX);
        if (!name) return;
        if (seen.length >= MAX_PLAYERS) return;
        if (seen.some(function (other) { return other.toLowerCase() === name.toLowerCase(); })) return;
        seen.push(name);
      });
      state.players = seen;
    }

    if (LEVELS.indexOf(data.level) !== -1) {
      state.level = data.level;
    }
  }

  function save() {
    try {
      window.localStorage.setItem(
        STORE_KEY,
        JSON.stringify({ players: state.players, level: state.level })
      );
    } catch (error) {
      /* modo privado o file:// sin almacenamiento: se juega igual */
    }
  }

  /* ---------- Inicio ---------- */

  function renderPlayers() {
    chipsEl.innerHTML = "";

    state.players.forEach(function (name, index) {
      var li = document.createElement("li");
      li.className = "chip";

      var label = document.createElement("span");
      label.className = "chip-name";
      label.textContent = name;

      var remove = document.createElement("button");
      remove.type = "button";
      remove.className = "chip-remove";
      remove.setAttribute("aria-label", "Quitar a " + name);
      remove.innerHTML = CROSS_SVG;
      remove.addEventListener("click", function () {
        removePlayer(index);
      });

      li.appendChild(label);
      li.appendChild(remove);
      chipsEl.appendChild(li);
    });

    playersCount.textContent = state.players.length + " / " + MAX_PLAYERS;
    emptyNote.hidden = state.players.length > 0;

    var ready = state.players.length >= MIN_PLAYERS;
    startBtn.disabled = !ready;
    startNote.textContent = ready
      ? state.players.length + " jugadores en la rueda."
      : "Agregá al menos 2 nombres para empezar.";
  }

  function message(text) {
    nameMsg.textContent = text || "";
  }

  function addPlayer(raw) {
    var name = String(raw == null ? "" : raw).replace(/\s+/g, " ").trim().slice(0, NAME_MAX);
    if (!name) return;

    if (state.players.length >= MAX_PLAYERS) {
      message("Ya son " + MAX_PLAYERS + ". Sacá uno para agregar otro.");
      return;
    }

    var exists = state.players.some(function (other) {
      return other.toLowerCase() === name.toLowerCase();
    });
    if (exists) {
      message("Ese nombre ya está en la rueda.");
      return;
    }

    state.players.push(name);
    nameInput.value = "";
    message("");
    save();
    renderPlayers();
    nameInput.focus({ preventScroll: true });
  }

  function removePlayer(index) {
    var name = state.players[index];
    if (typeof name !== "string") return;
    state.players.splice(index, 1);
    message("");
    save();
    renderPlayers();
    announce(name + " salió de la rueda.");
  }

  function applyLevel() {
    var deck = DECKS[state.level] || DECKS.suave;
    document.documentElement.style.setProperty("--level", deck.color);
    levelHint.textContent = deck.hint;

    var inputs = levelGroup.querySelectorAll("input[name='level']");
    Array.prototype.forEach.call(inputs, function (input) {
      input.checked = input.value === state.level;
    });
  }

  function setLevel(value) {
    if (LEVELS.indexOf(value) === -1) return;
    state.level = value;
    applyLevel();
    save();
  }

  /* ---------- Rueda ---------- */

  function buildWheel() {
    var n = state.players.length;
    if (n < MIN_PLAYERS) return;

    var seg = 360 / n;
    var gap = Math.min(0.5, seg * 0.02);
    var stops = [];

    for (var i = 0; i < n; i++) {
      var start = i * seg;
      var end = (i + 1) * seg;
      var fill = i % 2 === 0 ? "var(--sector-a)" : "var(--sector-b)";
      stops.push(fill + " " + round3(start) + "deg " + round3(end - gap) + "deg");
      stops.push("var(--seam) " + round3(end - gap) + "deg " + round3(end) + "deg");
    }

    wheelEl.style.background = "conic-gradient(from 0deg, " + stops.join(", ") + ")";
    wheelEl.setAttribute(
      "aria-label",
      "Rueda de " + n + " jugadores: " + state.players.join(", ")
    );

    buildLabels();
  }

  /*
   * Las etiquetas se orientan según el ángulo que ocupan en pantalla cuando la
   * rueda está quieta, así el nombre nunca queda cabeza abajo.
   */
  function buildLabels() {
    var n = state.players.length;
    if (n < MIN_PLAYERS) return;

    var width = wheelEl.clientWidth || stage.clientWidth || 300;
    var arc = (2 * Math.PI * 0.4 * width) / n;
    var size = Math.max(8.5, Math.min(width * 0.052, arc * 0.17));
    wheelEl.style.setProperty("--label-size", round3(size) + "px");

    var maxChars = n <= 4 ? 12 : n <= 6 ? 11 : n <= 8 ? 9 : n <= 10 ? 8 : 7;
    var rest = WHEEL.normalizeAngle(state.rotation);

    wheelLabels.innerHTML = "";
    state.players.forEach(function (name, index) {
      var center = WHEEL.sectorCenter(index, n);
      var screenAngle = WHEEL.normalizeAngle(center + rest);
      var flipped = screenAngle > 90 && screenAngle < 270;

      var el = document.createElement("span");
      el.className = "sector-label " + (index % 2 === 0 ? "is-a" : "is-b");
      el.textContent = shorten(name, maxChars);

      var rotate = flipped ? center + 180 : center;
      var shift = flipped
        ? "translateY(var(--label-r))"
        : "translateY(calc(-1 * var(--label-r)))";

      el.style.transform =
        "rotate(" + round3(rotate) + "deg) " + shift + " translateX(-50%) translateY(-50%)";

      wheelLabels.appendChild(el);
    });
  }

  function updateHead() {
    var deck = DECKS[state.level] || DECKS.suave;
    roundLabel.textContent = "Ronda " + state.round;
    levelTag.querySelector("span").textContent = deck.label;
  }

  function showWheel() {
    result.hidden = true;
    wheelWrap.hidden = false;
    dockResult.hidden = true;
    dockSpin.hidden = false;
    spinBtn.removeAttribute("aria-disabled");
    spinHint.textContent = "Que la botella decida.";
  }

  function flashCard() {
    qcard.classList.remove("animate-in");
    void qcard.offsetWidth;
    qcard.classList.add("animate-in");
  }

  function drawQuestion() {
    if (!state.deck) return "";
    return state.deck.next() || "";
  }

  function showResult(name, question) {
    resultName.textContent = name;
    qcardText.textContent = question;
    qcardTag.textContent = (DECKS[state.level] || DECKS.suave).label;

    wheelWrap.hidden = true;
    result.hidden = false;
    dockSpin.hidden = true;
    dockResult.hidden = false;

    flashCard();
    againBtn.focus({ preventScroll: true });
    announce("Le tocó a " + name + ". " + question);
  }

  function finishSpin() {
    if (!state.spinning) return;
    state.spinning = false;

    var index = state.pendingIndex;
    var name = state.players[index] || "";
    state.turn = name;
    state.round += 1;

    vibrate(28);

    /* Reacomoda los nombres según cómo quedó la rueda, antes de ocultarla. */
    buildLabels();

    showResult(name, drawQuestion());
  }

  function spin() {
    if (state.spinning) return;
    if (state.players.length < MIN_PLAYERS) return;

    var n = state.players.length;
    var reduced = prefersReduced();
    var index = WHEEL.pickSector(n);
    var turns = reduced ? 1 : 5 + Math.floor(Math.random() * 3);
    var from = state.rotation;
    var to = WHEEL.rotationFor(index, n, turns, from);
    var duration = reduced ? REDUCED_MS : SPIN_MS + Math.round(Math.random() * 250);
    var wasResult = !dockResult.hidden;

    state.spinning = true;
    state.pendingIndex = index;
    state.rotation = to;

    showWheel();
    updateHead();
    if (wasResult) spinBtn.focus({ preventScroll: true });
    spinBtn.setAttribute("aria-disabled", "true");
    announce("Girando la botella.");
    vibrate(reduced ? 12 : [16, 70, 22]);

    wheelEl.style.transition = "none";
    wheelEl.style.transform = "rotate(" + round3(from) + "deg)";
    void wheelEl.offsetWidth;

    wheelEl.style.transition =
      "transform " + duration + "ms cubic-bezier(0.13, 0.72, 0.1, 1)";
    wheelEl.style.transform = "rotate(" + round3(to) + "deg)";

    window.clearTimeout(spinTimer);
    spinTimer = window.setTimeout(finishSpin, duration + 160);
  }

  function nextQuestion() {
    var question = drawQuestion();
    if (!question) return;
    qcardText.textContent = question;
    flashCard();
    announce("Otra pregunta. " + question);
  }

  /* ---------- Vistas ---------- */

  function startGame() {
    if (state.players.length < MIN_PLAYERS) return;

    window.clearTimeout(spinTimer);
    state.round = 1;
    state.turn = "";
    state.spinning = false;
    state.pendingIndex = -1;
    state.deck = WHEEL.createDeck((DECKS[state.level] || DECKS.suave).questions);

    viewSetup.hidden = true;
    viewGame.hidden = false;

    applyLevel();
    updateHead();
    showWheel();
    buildWheel();

    /* La rueda arranca apuntando al centro del primer sector, no a una unión. */
    state.rotation = -WHEEL.sectorCenter(0, state.players.length);

    wheelEl.style.transition = "none";
    wheelEl.style.transform = "rotate(" + round3(state.rotation) + "deg)";

    window.setTimeout(function () {
      spinBtn.focus({ preventScroll: true });
    }, 80);
  }

  function editPlayers() {
    window.clearTimeout(spinTimer);
    state.spinning = false;

    viewGame.hidden = true;
    viewSetup.hidden = false;
    renderPlayers();

    window.setTimeout(function () {
      if (state.players.length < MIN_PLAYERS) {
        nameInput.focus({ preventScroll: true });
      } else {
        startBtn.focus({ preventScroll: true });
      }
    }, 80);
  }

  /* ---------- Cómo se juega ---------- */

  function openHow() {
    if (typeof howDialog.showModal === "function") {
      howDialog.showModal();
    } else {
      howDialog.setAttribute("open", "");
    }
  }

  function closeHow() {
    if (typeof howDialog.close === "function") {
      howDialog.close();
    } else {
      howDialog.removeAttribute("open");
    }
  }

  /* ---------- Tema ---------- */

  function setTheme(theme, persist) {
    var dark = theme === "dark";

    if (dark) {
      document.documentElement.dataset.theme = "dark";
    } else {
      delete document.documentElement.dataset.theme;
    }

    if (themeColorMeta) {
      themeColorMeta.setAttribute("content", dark ? "#12110F" : "#F6F1E9");
    }
    if (themeSchemeMeta) {
      themeSchemeMeta.setAttribute("content", dark ? "dark" : "light");
    }

    if (themeToggle) {
      themeToggle.setAttribute("aria-pressed", dark ? "true" : "false");
      themeToggle.setAttribute("aria-label", dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro");
    }

    if (persist) {
      try { localStorage.setItem("botella-theme", theme); } catch (error) {}
    }
  }

  /* ---------- Eventos ---------- */

  addForm.addEventListener("submit", function (event) {
    event.preventDefault();
    addPlayer(nameInput.value);
  });

  nameInput.addEventListener("input", function () {
    message("");
  });

  levelGroup.addEventListener("change", function (event) {
    if (event.target && event.target.name === "level") {
      setLevel(event.target.value);
    }
  });

  startBtn.addEventListener("click", startGame);
  editBtn.addEventListener("click", editPlayers);
  spinBtn.addEventListener("click", spin);
  againBtn.addEventListener("click", spin);
  nextQBtn.addEventListener("click", nextQuestion);

  closeHowBtn.addEventListener("click", closeHow);

  if (themeToggle) {
    themeToggle.addEventListener("click", function () {
      setTheme(
        document.documentElement.dataset.theme === "dark" ? "light" : "dark",
        true
      );
    });
  }

  howDialog.addEventListener("click", function (event) {
    if (event.target === howDialog) closeHow();
  });

  Array.prototype.forEach.call(document.querySelectorAll("[data-how]"), function (button) {
    button.addEventListener("click", openHow);
  });

  wheelEl.addEventListener("transitionend", function (event) {
    if (event.target !== wheelEl || event.propertyName !== "transform") return;
    if (!state.spinning) return;
    window.clearTimeout(spinTimer);
    finishSpin();
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && !howDialog.open && !viewGame.hidden && !state.spinning) {
      editPlayers();
    }
  });

  window.addEventListener("resize", function () {
    if (viewGame.hidden || state.spinning) return;
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(buildWheel, 160);
  });

  /* ---------- Arranque ---------- */

  load();
  applyLevel();
  renderPlayers();
  setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light", false);

  if (state.players.length === 0) {
    nameInput.focus({ preventScroll: true });
  }
})();
