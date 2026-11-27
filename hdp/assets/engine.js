"use strict";

/*
 * Motor de HDP. Corre igual en Node (para los tests) y en el navegador del
 * host cuando se juega P2P por WebRTC.
 *
 * No toca red ni disco: recibe acciones y devuelve estado. El transporte vive
 * afuera, en net.js (data channels del host).
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("../data/cards.js"));
  } else {
    root.HDP_ENGINE = factory(root.HDP_CARDS);
  }
})(typeof self !== "undefined" ? self : this, function (CARDS) {
  const BLACK = CARDS.BLACK;
  const WHITE = CARDS.WHITE;

  const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const CODE_LENGTH = 6;
  const LABELS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  const HAND_SIZE = 10;
  const MIN_PLAYERS = 3;
  const MAX_PLAYERS = 12;
  const DEFAULT_TARGET = 5;
  const MIN_TARGET = 3;
  const MAX_TARGET = 10;
  const DEFAULT_ROUND_SECONDS = 30;
  const MIN_ROUND_SECONDS = 10;
  const MAX_ROUND_SECONDS = 60;

  /* ------------------------------------------------------------------ */
  /* Utilidades                                                          */
  /* ------------------------------------------------------------------ */

  const cryptoRef =
    typeof globalThis !== "undefined" && globalThis.crypto && globalThis.crypto.getRandomValues
      ? globalThis.crypto
      : null;

  function randInt(max) {
    if (cryptoRef) {
      // Rechazo de valores fuera de rango para no sesgar el resultado.
      const limit = Math.floor(0x100000000 / max) * max;
      let value;
      do {
        value = cryptoRef.getRandomValues(new Uint32Array(1))[0];
      } while (value >= limit);
      return value % max;
    }
    return Math.floor(Math.random() * max);
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = randInt(i + 1);
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  function newToken() {
    const bytes = new Uint8Array(16);
    if (cryptoRef) {
      cryptoRef.getRandomValues(bytes);
    } else {
      for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    let out = "";
    for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, "0");
    return out;
  }

  function newRoomCode(taken) {
    let code;
    do {
      code = "";
      for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[randInt(CODE_ALPHABET.length)];
    } while (taken && taken.has(code));
    return code;
  }

  function validName(name) {
    if (typeof name !== "string") return false;
    const trimmed = name.trim();
    if (trimmed.length < 1 || trimmed.length > 16) return false;
    // eslint-disable-next-line no-control-regex
    if (/[\x00-\x1f\x7f]/.test(trimmed)) return false;
    return true;
  }

  /* ------------------------------------------------------------------ */
  /* Sala                                                                */
  /* ------------------------------------------------------------------ */

  function createRoom(hostName) {
    const token = newToken();
    const room = {
      code: newRoomCode(null),
      players: new Map([[token, { token, name: hostName, hand: [], newCardIds: [], score: 0, connected: true }]]),
      hostId: token,
      judgeId: token,
      phase: "lobby",
      targetScore: DEFAULT_TARGET,
      roundSeconds: DEFAULT_ROUND_SECONDS,
      roundEndsAt: null,
      timedOut: false,
      round: 0,
      blackCard: null,
      blackDeck: [],
      blackDiscard: [],
      whiteDeck: [],
      whiteDiscard: [],
      submissions: new Map(), // token -> [whiteIdx]
      labeled: [],
      winnerSubmissionId: null,
      winnerName: null,
      winnerToken: null,
    };
    return { room, token };
  }

  function addPlayer(room, name) {
    if (room.phase !== "lobby") return { error: "La partida ya empezó", status: 409 };
    if (room.players.size >= MAX_PLAYERS) return { error: "Sala llena", status: 409 };
    const token = newToken();
    room.players.set(token, { token, name: name.trim(), hand: [], newCardIds: [], score: 0, connected: true });
    return { token };
  }

  function removePlayer(room, token) {
    const player = room.players.get(token);
    if (!player) return { error: "Token inválido", status: 403 };

    for (const c of player.hand) {
      if (c !== null) room.whiteDiscard.push(c);
    }
    room.players.delete(token);
    room.submissions.delete(token);
    room.labeled = room.labeled.filter((s) => s.token !== token);

    if (room.players.size === 0) {
      clearRoundTimer(room);
      return { ok: true, empty: true };
    }

    if (room.hostId === token) room.hostId = [...room.players.keys()][0];
    if (room.judgeId === token) room.judgeId = room.hostId;
    if (
      room.phase === "playing" &&
      room.players.size - 1 > 0 &&
      room.submissions.size >= room.players.size - 1
    ) {
      enterJudging(room);
    }
    return { ok: true };
  }

  /* ------------------------------------------------------------------ */
  /* Mazos y cartas                                                      */
  /* ------------------------------------------------------------------ */

  function drawBlack(room) {
    if (room.blackCard) room.blackDiscard.push(room.blackCard.id);
    if (room.blackDeck.length === 0) room.blackDeck = shuffle(room.blackDiscard.splice(0));
    if (room.blackDeck.length === 0) room.blackDeck = shuffle(BLACK.map((_, i) => i));
    const id = room.blackDeck.pop();
    room.blackCard = { id, text: BLACK[id].text, pick: BLACK[id].pick };
  }

  function drawWhite(room) {
    if (room.whiteDeck.length === 0) room.whiteDeck = shuffle(room.whiteDiscard.splice(0));
    if (room.whiteDeck.length === 0) return null;
    return room.whiteDeck.pop();
  }

  function refillHand(room, player, markNew) {
    const added = [];
    for (let i = 0; i < player.hand.length; i++) {
      if (player.hand[i] === null) {
        const idx = drawWhite(room);
        if (idx === null) continue;
        player.hand[i] = idx;
        added.push(idx);
      }
    }
    while (player.hand.length < HAND_SIZE) {
      const idx = drawWhite(room);
      if (idx === null) break;
      player.hand.push(idx);
      added.push(idx);
    }
    if (player.hand.includes(null)) {
      player.hand = player.hand.filter((id) => id !== null);
    }
    player.newCardIds = markNew ? added : [];
  }

  function resolveNow(payload, fallback) {
    if (payload && Number.isFinite(payload.now)) return payload.now;
    return Number.isFinite(fallback) ? fallback : Date.now();
  }

  function startRoundTimer(room, now) {
    room.timedOut = false;
    room.roundEndsAt = room.roundSeconds > 0 ? now + room.roundSeconds * 1000 : null;
  }

  function clearRoundTimer(room) {
    room.roundEndsAt = null;
  }

  function enterJudging(room) {
    clearRoundTimer(room);
    room.phase = "judging";
    const tokens = shuffle([...room.submissions.keys()]);
    room.labeled = tokens.map((t, i) => ({
      id: newToken().slice(0, 8),
      label: LABELS[i] || String(i + 1),
      token: t,
      cards: room.submissions.get(t).slice(),
      authorName: room.players.get(t).name,
    }));
  }

  /* ------------------------------------------------------------------ */
  /* Estado por jugador                                                  */
  /* ------------------------------------------------------------------ */

  function snapshotFor(room, token, now) {
    const player = room.players.get(token);
    if (!player) return null;

    const ts = Number.isFinite(now) ? now : Date.now();
    const newSet = new Set(player.newCardIds || []);

    const snap = {
      code: room.code,
      phase: room.phase,
      targetScore: room.targetScore,
      roundSeconds: room.roundSeconds,
      roundRemainingMs:
        room.phase === "playing" && room.roundEndsAt !== null
          ? Math.max(0, room.roundEndsAt - ts)
          : null,
      timedOut: room.phase === "judging" ? Boolean(room.timedOut) : false,
      round: room.round,
      you: {
        name: player.name,
        isHost: room.hostId === token,
        isJudge: room.judgeId === token,
        score: player.score,
        submitted: room.submissions.has(token),
      },
      players: [...room.players.values()].map((p) => ({
        name: p.name,
        score: p.score,
        connected: p.connected,
        isHost: room.hostId === p.token,
        isJudge: room.judgeId === p.token,
        self: p.token === token,
      })),
      blackCard: room.blackCard ? { text: room.blackCard.text, pick: room.blackCard.pick } : null,
      hand: player.hand
        .filter((idx) => idx !== null)
        .map((idx) => ({ id: idx, text: WHITE[idx], isNew: newSet.has(idx) })),
      judgeName: room.players.get(room.judgeId) ? room.players.get(room.judgeId).name : null,
    };

    if (room.phase === "playing") {
      snap.missing = [...room.players.values()]
        .filter((p) => p.token !== room.judgeId && !room.submissions.has(p.token))
        .map((p) => p.name);
      snap.submittedCount = room.submissions.size;
      snap.expectedCount = room.players.size - 1;
    }

    if (room.phase === "judging") {
      if (token === room.judgeId) {
        snap.submissions = room.labeled.map((s) => ({
          id: s.id,
          label: s.label,
          cards: s.cards.map((idx) => WHITE[idx]),
        }));
      } else {
        snap.submissionsCount = room.labeled.length;
        snap.submissionsTotal = room.players.size - 1;
      }
    }

    if (room.phase === "reveal" || room.phase === "ended") {
      snap.reveal = room.labeled.map((s) => ({
        id: s.id,
        label: s.label,
        author: s.authorName,
        cards: s.cards.map((idx) => WHITE[idx]),
        isWinner: s.id === room.winnerSubmissionId,
      }));
      snap.winnerName = room.winnerName;
    }

    if (room.phase === "ended") {
      snap.scores = [...room.players.values()]
        .map((p) => ({ name: p.name, score: p.score }))
        .sort((a, b) => b.score - a.score);
    }

    return snap;
  }

  /* ------------------------------------------------------------------ */
  /* Acciones                                                            */
  /* ------------------------------------------------------------------ */

  function fail(status, error) {
    return { error, status };
  }

  function apply(room, token, action, payload) {
    const body = payload || {};
    const now = resolveNow(body);
    const player = room.players.get(token);
    if (!player) return fail(403, "Token inválido");

    switch (action) {
      case "start": {
        if (room.hostId !== token) return fail(403, "Solo el host puede hacer eso");
        if (room.phase !== "lobby") return fail(409, "La partida ya está en curso");
        if (room.players.size < MIN_PLAYERS) return fail(409, "Se necesitan al menos 3 jugadores");

        room.whiteDeck = shuffle(WHITE.map((_, i) => i));
        room.whiteDiscard = [];
        room.blackDeck = shuffle(BLACK.map((_, i) => i));
        room.blackDiscard = [];
        room.submissions.clear();
        room.labeled = [];
        room.winnerSubmissionId = null;
        room.winnerName = null;
        room.winnerToken = null;
        room.judgeId = room.hostId;
        room.round = 1;

        for (const p of room.players.values()) {
          p.hand = [];
          p.newCardIds = [];
        }
        for (const p of room.players.values()) refillHand(room, p, false);
        drawBlack(room);
        room.phase = "playing";
        startRoundTimer(room, now);
        return { ok: true };
      }

      case "play": {
        if (room.phase !== "playing") return fail(409, "No es momento de jugar");
        if (room.judgeId === token) return fail(409, "El juez no juega cartas");
        if (room.submissions.has(token)) return fail(409, "Ya jugaste esta ronda");

        const cardIds = body.cardIds;
        const pick = room.blackCard.pick;
        if (!Array.isArray(cardIds) || cardIds.length !== pick) {
          return fail(400, "Tenés que jugar exactamente " + pick + " carta" + (pick === 1 ? "" : "s"));
        }
        const hand = new Set(player.hand.filter((id) => id !== null));
        if (cardIds.some((id) => !Number.isInteger(id) || !hand.has(id))) {
          return fail(400, "Cartas inválidas");
        }
        if (new Set(cardIds).size !== cardIds.length) return fail(400, "No podés repetir cartas");

        const playedSet = new Set(cardIds);
        player.hand = player.hand.map((id) => (playedSet.has(id) ? null : id));
        room.submissions.set(token, cardIds);

        if (room.submissions.size >= room.players.size - 1) enterJudging(room);
        return { ok: true };
      }

      case "reveal": {
        if (room.judgeId !== token) return fail(403, "Solo el juez puede hacer eso");
        if (room.phase === "playing") {
          if (room.submissions.size === 0) return fail(409, "Todavía no hay respuestas");
          enterJudging(room);
        } else if (room.phase !== "judging") {
          return fail(409, "No es momento de revelar");
        }
        return { ok: true };
      }

      case "timeout": {
        if (room.hostId !== token) return fail(403, "Solo el host puede hacer eso");
        if (room.phase !== "playing") return fail(409, "No hay ronda en curso");
        if (room.roundEndsAt === null) return fail(409, "La ronda no tiene timer");
        if (now < room.roundEndsAt) return fail(409, "Todavía queda tiempo");

        if (room.submissions.size === 0) {
          const pick = room.blackCard.pick;
          for (const [t, p] of room.players.entries()) {
            if (t === room.judgeId) continue;
            const available = p.hand.filter((id) => id !== null);
            if (available.length < pick) continue;
            const chosen = shuffle(available.slice()).slice(0, pick);
            const chosenSet = new Set(chosen);
            p.hand = p.hand.map((id) => (chosenSet.has(id) ? null : id));
            room.submissions.set(t, chosen);
          }
        }

        if (room.submissions.size > 0) {
          room.timedOut = true;
          enterJudging(room);
          return { ok: true };
        }

        drawBlack(room);
        startRoundTimer(room, now);
        return { ok: true };
      }

      case "judge": {
        if (room.judgeId !== token) return fail(403, "Solo el juez puede hacer eso");
        if (room.phase !== "judging") return fail(409, "No es momento de elegir");

        const sub = room.labeled.find((s) => s.id === body.submissionId);
        if (!sub) return fail(400, "Respuesta inválida");

        const winner = room.players.get(sub.token);
        if (!winner) return fail(400, "Respuesta inválida");

        winner.score += 1;
        room.winnerToken = sub.token;
        room.winnerName = winner.name;
        room.winnerSubmissionId = sub.id;
        room.phase = "reveal";
        return { ok: true };
      }

      case "next": {
        const isJudge = room.judgeId === token;
        const isHost = room.hostId === token;
        if (!isJudge && !isHost) return fail(403, "Solo el juez o el host pueden pasar de ronda");
        if (room.phase !== "reveal") return fail(409, "No es momento de pasar de ronda");

        const winner = room.players.get(room.winnerToken);
        if (winner && winner.score >= room.targetScore) {
          clearRoundTimer(room);
          room.timedOut = false;
          room.phase = "ended";
          return { ok: true };
        }

        const order = [...room.players.keys()];
        const idx = order.indexOf(room.judgeId);
        room.judgeId = order[(idx + 1) % order.length];

        for (const s of room.labeled) {
          for (const c of s.cards) room.whiteDiscard.push(c);
        }
        for (const p of room.players.values()) refillHand(room, p, true);

        room.submissions.clear();
        room.labeled = [];
        room.winnerSubmissionId = null;
        room.winnerName = null;
        room.winnerToken = null;
        drawBlack(room);
        room.round += 1;
        room.phase = "playing";
        startRoundTimer(room, now);
        return { ok: true };
      }

      case "restart": {
        if (room.hostId !== token) return fail(403, "Solo el host puede hacer eso");
        if (room.phase !== "ended") return fail(409, "Solo se puede revancha al terminar");

        for (const p of room.players.values()) {
          p.score = 0;
          p.hand = [];
          p.newCardIds = [];
        }
        room.submissions.clear();
        room.labeled = [];
        room.winnerSubmissionId = null;
        room.winnerName = null;
        room.winnerToken = null;
        room.blackCard = null;
        room.round = 0;
        clearRoundTimer(room);
        room.timedOut = false;
        room.phase = "lobby";
        return { ok: true };
      }

      case "settings": {
        if (room.hostId !== token) return fail(403, "Solo el host puede hacer eso");
        const hasTarget = body.targetScore !== undefined;
        const hasTimer = body.roundSeconds !== undefined;
        if (!hasTarget && !hasTimer) return fail(400, "No hay cambios para aplicar");

        if (hasTarget) {
          const target = body.targetScore;
          if (!Number.isInteger(target) || target < MIN_TARGET || target > MAX_TARGET) {
            return fail(400, "El puntaje objetivo va de " + MIN_TARGET + " a " + MAX_TARGET);
          }
        }
        if (hasTimer) {
          const secs = body.roundSeconds;
          const validSecs =
            secs === 0 ||
            (Number.isInteger(secs) && secs >= MIN_ROUND_SECONDS && secs <= MAX_ROUND_SECONDS);
          if (!validSecs) {
            return fail(
              400,
              "El tiempo por ronda va de " +
                MIN_ROUND_SECONDS +
                " a " +
                MAX_ROUND_SECONDS +
                " segundos (o sin límite)"
            );
          }
        }

        if (hasTarget) room.targetScore = body.targetScore;
        if (hasTimer) room.roundSeconds = body.roundSeconds;
        return { ok: true };
      }

      default:
        return fail(404, "Acción inexistente");
    }
  }

  const constants = {
    CODE_LENGTH,
    CODE_ALPHABET,
    HAND_SIZE,
    MIN_PLAYERS,
    MAX_PLAYERS,
    DEFAULT_TARGET,
    MIN_TARGET,
    MAX_TARGET,
    DEFAULT_ROUND_SECONDS,
    MIN_ROUND_SECONDS,
    MAX_ROUND_SECONDS,
    BLACK_COUNT: BLACK.length,
    WHITE_COUNT: WHITE.length,
  };

  return {
    createRoom,
    addPlayer,
    removePlayer,
    snapshotFor,
    apply,
    validName,
    shuffle,
    newToken,
    constants,
  };
});
