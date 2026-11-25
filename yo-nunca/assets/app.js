"use strict";

(function () {
  const DATA = window.YO_NUNCA_DATA;

  if (!DATA) {
    throw new Error("No se cargaron las frases: revisá data/statements.js");
  }

  const LEVELS = ["suave", "media", "picante"];
  const LEVEL_META = {
    suave: { label: "Suave", note: "Para entrar en calor" },
    media: { label: "Media", note: "Para picantear" },
    picante: { label: "Picante", note: "Sin vueltas" }
  };

  const MIN_PLAYERS = 2;
  const MAX_PLAYERS = 12;
  const MIN_LIVES = 1;
  const MAX_LIVES = 5;
  const DEFAULT_LIVES = 3;
  const NAME_LIMIT = 18;

  const STORE_PLAYERS = "yo-nunca-players";
  const STORE_SETTINGS = "yo-nunca-settings";

  function shuffle(items) {
    const arr = items.slice();
    for (let i = arr.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const swap = arr[i];
      arr[i] = arr[j];
      arr[j] = swap;
    }
    return arr;
  }

  function buildDeck(level) {
    const source = DATA[level];
    if (!Array.isArray(source)) {
      throw new Error("Intensidad desconocida: " + level);
    }
    return shuffle(source);
  }

  // Un mazo se consume de a una carta y nunca repite: cuando llega al final
  // devuelve null. La app y el test usan el mismo objeto.
  function createRun(level) {
    const deck = buildDeck(level);
    let index = 0;

    return {
      total: deck.length,
      get drawn() {
        return index;
      },
      get remaining() {
        return deck.length - index;
      },
      next: function () {
        if (index >= deck.length) return null;
        const card = deck[index];
        index += 1;
        return card;
      }
    };
  }

  window.YO_NUNCA_CORE = { LEVELS: LEVELS, buildDeck: buildDeck, createRun: createRun, shuffle: shuffle };

  // En Node (test/game.test.js) no hay DOM: la lógica del mazo ya quedó exportada.
  if (typeof document === "undefined") return;

  const NS = "http://www.w3.org/2000/svg";

  const state = {
    players: [],
    intensity: "suave",
    lives: DEFAULT_LIVES,
    roster: [],
    run: null,
    card: "",
    lastHit: null,
    playerEls: new Map()
  };

  let nextId = 1;

  const viewSetup = document.getElementById("viewSetup");
  const viewGame = document.getElementById("viewGame");
  const viewEnd = document.getElementById("viewEnd");

  const playersCount = document.getElementById("playersCount");
  const playerForm = document.getElementById("playerForm");
  const playerInput = document.getElementById("playerInput");
  const addPlayerBtn = document.getElementById("addPlayerBtn");
  const formMsg = document.getElementById("formMsg");
  const setupPlayers = document.getElementById("setupPlayers");
  const emptyNote = document.getElementById("emptyNote");
  const levelSeg = document.getElementById("levelSeg");
  const livesSeg = document.getElementById("livesSeg");
  const startBtn = document.getElementById("startBtn");
  const startNote = document.getElementById("startNote");
  const howBtn = document.getElementById("howBtn");

  const backBtn = document.getElementById("backBtn");
  const gameLevel = document.getElementById("gameLevel");
  const gameSub = document.getElementById("gameSub");
  const progressTrack = document.getElementById("progressTrack");
  const progressBar = document.getElementById("progressBar");
  const cardEl = document.getElementById("cardEl");
  const cardLevel = document.getElementById("cardLevel");
  const cardPhrase = document.getElementById("cardPhrase");
  const cardCount = document.getElementById("cardCount");
  const confessCount = document.getElementById("confessCount");
  const playerGrid = document.getElementById("playerGrid");
  const undoBtn = document.getElementById("undoBtn");
  const nextBtn = document.getElementById("nextBtn");

  const endTitle = document.getElementById("endTitle");
  const endText = document.getElementById("endText");
  const survivors = document.getElementById("survivors");
  const againBtn = document.getElementById("againBtn");
  const endHomeBtn = document.getElementById("endHomeBtn");

  const howDialog = document.getElementById("howDialog");
  const closeHowBtn = document.getElementById("closeHowBtn");
  const srStatus = document.getElementById("srStatus");

  function readStore(key) {
    try {
      return localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  function writeStore(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      // Sin almacenamiento: el juego sigue funcionando en memoria.
    }
  }

  function cleanName(raw) {
    return String(raw).replace(/\s+/g, " ").trim().slice(0, NAME_LIMIT);
  }

  function hasName(name) {
    const needle = name.toLowerCase();
    return state.players.some(function (player) {
      return player.name.toLowerCase() === needle;
    });
  }

  function persistPlayers() {
    writeStore(STORE_PLAYERS, JSON.stringify(state.players.map(function (player) {
      return player.name;
    })));
  }

  function persistSettings() {
    writeStore(STORE_SETTINGS, JSON.stringify({
      intensity: state.intensity,
      lives: state.lives
    }));
  }

  function loadStored() {
    const rawPlayers = readStore(STORE_PLAYERS);
    if (rawPlayers) {
      try {
        const list = JSON.parse(rawPlayers);
        if (Array.isArray(list)) {
          list.slice(0, MAX_PLAYERS).forEach(function (value) {
            if (typeof value !== "string") return;
            const name = cleanName(value);
            if (!name || hasName(name)) return;
            state.players.push({ id: nextId, name: name });
            nextId += 1;
          });
        }
      } catch (error) {
        // Datos viejos o rotos: se ignoran.
      }
    }

    const rawSettings = readStore(STORE_SETTINGS);
    if (rawSettings) {
      try {
        const settings = JSON.parse(rawSettings);
        if (LEVELS.indexOf(settings.intensity) !== -1) {
          state.intensity = settings.intensity;
        }
        if (Number.isInteger(settings.lives) && settings.lives >= MIN_LIVES && settings.lives <= MAX_LIVES) {
          state.lives = settings.lives;
        }
      } catch (error) {
        // Datos viejos o rotos: se ignoran.
      }
    }
  }

  function announce(message) {
    if (!srStatus) return;
    srStatus.textContent = "";
    window.setTimeout(function () {
      srStatus.textContent = message;
    }, 30);
  }

  function playerLabel(player) {
    if (player.out) {
      return player.name + ", sin vidas. Espectador.";
    }
    const total = state.lives + (state.lives === 1 ? " vida" : " vidas");
    const lives = player.lives + " de " + total;
    if (player.confessed) {
      return player.name + ", " + lives + ". Ya confesó en esta frase.";
    }
    return player.name + ", " + lives + ". Tocá si hiciste la cosa.";
  }

  function renderHearts(container, player, justLost) {
    container.textContent = "";

    for (let i = 0; i < state.lives; i += 1) {
      const heart = document.createElementNS(NS, "svg");
      heart.setAttribute("class", "heart");
      heart.setAttribute("viewBox", "0 0 24 24");
      heart.setAttribute("aria-hidden", "true");
      heart.setAttribute("focusable", "false");

      if (i >= player.lives) {
        heart.classList.add("is-lost");
      }
      if (justLost && i === player.lives) {
        heart.classList.add("is-breaking");
      }

      const use = document.createElementNS(NS, "use");
      use.setAttribute("href", "#icon-heart");
      heart.appendChild(use);
      container.appendChild(heart);
    }
  }

  function syncPlayer(player, justLost) {
    const el = state.playerEls.get(player.id);
    if (!el) return;

    if (!justLost) {
      el.root.classList.remove("is-hit");
    }

    el.root.classList.toggle("is-confessed", player.confessed);
    el.root.classList.toggle("is-out", player.out);
    el.root.setAttribute("aria-pressed", player.confessed ? "true" : "false");
    el.root.setAttribute("aria-disabled", player.out || player.confessed ? "true" : "false");
    el.root.setAttribute("aria-label", playerLabel(player));
    renderHearts(el.hearts, player, Boolean(justLost));
  }

  /* ---------- Inicio ---------- */

  function setupChip(player) {
    const chip = document.createElement("span");
    chip.className = "pchip";

    const name = document.createElement("span");
    name.className = "pchip-name";
    name.textContent = player.name;

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "pchip-x";
    remove.setAttribute("aria-label", "Quitar a " + player.name);
    remove.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    remove.addEventListener("click", function () {
      removePlayer(player.id);
    });

    chip.appendChild(name);
    chip.appendChild(remove);
    return chip;
  }

  function renderSetup() {
    playersCount.textContent = state.players.length + " / " + MAX_PLAYERS;

    setupPlayers.textContent = "";
    state.players.forEach(function (player) {
      setupPlayers.appendChild(setupChip(player));
    });

    emptyNote.hidden = state.players.length > 0;
    const full = state.players.length >= MAX_PLAYERS;
    playerInput.disabled = full;
    addPlayerBtn.disabled = full;
    playerInput.setAttribute("aria-label", "Nombre del jugador. " + state.players.length + " de " + MAX_PLAYERS + " en la mesa.");

    startBtn.disabled = state.players.length < MIN_PLAYERS;
    if (state.players.length >= MIN_PLAYERS) {
      startNote.textContent = "Un solo dispositivo en la mesa. Sin turnos.";
    } else if (state.players.length === 1) {
      startNote.textContent = "Falta una persona más para empezar.";
    } else {
      startNote.textContent = "Sumá al menos dos jugadores para empezar.";
    }

    Array.prototype.forEach.call(levelSeg.querySelectorAll("[data-level]"), function (button) {
      button.setAttribute("aria-pressed", button.dataset.level === state.intensity ? "true" : "false");
    });

    Array.prototype.forEach.call(livesSeg.querySelectorAll("[data-lives]"), function (button) {
      button.setAttribute("aria-pressed", Number(button.dataset.lives) === state.lives ? "true" : "false");
    });
  }

  function addPlayer(raw) {
    const name = cleanName(raw);
    if (!name) return;

    if (state.players.length >= MAX_PLAYERS) {
      formMsg.textContent = "La mesa está llena: " + MAX_PLAYERS + " jugadores.";
      return;
    }

    if (hasName(name)) {
      formMsg.textContent = "Ese nombre ya está en la mesa.";
      return;
    }

    state.players.push({ id: nextId, name: name });
    nextId += 1;
    formMsg.textContent = "";
    playerInput.value = "";
    persistPlayers();
    renderSetup();
    playerInput.focus({ preventScroll: true });
  }

  function removePlayer(id) {
    state.players = state.players.filter(function (player) {
      return player.id !== id;
    });
    formMsg.textContent = "";
    persistPlayers();
    renderSetup();
  }

  function setIntensity(level) {
    if (LEVELS.indexOf(level) === -1) return;
    state.intensity = level;
    persistSettings();
    renderSetup();
  }

  function setLives(lives) {
    if (lives < MIN_LIVES || lives > MAX_LIVES) return;
    state.lives = lives;
    persistSettings();
    renderSetup();
  }

  /* ---------- Partida ---------- */

  function buildPlayerGrid() {
    playerGrid.textContent = "";
    playerGrid.classList.toggle("is-dense", state.roster.length >= 10);
    state.playerEls = new Map();

    state.roster.forEach(function (player) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "player";
      button.dataset.id = String(player.id);

      const name = document.createElement("span");
      name.className = "player-name";
      name.textContent = player.name;

      const hearts = document.createElement("span");
      hearts.className = "hearts";
      hearts.setAttribute("aria-hidden", "true");

      button.appendChild(name);
      button.appendChild(hearts);
      button.addEventListener("click", function () {
        touchPlayer(player.id);
      });
      button.addEventListener("animationend", function (event) {
        if (event.animationName === "shake") {
          button.classList.remove("is-hit");
        }
      });

      playerGrid.appendChild(button);
      state.playerEls.set(player.id, { root: button, hearts: hearts });
      syncPlayer(player);
    });
  }

  function alivePlayers() {
    return state.roster.filter(function (player) {
      return player.lives > 0;
    });
  }

  function updateHud() {
    const alive = alivePlayers().length;
    const confessed = state.roster.filter(function (player) {
      return player.confessed;
    }).length;

    gameLevel.textContent = LEVEL_META[state.intensity].label;
    gameSub.textContent = alive + " en juego · " + state.lives + (state.lives === 1 ? " vida" : " vidas");

    if (confessed === 0) {
      confessCount.textContent = "Nadie confesó todavía";
    } else if (confessed === 1) {
      confessCount.textContent = "1 confesó";
    } else {
      confessCount.textContent = confessed + " confesaron";
    }

    undoBtn.hidden = !state.lastHit;

    const shouldFinish = alive <= 1 || state.run.remaining === 0;
    nextBtn.textContent = shouldFinish ? "Ver resultado" : "Siguiente frase";
  }

  function updateProgress() {
    const pct = Math.round((state.run.drawn / state.run.total) * 100);
    progressBar.style.width = pct + "%";
    progressTrack.setAttribute("aria-valuenow", String(pct));
    progressTrack.setAttribute("aria-valuetext", state.run.drawn + " de " + state.run.total + " frases");
  }

  function paintCard() {
    const meta = LEVEL_META[state.intensity];
    cardLevel.textContent = meta.label;
    cardLevel.classList.toggle("is-hot", state.intensity === "picante");
    cardPhrase.textContent = state.card;
    cardCount.textContent = "Frase " + state.run.drawn + " de " + state.run.total;

    cardEl.classList.remove("animate-in");
    void cardEl.offsetWidth;
    cardEl.classList.add("animate-in");
  }

  function startGame() {
    if (state.players.length < MIN_PLAYERS) return;

    state.roster = state.players.map(function (player) {
      return {
        id: player.id,
        name: player.name,
        lives: state.lives,
        out: false,
        confessed: false
      };
    });

    state.run = createRun(state.intensity);
    state.card = state.run.next();
    state.lastHit = null;

    buildPlayerGrid();
    paintCard();
    updateHud();
    updateProgress();
    showView("game");
    cardEl.focus({ preventScroll: true });
  }

  function touchPlayer(id) {
    const player = state.roster.find(function (item) {
      return item.id === id;
    });

    if (!player || player.out || player.confessed) return;

    player.confessed = true;
    player.lives = Math.max(0, player.lives - 1);
    if (player.lives === 0) {
      player.out = true;
    }
    state.lastHit = { id: id };

    syncPlayer(player, true);

    const el = state.playerEls.get(player.id);
    if (el) {
      el.root.classList.remove("is-hit");
      void el.root.offsetWidth;
      el.root.classList.add("is-hit");
    }

    updateHud();

    if (player.out) {
      announce(player.name + " se quedó sin vidas y pasa a espectador.");
    } else {
      announce(player.name + " perdió una vida. Le queda " + player.lives + (player.lives === 1 ? " vida." : " vidas."));
    }
  }

  function undoHit() {
    if (!state.lastHit) return;

    const player = state.roster.find(function (item) {
      return item.id === state.lastHit.id;
    });
    state.lastHit = null;

    if (player) {
      player.lives = Math.min(state.lives, player.lives + 1);
      player.confessed = false;
      player.out = false;
      syncPlayer(player);
      announce("Deshecho. " + player.name + " recuperó una vida.");
    }

    updateHud();
  }

  function nextCard() {
    const alive = alivePlayers();

    if (alive.length <= 1) {
      finish();
      return;
    }

    if (state.run.remaining === 0) {
      finish();
      return;
    }

    const card = state.run.next();
    if (card === null) {
      finish();
      return;
    }

    state.card = card;
    state.lastHit = null;
    state.roster.forEach(function (player) {
      player.confessed = false;
    });

    paintCard();
    state.roster.forEach(function (player) {
      syncPlayer(player);
    });
    updateHud();
    updateProgress();
    cardEl.focus({ preventScroll: true });
  }

  /* ---------- Cierre ---------- */

  function survivorChip(player) {
    const chip = document.createElement("span");
    chip.className = "survivor";

    const name = document.createElement("span");
    name.className = "survivor-name";
    name.textContent = player.name;

    const hearts = document.createElement("span");
    hearts.className = "hearts";
    hearts.setAttribute("aria-hidden", "true");
    renderHearts(hearts, player, false);

    chip.appendChild(name);
    chip.appendChild(hearts);
    return chip;
  }

  function finish() {
    const alive = alivePlayers();
    let reason = "deck-empty";

    if (alive.length === 0) {
      reason = "all-out";
    } else if (alive.length === 1) {
      reason = "last-standing";
    }

    const list = document.createElement("div");
    list.className = "survivor-list";

    if (alive.length === 0) {
      endTitle.textContent = "Se terminó la noche";
      endText.textContent = "Nadie quedó con vidas. Se confesaron todo y el juego terminó ahí.";
      survivors.textContent = "";
      const empty = document.createElement("p");
      empty.className = "survivors-empty";
      empty.textContent = "No hubo sobrevivientes.";
      survivors.appendChild(empty);
    } else if (reason === "last-standing") {
      const winner = alive[0];
      endTitle.textContent = "Quedó " + winner.name;
      endText.textContent = "Aguantó hasta el final con " + winner.lives + (winner.lives === 1 ? " vida" : " vidas") + ". No hay premio: solo alivio.";
      survivors.textContent = "";
      alive.forEach(function (player) {
        list.appendChild(survivorChip(player));
      });
      survivors.appendChild(list);
    } else {
      endTitle.textContent = "Se acabaron las frases";
      endText.textContent = "El mazo se terminó antes que las confesiones. Quedaron " + alive.length + (alive.length === 1 ? " persona" : " personas") + " en pie.";
      survivors.textContent = "";
      alive.forEach(function (player) {
        list.appendChild(survivorChip(player));
      });
      survivors.appendChild(list);
    }

    showView("end");
    againBtn.focus({ preventScroll: true });
    announce("Fin de la partida. " + endTitle.textContent + ".");
  }

  /* ---------- Vistas y eventos ---------- */

  function showView(name) {
    viewSetup.hidden = name !== "setup";
    viewGame.hidden = name !== "game";
    viewEnd.hidden = name !== "end";
  }

  function showSetup() {
    renderSetup();
    showView("setup");
    if (startBtn.disabled) {
      playerInput.focus({ preventScroll: true });
    } else {
      startBtn.focus({ preventScroll: true });
    }
  }

  loadStored();
  renderSetup();
  showView("setup");

  playerForm.addEventListener("submit", function (event) {
    event.preventDefault();
    addPlayer(playerInput.value);
  });

  playerInput.addEventListener("input", function () {
    if (formMsg.textContent) formMsg.textContent = "";
  });

  levelSeg.addEventListener("click", function (event) {
    const button = event.target.closest("[data-level]");
    if (!button) return;
    setIntensity(button.dataset.level);
  });

  livesSeg.addEventListener("click", function (event) {
    const button = event.target.closest("[data-lives]");
    if (!button) return;
    setLives(Number(button.dataset.lives));
  });

  startBtn.addEventListener("click", startGame);
  nextBtn.addEventListener("click", nextCard);
  undoBtn.addEventListener("click", undoHit);
  backBtn.addEventListener("click", showSetup);
  againBtn.addEventListener("click", startGame);
  endHomeBtn.addEventListener("click", showSetup);

  howBtn.addEventListener("click", function () {
    if (howDialog.open) return;
    if (typeof howDialog.showModal === "function") {
      howDialog.showModal();
    } else {
      howDialog.setAttribute("open", "");
    }
  });

  closeHowBtn.addEventListener("click", function () {
    if (typeof howDialog.close === "function") {
      howDialog.close();
    } else {
      howDialog.removeAttribute("open");
    }
  });

  howDialog.addEventListener("click", function (event) {
    if (event.target === howDialog) {
      howDialog.close();
    }
  });

  document.addEventListener("keydown", function (event) {
    if (viewGame.hidden) return;
    if (howDialog.open || document.querySelector("dialog[open]")) return;

    const onPlayer = Boolean(event.target && event.target.closest && event.target.closest(".player"));

    if (event.key === "ArrowRight" && !onPlayer) {
      event.preventDefault();
      nextCard();
      return;
    }

    if (event.key === " " && (event.target === document.body || event.target === cardEl)) {
      event.preventDefault();
      nextCard();
    }
  });
})();
