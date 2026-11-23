"use strict";

const DATA = window.DESPUES_DATA;

if (!DATA) {
  throw new Error("No se cargaron las cartas: revisá data/cards.js");
}

const TENSION_STEP = 10;
const STORAGE_KEY = "despues-de-las-doce-group-names";
const MIN_GROUP = 3;
const MAX_GROUP = 8;

const MODE_LABELS = { duo: "Uno a uno", group: "Grupo" };

// ─────────────────────────────── state ───────────────────────────────

const state = {
  mode: "duo",
  intensity: "previa",
  names: [],
  turn: 0,
  pool: [],
  deck: [],
  current: null,
  tension: 0,
  finalReached: false,
  stats: { cumplidas: 0, pasadas: 0, otras: 0, rondas: 0 }
};

let groupNames = [];

// ─────────────────────────────── dom ───────────────────────────────

const $ = (id) => document.getElementById(id);

const viewSetup = $("viewSetup");
const viewGame = $("viewGame");
const viewEnd = $("viewEnd");

const rulesFab = $("rulesFab");
const setupBackBtn = $("setupBackBtn");
const howBtn = $("howBtn");
const startBtn = $("startBtn");

const duoNamesEl = $("duoNames");
const groupNamesEl = $("groupNames");
const duoNameA = $("duoNameA");
const duoNameB = $("duoNameB");
const nameChips = $("nameChips");
const nameInput = $("nameInput");
const addNameBtn = $("addNameBtn");
const nameCount = $("nameCount");
const intensityHint = $("intensityHint");

const gameBackBtn = $("gameBackBtn");
const gameMode = $("gameMode");
const gameTurn = $("gameTurn");
const pickBtn = $("pickBtn");
const tensionTrack = $("tensionTrack");
const tensionFill = $("tensionFill");
const cardEl = $("cardEl");
const cardType = $("cardType");
const cardText = $("cardText");
const cardFlag = $("cardFlag");
const doneBtn = $("doneBtn");
const passBtn = $("passBtn");
const otherBtn = $("otherBtn");

const sumCumplidas = $("sumCumplidas");
const sumPasadas = $("sumPasadas");
const sumOtras = $("sumOtras");
const sumRondas = $("sumRondas");
const againBtn = $("againBtn");
const settingsBtn = $("settingsBtn");

const howDialog = $("howDialog");
const closeHowBtn = $("closeHowBtn");
const rulesDialog = $("rulesDialog");
const closeRulesBtn = $("closeRulesBtn");
const pickDialog = $("pickDialog");
const pickList = $("pickList");
const closePickBtn = $("closePickBtn");

// ─────────────────────────────── utils ───────────────────────────────

function shuffle(items) {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

function show(view) {
  [viewSetup, viewGame, viewEnd].forEach((v) => {
    v.hidden = v !== view;
  });
}

function openDialog(dialog) {
  if (typeof dialog.showModal === "function") {
    dialog.showModal();
  } else {
    dialog.setAttribute("open", "");
  }
}

function closeDialog(dialog) {
  if (typeof dialog.close === "function") {
    dialog.close();
  } else {
    dialog.removeAttribute("open");
  }
}

// ─────────────────────────────── segmented controls ───────────────────────────────

function setupSeg(containerId, onSelect) {
  const container = $(containerId);
  const buttons = Array.from(container.querySelectorAll(".seg-btn"));
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((b) => b.setAttribute("aria-checked", "false"));
      btn.setAttribute("aria-checked", "true");
      onSelect(btn);
    });
  });
}

setupSeg("modeSeg", (btn) => {
  state.mode = btn.dataset.mode;
  const isGroup = state.mode === "group";
  duoNamesEl.hidden = isGroup;
  groupNamesEl.hidden = !isGroup;
  pickBtn.hidden = !isGroup;
  renderNameCount();
});

setupSeg("intensitySeg", (btn) => {
  state.intensity = btn.dataset.intensity;
  intensityHint.textContent = DATA.intensities[state.intensity].tagline + ".";
});

// ─────────────────────────────── group names ───────────────────────────────

function loadGroupNames() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        groupNames = parsed.filter((n) => typeof n === "string" && n.trim() !== "").map((n) => n.trim());
      }
    }
  } catch (e) {
    groupNames = [];
  }
}

function persistGroupNames() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(groupNames));
  } catch (e) {}
}

function addName() {
  const name = nameInput.value.trim();
  if (!name) return;
  if (groupNames.length >= MAX_GROUP) return;
  if (groupNames.some((n) => n.toLowerCase() === name.toLowerCase())) {
    nameInput.value = "";
    return;
  }
  groupNames.push(name);
  nameInput.value = "";
  persistGroupNames();
  renderNameChips();
  nameInput.focus();
}

function removeName(name) {
  groupNames = groupNames.filter((n) => n !== name);
  persistGroupNames();
  renderNameChips();
}

function renderNameChips() {
  nameChips.innerHTML = "";
  groupNames.forEach((name) => {
    const li = document.createElement("li");
    li.className = "name-chip";

    const label = document.createElement("span");
    label.textContent = name;

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "remove";
    remove.setAttribute("aria-label", "Quitar " + name);
    remove.textContent = "×";
    remove.addEventListener("click", () => removeName(name));

    li.appendChild(label);
    li.appendChild(remove);
    nameChips.appendChild(li);
  });
  renderNameCount();
}

function renderNameCount() {
  const total = groupNames.length;
  nameCount.textContent = total + " de " + MAX_GROUP + " · mínimo " + MIN_GROUP;
  nameCount.style.color = total >= MIN_GROUP ? "" : "var(--accent)";
}

addNameBtn.addEventListener("click", addName);
nameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    addName();
  }
});

// ─────────────────────────────── deck ───────────────────────────────

function buildDeck() {
  const allowed = state.mode === "duo"
    ? { solo: true, ambos: true }
    : { grupo: true, ambos: true };

  state.pool = DATA.cards.filter(
    (c) => c.intensity === state.intensity && allowed[c.audience]
  );
  state.deck = shuffle(state.pool);
}

function drawCard() {
  if (state.deck.length === 0) {
    state.deck = shuffle(state.pool);
  }
  state.current = { card: state.deck.shift(), isFinal: false };
  state.stats.rondas += 1;
  renderCard();
}

function drawFinalCard() {
  const final = DATA.finalCards[state.intensity];
  // La carta final se elige por modo: en pareja no puede hablar de "elegir a alguien".
  const text = state.mode === "duo" ? final.solo : final.grupo;
  state.current = {
    card: { intensity: final.intensity, text: text },
    isFinal: true
  };
  state.stats.rondas += 1;
  renderCard();
}

// ─────────────────────────────── turn ───────────────────────────────

function advanceTurn() {
  if (state.names.length === 0) return;
  if (state.mode === "duo") {
    state.turn = (state.turn + 1) % state.names.length;
    return;
  }
  let idx = Math.floor(Math.random() * state.names.length);
  if (state.names.length > 1) {
    while (idx === state.turn) {
      idx = Math.floor(Math.random() * state.names.length);
    }
  }
  state.turn = idx;
}

// ─────────────────────────────── render ───────────────────────────────

function renderCard() {
  const isFinal = state.current.isFinal;
  const card = state.current.card;

  if (isFinal) {
    cardType.textContent = "Carta final";
    cardEl.style.setProperty("--cat", "#C9A15A");
  } else {
    const typeMeta = DATA.types[card.type];
    cardType.textContent = typeMeta.label;
    cardEl.style.setProperty("--cat", typeMeta.color);
  }

  cardText.textContent = card.text;
  cardFlag.hidden = !isFinal;
  otherBtn.hidden = isFinal;

  renderTurn();

  cardEl.classList.remove("animate-in");
  void cardEl.offsetWidth;
  cardEl.classList.add("animate-in");
}

function renderTurn() {
  const name = state.names[state.turn] || "…";
  gameTurn.textContent = "Le toca a " + name;
  gameMode.textContent = MODE_LABELS[state.mode] + " · " + DATA.intensities[state.intensity].label;
}

function updateTension() {
  tensionFill.style.width = state.tension + "%";
  tensionTrack.setAttribute("aria-valuenow", String(state.tension));
}

// ─────────────────────────────── game flow ───────────────────────────────

function startGame() {
  if (state.mode === "group" && groupNames.length < MIN_GROUP) {
    nameInput.focus();
    nameCount.textContent = "Necesitás al menos " + MIN_GROUP + " nombres.";
    return;
  }

  if (state.mode === "duo") {
    state.names = [
      duoNameA.value.trim() || "Vos",
      duoNameB.value.trim() || "Tu pareja"
    ];
  } else {
    state.names = groupNames.slice();
  }

  state.turn = state.mode === "duo"
    ? 0
    : Math.floor(Math.random() * state.names.length);
  state.tension = 0;
  state.finalReached = false;
  state.stats = { cumplidas: 0, pasadas: 0, otras: 0, rondas: 0 };

  buildDeck();
  updateTension();
  show(viewGame);
  drawCard();
}

function resolve(action) {
  if (action === "cumplida") {
    state.stats.cumplidas += 1;
  } else if (action === "pasala") {
    state.stats.pasadas += 1;
  } else {
    state.stats.otras += 1;
  }

  if (action === "otra") {
    drawCard();
    return;
  }

  if (state.current.isFinal) {
    showEnd();
    return;
  }

  advanceTurn();

  if (action === "cumplida") {
    state.tension = Math.min(100, state.tension + TENSION_STEP);
    updateTension();
    if (state.tension >= 100) {
      state.finalReached = true;
      drawFinalCard();
      return;
    }
  }

  drawCard();
}

function showEnd() {
  sumCumplidas.textContent = String(state.stats.cumplidas);
  sumPasadas.textContent = String(state.stats.pasadas);
  sumOtras.textContent = String(state.stats.otras);
  sumRondas.textContent = String(state.stats.rondas);
  show(viewEnd);
}

// ─────────────────────────────── navigation ───────────────────────────────

startBtn.addEventListener("click", startGame);

setupBackBtn.addEventListener("click", () => { document.getElementById("hubFab").click(); });
gameBackBtn.addEventListener("click", () => show(viewSetup));
settingsBtn.addEventListener("click", () => show(viewSetup));
againBtn.addEventListener("click", startGame);

doneBtn.addEventListener("click", () => resolve("cumplida"));
passBtn.addEventListener("click", () => resolve("pasala"));
otherBtn.addEventListener("click", () => resolve("otra"));

// ─────────────────────────────── dialogs ───────────────────────────────

rulesFab.addEventListener("click", () => openDialog(rulesDialog));
closeRulesBtn.addEventListener("click", () => closeDialog(rulesDialog));
howBtn.addEventListener("click", () => openDialog(howDialog));
closeHowBtn.addEventListener("click", () => closeDialog(howDialog));

pickBtn.addEventListener("click", () => {
  pickList.innerHTML = "";
  state.names.forEach((name, index) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pick-item";
    btn.textContent = name;
    btn.addEventListener("click", () => {
      state.turn = index;
      renderTurn();
      closeDialog(pickDialog);
    });
    pickList.appendChild(btn);
  });
  openDialog(pickDialog);
});

closePickBtn.addEventListener("click", () => closeDialog(pickDialog));

// ─────────────────────────────── init ───────────────────────────────

show(viewSetup);
loadGroupNames();
renderNameChips();
intensityHint.textContent = DATA.intensities[state.intensity].tagline + ".";
pickBtn.hidden = true;
