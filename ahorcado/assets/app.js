"use strict";

const DATA = window.AHORCADO_DATA;
const RULES = window.AHORCADO_RULES;

if (!DATA || !Array.isArray(DATA.categories) || !Array.isArray(DATA.items)) {
  throw new Error("No se cargaron las palabras: revisá data/words.js");
}

if (!RULES) {
  throw new Error("No se cargaron las reglas: revisá assets/rules.js");
}

const MAX_MISSES = RULES.MAX_MISSES;
const LETTERS = RULES.LETTERS;
const KEY = {
  theme: "ahorcado-theme",
  deck: "ahorcado-deck",
  best: "ahorcado-best"
};

/* ---------- mazos ---------- */

const DECKS = {};
DATA.categories.forEach((cat) => {
  DECKS[cat.id] = { label: cat.label, color: cat.color, mixed: Boolean(cat.mixed), words: [] };
});

DATA.items.forEach((item) => {
  if (DECKS[item.category]) DECKS[item.category].words.push(item.word);
});

// Mezcla no tiene palabras propias: junta las de los mazos reales.
const ALL_WORDS = DATA.items.map((item) => item.word);
Object.keys(DECKS).forEach((id) => {
  if (DECKS[id].mixed) DECKS[id].words = ALL_WORDS.slice();
});

const DECK_ORDER = DATA.categories.map((cat) => cat.id);
const DEFAULT_DECK = DECK_ORDER.find((id) => DECKS[id].mixed) || DECK_ORDER[0];

/* ---------- estado ---------- */

const state = {
  deck: DEFAULT_DECK,
  queue: [],
  round: null,
  revealed: false,
  streak: 0,
  best: 0
};

/* ---------- DOM ---------- */

const viewHome = document.getElementById("viewHome");
const viewGame = document.getElementById("viewGame");
const deckChips = document.getElementById("deckChips");
const startBtn = document.getElementById("startBtn");
const howBtn = document.getElementById("howBtn");
const howDialog = document.getElementById("howDialog");
const closeHowBtn = document.getElementById("closeHowBtn");
const backBtn = document.getElementById("backBtn");
const gameDeck = document.getElementById("gameDeck");
const gameStreak = document.getElementById("gameStreak");
const wordEl = document.getElementById("wordEl");
const missesEl = document.getElementById("missesEl");
const keyboard = document.getElementById("keyboard");
const board = document.getElementById("board");
const playActions = document.getElementById("playActions");
const giveUpBtn = document.getElementById("giveUpBtn");
const resultPanel = document.getElementById("resultPanel");
const resultTitle = document.getElementById("resultTitle");
const resultText = document.getElementById("resultText");
const nextBtn = document.getElementById("nextBtn");
const changeDeckBtn = document.getElementById("changeDeckBtn");
const recordLine = document.getElementById("recordLine");

/* ---------- utilidades ---------- */

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

function readNumber(key, fallback) {
  try {
    const n = parseInt(localStorage.getItem(key), 10);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  } catch (e) {
    return fallback;
  }
}

function save(key, value) {
  try { localStorage.setItem(key, String(value)); } catch (e) {}
}

/* ---------- inicio ---------- */

function buildChips() {
  DECK_ORDER.forEach((id) => {
    const deck = DECKS[id];
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.dataset.deck = id;
    chip.style.setProperty("--c", deck.color);

    const dot = document.createElement("span");
    dot.className = "dot";

    const label = document.createElement("span");
    label.textContent = deck.label;

    chip.appendChild(dot);
    chip.appendChild(label);
    chip.addEventListener("click", () => selectDeck(id));
    deckChips.appendChild(chip);
  });
}

function selectDeck(id) {
  if (!DECKS[id]) return;
  state.deck = id;
  save(KEY.deck, id);
  syncChips();
}

function syncChips() {
  Array.from(deckChips.children).forEach((chip) => {
    chip.setAttribute("aria-pressed", String(chip.dataset.deck === state.deck));
  });
}

function renderHome() {
  recordLine.textContent = "Racha: " + state.streak + " · Mejor: " + state.best;
}

function showHome() {
  viewGame.hidden = true;
  viewHome.hidden = false;
  window.scrollTo(0, 0);
  renderHome();
  startBtn.focus({ preventScroll: true });
}

/* ---------- partida ---------- */

function startDeck(id) {
  if (!DECKS[id]) return;
  state.deck = id;
  save(KEY.deck, id);
  syncChips();
  state.queue = shuffle(DECKS[id].words);
  viewHome.hidden = true;
  viewGame.hidden = false;
  window.scrollTo(0, 0);
  nextWord();
}

function nextWord() {
  if (state.queue.length === 0) {
    state.queue = shuffle(DECKS[state.deck].words);
  }

  state.round = RULES.start(state.queue.shift());
  state.revealed = false;

  board.classList.remove("is-lost");
  resultPanel.hidden = true;
  keyboard.hidden = false;
  playActions.hidden = false;

  render();
}

function guess(letter) {
  if (!state.round || state.revealed) return;
  if (state.round.status !== "playing") return;

  const next = RULES.guess(state.round, letter);
  if (next.guessed.length === state.round.guessed.length) return;

  state.round = next;
  render();

  if (next.status === "won") planFinish("won");
  else if (next.status === "lost") planFinish("lost");
}

function planFinish(kind) {
  if (kind === "won") {
    state.streak += 1;
    if (state.streak > state.best) {
      state.best = state.streak;
      save(KEY.best, state.best);
    }
  } else {
    state.streak = 0;
    state.revealed = true;
  }

  render();
  showResult(kind);
}

function giveUp() {
  if (!state.round || state.round.status !== "playing" || state.revealed) return;
  state.revealed = true;
  state.streak = 0;
  render();
  showResult("given-up");
}

function showResult(kind) {
  keyboard.hidden = true;
  playActions.hidden = true;
  resultPanel.hidden = false;

  board.classList.toggle("is-lost", kind !== "won");

  const word = state.round.word;
  const wrong = state.round.misses.length;

  if (kind === "won") {
    resultTitle.textContent = state.streak === 1
      ? "¡Salió! Primera de la racha."
      : "¡Salió! Racha de " + state.streak + ".";
    resultText.textContent = "La palabra era " + word + ", con " +
      (wrong === 0 ? "ningún error" : wrong + (wrong === 1 ? " error" : " errores")) + ".";
  } else if (kind === "lost") {
    resultTitle.textContent = "Se terminaron los seis errores.";
    resultText.textContent = "La palabra era " + word + ". La racha vuelve a cero.";
  } else {
    resultTitle.textContent = "La dejaron pasar.";
    resultText.textContent = "La palabra era " + word + ". Rendirse también corta la racha.";
  }

  nextBtn.focus({ preventScroll: true });
}

/* ---------- render ---------- */

function buildKeyboardOnce() {
  if (keyboard.children.length === LETTERS.length) return;

  keyboard.textContent = "";
  LETTERS.forEach((letter) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "key";
    btn.dataset.letter = letter;
    btn.textContent = letter;
    btn.setAttribute("aria-label", "Letra " + letter);
    btn.addEventListener("click", () => guess(letter));
    keyboard.appendChild(btn);
  });
}

function renderKeyboard() {
  buildKeyboardOnce();
  const round = state.round;

  Array.from(keyboard.children).forEach((btn) => {
    const letter = btn.dataset.letter;
    const used = round.guessed.indexOf(letter) !== -1;
    const hit = used && round.word.indexOf(letter) !== -1;

    btn.disabled = used || round.status !== "playing" || state.revealed;
    btn.classList.toggle("is-hit", hit);
    btn.classList.toggle("is-miss", used && !hit);
  });
}

function renderWord() {
  const round = state.round;
  const revealAll = state.revealed || round.status === "lost";

  wordEl.textContent = "";

  RULES.mask(round, revealAll).forEach((slot) => {
    const el = document.createElement("span");
    el.className = "slot";

    if (slot.shown) {
      el.classList.add("shown");
      if (round.guessed.indexOf(slot.letter) === -1) el.classList.add("missing");
      el.textContent = slot.letter;
    } else {
      el.textContent = "\u00A0";
    }

    wordEl.appendChild(el);
  });

  fitWord();

  wordEl.setAttribute("aria-label", "Palabra: " + RULES.mask(round, revealAll)
    .map((slot) => (slot.shown ? slot.letter : "guion"))
    .join(" "));
}

function fitWord() {
  const available = wordEl.clientWidth || 320;
  const n = Math.max(state.round.word.length, 1);
  const emPerLetter = 1.05 * n + 0.14 * (n - 1);
  const size = Math.max(13, Math.min(34, available / emPerLetter));
  wordEl.style.fontSize = size + "px";
}

function render() {
  const round = state.round;

  renderWord();
  renderKeyboard();

  const wrong = round.misses.length;
  missesEl.textContent = wrong === 0
    ? "Sin errores todavía"
    : "Errores " + wrong + " de " + MAX_MISSES + " · " + round.misses.join(" ");

  document.querySelectorAll("#figure .part").forEach((part, index) => {
    part.classList.toggle("on", index < wrong);
  });

  gameDeck.textContent = DECKS[state.deck].label;
  gameStreak.textContent = "Racha " + state.streak;
}

/* ---------- eventos ---------- */

startBtn.addEventListener("click", () => startDeck(state.deck));
backBtn.addEventListener("click", showHome);
giveUpBtn.addEventListener("click", giveUp);
nextBtn.addEventListener("click", nextWord);
changeDeckBtn.addEventListener("click", showHome);

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
  if (event.target === howDialog) closeHowBtn.click();
});

document.addEventListener("keydown", (event) => {
  if (howDialog.open || document.querySelector("dialog[open]")) return;
  if (viewGame.hidden) return;

  if (event.key === "Escape") {
    showHome();
    return;
  }

  if (event.key === " ") return;

  const key = event.key ? event.key.toUpperCase() : "";
  if (key.length === 1 && LETTERS.indexOf(key) !== -1) {
    event.preventDefault();
    guess(key);
  }
});

let resizeTimer = null;
window.addEventListener("resize", () => {
  if (viewGame.hidden || !state.round) return;
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(fitWord, 120);
});

/* ---------- tema ---------- */

const themeToggle = document.getElementById("themeToggle");
const themeColorMeta = document.querySelector('meta[name="theme-color"]');

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
    try { localStorage.setItem(KEY.theme, theme); } catch (e) {}
  }
}

setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light", false);

if (themeToggle) {
  themeToggle.addEventListener("click", () => {
    setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark", true);
  });
}

/* ---------- arranque ---------- */

state.best = readNumber(KEY.best, 0);

let savedDeck = null;
try { savedDeck = localStorage.getItem(KEY.deck); } catch (e) {}
if (savedDeck && DECKS[savedDeck]) state.deck = savedDeck;

buildChips();
syncChips();
renderHome();
