"use strict";

(function () {
  var SESSION_KEY = "hdp-session";

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

    nameInput: document.getElementById("nameInput"),
    createForm: document.getElementById("createForm"),
    joinForm: document.getElementById("joinForm"),
    codeInput: document.getElementById("codeInput"),
    howBtn: document.getElementById("howBtn"),
    howDialog: document.getElementById("howDialog"),
    closeHowBtn: document.getElementById("closeHowBtn"),

    lobbyCode: document.getElementById("lobbyCode"),
    lobbyUrl: document.getElementById("lobbyUrl"),
    copyBtn: document.getElementById("copyBtn"),
    shareBtn: document.getElementById("shareBtn"),
    playerCount: document.getElementById("playerCount"),
    playersList: document.getElementById("playersList"),
    lobbyHost: document.getElementById("lobbyHost"),
    targetInput: document.getElementById("targetInput"),
    startBtn: document.getElementById("startBtn"),
    startHint: document.getElementById("startHint"),
    leaveBtn: document.getElementById("leaveBtn"),

    roundNum: document.getElementById("roundNum"),
    blackCard: document.getElementById("blackCard"),
    roundInstruction: document.getElementById("roundInstruction"),
    hand: document.getElementById("hand"),
    playBtn: document.getElementById("playBtn"),

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
  var es = null;
  var pollTimer = null;
  var toastTimer = null;

  /* ---------- Sesión (localStorage) ---------- */
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
  function api(path, body) {
    return fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
    }).then(function (res) {
      return res.json().catch(function () { return null; }).then(function (data) {
        if (!res.ok) {
          var err = new Error((data && data.error) || "Algo salió mal");
          err.status = res.status;
          throw err;
        }
        return data;
      });
    });
  }

  function authed(path, body) {
    var payload = body || {};
    payload.code = session.code;
    payload.token = session.token;
    return api(path, payload);
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

  function startPolling() {
    if (pollTimer) return;
    pollOnce();
    pollTimer = setInterval(pollOnce, 3000);
  }

  function stopPolling() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }

  function pollOnce() {
    if (!session) return;
    authed("/api/state")
      .then(function (snap) {
        applySnapshot(snap);
        setConn("online");
      })
      .catch(function () { setConn("offline"); });
  }

  function connect() {
    if (!session) return;
    stopPolling();
    if (es) { es.close(); es = null; }
    setConn("connecting");

    var url = "/api/stream?code=" + encodeURIComponent(session.code) +
      "&token=" + encodeURIComponent(session.token);
    es = new EventSource(url);

    es.addEventListener("state", function (e) {
      try { applySnapshot(JSON.parse(e.data)); } catch (err) {}
      setConn("online");
    });

    es.onopen = function () {
      stopPolling();
      setConn("online");
    };

    es.onerror = function () {
      setConn("connecting");
      startPolling();
    };
  }

  /* ---------- Render ---------- */
  function show(name) {
    Object.keys(views).forEach(function (k) { views[k].hidden = k !== name; });
    el.topbar.hidden = name === "home";
    window.scrollTo(0, 0);
  }

  function applySnapshot(snap) {
    snapshot = snap;
    var key = snap.round + "|" + (snap.blackCard ? snap.blackCard.text : "");
    if (key !== roundKey) {
      selected = [];
      roundKey = key;
    }
    el.judgeFlag.hidden = !(snap.you && snap.you.isJudge &&
      (snap.phase === "playing" || snap.phase === "judging" || snap.phase === "reveal"));
    render();
  }

  function render() {
    if (!snapshot) { show("home"); return; }
    switch (snapshot.phase) {
      case "lobby": show("lobby"); renderLobby(); break;
      case "playing": if (snapshot.you.isJudge) { show("judge"); renderJudge(); } else { show("round"); renderRound(); } break;
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
    el.lobbyCode.textContent = snapshot.code;
    el.lobbyUrl.textContent = window.location.origin + "/";

    var players = snapshot.players;
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

    el.lobbyHost.hidden = !snapshot.you.isHost;
    if (snapshot.you.isHost) {
      if (document.activeElement !== el.targetInput) {
        el.targetInput.value = String(snapshot.targetScore);
      }
      var canStart = players.length >= 3;
      el.startBtn.disabled = !canStart;
      el.startHint.textContent = canStart
        ? "Repartimos y arranca la primera ronda."
        : "Se necesitan al menos 3 jugadores.";
    }
  }

  function renderRound() {
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

    renderHand(pick);
  }

  function renderHand(pick) {
    el.hand.innerHTML = "";
    snapshot.hand.forEach(function (card) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "white-card";
      btn.dataset.id = String(card.id);
      btn.setAttribute("role", "option");
      btn.setAttribute("aria-label", card.text);
      var pressed = selected.indexOf(card.id) !== -1;
      btn.setAttribute("aria-pressed", pressed ? "true" : "false");
      btn.setAttribute("aria-selected", pressed ? "true" : "false");
      if (snapshot.you.submitted) btn.disabled = true;

      var logo = document.createElement("span");
      logo.className = "card-logo";
      logo.textContent = "HDP";
      var text = document.createElement("span");
      text.textContent = card.text;
      btn.appendChild(logo);
      btn.appendChild(text);

      btn.addEventListener("click", function () { toggleSelect(card.id, pick); });
      el.hand.appendChild(btn);
    });
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

  function joinOrCreate(path, name, code) {
    var body = { name: name };
    if (code) body.code = code;
    api(path, body)
      .then(function (data) {
        session = { code: data.code, token: data.token };
        saveSession();
        el.nameInput.value = "";
        el.codeInput.value = "";
        return authed("/api/state");
      })
      .then(function (snap) {
        applySnapshot(snap);
        connect();
      })
      .catch(function (e) { toast(e.message, "error"); });
  }

  function leaveGame() {
    if (!session) return goHome();
    authed("/api/leave")
      .catch(function () {})
      .then(function () { goHome(); });
  }

  function goHome() {
    if (es) { es.close(); es = null; }
    stopPolling();
    clearSession();
    snapshot = null;
    selected = [];
    show("home");
  }

  /* ---------- Copiar / compartir ---------- */
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

  function copyCode() {
    var text = snapshot.code;
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(
        function () { toast("Código copiado", "ok"); },
        function () { fallbackCopy(text, function () { toast("Código copiado", "ok"); }, function () { toast("No se pudo copiar", "error"); }); }
      );
    } else {
      fallbackCopy(text, function () { toast("Código copiado", "ok"); }, function () { toast("No se pudo copiar", "error"); });
    }
  }

  function shareCode() {
    var text = "Jugamos a HDP. Entrá a " + window.location.origin + " y poné el código " + snapshot.code;
    if (navigator.share) {
      navigator.share({ title: "HDP", text: text }).catch(function () {});
    } else {
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(function () { toast("Invitación copiada", "ok"); });
      } else {
        fallbackCopy(text, function () { toast("Invitación copiada", "ok"); }, function () {});
      }
    }
  }

  /* ---------- Eventos ---------- */
  el.createForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var name = el.nameInput.value.trim();
    if (!name) { toast("Poné tu nombre", "error"); return; }
    joinOrCreate("/api/create", name, null);
  });

  el.joinForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var name = el.nameInput.value.trim();
    var code = el.codeInput.value.trim().toUpperCase();
    if (!name) { toast("Poné tu nombre", "error"); return; }
    if (!code) { toast("Poné el código de la sala", "error"); return; }
    joinOrCreate("/api/join", name, code);
  });

  el.startBtn.addEventListener("click", function () {
    authed("/api/start").catch(function (e) { toast(e.message, "error"); });
  });

  el.targetInput.addEventListener("change", function () {
    var v = Number(el.targetInput.value);
    authed("/api/settings", { targetScore: v }).catch(function (e) { toast(e.message, "error"); });
  });

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

  el.copyBtn.addEventListener("click", copyCode);
  el.shareBtn.addEventListener("click", shareCode);

  el.howBtn.addEventListener("click", function () {
    if (typeof el.howDialog.showModal === "function") el.howDialog.showModal();
    else el.howDialog.setAttribute("open", "");
  });
  el.closeHowBtn.addEventListener("click", function () {
    if (typeof el.howDialog.close === "function") el.howDialog.close();
    else el.howDialog.removeAttribute("open");
  });

  /* ---------- Arranque ---------- */
  loadSession();
  if (session) {
    authed("/api/state")
      .then(function (snap) {
        applySnapshot(snap);
        connect();
      })
      .catch(function () {
        clearSession();
        show("home");
      });
  } else {
    show("home");
  }
})();
