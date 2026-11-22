"use strict";

const PROMPTS = window.MAS_PROBABLE_DATA;

if (!Array.isArray(PROMPTS) || PROMPTS.length === 0) {
  throw new Error("No se cargaron las consignas: revisá data/prompts.js");
}

const MIN_PLAYERS = 3;
const MAX_PLAYERS = 12;
const STORAGE_KEY = "mas-probable-players";

const PLAYER_COLORS = [
  "#0F5B62",
  "#B8623A",
  "#6B7F3A",
  "#8E4A5E",
  "#3F5E8C",
  "#A8792B",
  "#5B4A7A",
  "#2E7A63",
  "#8C5A3C",
  "#B0524A",
  "#446B85",
  "#7E6A2F"
];

// ---------- Lógica pura (testeable sin DOM) ----------

function shuffle(items, random) {
  const rnd = random || Math.random;
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

function createDeck(prompts, random) {
  return shuffle(prompts, random);
}

// votes: { [voterId]: targetId }. Devuelve todos los jugadores ordenados
// por votos (de más a menos); los empates conservan el orden de la lista.
function countVotes(votes, players) {
  const tally = {};
  players.forEach((player) => {
    tally[player.id] = 0;
  });

  Object.keys(votes || {}).forEach((voterId) => {
    if (!Object.prototype.hasOwnProperty.call(tally, voterId)) return;
    const target = votes[voterId];
    if (Object.prototype.hasOwnProperty.call(tally, target)) {
      tally[target] += 1;
    }
  });

  return players
    .map((player, index) => ({
      id: player.id,
      name: player.name,
      color: player.color,
      votes: tally[player.id],
      order: index
    }))
    .sort((a, b) => b.votes - a.votes || a.order - b.order);
}

// Todos los que comparten el máximo. Sin votos no hay más votado.
function topIds(results) {
  if (!results || results.length === 0) return [];
  const max = results[0].votes;
  if (max === 0) return [];
  return results.filter((result) => result.votes === max).map((result) => result.id);
}

// En un empate, cada uno de los más votados suma una vez.
function addRoundScores(scores, results) {
  const next = Object.assign({}, scores || {});
  const max = results && results.length ? results[0].votes : 0;

  if (max > 0) {
    results.forEach((result) => {
      if (result.votes === max) {
        next[result.id] = (next[result.id] || 0) + 1;
      }
    });
  }

  return next;
}

function rankScores(scores, players) {
  return players
    .map((player, index) => ({
      id: player.id,
      name: player.name,
      color: player.color,
      score: (scores && scores[player.id]) || 0,
      order: index
    }))
    .sort((a, b) => b.score - a.score || a.order - b.order);
}

function formatVoteCount(count) {
  return count + (count === 1 ? " voto" : " votos");
}

function joinNames(names) {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return names[0] + " y " + names[1];
  return names.slice(0, -1).join(", ") + " y " + names[names.length - 1];
}

window.MAS_PROBABLE_LOGIC = {
  shuffle: shuffle,
  createDeck: createDeck,
  countVotes: countVotes,
  topIds: topIds,
  addRoundScores: addRoundScores,
  rankScores: rankScores,
  formatVoteCount: formatVoteCount,
  joinNames: joinNames
};

// ---------- Interfaz ----------

function init() {
  const viewSetup = document.getElementById("viewSetup");
  const viewRound = document.getElementById("viewRound");
  const viewHandoff = document.getElementById("viewHandoff");
  const viewVote = document.getElementById("viewVote");
  const viewReveal = document.getElementById("viewReveal");
  const viewRanking = document.getElementById("viewRanking");

  const playerInput = document.getElementById("playerInput");
  const addForm = document.getElementById("addForm");
  const addBtn = document.getElementById("addBtn");
  const playerList = document.getElementById("playerList");
  const playerCount = document.getElementById("playerCount");
  const playersHint = document.getElementById("playersHint");
  const setupError = document.getElementById("setupError");
  const startBtn = document.getElementById("startBtn");
  const startHint = document.getElementById("startHint");
  const howBtn = document.getElementById("howBtn");
  const howDialog = document.getElementById("howDialog");
  const closeHowBtn = document.getElementById("closeHowBtn");

  const quitBtn = document.getElementById("quitBtn");
  const rankingBtn = document.getElementById("rankingBtn");
  const roundLabel = document.getElementById("roundLabel");
  const roundSub = document.getElementById("roundSub");
  const promptText = document.getElementById("promptText");
  const roundHint = document.getElementById("roundHint");
  const beginVoteBtn = document.getElementById("beginVoteBtn");

  const handoffKicker = document.getElementById("handoffKicker");
  const handoffName = document.getElementById("handoffName");
  const handoffProgress = document.getElementById("handoffProgress");
  const takePhoneBtn = document.getElementById("takePhoneBtn");
  const takePhoneName = document.getElementById("takePhoneName");

  const voteTurn = document.getElementById("voteTurn");
  const voteProgress = document.getElementById("voteProgress");
  const votePrompt = document.getElementById("votePrompt");
  const nameGrid = document.getElementById("nameGrid");
  const voteSelected = document.getElementById("voteSelected");
  const confirmBtn = document.getElementById("confirmBtn");
  const voteScroll = document.querySelector(".vote-scroll");

  const revealKicker = document.getElementById("revealKicker");
  const revealPrompt = document.getElementById("revealPrompt");
  const revealSummary = document.getElementById("revealSummary");
  const resultsList = document.getElementById("resultsList");
  const nextRoundBtn = document.getElementById("nextRoundBtn");
  const revealRankingBtn = document.getElementById("revealRankingBtn");
  const revealNote = document.getElementById("revealNote");

  const rankingBackBtn = document.getElementById("rankingBackBtn");
  const rankingSub = document.getElementById("rankingSub");
  const rankingList = document.getElementById("rankingList");
  const rankingEmpty = document.getElementById("rankingEmpty");
  const rankingContinueBtn = document.getElementById("rankingContinueBtn");

  const themeToggle = document.getElementById("themeToggle");
  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  const THEME_KEY = "mas-probable-theme";

  function setTheme(theme, persist) {
    const dark = theme === "dark";

    if (dark) {
      document.documentElement.dataset.theme = "dark";
    } else {
      delete document.documentElement.dataset.theme;
    }

    if (themeColorMeta) {
      themeColorMeta.setAttribute("content", dark ? "#12110F" : "#F6F1E9");
    }

    if (themeToggle) {
      themeToggle.setAttribute("aria-pressed", String(dark));
      themeToggle.setAttribute("aria-label", dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro");
    }

    if (persist) {
      try { localStorage.setItem(THEME_KEY, theme); } catch (error) {}
    }
  }

  setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light", false);

  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark", true);
    });
  }

  const state = {
    players: [],
    queue: [],
    total: PROMPTS.length,
    round: 0,
    prompt: "",
    votes: {},
    voterOrder: [],
    voterIndex: 0,
    selected: null,
    locked: false,
    scores: {},
    results: [],
    rankingReturn: "prompt"
  };

  let nextPlayerId = 1;

  function prefersReducedMotion() {
    return Boolean(window.matchMedia) && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function showView(name) {
    const views = {
      setup: viewSetup,
      round: viewRound,
      handoff: viewHandoff,
      vote: viewVote,
      reveal: viewReveal,
      ranking: viewRanking
    };

    Object.keys(views).forEach((key) => {
      views[key].hidden = key !== name;
    });

    window.scrollTo(0, 0);
  }

  function nameOf(playerId) {
    const found = state.players.find((player) => player.id === playerId);
    return found ? found.name : "";
  }

  function makePlayer(name) {
    const used = state.players.map((player) => player.color);
    const free = PLAYER_COLORS.find((color) => used.indexOf(color) === -1);

    return {
      id: "p" + nextPlayerId++,
      name: name,
      color: free || PLAYER_COLORS[state.players.length % PLAYER_COLORS.length]
    };
  }

  function persistPlayers() {
    try {
      const names = state.players.map((player) => player.name);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(names));
    } catch (error) {
      // Sin almacenamiento (modo privado, file:// restringido): seguimos igual.
    }
  }

  function restorePlayers() {
    let names = [];

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) names = parsed;
      }
    } catch (error) {
      names = [];
    }

    const seen = {};
    names
      .filter((name) => typeof name === "string" && name.trim())
      .slice(0, MAX_PLAYERS)
      .forEach((name) => {
        const clean = name.trim();
        const key = clean.toLowerCase();
        if (seen[key]) return;
        seen[key] = true;
        state.players.push(makePlayer(clean));
      });
  }

  function showError(message) {
    setupError.textContent = message;
  }

  function updateSetupState() {
    const count = state.players.length;
    const missing = MIN_PLAYERS - count;

    playerCount.textContent = count + " de " + MAX_PLAYERS;
    startBtn.disabled = missing > 0;

    if (missing > 0) {
      startHint.textContent = missing === 1 ? "Falta 1 jugador." : "Faltan " + missing + " jugadores.";
    } else if (count === MAX_PLAYERS) {
      startHint.textContent = "Cupo completo. Listos para arrancar.";
    } else {
      startHint.textContent = "Listos para arrancar.";
    }

    playerInput.disabled = count >= MAX_PLAYERS;
    addBtn.disabled = count >= MAX_PLAYERS;
    playersHint.hidden = count >= MAX_PLAYERS;
  }

  function renderPlayers() {
    playerList.innerHTML = "";

    state.players.forEach((player) => {
      const item = document.createElement("li");
      item.className = "player-chip";

      const dot = document.createElement("span");
      dot.className = "player-dot";
      dot.style.background = player.color;
      dot.setAttribute("aria-hidden", "true");

      const name = document.createElement("span");
      name.className = "player-name";
      name.textContent = player.name;

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "chip-remove";
      remove.setAttribute("aria-label", "Quitar a " + player.name);
      remove.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
      remove.addEventListener("click", () => {
        state.players = state.players.filter((entry) => entry.id !== player.id);
        persistPlayers();
        renderPlayers();
        showError("");
        playerInput.focus();
      });

      item.appendChild(dot);
      item.appendChild(name);
      item.appendChild(remove);
      playerList.appendChild(item);
    });

    updateSetupState();
  }

  function addPlayer() {
    const name = playerInput.value.trim().replace(/\s+/g, " ");

    if (!name) {
      playerInput.focus();
      return;
    }

    if (state.players.length >= MAX_PLAYERS) {
      showError("El cupo es de 12 jugadores.");
      return;
    }

    const repeated = state.players.some((player) => player.name.toLowerCase() === name.toLowerCase());
    if (repeated) {
      showError("Ya hay alguien con ese nombre.");
      playerInput.select();
      return;
    }

    state.players.push(makePlayer(name));
    playerInput.value = "";
    showError("");
    persistPlayers();
    renderPlayers();
    playerInput.focus();
  }

  function rotate(items, offset) {
    const out = [];
    for (let i = 0; i < items.length; i++) {
      out.push(items[(i + offset) % items.length]);
    }
    return out;
  }

  function startGame() {
    if (state.players.length < MIN_PLAYERS) return;

    state.queue = createDeck(PROMPTS);
    state.total = PROMPTS.length;
    state.round = 0;
    state.prompt = "";
    state.votes = {};
    state.scores = {};
    state.results = [];
    state.selected = null;
    state.locked = false;

    startRound();
  }

  function startRound() {
    if (state.queue.length === 0) {
      showRanking("end");
      return;
    }

    state.prompt = state.queue.shift();
    state.round += 1;
    state.votes = {};
    state.voterOrder = rotate(state.players, (state.round - 1) % state.players.length);
    state.voterIndex = 0;
    state.selected = null;
    state.locked = false;

    renderRound();
    showView("round");
    beginVoteBtn.focus({ preventScroll: true });
  }

  function renderRound() {
    roundLabel.textContent = "Ronda " + state.round;

    const left = state.queue.length;
    if (left === 0) {
      roundSub.textContent = "Última consigna";
    } else if (left === 1) {
      roundSub.textContent = "Queda 1 consigna";
    } else {
      roundSub.textContent = "Quedan " + left + " consignas";
    }

    promptText.textContent = state.prompt;
    roundHint.textContent = state.players.length + " votos en secreto, uno por persona.";
    beginVoteBtn.textContent = "Arrancar la votación";
  }

  function showHandoff() {
    const voter = state.voterOrder[state.voterIndex];

    handoffKicker.textContent = state.voterIndex === 0 ? "Primer voto" : "Voto " + (state.voterIndex + 1);
    handoffName.textContent = voter.name;
    takePhoneName.textContent = voter.name;
    handoffProgress.textContent = "Voto " + (state.voterIndex + 1) + " de " + state.voterOrder.length;
    takePhoneBtn.setAttribute("aria-label", "Soy " + voter.name + ", ir a votar");

    showView("handoff");
    takePhoneBtn.focus({ preventScroll: true });
  }

  function renderNameGrid() {
    nameGrid.innerHTML = "";

    state.players.forEach((player) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "name-btn";
      button.dataset.id = player.id;
      button.setAttribute("aria-pressed", "false");
      button.style.setProperty("--c", player.color);

      const dot = document.createElement("span");
      dot.className = "name-dot";
      dot.setAttribute("aria-hidden", "true");

      const label = document.createElement("span");
      label.className = "name-label";
      label.textContent = player.name;

      button.appendChild(dot);
      button.appendChild(label);
      button.addEventListener("click", () => selectName(player.id));
      nameGrid.appendChild(button);
    });
  }

  function selectName(playerId) {
    if (state.locked) return;

    state.selected = playerId;

    Array.prototype.forEach.call(nameGrid.children, (button) => {
      const isSelected = button.dataset.id === playerId;
      button.classList.toggle("is-selected", isSelected);
      button.setAttribute("aria-pressed", isSelected ? "true" : "false");
    });

    voteSelected.textContent = "Elegiste a " + nameOf(playerId) + ".";
    confirmBtn.disabled = false;
  }

  function showVote() {
    const voter = state.voterOrder[state.voterIndex];

    state.selected = null;
    state.locked = false;

    voteTurn.textContent = "Turno de " + voter.name;
    voteProgress.textContent = "Voto " + (state.voterIndex + 1) + " de " + state.voterOrder.length;
    votePrompt.textContent = "¿Quién es más probable que " + state.prompt + "?";
    voteSelected.textContent = "Tocá un nombre para elegir.";
    confirmBtn.disabled = true;
    confirmBtn.textContent = "Confirmar voto";
    confirmBtn.classList.remove("is-confirmed");

    renderNameGrid();
    showView("vote");
    voteScroll.scrollTop = 0;
    nameGrid.focus({ preventScroll: true });
  }

  function confirmVote() {
    if (!state.selected || state.locked) return;

    const voter = state.voterOrder[state.voterIndex];

    state.locked = true;
    state.votes[voter.id] = state.selected;

    confirmBtn.disabled = true;
    confirmBtn.textContent = "Voto guardado";
    confirmBtn.classList.add("is-confirmed");
    voteSelected.textContent = "Listo. Pasá el celular.";

    Array.prototype.forEach.call(nameGrid.querySelectorAll(".name-btn"), (button) => {
      button.disabled = true;
    });

    const wait = prefersReducedMotion() ? 140 : 460;

    window.setTimeout(() => {
      state.selected = null;
      state.voterIndex += 1;

      if (state.voterIndex < state.voterOrder.length) {
        showHandoff();
      } else {
        revealRound();
      }
    }, wait);
  }

  function renderReveal() {
    const results = state.results;
    const top = topIds(results);
    const maxVotes = results.length ? results[0].votes : 0;
    const totalVoters = state.voterOrder.length || state.players.length || 1;

    revealKicker.textContent = "Resultado de la ronda " + state.round;
    revealPrompt.textContent = "¿Quién es más probable que " + state.prompt + "?";

    if (top.length === 0) {
      revealSummary.textContent = "No se registraron votos.";
    } else if (top.length === 1) {
      revealSummary.textContent = nameOf(top[0]) + " se llevó la ronda con " + formatVoteCount(maxVotes) + ".";
    } else {
      const names = top.map((id) => nameOf(id));
      revealSummary.textContent = "Empataron " + joinNames(names) + " con " + formatVoteCount(maxVotes) + " cada uno.";
    }

    resultsList.classList.remove("is-shown");
    resultsList.innerHTML = "";

    results.forEach((result, index) => {
      const row = document.createElement("li");
      row.className = "result-row" + (top.indexOf(result.id) !== -1 ? " is-top" : "");
      row.style.setProperty("--c", result.color);
      row.style.setProperty("--pct", Math.round((result.votes / totalVoters) * 100) + "%");
      row.style.setProperty("--i", String(index));

      const line = document.createElement("div");
      line.className = "result-line";

      const nameWrap = document.createElement("span");
      nameWrap.className = "result-name";

      const dot = document.createElement("span");
      dot.className = "result-dot";
      dot.setAttribute("aria-hidden", "true");

      const nameText = document.createElement("span");
      nameText.textContent = result.name;

      nameWrap.appendChild(dot);
      nameWrap.appendChild(nameText);

      if (top.indexOf(result.id) !== -1) {
        const badge = document.createElement("span");
        badge.className = "result-badge";
        badge.textContent = top.length > 1 ? "Empate" : "Más votado";
        nameWrap.appendChild(badge);
      }

      const count = document.createElement("span");
      count.className = "result-count";
      count.textContent = formatVoteCount(result.votes);

      const track = document.createElement("div");
      track.className = "result-track";

      const fill = document.createElement("span");
      fill.className = "result-fill";

      track.appendChild(fill);
      line.appendChild(nameWrap);
      line.appendChild(count);
      row.appendChild(line);
      row.appendChild(track);
      resultsList.appendChild(row);
    });

    const isEnd = state.queue.length === 0;
    nextRoundBtn.textContent = isEnd ? "Ver ranking final" : "Siguiente ronda";
    revealRankingBtn.hidden = isEnd;
    revealNote.hidden = !isEnd;

    const showResults = () => resultsList.classList.add("is-shown");

    if (prefersReducedMotion()) {
      showResults();
    } else {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(showResults);
      });
      // Respaldo por si el navegador frena los frames (pestaña en segundo plano).
      window.setTimeout(showResults, 90);
    }
  }

  function revealRound() {
    state.results = countVotes(state.votes, state.players);
    state.scores = addRoundScores(state.scores, state.results);
    renderReveal();
    showView("reveal");
    nextRoundBtn.focus({ preventScroll: true });
  }

  function renderRanking() {
    const rounds = state.round;

    if (rounds === 0) {
      rankingSub.textContent = "Sin rondas jugadas";
    } else if (rounds === 1) {
      rankingSub.textContent = "1 ronda jugada";
    } else {
      rankingSub.textContent = rounds + " rondas jugadas";
    }

    rankingEmpty.hidden = rounds > 0;
    rankingList.hidden = rounds === 0;
    rankingList.innerHTML = "";

    const ranked = rankScores(state.scores, state.players);
    const maxScore = ranked.length ? ranked[0].score : 0;

    ranked.forEach((player, index) => {
      const row = document.createElement("li");
      row.className = "ranking-row" + (player.score > 0 && player.score === maxScore ? " is-leader" : "");

      const position = document.createElement("span");
      position.className = "ranking-pos";
      position.textContent = String(index + 1);

      const dot = document.createElement("span");
      dot.className = "ranking-dot";
      dot.style.background = player.color;
      dot.setAttribute("aria-hidden", "true");

      const name = document.createElement("span");
      name.className = "ranking-name";
      name.textContent = player.name;

      const score = document.createElement("span");
      score.className = "ranking-score";
      score.textContent = player.score + (player.score === 1 ? " vez" : " veces");

      row.appendChild(position);
      row.appendChild(dot);
      row.appendChild(name);
      row.appendChild(score);
      rankingList.appendChild(row);
    });
  }

  function showRanking(returnTo) {
    state.rankingReturn = returnTo || "prompt";
    rankingContinueBtn.textContent = state.rankingReturn === "end" ? "Volver al inicio" : "Seguir jugando";
    renderRanking();
    showView("ranking");
    rankingBackBtn.focus({ preventScroll: true });
  }

  function leaveRanking() {
    if (state.rankingReturn === "end") {
      goHome();
      return;
    }

    if (state.rankingReturn === "reveal") {
      showView("reveal");
      nextRoundBtn.focus({ preventScroll: true });
      return;
    }

    renderRound();
    showView("round");
    beginVoteBtn.focus({ preventScroll: true });
  }

  function goHome() {
    state.queue = [];
    state.round = 0;
    state.prompt = "";
    state.votes = {};
    state.voterOrder = [];
    state.voterIndex = 0;
    state.selected = null;
    state.locked = false;
    state.scores = {};
    state.results = [];

    renderPlayers();
    showView("setup");
    startBtn.focus({ preventScroll: true });
  }

  // ---------- Eventos ----------

  addForm.addEventListener("submit", (event) => {
    event.preventDefault();
    addPlayer();
  });

  playerInput.addEventListener("input", () => {
    if (setupError.textContent) showError("");
  });

  startBtn.addEventListener("click", startGame);
  beginVoteBtn.addEventListener("click", showHandoff);
  takePhoneBtn.addEventListener("click", showVote);
  confirmBtn.addEventListener("click", confirmVote);

  nextRoundBtn.addEventListener("click", () => {
    if (state.queue.length === 0) {
      showRanking("end");
      return;
    }
    startRound();
  });

  revealRankingBtn.addEventListener("click", () => showRanking("reveal"));
  rankingBtn.addEventListener("click", () => showRanking("prompt"));
  rankingBackBtn.addEventListener("click", leaveRanking);
  rankingContinueBtn.addEventListener("click", leaveRanking);

  quitBtn.addEventListener("click", () => {
    if (state.round > 0 && !window.confirm("¿Dejar la partida? Se pierde el ranking de esta partida.")) {
      return;
    }
    goHome();
  });

  howBtn.addEventListener("click", () => {
    if (typeof howDialog.showModal === "function") {
      howDialog.showModal();
    } else {
      howDialog.setAttribute("open", "");
    }
  });

  closeHowBtn.addEventListener("click", () => {
    if (typeof howDialog.close === "function") {
      howDialog.close();
    } else {
      howDialog.removeAttribute("open");
    }
  });

  howDialog.addEventListener("click", (event) => {
    if (event.target === howDialog) {
      if (typeof howDialog.close === "function") {
        howDialog.close();
      } else {
        howDialog.removeAttribute("open");
      }
    }
  });

  restorePlayers();
  renderPlayers();
}

if (typeof document === "undefined") {
  // Entorno de test: solo se usa window.MAS_PROBABLE_LOGIC.
} else if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
