(function (global) {
  "use strict";

  const MAX_ALL_CARDS = 100;

  function shuffle(items, random) {
    const rnd = typeof random === "function" ? random : Math.random;
    const arr = items.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  function buildDeck(decks, key, random) {
    if (!decks || typeof decks !== "object") return [];
    if (key === "todas") {
      const all = [];
      Object.keys(decks).forEach((deckKey) => {
        const entry = decks[deckKey];
        if (entry && Array.isArray(entry.questions)) {
          entry.questions.forEach((text) => {
            all.push({ cat: deckKey, text: text });
          });
        }
      });
      return shuffle(all, random).slice(0, MAX_ALL_CARDS);
    }
    const deck = decks[key];
    if (!deck || !Array.isArray(deck.questions)) return [];
    return shuffle(deck.questions.map((text) => ({ cat: key, text: text })), random);
  }

  global.EN_PALABRAS_CORE = {
    MAX_ALL_CARDS: MAX_ALL_CARDS,
    shuffle: shuffle,
    buildDeck: buildDeck
  };

  if (typeof document === "undefined") return;

  const DECKS = global.EN_PALABRAS_DECKS;

  if (!DECKS) {
    throw new Error("No se cargaron los mazos: revisá data/decks.js");
  }

  const DECK_META = { todas: { label: "Todos los mazos", color: "#1B1917" } };

  Object.keys(DECKS).forEach((key) => {
    DECK_META[key] = { label: DECKS[key].label, color: DECKS[key].color };
  });

  const DECK_ORDER = Object.keys(DECKS);

const state = {
  deck: "todas",
  queue: [],
  total: 0,
  drawn: 0,
  current: null
};

const viewHome = document.getElementById("viewHome");
const viewGame = document.getElementById("viewGame");
const deckChips = document.getElementById("deckChips");
const startBtn = document.getElementById("startBtn");
const howBtn = document.getElementById("howBtn");
const howDialog = document.getElementById("howDialog");
const closeHowBtn = document.getElementById("closeHowBtn");
const backBtn = document.getElementById("backBtn");
const nextBtn = document.getElementById("nextBtn");
const restartBtn = document.getElementById("restartBtn");
const endHomeBtn = document.getElementById("endHomeBtn");
const gameDeck = document.getElementById("gameDeck");
const gameProgress = document.getElementById("gameProgress");
const progressTrack = document.getElementById("progressTrack");
const progressBar = document.getElementById("progressBar");
const cardEl = document.getElementById("cardEl");
const cardCategory = document.getElementById("cardCategory");
const cardQuestion = document.getElementById("cardQuestion");
const cardCount = document.getElementById("cardCount");
const endPanel = document.getElementById("endPanel");
const cardWrap = document.getElementById("cardWrap");

function buildChips() {
  DECK_ORDER.forEach((key) => {
    const meta = DECK_META[key];
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.style.setProperty("--c", meta.color);

    const dot = document.createElement("span");
    dot.className = "dot";

    const label = document.createElement("span");
    label.textContent = meta.label;

    chip.appendChild(dot);
    chip.appendChild(label);
    chip.addEventListener("click", () => startDeck(key));
    deckChips.appendChild(chip);
  });
}

function showHome() {
  viewGame.hidden = true;
  viewHome.hidden = false;
  window.scrollTo(0, 0);
  startBtn.focus({ preventScroll: true });
}

function startDeck(key) {
  state.deck = key;
  state.queue = buildDeck(DECKS, key);
  state.total = state.queue.length;
  state.drawn = 0;
  state.current = null;

  viewHome.hidden = true;
  viewGame.hidden = false;
  window.scrollTo(0, 0);
  nextCard();
}

function nextCard() {
  if (state.queue.length === 0) {
    showEnd();
    return;
  }

  state.current = state.queue.shift();
  state.drawn += 1;
  renderCard(state.current);
}

function renderCard(card) {
  const meta = DECK_META[card.cat];

  endPanel.hidden = true;
  cardEl.hidden = false;

  cardEl.style.setProperty("--cat", meta.color);
  cardCategory.textContent = meta.label;
  cardQuestion.textContent = card.text;
  cardCount.textContent = "Carta " + state.drawn + " de " + state.total;
  gameDeck.textContent = state.deck === "todas" ? DECK_META.todas.label : DECK_META[state.deck].label;
  gameProgress.textContent = state.drawn + " de " + state.total;

  const pct = Math.round((state.drawn / state.total) * 100);
  progressBar.style.width = pct + "%";
  progressTrack.setAttribute("aria-valuenow", String(pct));

  cardEl.classList.remove("animate-in");
  void cardEl.offsetWidth;
  cardEl.classList.add("animate-in");
}

function showEnd() {
  cardEl.hidden = true;
  endPanel.hidden = false;
  gameProgress.textContent = state.total + " de " + state.total;
  gameDeck.textContent = state.deck === "todas" ? DECK_META.todas.label : DECK_META[state.deck].label;
  progressBar.style.width = "100%";
  progressTrack.setAttribute("aria-valuenow", "100");
  restartBtn.focus({ preventScroll: true });
}

startBtn.addEventListener("click", () => startDeck("todas"));
nextBtn.addEventListener("click", nextCard);
backBtn.addEventListener("click", showHome);
restartBtn.addEventListener("click", () => startDeck(state.deck));
endHomeBtn.addEventListener("click", showHome);

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

// Swipe on touch devices
let touchStartX = 0;
let touchStartY = 0;

cardWrap.addEventListener("touchstart", (event) => {
  const touch = event.changedTouches[0];
  touchStartX = touch.clientX;
  touchStartY = touch.clientY;
}, { passive: true });

cardWrap.addEventListener("touchend", (event) => {
  const touch = event.changedTouches[0];
  const dx = touch.clientX - touchStartX;
  const dy = touch.clientY - touchStartY;
  if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.2) {
    nextCard();
  }
}, { passive: true });

// Keyboard support
document.addEventListener("keydown", (event) => {
  if (howDialog.open || document.querySelector("dialog[open]")) return;
  if (viewGame.hidden) return;

  if (event.key === "ArrowRight") {
    event.preventDefault();
    nextCard();
    return;
  }

  if (event.key === " " && (event.target === document.body || event.target === cardEl)) {
    event.preventDefault();
    nextCard();
    return;
  }

  if (event.key === "Escape") {
    showHome();
  }
});

buildChips();
})(typeof window !== "undefined" ? window : globalThis);
