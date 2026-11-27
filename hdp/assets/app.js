"use strict";

(function () {
  var SESSION_KEY = "hdp-session";
  var NAME_KEY = "hdp-name";

  /* ---------- DOM ---------- */
  var views = {
    home: document.getElementById("viewHome"),
    lobby: document.getElementById("viewLobby"),
    round: document.getElementById("viewRound"),
    judge: document.getElementById("viewJudge"),
    judging: document.getElementById("viewJudging"),
    reveal: document.getElementById("viewReveal"),
    final: document.getElementById("viewFinal"),
  };

  var el = {
    topbar: document.getElementById("topbar"),
    connStatus: document.getElementById("connStatus"),
    connText: document.getElementById("connText"),
    judgeFlag: document.getElementById("judgeFlag"),
    toast: document.getElementById("toast"),

    homeLead: document.getElementById("homeLead"),
    homeModeSwitch: document.getElementById("homeModeSwitch"),
    modeCreateBtn: document.getElementById("modeCreateBtn"),
    modeJoinBtn: document.getElementById("modeJoinBtn"),
    inviteBanner: document.getElementById("inviteBanner"),
    inviteCodeValue: document.getElementById("inviteCodeValue"),
    homeForm: document.getElementById("homeForm"),
    codeField: document.getElementById("codeField"),
    codeInput: document.getElementById("codeInput"),
    nameInput: document.getElementById("nameInput"),
    homeSubmitBtn: document.getElementById("homeSubmitBtn"),
    exitInviteBtn: document.getElementById("exitInviteBtn"),
    howBtn: document.getElementById("howBtn"),
    howDialog: document.getElementById("howDialog"),
    closeHowBtn: document.getElementById("closeHowBtn"),

    roomCodeValue: document.getElementById("roomCodeValue"),
    copyCodeBtn: document.getElementById("copyCodeBtn"),
    copyLinkBtn: document.getElementById("copyLinkBtn"),
    playerCount: document.getElementById("playerCount"),
    playersList: document.getElementById("playersList"),
    lobbyRules: document.getElementById("lobbyRules"),
    lobbyHost: document.getElementById("lobbyHost"),
    targetInput: document.getElementById("targetInput"),
    roundTimerGroup: document.getElementById("roundTimerGroup"),
    startBtn: document.getElementById("startBtn"),
    startHint: document.getElementById("startHint"),
    leaveBtn: document.getElementById("leaveBtn"),

    roundNum: document.getElementById("roundNum"),
    roundTimer: document.getElementById("roundTimer"),
    roundTimerText: document.getElementById("roundTimerText"),
    roundTimerBar: document.getElementById("roundTimerBar"),
    roundTimerFill: document.getElementById("roundTimerFill"),
    blackCard: document.getElementById("blackCard"),
    roundInstruction: document.getElementById("roundInstruction"),
    hand: document.getElementById("hand"),
    playBtn: document.getElementById("playBtn"),

    judgeRoundNum: document.getElementById("judgeRoundNum"),
    judgeTimer: document.getElementById("judgeTimer"),
    judgeTimerText: document.getElementById("judgeTimerText"),
    judgeTimerBar: document.getElementById("judgeTimerBar"),
    judgeTimerFill: document.getElementById("judgeTimerFill"),
    judgeBlackCard: document.getElementById("judgeBlackCard"),
    submittedCount: document.getElementById("submittedCount"),
    expectedCount: document.getElementById("expectedCount"),
    missingLine: document.getElementById("missingLine"),
    revealBtn: document.getElementById("revealBtn"),

    judgingKicker: document.getElementById("judgingKicker"),
    judgingBlackCard: document.getElementById("judgingBlackCard"),
    judgingWaiting: document.getElementById("judgingWaiting"),
    judgingWaitText: document.getElementById("judgingWaitText"),
    judgingChoices: document.getElementById("judgingChoices"),

    revealBlackCard: document.getElementById("revealBlackCard"),
    revealChoices: document.getElementById("revealChoices"),
    revealScores: document.getElementById("revealScores"),
    nextBtn: document.getElementById("nextBtn"),

    winnerName: document.getElementById("winnerName"),
    finalSub: document.getElementById("finalSub"),
    finalScores: document.getElementById("finalScores"),
    rematchBtn: document.getElementById("rematchBtn"),
    exitBtn: document.getElementById("exitBtn"),
  };

  /* ---------- Estado ---------- */
  var session = null; // { code, token }
  var snapshot = null;
  var selected = []; // ids de cartas blancas elegidas
  var roundKey = null; // para resetear la selección en cada ronda
  var renderedHandKey = null;
  var currentView = null;
  var homeMode = "create"; // "create" | "join" | "invite"
  var inviteCode = null;
  var joining = false;
  var localRoundEndsAt = null;
  var localRoundTotalMs = 0;
  var timerInterval = null;
  var lastTimeoutToastRound = null;
  var toastTimer = null;

  /* ---------- Sesión (localStorage) ---------- */
  function loadSavedName() {
    try {
      return localStorage.getItem(NAME_KEY) || "";
    } catch (e) {
      return "";
    }
  }

  function saveName(name) {
    try {
      if (name) localStorage.setItem(NAME_KEY, name);
    } catch (e) {}
  }

  function loadSession() {
    try {
      var raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        var s = JSON.parse(raw);
        if (s && s.code && s.token) session = s;
      }
    } catch (e) {}
  }

  function saveSession() {
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch (e) {}
  }

  function clearSession() {
    session = null;
    try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
  }

  /* ---------- API ---------- */
  // Todo pasa por el backend local: el host corre el motor en su navegador y
  // los invitados hablan por data channel. La UI sigue usando /api/<accion>.
  function api(path, body) {
    return HDP_BACKEND.act(path, body || {});
  }

  function authed(path, body) {
    return HDP_BACKEND.act(path, body || {});
  }

  /* ---------- Toast ---------- */
  function toast(msg, kind) {
    el.toast.textContent = msg;
    el.toast.setAttribute("data-kind", kind || "info");
    el.toast.setAttribute("data-show", "true");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.toast.setAttribute("data-show", "false");
    }, 3200);
  }

  /* ---------- Conexión ---------- */
  function setConn(state) {
    el.connStatus.setAttribute("data-state", state);
    if (state === "online") el.connText.textContent = "Conectado";
    else if (state === "connecting") el.connText.textContent = "Reconectando…";
    else el.connText.textContent = "Sin conexión";
  }

  function connect() {
    setConn("connecting");
    HDP_BACKEND.subscribe(function (snap) {
      if (!snap) return;
      applySnapshot(snap);
      setConn("online");
    });
  }

  /* ---------- Render ---------- */
  function show(name) {
    var changed = name !== currentView;
    currentView = name;
    Object.keys(views).forEach(function (k) { views[k].hidden = k !== name; });
    el.topbar.hidden = name === "home";
    if (changed) window.scrollTo(0, 0);
  }

  function stopCountdownUI() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    localRoundEndsAt = null;
    localRoundTotalMs = 0;
    [el.roundTimer, el.roundTimerBar, el.judgeTimer, el.judgeTimerBar].forEach(function (node) {
      if (node) node.hidden = true;
    });
  }

  function updateCountdownUI() {
    if (localRoundEndsAt === null) return;
    var remaining = Math.max(0, localRoundEndsAt - Date.now());
    var secs = Math.ceil(remaining / 1000);
    var ratio = localRoundTotalMs > 0 ? Math.max(0, Math.min(1, remaining / localRoundTotalMs)) : 0;
    var urgent = secs <= 5 ? "true" : "false";

    if (el.roundTimerText) el.roundTimerText.textContent = secs + "s";
    if (el.judgeTimerText) el.judgeTimerText.textContent = secs + "s";
    if (el.roundTimer) el.roundTimer.setAttribute("data-urgent", urgent);
    if (el.judgeTimer) el.judgeTimer.setAttribute("data-urgent", urgent);
    if (el.roundTimerFill) {
      el.roundTimerFill.setAttribute("data-urgent", urgent);
      el.roundTimerFill.style.transform = "scaleX(" + ratio.toFixed(4) + ")";
    }
    if (el.judgeTimerFill) {
      el.judgeTimerFill.setAttribute("data-urgent", urgent);
      el.judgeTimerFill.style.transform = "scaleX(" + ratio.toFixed(4) + ")";
    }
  }

  function startCountdownUI(remainingMs, totalSeconds) {
    localRoundEndsAt = Date.now() + Math.max(0, remainingMs);
    localRoundTotalMs = (totalSeconds || 30) * 1000;
    [el.roundTimer, el.roundTimerBar, el.judgeTimer, el.judgeTimerBar].forEach(function (node) {
      if (node) node.hidden = false;
    });
    updateCountdownUI();
    if (!timerInterval) {
      timerInterval = setInterval(updateCountdownUI, 200);
    }
  }

  function applySnapshot(snap) {
    snapshot = snap;
    var key = snap.round + "|" + (snap.blackCard ? snap.blackCard.text : "");
    var isNewRound = key !== roundKey;
    if (isNewRound) {
      selected = [];
      roundKey = key;
    }
    if (snap.phase !== "playing") {
      renderedHandKey = null;
      stopCountdownUI();
    } else if (typeof snap.roundRemainingMs === "number") {
      startCountdownUI(snap.roundRemainingMs, snap.roundSeconds);
    } else {
      stopCountdownUI();
    }
    if (snap.phase === "judging" && snap.timedOut && lastTimeoutToastRound !== snap.round) {
      lastTimeoutToastRound = snap.round;
      toast("Se acabó el tiempo de la ronda", "info");
    }
    el.judgeFlag.hidden = !(snap.you && snap.you.isJudge &&
      (snap.phase === "playing" || snap.phase === "judging" || snap.phase === "reveal"));
    render(isNewRound);
  }

  function render(isNewRound) {
    if (!snapshot) { show("home"); return; }
    switch (snapshot.phase) {
      case "lobby": show("lobby"); renderLobby(); break;
      case "playing":
        if (snapshot.you.isJudge) { show("judge"); renderJudge(); }
        else { show("round"); renderRound(isNewRound); }
        break;
      case "judging": show("judging"); renderJudging(); break;
      case "reveal": show("reveal"); renderReveal(); break;
      case "ended": show("final"); renderFinal(); break;
      default: show("home");
    }
  }

  function blackHTML(text) {
    // El punto final después del último blanco queda huérfano cuando el hueco
    // cae solo en la línea siguiente: se descarta.
    var clean = text.replace(/___\.?\s*$/, "___");
    var escaped = clean.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return escaped.replace(/___/g, '<span class="blank" role="img" aria-label="en blanco"></span>');
  }

  function renderLobby() {
    var players = snapshot.players;
    if (el.roomCodeValue) el.roomCodeValue.textContent = snapshot.code || "------";
    el.playerCount.textContent = String(players.length);
    el.playersList.innerHTML = "";
    players.forEach(function (p) {
      var li = document.createElement("li");
      var name = document.createElement("span");
      name.className = "player-name";
      name.textContent = p.name;
      var score = document.createElement("span");
      score.className = "player-score";
      score.textContent = p.score;
      var tags = [];
      if (p.isHost) tags.push("host");
      if (p.self) tags.push("vos");
      var tagText = tags.length ? tags.join(" · ") : "";
      li.appendChild(name);
      if (tagText) {
        var tag = document.createElement("span");
        tag.className = "player-tag";
        tag.textContent = tagText;
        li.appendChild(tag);
      }
      li.appendChild(score);
      el.playersList.appendChild(li);
    });

    var secs = typeof snapshot.roundSeconds === "number" ? snapshot.roundSeconds : 30;
    if (el.lobbyRules) {
      var timeText = secs > 0 ? secs + "s por ronda" : "sin límite de tiempo";
      el.lobbyRules.textContent = "A " + snapshot.targetScore + " puntos · " + timeText;
    }

    el.lobbyHost.hidden = !snapshot.you.isHost;
    if (snapshot.you.isHost) {
      if (document.activeElement !== el.targetInput) {
        el.targetInput.value = String(snapshot.targetScore);
      }
      if (el.roundTimerGroup) {
        var timerBtns = el.roundTimerGroup.querySelectorAll(".seg-btn");
        for (var i = 0; i < timerBtns.length; i++) {
          var b = timerBtns[i];
          b.setAttribute("aria-checked", Number(b.dataset.seconds) === secs ? "true" : "false");
        }
      }
      var canStart = players.length >= 3;
      el.startBtn.disabled = !canStart;
      el.startHint.textContent = canStart
        ? "Repartimos y arranca la primera ronda."
        : "Se necesitan al menos 3 jugadores.";
    }
  }

  function renderRound(isNewRound) {
    el.roundNum.textContent = String(snapshot.round);
    el.blackCard.innerHTML = blackHTML(snapshot.blackCard.text);

    var pick = snapshot.blackCard.pick;
    if (snapshot.you.submitted) {
      el.roundInstruction.textContent = "Ya jugaste. Esperando al resto…";
      el.playBtn.disabled = true;
      el.playBtn.textContent = "Esperando a los demás…";
      el.hand.classList.add("hand-done");
    } else {
      el.roundInstruction.innerHTML = "Elegí <strong>" + pick + "</strong> " +
        (pick === 1 ? "carta" : "cartas") + " para completar la frase.";
      el.hand.classList.remove("hand-done");
      updatePlayButton(pick);
    }

    renderHand(pick, isNewRound);
  }

  function renderHand(pick, isNewRound) {
    var handKey = snapshot.round + "|" + pick + "|" + (snapshot.you.submitted ? "1" : "0") + "|" +
      snapshot.hand.map(function (c) { return c.id + (c.isNew ? "n" : ""); }).join(",");

    if (handKey === renderedHandKey) {
      var btns = el.hand.querySelectorAll(".white-card");
      for (var i = 0; i < btns.length; i++) {
        var b = btns[i];
        var cid = Number(b.dataset.id);
        var on = selected.indexOf(cid) !== -1;
        b.setAttribute("aria-pressed", on ? "true" : "false");
        b.setAttribute("aria-selected", on ? "true" : "false");
        b.disabled = Boolean(snapshot.you.submitted);
      }
      return;
    }

    renderedHandKey = handKey;
    el.hand.innerHTML = "";
    snapshot.hand.forEach(function (card) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "white-card";
      btn.dataset.id = String(card.id);
      btn.dataset.new = card.isNew ? "true" : "false";
      btn.setAttribute("role", "option");
      btn.setAttribute("aria-label", card.text);
      var pressed = selected.indexOf(card.id) !== -1;
      btn.setAttribute("aria-pressed", pressed ? "true" : "false");
      btn.setAttribute("aria-selected", pressed ? "true" : "false");
      if (snapshot.you.submitted) btn.disabled = true;

      var head = document.createElement("span");
      head.className = "card-head";
      var logo = document.createElement("span");
      logo.className = "card-logo";
      logo.textContent = "HDP";
      head.appendChild(logo);
      if (card.isNew) {
        var badge = document.createElement("span");
        badge.className = "card-new";
        badge.textContent = "Nueva";
        head.appendChild(badge);
      }

      var text = document.createElement("span");
      text.className = "card-body";
      text.textContent = card.text;
      btn.appendChild(head);
      btn.appendChild(text);

      btn.addEventListener("click", function () { toggleSelect(card.id, pick); });
      el.hand.appendChild(btn);
    });

    if (isNewRound) {
      el.hand.scrollLeft = 0;
    }
  }

  function toggleSelect(id, pick) {
    var idx = selected.indexOf(id);
    if (idx !== -1) {
      selected.splice(idx, 1);
    } else {
      if (selected.length >= pick) {
        toast("Elegí exactamente " + pick + (pick === 1 ? " carta" : " cartas"), "error");
        return;
      }
      selected.push(id);
    }
    var btn = el.hand.querySelector('.white-card[data-id="' + id + '"]');
    if (btn) {
      var on = selected.indexOf(id) !== -1;
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      btn.setAttribute("aria-selected", on ? "true" : "false");
    }
    updatePlayButton(pick);
  }

  function updatePlayButton(pick) {
    var ready = selected.length === pick;
    el.playBtn.disabled = !ready;
    el.playBtn.textContent = ready
      ? "Jugar " + pick + (pick === 1 ? " carta" : " cartas")
      : "Jugar cartas (" + selected.length + "/" + pick + ")";
  }

  function renderJudge() {
    if (el.judgeRoundNum) el.judgeRoundNum.textContent = String(snapshot.round);
    el.judgeBlackCard.innerHTML = blackHTML(snapshot.blackCard.text);
    el.submittedCount.textContent = String(snapshot.submittedCount);
    el.expectedCount.textContent = String(snapshot.expectedCount);
    if (snapshot.missing && snapshot.missing.length) {
      el.missingLine.textContent = "Faltan: " + snapshot.missing.join(", ");
    } else {
      el.missingLine.textContent = "";
    }
    el.revealBtn.disabled = snapshot.submittedCount === 0;
  }

  function renderJudging() {
    el.judgingBlackCard.innerHTML = blackHTML(snapshot.blackCard.text);
    if (snapshot.you.isJudge) {
      el.judgingKicker.textContent = "Sos el juez — elegí la más graciosa";
      el.judgingWaiting.hidden = true;
      el.judgingChoices.hidden = false;
      el.judgingChoices.innerHTML = "";
      snapshot.submissions.forEach(function (sub) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "choice";
        var label = document.createElement("span");
        label.className = "choice-label";
        label.textContent = sub.label;
        var cards = document.createElement("div");
        cards.className = "choice-cards";
        sub.cards.forEach(function (text) {
          var t = document.createElement("span");
          t.className = "choice-card-text";
          t.textContent = text;
          cards.appendChild(t);
        });
        btn.appendChild(label);
        btn.appendChild(cards);
        btn.addEventListener("click", function () { chooseWinner(sub.id); });
        el.judgingChoices.appendChild(btn);
      });
    } else {
      el.judgingKicker.textContent = "El juez está eligiendo";
      el.judgingChoices.hidden = true;
      el.judgingWaiting.hidden = false;
      el.judgingWaitText.textContent = "El juez está eligiendo la más graciosa… (" +
        snapshot.submissionsCount + " de " + snapshot.submissionsTotal + " respondieron)";
    }
  }

  function renderReveal() {
    el.revealBlackCard.innerHTML = blackHTML(snapshot.blackCard.text);
    el.revealChoices.innerHTML = "";
    snapshot.reveal.forEach(function (sub) {
      var div = document.createElement("div");
      div.className = "choice";
      div.setAttribute("data-winner", sub.isWinner ? "true" : "false");
      div.removeAttribute("tabindex");
      var label = document.createElement("span");
      label.className = "choice-label";
      label.textContent = sub.label;
      var cards = document.createElement("div");
      cards.className = "choice-cards";
      sub.cards.forEach(function (text) {
        var t = document.createElement("span");
        t.className = "choice-card-text";
        t.textContent = text;
        cards.appendChild(t);
      });
      var author = document.createElement("span");
      author.className = "choice-author";
      author.textContent = sub.author;
      div.appendChild(label);
      div.appendChild(cards);
      div.appendChild(author);
      if (sub.isWinner) {
        var flag = document.createElement("span");
        flag.className = "choice-winner-flag";
        flag.textContent = "Ganadora";
        div.appendChild(flag);
      }
      el.revealChoices.appendChild(div);
    });

    renderScores(el.revealScores, snapshot.players);

    var canNext = snapshot.you.isJudge || snapshot.you.isHost;
    el.nextBtn.hidden = !canNext;
  }

  function renderScores(listEl, players) {
    var sorted = players.slice().sort(function (a, b) { return b.score - a.score; });
    listEl.innerHTML = "";
    sorted.forEach(function (p, i) {
      var li = document.createElement("li");
      var rank = document.createElement("span");
      rank.className = "rank";
      rank.textContent = String(i + 1);
      var name = document.createElement("span");
      name.className = "player-name";
      name.textContent = p.name + (p.self ? " (vos)" : "");
      var score = document.createElement("span");
      score.className = "player-score";
      score.textContent = p.score;
      li.appendChild(rank);
      li.appendChild(name);
      li.appendChild(score);
      listEl.appendChild(li);
    });
  }

  function renderFinal() {
    el.winnerName.textContent = snapshot.winnerName || "";
    el.finalSub.textContent = "Llegó a " + snapshot.targetScore + " puntos. Una máquina.";
    renderScores(el.finalScores, snapshot.scores);
    el.rematchBtn.hidden = !snapshot.you.isHost;
  }

  /* ---------- Acciones ---------- */
  function chooseWinner(submissionId) {
    authed("/api/judge", { submissionId: submissionId }).catch(function (e) { toast(e.message, "error"); });
  }

  /* ---------- Sala P2P ---------- */
  function clearRoomParamFromUrl() {
    try {
      var url = new URL(window.location.href);
      if (!url.searchParams.has("sala")) return;
      url.searchParams.delete("sala");
      window.history.replaceState(null, "", url.toString());
    } catch (e) {}
  }

  function setHomeMode(mode, code) {
    homeMode = mode;
    if (mode === "invite" && code) {
      inviteCode = code;
      if (el.inviteCodeValue) el.inviteCodeValue.textContent = code;
      if (el.codeInput) el.codeInput.value = code;
      if (el.homeModeSwitch) el.homeModeSwitch.hidden = true;
      if (el.homeLead) el.homeLead.hidden = true;
      if (el.codeField) el.codeField.hidden = true;
      if (el.inviteBanner) el.inviteBanner.hidden = false;
      if (el.exitInviteBtn) el.exitInviteBtn.hidden = false;
      if (el.homeSubmitBtn) el.homeSubmitBtn.textContent = joining ? "Conectando…" : "Unirme a la sala";
      return;
    }

    inviteCode = null;
    if (el.homeModeSwitch) el.homeModeSwitch.hidden = false;
    if (el.homeLead) el.homeLead.hidden = false;
    if (el.inviteBanner) el.inviteBanner.hidden = true;
    if (el.exitInviteBtn) el.exitInviteBtn.hidden = true;

    if (mode === "join") {
      if (el.codeField) el.codeField.hidden = false;
      if (el.modeCreateBtn) el.modeCreateBtn.setAttribute("aria-checked", "false");
      if (el.modeJoinBtn) el.modeJoinBtn.setAttribute("aria-checked", "true");
      if (el.homeSubmitBtn) el.homeSubmitBtn.textContent = joining ? "Conectando…" : "Unirme a la sala";
    } else {
      homeMode = "create";
      if (el.codeField) el.codeField.hidden = true;
      if (el.modeCreateBtn) el.modeCreateBtn.setAttribute("aria-checked", "true");
      if (el.modeJoinBtn) el.modeJoinBtn.setAttribute("aria-checked", "false");
      if (el.homeSubmitBtn) el.homeSubmitBtn.textContent = joining ? "Conectando…" : "Crear sala";
    }
  }

  function setJoining(busy) {
    joining = Boolean(busy);
    if (el.homeSubmitBtn) {
      el.homeSubmitBtn.disabled = joining;
      el.homeSubmitBtn.textContent = joining
        ? "Conectando…"
        : (homeMode === "create" ? "Crear sala" : "Unirme a la sala");
    }
    if (el.modeCreateBtn) el.modeCreateBtn.disabled = joining;
    if (el.modeJoinBtn) el.modeJoinBtn.disabled = joining;
    if (el.exitInviteBtn) el.exitInviteBtn.disabled = joining;
  }

  function startHost(name) {
    HDP_BACKEND.reset();
    HDP_BACKEND.create(name)
      .then(function (data) {
        session = { code: data.code, token: data.token };
        saveSession();
        connect();
      })
      .catch(function (e) { toast(e.message, "error"); });
  }

  function startGuest(rawCode, name) {
    var code = window.HDP_NET ? HDP_NET.normalizeRoomCode(rawCode) : String(rawCode || "").trim().toUpperCase();
    if (!window.HDP_NET || !HDP_NET.isValidRoomCode(code)) {
      toast("El código tiene que tener 6 caracteres", "error");
      return;
    }

    HDP_BACKEND.reset();
    setJoining(true);
    HDP_BACKEND.afterJoin({
      onError: function (msg) {
        setJoining(false);
        toast(msg || "No pudiste entrar a la sala", "error");
      },
    });
    HDP_BACKEND.subscribe(function (snap) {
      if (!snap) return;
      if (!session) {
        session = { code: snap.code, token: HDP_BACKEND.token };
        saveSession();
      }
      setJoining(false);
      if (el.codeInput) el.codeInput.value = "";
      applySnapshot(snap);
      setConn("online");
    });

    HDP_BACKEND.join(code, name)
      .catch(function (e) {
        setJoining(false);
        toast(e.message, "error");
      });
  }

  function leaveGame() {
    if (!session) return goHome();
    authed("/api/leave")
      .catch(function () {})
      .then(function () { goHome(); });
  }

  function goHome() {
    stopCountdownUI();
    setJoining(false);
    clearRoomParamFromUrl();
    if (window.HDP_BACKEND) HDP_BACKEND.reset();
    clearSession();
    snapshot = null;
    selected = [];
    roundKey = null;
    renderedHandKey = null;
    lastTimeoutToastRound = null;
    if (el.codeInput) el.codeInput.value = "";
    if (el.nameInput) el.nameInput.value = loadSavedName();
    setHomeMode("create");
    show("home");
  }

  /* ---------- Copiar ---------- */
  function fallbackCopy(text, ok, fail) {
    var ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      ok();
    } catch (e) {
      fail(e);
    }
    document.body.removeChild(ta);
  }

  /* ---------- Eventos ---------- */
  if (el.modeCreateBtn) {
    el.modeCreateBtn.addEventListener("click", function () {
      if (joining) return;
      setHomeMode("create");
      if (el.nameInput) el.nameInput.focus();
    });
  }

  if (el.modeJoinBtn) {
    el.modeJoinBtn.addEventListener("click", function () {
      if (joining) return;
      setHomeMode("join");
      if (el.codeInput && !el.codeInput.value) el.codeInput.focus();
      else if (el.nameInput) el.nameInput.focus();
    });
  }

  if (el.exitInviteBtn) {
    el.exitInviteBtn.addEventListener("click", function () {
      if (joining) return;
      clearRoomParamFromUrl();
      if (el.codeInput) el.codeInput.value = "";
      setHomeMode("create");
      if (el.nameInput) el.nameInput.focus();
    });
  }

  el.codeInput.addEventListener("paste", function (e) {
    var text = e.clipboardData && e.clipboardData.getData ? e.clipboardData.getData("text") : "";
    var match = text && text.match(/[?&]sala=([A-Za-z0-9]+)/i);
    if (match && window.HDP_NET) {
      e.preventDefault();
      el.codeInput.value = HDP_NET.normalizeRoomCode(match[1]);
    }
  });

  el.codeInput.addEventListener("input", function () {
    if (window.HDP_NET) {
      var clean = HDP_NET.normalizeRoomCode(el.codeInput.value);
      if (el.codeInput.value !== clean) el.codeInput.value = clean;
    }
  });

  el.homeForm.addEventListener("submit", function (e) {
    e.preventDefault();
    if (joining) return;
    var name = el.nameInput.value.trim();

    if (homeMode === "join") {
      var code = el.codeInput.value.trim();
      if (!code) {
        toast("Escribí el código de 6 caracteres", "error");
        el.codeInput.focus();
        return;
      }
      if (!name) {
        toast("Poné tu nombre", "error");
        el.nameInput.focus();
        return;
      }
      saveName(name);
      startGuest(code, name);
      return;
    }

    if (!name) {
      toast("Poné tu nombre", "error");
      el.nameInput.focus();
      return;
    }
    saveName(name);

    if (homeMode === "invite") {
      startGuest(inviteCode, name);
    } else {
      startHost(name);
    }
  });

  function copyText(text, okMsg) {
    if (!text) return;
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(
        function () { toast(okMsg, "ok"); },
        function () { fallbackCopy(text, function () { toast(okMsg, "ok"); }, function () { toast("No se pudo copiar", "error"); }); }
      );
    } else {
      fallbackCopy(text, function () { toast(okMsg, "ok"); }, function () { toast("No se pudo copiar", "error"); });
    }
  }

  if (el.copyCodeBtn) el.copyCodeBtn.addEventListener("click", function () {
    if (snapshot && snapshot.code) copyText(snapshot.code, "Código copiado");
  });

  if (el.copyLinkBtn) el.copyLinkBtn.addEventListener("click", function () {
    if (!snapshot || !snapshot.code) return;
    var url = new URL(window.location.href);
    url.searchParams.set("sala", snapshot.code);
    copyText(url.toString(), "Link de la sala copiado");
  });

  el.startBtn.addEventListener("click", function () {
    authed("/api/start").catch(function (e) { toast(e.message, "error"); });
  });

  el.targetInput.addEventListener("change", function () {
    var v = Number(el.targetInput.value);
    authed("/api/settings", { targetScore: v }).catch(function (e) { toast(e.message, "error"); });
  });

  if (el.roundTimerGroup) {
    var timerSegBtns = el.roundTimerGroup.querySelectorAll(".seg-btn");
    for (var ti = 0; ti < timerSegBtns.length; ti++) {
      timerSegBtns[ti].addEventListener("click", function () {
        var secs = Number(this.dataset.seconds);
        authed("/api/settings", { roundSeconds: secs }).catch(function (e) { toast(e.message, "error"); });
      });
    }
  }

  el.leaveBtn.addEventListener("click", leaveGame);
  el.exitBtn.addEventListener("click", leaveGame);

  el.playBtn.addEventListener("click", function () {
    var pick = snapshot.blackCard.pick;
    if (selected.length !== pick) return;
    el.playBtn.disabled = true;
    authed("/api/play", { cardIds: selected })
      .then(function () { selected = []; })
      .catch(function (e) {
        toast(e.message, "error");
        el.playBtn.disabled = false;
      });
  });

  el.revealBtn.addEventListener("click", function () {
    authed("/api/reveal").catch(function (e) { toast(e.message, "error"); });
  });

  el.nextBtn.addEventListener("click", function () {
    authed("/api/next").catch(function (e) { toast(e.message, "error"); });
  });

  el.rematchBtn.addEventListener("click", function () {
    authed("/api/restart").catch(function (e) { toast(e.message, "error"); });
  });

  el.howBtn.addEventListener("click", function () {
    if (typeof el.howDialog.showModal === "function") el.howDialog.showModal();
    else el.howDialog.setAttribute("open", "");
  });
  el.closeHowBtn.addEventListener("click", function () {
    if (typeof el.howDialog.close === "function") el.howDialog.close();
    else el.howDialog.removeAttribute("open");
  });
  el.howDialog.addEventListener("click", function (event) {
    if (event.target === el.howDialog) el.closeHowBtn.click();
  });

  /* ---------- Arranque ---------- */
  var savedName = loadSavedName();
  if (savedName && el.nameInput) el.nameInput.value = savedName;

  setHomeMode("create");
  try {
    var params = new URLSearchParams(window.location.search);
    var salaParam = params.get("sala");
    if (salaParam && window.HDP_NET) {
      var cleanSala = HDP_NET.normalizeRoomCode(salaParam);
      if (HDP_NET.isValidRoomCode(cleanSala)) {
        setHomeMode("invite", cleanSala);
      } else if (cleanSala) {
        if (el.codeInput) el.codeInput.value = cleanSala;
        setHomeMode("join");
        toast("El código del link no es válido", "error");
      }
    }
  } catch (e) {}

  function showInitialHome() {
    show("home");
    if (homeMode === "invite" && el.nameInput && !el.nameInput.value) {
      el.nameInput.focus();
    }
  }

  loadSession();
  if (session) {
    authed("/api/state")
      .then(function (snap) {
        applySnapshot(snap);
        connect();
      })
      .catch(function () {
        clearSession();
        showInitialHome();
      });
  } else {
    showInitialHome();
  }
})();
