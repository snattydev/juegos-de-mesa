(function (global) {
  "use strict";

  const TILT_THRESHOLD = 42;
  const TILT_RELEASE = 12;

  /**
   * Fisher-Yates sobre una copia: el mazo original nunca se toca.
   * Queda expuesto para poder testearlo desde Node sin DOM.
   */
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

  function buildPoolFrom(data, category) {
    if (!data || !Array.isArray(data.categories) || !Array.isArray(data.items)) {
      return [];
    }
    const meta = data.categories.find((cat) => cat.id === category);
    const items = meta && meta.mixed
      ? data.items
      : data.items.filter((item) => item.category === category);
    return items.map((item) => ({ text: item.text, category: item.category }));
  }

  function evaluateTilt(beta, baseline, locked, threshold, release) {
    const th = typeof threshold === "number" ? threshold : TILT_THRESHOLD;
    const rel = typeof release === "number" ? release : TILT_RELEASE;
    if (typeof beta !== "number" || isNaN(beta) || baseline === null || typeof baseline !== "number") {
      return { action: null, locked: Boolean(locked), delta: 0 };
    }

    const direction = baseline >= 0 ? 1 : -1;
    let drift = beta - baseline;
    if (drift > 180) drift -= 360;
    else if (drift < -180) drift += 360;
    const delta = drift * direction;

    if (Math.abs(delta) < rel) {
      return { action: null, locked: false, delta: delta };
    }
    if (locked) {
      return { action: null, locked: true, delta: delta };
    }
    // Inclinar hacia arriba (mentón arriba) = la sacó; hacia abajo = paso.
    if (delta < -th) {
      return { action: "hit", locked: true, delta: delta };
    }
    if (delta > th) {
      return { action: "pass", locked: true, delta: delta };
    }
    return { action: null, locked: false, delta: delta };
  }

  global.CharadasCore = {
    TILT_THRESHOLD: TILT_THRESHOLD,
    TILT_RELEASE: TILT_RELEASE,
    shuffle: shuffle,
    buildPool: buildPoolFrom,
    evaluateTilt: evaluateTilt
  };

  if (typeof document === "undefined") {
    return;
  }

  const DATA = global.CHARADAS_DATA;

  if (!DATA || !Array.isArray(DATA.categories) || !Array.isArray(DATA.items)) {
    throw new Error("No se cargaron las palabras: revisá data/words.js");
  }

  const STORE = {
    theme: "charadas-theme",
    records: "charadas-records",
    setup: "charadas-setup"
  };

  const DURATIONS = [60, 90, 120];
  const RING_CIRCUMFERENCE = 2 * Math.PI * 44;

  const CATEGORY_BY_ID = {};
  DATA.categories.forEach((cat) => { CATEGORY_BY_ID[cat.id] = cat; });

  const state = {
    category: "mezcla",
    duration: 60,
    queue: [],
    index: 0,
    hits: [],
    passes: [],
    playing: false,
    paused: false,
    startedAt: 0,
    elapsedMs: 0,
    rafId: 0,
    lastWhole: null
  };

  const countdown = { token: 0, timer: 0 };

  // ---------- DOM ----------

  const viewSetup = document.getElementById("viewSetup");
  const viewPlay = document.getElementById("viewPlay");
  const viewEnd = document.getElementById("viewEnd");

  const catChips = document.getElementById("catChips");
  const durGroup = document.getElementById("durGroup");
  const recordNote = document.getElementById("recordNote");
  const startBtn = document.getElementById("startBtn");
  const howBtn = document.getElementById("howBtn");
  const howDialog = document.getElementById("howDialog");
  const closeHowBtn = document.getElementById("closeHowBtn");
  const themeToggle = document.getElementById("themeToggle");

  const timerEl = document.getElementById("timer");
  const timerNum = document.getElementById("timerNum");
  const ringFill = document.getElementById("ringFill");
  const scoreNum = document.getElementById("scoreNum");
  const quitBtn = document.getElementById("quitBtn");
  const pauseVeil = document.getElementById("pauseVeil");
  const resumeBtn = document.getElementById("resumeBtn");

  const stage = document.getElementById("stage");
  const stageCat = document.getElementById("stageCat");
  const wordBox = document.getElementById("wordBox");
  const wordEl = document.getElementById("word");
  const tiltLegend = document.getElementById("tiltLegend");

  const hitBtn = document.getElementById("hitBtn");
  const passBtn = document.getElementById("passBtn");

  const countdownEl = document.getElementById("countdown");
  const countNum = document.getElementById("countNum");

  const endNum = document.getElementById("endNum");
  const endRecord = document.getElementById("endRecord");
  const hitList = document.getElementById("hitList");
  const passList = document.getElementById("passList");
  const hitCount = document.getElementById("hitCount");
  const passCount = document.getElementById("passCount");
  const againBtn = document.getElementById("againBtn");
  const adjustBtn = document.getElementById("adjustBtn");

  const sensorRow = document.getElementById("sensorRow");
  const sensorBtn = document.getElementById("sensorBtn");
  const sensorNote = document.getElementById("sensorNote");

  const themeColorMeta = document.querySelector('meta[name="theme-color"]');

  // ---------- Storage ----------

  function readJSON(key, fallback) {
    try {
      const raw = global.localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed === null || parsed === undefined ? fallback : parsed;
    } catch (e) {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      global.localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      /* modo privado o storage lleno: el juego sigue sin récords */
    }
  }

  function readRecords() {
    const raw = readJSON(STORE.records, {});
    const out = {};
    if (!raw || typeof raw !== "object") return out;
    Object.keys(raw).forEach((key) => {
      const value = Number(raw[key]);
      if (isFinite(value) && value > 0) out[key] = Math.floor(value);
    });
    return out;
  }

  function bestFor(category) {
    return readRecords()[category] || 0;
  }

  // ---------- Vistas ----------

  function showView(name) {
    viewSetup.hidden = name !== "setup";
    viewPlay.hidden = name !== "play";
    viewEnd.hidden = name !== "end";
    themeToggle.hidden = name !== "setup";
    if (name === "setup") {
      refreshRecordNote();
    }
  }

  function refreshRecordNote() {
    const best = bestFor(state.category);
    recordNote.textContent = best > 0 ? "Mejor marca: " + best : "Sin marca todavía";
  }

  // ---------- Setup ----------

  function buildCategoryChips() {
    DATA.categories.forEach((cat) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip";
      chip.setAttribute("role", "radio");
      chip.setAttribute("aria-checked", String(cat.id === state.category));
      chip.dataset.category = cat.id;
      chip.style.setProperty("--c", cat.color);

      const dot = document.createElement("span");
      dot.className = "dot";
      dot.setAttribute("aria-hidden", "true");

      const label = document.createElement("span");
      label.textContent = cat.label;

      chip.appendChild(dot);
      chip.appendChild(label);
      chip.addEventListener("click", () => selectCategory(cat.id));
      catChips.appendChild(chip);
    });
  }

  function selectCategory(id) {
    state.category = id;
    Array.prototype.forEach.call(catChips.children, (chip) => {
      chip.setAttribute("aria-checked", String(chip.dataset.category === id));
    });
    refreshRecordNote();
    persistSetup();
  }

  function buildDurations() {
    DURATIONS.forEach((seconds) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "seg-btn";
      btn.setAttribute("role", "radio");
      btn.setAttribute("aria-checked", String(seconds === state.duration));
      btn.dataset.duration = String(seconds);
      btn.textContent = seconds + "s";
      btn.addEventListener("click", () => selectDuration(seconds));
      durGroup.appendChild(btn);
    });
  }

  function selectDuration(seconds) {
    state.duration = seconds;
    Array.prototype.forEach.call(durGroup.children, (btn) => {
      btn.setAttribute("aria-checked", String(Number(btn.dataset.duration) === seconds));
    });
    persistSetup();
  }

  function persistSetup() {
    writeJSON(STORE.setup, { category: state.category, duration: state.duration });
  }

  function restoreSetup() {
    const saved = readJSON(STORE.setup, null);
    if (!saved || typeof saved !== "object") return;
    if (saved.category && CATEGORY_BY_ID[saved.category]) {
      state.category = saved.category;
    }
    const duration = Number(saved.duration);
    if (DURATIONS.indexOf(duration) !== -1) {
      state.duration = duration;
    }
  }

  // ---------- Mazo ----------

  function buildPool(category) {
    return buildPoolFrom(DATA, category);
  }

  function labelOf(category) {
    const cat = CATEGORY_BY_ID[category];
    return cat ? cat.label : "";
  }

  function colorOf(category) {
    const cat = CATEGORY_BY_ID[category];
    return cat ? cat.color : "#1B1917";
  }

  // ---------- Ronda ----------

  function startRound() {
    countdown.token += 1;
    const token = countdown.token;

    state.queue = shuffle(buildPool(state.category));
    state.index = 0;
    state.hits = [];
    state.passes = [];
    state.playing = false;
    state.paused = false;
    state.lastWhole = null;

    showView("play");
    if (pauseVeil) pauseVeil.hidden = true;
    paintScore();
    paintTimer(state.duration);
    wordEl.textContent = "";
    stageCat.textContent = labelOf(state.category);
    stage.style.setProperty("--cat", colorOf(state.category));

    countdownEl.hidden = false;
    countNum.textContent = "3";
    countNum.classList.remove("pop");
    void countNum.offsetWidth;
    countNum.classList.add("pop");

    countdown.timer = global.setTimeout(() => stepCountdown(2, token), 720);
  }

  function stepCountdown(n, token) {
    if (token !== countdown.token) return;

    if (n <= 0) {
      countNum.textContent = "¡Ya!";
      countNum.classList.remove("pop");
      void countNum.offsetWidth;
      countNum.classList.add("pop");
      countdown.timer = global.setTimeout(() => beginPlay(token), 460);
      return;
    }

    countNum.textContent = String(n);
    countNum.classList.remove("pop");
    void countNum.offsetWidth;
    countNum.classList.add("pop");
    countdown.timer = global.setTimeout(() => stepCountdown(n - 1, token), 720);
  }

  function beginPlay(token) {
    if (token !== countdown.token) return;

    countdownEl.hidden = true;
    state.playing = true;
    state.paused = false;
    state.elapsedMs = 0;
    state.startedAt = performance.now();

    nextWord();
    requestWakeLock();

    cancelAnimationFrame(state.rafId);
    state.rafId = requestAnimationFrame(tick);
  }

  function tick() {
    if (!state.playing || state.paused) return;

    state.elapsedMs = performance.now() - state.startedAt;
    const remaining = state.duration - state.elapsedMs / 1000;

    paintTimer(Math.max(0, remaining));

    if (remaining <= 0) {
      finishRound();
      return;
    }

    state.rafId = requestAnimationFrame(tick);
  }

  function paintTimer(remaining) {
    const safe = Math.max(0, Math.min(state.duration, remaining));
    const ratio = state.duration > 0 ? safe / state.duration : 0;

    ringFill.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - ratio));

    const whole = Math.max(0, Math.ceil(safe - 0.0001));
    if (whole !== state.lastWhole) {
      state.lastWhole = whole;
      timerNum.textContent = String(whole);
      timerEl.classList.toggle("is-low", whole <= 10 && state.playing);
    }
  }

  function paintScore() {
    scoreNum.textContent = String(state.hits.length);
  }

  function currentWord() {
    return state.queue[state.index] || null;
  }

  function nextWord() {
    const item = currentWord();
    if (!item) {
      finishRound();
      return;
    }

    wordEl.textContent = item.text.charAt(0).toUpperCase() + item.text.slice(1);
    stageCat.textContent = labelOf(item.category);
    stage.style.setProperty("--cat", colorOf(item.category));

    // El sensor NO se reancla acá: la referencia es la postura neutra de la
    // ronda. Si se reseteara, volver al centro después de un gesto contaría
    // como el gesto contrario.

    wordEl.classList.remove("is-in");
    void wordEl.offsetWidth;
    wordEl.classList.add("is-in");

    fitWord();
  }

  function advance() {
    state.index += 1;

    if (state.index >= state.queue.length) {
      const recent = state.hits.concat(state.passes).slice(-24);
      const seen = {};
      recent.forEach((item) => { seen[item.text] = true; });
      const rest = buildPool(state.category).filter((item) => !seen[item.text]);
      state.queue = shuffle(rest.length ? rest : buildPool(state.category));
      state.index = 0;
    }

    nextWord();
  }

  function markHit() {
    if (!state.playing || state.paused) return;
    const item = currentWord();
    if (!item) return;

    state.hits.push(item);
    paintScore();
    bumpScore();
    flash("hit");
    buzz(16);
    advance();
  }

  function markPass() {
    if (!state.playing || state.paused) return;
    const item = currentWord();
    if (!item) return;

    state.passes.push(item);
    flash("pass");
    buzz(10);
    advance();
  }

  function bumpScore() {
    scoreNum.classList.remove("bump");
    void scoreNum.offsetWidth;
    scoreNum.classList.add("bump");
  }

  function flash(kind) {
    const cls = kind === "hit" ? "flash-hit" : "flash-pass";
    const zone = kind === "hit" ? hitBtn : passBtn;

    stage.classList.remove("flash-hit", "flash-pass");
    void stage.offsetWidth;
    stage.classList.add(cls);

    zone.classList.add("is-pressed");
    global.setTimeout(() => zone.classList.remove("is-pressed"), 130);
    global.setTimeout(() => stage.classList.remove(cls), 520);
  }

  let canVibrate = false;

  function buzz(pattern) {
    try {
      const nav = global.navigator;
      if (!canVibrate || !nav || typeof nav.vibrate !== "function") return;
      nav.vibrate(pattern);
    } catch (e) {
      /* sin vibración, sigue todo igual */
    }
  }

  // Solo vibramos después de un toque real: los navegadores bloquean el resto
  // y ensucian la consola.
  document.addEventListener("pointerdown", () => { canVibrate = true; }, { once: true, capture: true });

  function pauseRound() {
    if (!state.playing || state.paused) return;
    state.paused = true;
    cancelAnimationFrame(state.rafId);
    if (pauseVeil) pauseVeil.hidden = false;
  }

  function resumeRound() {
    if (!state.playing || !state.paused) return;
    state.paused = false;
    if (pauseVeil) pauseVeil.hidden = true;
    state.startedAt = performance.now() - state.elapsedMs;
    state.rafId = requestAnimationFrame(tick);
    requestWakeLock();
  }

  function finishRound() {
    if (viewPlay.hidden) return;

    state.playing = false;
    state.paused = false;
    if (pauseVeil) pauseVeil.hidden = true;
    cancelAnimationFrame(state.rafId);
    countdown.token += 1;
    global.clearTimeout(countdown.timer);
    countdownEl.hidden = true;
    releaseWakeLock();

    const total = state.hits.length;
    const previous = bestFor(state.category);

    if (total > 0 && total > previous) {
      const records = readRecords();
      records[state.category] = total;
      writeJSON(STORE.records, records);
    }

    endNum.textContent = String(total);
    hitCount.textContent = String(state.hits.length);
    passCount.textContent = String(state.passes.length);

    renderList(hitList, state.hits, "Ninguna");
    renderList(passList, state.passes, "Ninguna");

    endRecord.classList.remove("is-new");
    if (total > 0 && total > previous) {
      endRecord.textContent = previous > 0
        ? "¡Nuevo récord! Antes: " + previous
        : "¡Primera marca de esta categoría!";
      endRecord.classList.add("is-new");
    } else if (previous > 0) {
      endRecord.textContent = "Mejor marca: " + previous;
    } else {
      endRecord.textContent = "Todavía no hay marca en esta categoría.";
    }

    showView("end");
    buzz([20, 60, 20]);
    againBtn.focus({ preventScroll: true });
  }

  function renderList(listEl, items, emptyText) {
    listEl.textContent = "";
    if (!items.length) {
      const li = document.createElement("li");
      li.className = "result-empty";
      li.textContent = emptyText;
      listEl.appendChild(li);
      return;
    }

    const fragment = document.createDocumentFragment();
    items.forEach((item) => {
      const li = document.createElement("li");
      li.textContent = item.text;
      fragment.appendChild(li);
    });
    listEl.appendChild(fragment);
  }

  function quitRound() {
    if (!viewPlay.hidden) {
      if (!state.playing) {
        // Estaba en la cuenta regresiva: no hay ronda que mostrar.
        countdown.token += 1;
        global.clearTimeout(countdown.timer);
        countdownEl.hidden = true;
        showView("setup");
        startBtn.focus({ preventScroll: true });
        return;
      }
      finishRound();
      return;
    }
    showView("setup");
  }

  // ---------- Ajuste del texto ----------

  function fitWord() {
    const text = wordEl.textContent;
    if (!text) return;

    const box = wordBox.getBoundingClientRect();
    if (box.height < 40 || box.width < 40) return;

    wordEl.style.fontSize = "";

    const base = parseFloat(global.getComputedStyle(wordEl).fontSize) || 40;
    let lo = 16;
    let hi = Math.max(base, Math.min(150, box.height));

    const fits = function () {
      const rect = wordEl.getBoundingClientRect();
      return rect.height <= box.height - 2 && wordEl.scrollWidth <= box.width + 1;
    };

    wordEl.style.fontSize = hi + "px";
    if (fits()) {
      wordEl.style.fontSize = Math.floor(hi) + "px";
      return;
    }

    for (let i = 0; i < 9; i++) {
      const mid = (lo + hi) / 2;
      wordEl.style.fontSize = mid + "px";
      if (fits()) {
        lo = mid;
      } else {
        hi = mid;
      }
    }

    wordEl.style.fontSize = Math.floor(lo) + "px";
  }

  // ---------- Sensor de inclinación ----------

  const sensor = {
    supported: typeof global.DeviceOrientationEvent !== "undefined",
    enabled: false,
    seen: false,
    baseline: null,
    locked: false,
    watchdog: 0
  };

  function tiltSupported() {
    if (!sensor.supported) return false;
    try {
      return global.matchMedia("(pointer: coarse)").matches || ("ontouchstart" in global);
    } catch (e) {
      return true;
    }
  }

  function showSensorNote(text) {
    if (!text) {
      sensorNote.hidden = true;
      sensorNote.textContent = "";
      return;
    }
    sensorNote.textContent = text;
    sensorNote.hidden = false;
  }

  function paintSensor() {
    sensorBtn.setAttribute("aria-checked", String(sensor.enabled));
    tiltLegend.hidden = !sensor.enabled;
  }

  async function enableSensor() {
    if (!sensor.supported || sensor.enabled) return;

    try {
      if (typeof global.DeviceOrientationEvent.requestPermission === "function") {
        const answer = await global.DeviceOrientationEvent.requestPermission();
        if (answer !== "granted") {
          showSensorNote("Sin permiso no hay sensor. Los botones funcionan igual.");
          return;
        }
      }

      global.addEventListener("deviceorientation", onTilt);
      sensor.enabled = true;
      sensor.seen = false;
      paintSensor();
      showSensorNote("");

      global.clearTimeout(sensor.watchdog);
      sensor.watchdog = global.setTimeout(() => {
        if (!sensor.seen) {
          disableSensor("Este dispositivo no manda datos del sensor. Jugá con los botones.");
          return;
        }
        showSensorNote("Listo: arriba suma acierto, abajo pasa la palabra.");
      }, 1500);
    } catch (e) {
      disableSensor("No pudimos activar el sensor. Jugá con los botones.");
    }
  }

  function disableSensor(message) {
    global.removeEventListener("deviceorientation", onTilt);
    global.clearTimeout(sensor.watchdog);
    sensor.enabled = false;
    sensor.baseline = null;
    sensor.locked = false;
    paintSensor();
    showSensorNote(message || "");
  }

  function onTilt(event) {
    if (typeof event.beta !== "number" || isNaN(event.beta)) return;
    sensor.seen = true;

    if (!state.playing || state.paused) {
      sensor.baseline = null;
      return;
    }

    if (sensor.baseline === null) {
      sensor.baseline = event.beta;
      sensor.locked = false;
      return;
    }

    const res = evaluateTilt(event.beta, sensor.baseline, sensor.locked, TILT_THRESHOLD, TILT_RELEASE);
    sensor.locked = res.locked;

    if (res.action === "hit") {
      markHit();
      return;
    }

    if (res.action === "pass") {
      markPass();
    }
  }

  // ---------- Wake Lock ----------

  let wakeLock = null;

  async function requestWakeLock() {
    try {
      if (!("wakeLock" in global.navigator)) return;
      if (document.visibilityState !== "visible") return;
      wakeLock = await global.navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", () => { wakeLock = null; });
    } catch (e) {
      wakeLock = null;
    }
  }

  function releaseWakeLock() {
    try {
      if (wakeLock && typeof wakeLock.release === "function") {
        wakeLock.release();
      }
    } catch (e) {
      /* nada que liberar */
    }
    wakeLock = null;
  }

  // ---------- Tema ----------

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

    themeToggle.setAttribute("aria-pressed", String(dark));
    themeToggle.setAttribute("aria-label", dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro");

    if (persist) {
      try { global.localStorage.setItem(STORE.theme, theme); } catch (e) {}
    }
  }

  // ---------- Eventos ----------

  startBtn.addEventListener("click", startRound);
  hitBtn.addEventListener("click", markHit);
  if (resumeBtn) resumeBtn.addEventListener("click", resumeRound);
  passBtn.addEventListener("click", markPass);
  quitBtn.addEventListener("click", quitRound);
  againBtn.addEventListener("click", startRound);
  adjustBtn.addEventListener("click", () => {
    showView("setup");
    startBtn.focus({ preventScroll: true });
  });

  themeToggle.addEventListener("click", () => {
    setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark", true);
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
    if (event.target === howDialog) closeHowBtn.click();
  });

  sensorBtn.addEventListener("click", () => {
    if (sensor.enabled) {
      disableSensor("");
    } else {
      enableSensor();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (howDialog.open || document.querySelector("dialog[open]")) return;

    if (!viewPlay.hidden) {
      if (event.key === " " || event.key === "ArrowUp") {
        event.preventDefault();
        markHit();
        return;
      }
      if (event.key === "ArrowDown" || event.key === "ArrowRight") {
        event.preventDefault();
        markPass();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        quitRound();
        return;
      }
    }

    if (!viewEnd.hidden && event.key === "Escape") {
      showView("setup");
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (!state.playing) return;

    if (document.visibilityState === "hidden") {
      pauseRound();
      return;
    }

    resumeRound();
    requestWakeLock();
  });

  let resizeTimer = 0;
  global.addEventListener("resize", () => {
    global.clearTimeout(resizeTimer);
    resizeTimer = global.setTimeout(() => {
      if (!viewPlay.hidden) fitWord();
    }, 120);
  });

  // Si la tipografía llega tarde, se recalcula el tamaño de la palabra.
  if (document.fonts && typeof document.fonts.ready === "object") {
    document.fonts.ready.then(() => {
      if (!viewPlay.hidden) fitWord();
    }).catch(() => {});
  }

  // ---------- Arranque ----------

  restoreSetup();
  buildCategoryChips();
  buildDurations();
  paintSensor();
  setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light", false);
  refreshRecordNote();

  if (!tiltSupported()) {
    sensorRow.hidden = true;
  } else {
    sensorRow.hidden = false;
  }
})(typeof window !== "undefined" ? window : globalThis);
