"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

const { BLACK, WHITE } = require("./data/cards");

const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT) || 3000;

const PUBLIC_DIR = path.join(__dirname, "public");

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 4;
const HAND_SIZE = 10;
const MIN_PLAYERS = 3;
const MAX_PLAYERS = 12;
const MAX_ROOMS = 200;
const MAX_BODY = 16 * 1024;
const ROOM_TTL_MS = 3 * 60 * 60 * 1000;
const HEARTBEAT_MS = 20 * 1000;
const HOST_TRANSFER_MS = 10 * 1000;
const LABELS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DEFAULT_TARGET = 5;
const MIN_TARGET = 3;
const MAX_TARGET = 10;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

/* ------------------------------------------------------------------ */
/* Utilidades                                                          */
/* ------------------------------------------------------------------ */

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

function newToken() {
  return crypto.randomBytes(16).toString("hex");
}

function lanIPs() {
  const out = [];
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const ni of ifaces[name] || []) {
      if (ni.family === "IPv4" && !ni.internal) out.push(ni.address);
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Estado en memoria                                                    */
/* ------------------------------------------------------------------ */

const rooms = new Map(); // code -> room
const streams = new Map(); // code -> Map<token, Set<res>>

function newRoomCode() {
  let code;
  do {
    code = "";
    for (let i = 0; i < CODE_LENGTH; i++) {
      code += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
    }
  } while (rooms.has(code));
  return code;
}

function createRoom(hostName) {
  const token = newToken();
  const room = {
    code: newRoomCode(),
    players: new Map([[token, { token, name: hostName, hand: [], score: 0, connected: false }]]),
    hostId: token,
    judgeId: token,
    phase: "lobby",
    targetScore: DEFAULT_TARGET,
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
    createdAt: Date.now(),
    lastActivity: Date.now(),
    pendingHostTransfer: null,
  };
  rooms.set(room.code, room);
  return { room, token };
}

function touch(room, token) {
  const player = room.players.get(token);
  if (!player) return false;
  player.connected = true;
  room.lastActivity = Date.now();
  if (room.hostId === token && room.pendingHostTransfer) {
    clearTimeout(room.pendingHostTransfer);
    room.pendingHostTransfer = null;
  }
  return true;
}

function transferHost(room) {
  for (const p of room.players.values()) {
    if (p.token !== room.hostId && p.connected) {
      room.hostId = p.token;
      return true;
    }
  }
  return false;
}

function onDisconnect(code, token) {
  const room = rooms.get(code);
  if (!room) return;
  const player = room.players.get(token);
  if (!player) return;
  player.connected = false;
  room.lastActivity = Date.now();

  if (room.hostId === token && room.phase !== "ended") {
    if (room.pendingHostTransfer) clearTimeout(room.pendingHostTransfer);
    room.pendingHostTransfer = setTimeout(() => {
      const p = room.players.get(token);
      if (p && !p.connected && room.hostId === token && transferHost(room)) {
        broadcast(room);
      }
    }, HOST_TRANSFER_MS);
    room.pendingHostTransfer.unref();
  }
}

/* ------------------------------------------------------------------ */
/* Mazos y cartas                                                      */
/* ------------------------------------------------------------------ */

function drawBlack(room) {
  if (room.blackCard) room.blackDiscard.push(room.blackCard.id);
  if (room.blackDeck.length === 0) {
    room.blackDeck = shuffle(room.blackDiscard.splice(0));
  }
  if (room.blackDeck.length === 0) {
    room.blackDeck = shuffle(BLACK.map((_, i) => i));
  }
  const id = room.blackDeck.pop();
  room.blackCard = { id, text: BLACK[id].text, pick: BLACK[id].pick };
}

function drawWhite(room) {
  if (room.whiteDeck.length === 0) {
    room.whiteDeck = shuffle(room.whiteDiscard.splice(0));
  }
  if (room.whiteDeck.length === 0) return null;
  return room.whiteDeck.pop();
}

function refillHand(room, player) {
  while (player.hand.length < HAND_SIZE) {
    const idx = drawWhite(room);
    if (idx === null) break;
    player.hand.push(idx);
  }
}

function enterJudging(room) {
  room.phase = "judging";
  const tokens = shuffle([...room.submissions.keys()]);
  room.labeled = tokens.map((t, i) => ({
    id: crypto.randomBytes(4).toString("hex"),
    label: LABELS[i] || String(i + 1),
    token: t,
    cards: room.submissions.get(t).slice(),
    authorName: room.players.get(t).name,
  }));
}

/* ------------------------------------------------------------------ */
/* Snapshots personalizados                                            */
/* ------------------------------------------------------------------ */

function snapshotFor(room, token) {
  const player = room.players.get(token);
  if (!player) return null;

  const snap = {
    code: room.code,
    phase: room.phase,
    targetScore: room.targetScore,
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
    hand: player.hand.map((idx) => ({ id: idx, text: WHITE[idx] })),
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
/* SSE / broadcast                                                     */
/* ------------------------------------------------------------------ */

function writeEvent(res, snap) {
  res.write("event: state\n");
  res.write("data: " + JSON.stringify(snap) + "\n\n");
}

function broadcast(room) {
  const clients = streams.get(room.code);
  if (!clients) return;
  for (const [token, set] of clients) {
    const snap = snapshotFor(room, token);
    if (!snap) continue;
    for (const res of set) writeEvent(res, snap);
  }
}

/* ------------------------------------------------------------------ */
/* Respuestas HTTP                                                     */
/* ------------------------------------------------------------------ */

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const len = Number(req.headers["content-length"]) || 0;
    if (len > MAX_BODY) return reject({ status: 413, error: "Body demasiado grande" });
    const chunks = [];
    let total = 0;
    req.on("data", (chunk) => {
      total += chunk.length;
      if (total > MAX_BODY) {
        req.destroy();
        reject({ status: 413, error: "Body demasiado grande" });
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", () => reject({ status: 400, error: "No se pudo leer el body" }));
  });
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
/* Servidor estático                                                   */
/* ------------------------------------------------------------------ */

function serveStatic(res, pathname) {
  let rel;
  try {
    rel = decodeURIComponent(pathname);
  } catch (e) {
    return json(res, 400, { error: "URL inválida" });
  }
  if (rel === "/") rel = "/index.html";

  const filePath = path.resolve(PUBLIC_DIR, "." + rel);
  if (filePath !== PUBLIC_DIR && !filePath.startsWith(PUBLIC_DIR + path.sep)) {
    return json(res, 403, { error: "Prohibido" });
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) return json(res, 404, { error: "No encontrado" });
    const ext = path.extname(filePath).toLowerCase();
    const type = TYPES[ext] || "application/octet-stream";
    res.writeHead(200, {
      "Content-Type": type,
      "Content-Length": stat.size,
      "Cache-Control": "no-cache",
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

/* ------------------------------------------------------------------ */
/* Acciones de la API                                                  */
/* ------------------------------------------------------------------ */

function getRoomAuth(req) {
  const room = rooms.get(req.code);
  if (!room) return { error: { status: 404, error: "Sala inexistente" } };
  const player = room.players.get(req.token);
  if (!player) return { error: { status: 403, error: "Token inválido" } };
  return { room, player };
}

function requireHost(room, player, token) {
  if (room.hostId !== token) return { status: 403, error: "Solo el host puede hacer eso" };
  return null;
}

function requireJudge(room, player, token) {
  if (room.judgeId !== token) return { status: 403, error: "Solo el juez puede hacer eso" };
  return null;
}

const actions = {
  create(body, res) {
    const name = body.name;
    if (!validName(name)) return json(res, 400, { error: "Nombre de 1 a 16 caracteres" });
    if (rooms.size >= MAX_ROOMS) return json(res, 503, { error: "Muchas salas activas, probá en un rato" });
    const { room, token } = createRoom(name.trim());
    room.players.get(token).connected = true;
    return json(res, 200, { code: room.code, token });
  },

  join(body, res) {
    const code = String(body.code || "").trim().toUpperCase();
    const name = body.name;
    if (!/^[A-Z2-9]{4}$/.test(code)) return json(res, 400, { error: "Código inválido" });
    if (!validName(name)) return json(res, 400, { error: "Nombre de 1 a 16 caracteres" });
    const room = rooms.get(code);
    if (!room) return json(res, 404, { error: "No hay sala con ese código" });
    if (room.phase !== "lobby") return json(res, 409, { error: "La partida ya empezó" });
    if (room.players.size >= MAX_PLAYERS) return json(res, 409, { error: "Sala llena" });
    const token = newToken();
    room.players.set(token, { token, name: name.trim(), hand: [], score: 0, connected: true });
    room.lastActivity = Date.now();
    broadcast(room);
    return json(res, 200, { code: room.code, token });
  },

  start(body, res) {
    const auth = getRoomAuth(body);
    if (auth.error) return json(res, auth.error.status, { error: auth.error.error });
    const { room } = auth;
    const hostErr = requireHost(room, null, body.token);
    if (hostErr) return json(res, hostErr.status, { error: hostErr.error });
    if (room.phase !== "lobby") return json(res, 409, { error: "La partida ya está en curso" });
    if (room.players.size < MIN_PLAYERS) return json(res, 409, { error: "Se necesitan al menos 3 jugadores" });

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

    for (const p of room.players.values()) p.hand = [];
    for (const p of room.players.values()) refillHand(room, p);
    drawBlack(room);
    room.phase = "playing";
    room.lastActivity = Date.now();
    broadcast(room);
    return json(res, 200, { ok: true });
  },

  play(body, res) {
    const auth = getRoomAuth(body);
    if (auth.error) return json(res, auth.error.status, { error: auth.error.error });
    const { room, player } = auth;
    if (room.phase !== "playing") return json(res, 409, { error: "No es momento de jugar" });
    if (room.judgeId === body.token) return json(res, 409, { error: "El juez no juega cartas" });
    if (room.submissions.has(body.token)) return json(res, 409, { error: "Ya jugaste esta ronda" });

    const cardIds = body.cardIds;
    const pick = room.blackCard.pick;
    if (!Array.isArray(cardIds) || cardIds.length !== pick) {
      return json(res, 400, { error: "Tenés que jugar exactamente " + pick + " carta" + (pick === 1 ? "" : "s") });
    }
    const hand = new Set(player.hand);
    if (cardIds.some((id) => !Number.isInteger(id) || !hand.has(id))) {
      return json(res, 400, { error: "Cartas inválidas" });
    }
    if (new Set(cardIds).size !== cardIds.length) {
      return json(res, 400, { error: "No podés repetir cartas" });
    }

    player.hand = player.hand.filter((id) => !cardIds.includes(id));
    room.submissions.set(body.token, cardIds);
    room.lastActivity = Date.now();

    if (room.submissions.size >= room.players.size - 1) enterJudging(room);
    broadcast(room);
    return json(res, 200, { ok: true });
  },

  reveal(body, res) {
    const auth = getRoomAuth(body);
    if (auth.error) return json(res, auth.error.status, { error: auth.error.error });
    const { room } = auth;
    const judgeErr = requireJudge(room, null, body.token);
    if (judgeErr) return json(res, judgeErr.status, { error: judgeErr.error });
    if (room.phase === "playing") {
      if (room.submissions.size === 0) return json(res, 409, { error: "Todavía no hay respuestas" });
      enterJudging(room);
      room.lastActivity = Date.now();
    } else if (room.phase !== "judging") {
      return json(res, 409, { error: "No es momento de revelar" });
    }
    broadcast(room);
    return json(res, 200, { ok: true });
  },

  judge(body, res) {
    const auth = getRoomAuth(body);
    if (auth.error) return json(res, auth.error.status, { error: auth.error.error });
    const { room } = auth;
    const judgeErr = requireJudge(room, null, body.token);
    if (judgeErr) return json(res, judgeErr.status, { error: judgeErr.error });
    if (room.phase !== "judging") return json(res, 409, { error: "No es momento de elegir" });

    const sub = room.labeled.find((s) => s.id === body.submissionId);
    if (!sub) return json(res, 400, { error: "Respuesta inválida" });

    const winner = room.players.get(sub.token);
    if (!winner) return json(res, 400, { error: "Respuesta inválida" });
    winner.score += 1;
    room.winnerToken = sub.token;
    room.winnerName = winner.name;
    room.winnerSubmissionId = sub.id;
    room.phase = "reveal";
    room.lastActivity = Date.now();
    broadcast(room);
    return json(res, 200, { ok: true });
  },

  next(body, res) {
    const auth = getRoomAuth(body);
    if (auth.error) return json(res, auth.error.status, { error: auth.error.error });
    const { room } = auth;
    const isJudge = room.judgeId === body.token;
    const isHost = room.hostId === body.token;
    if (!isJudge && !isHost) return json(res, 403, { error: "Solo el juez o el host pueden pasar de ronda" });
    if (room.phase !== "reveal") return json(res, 409, { error: "No es momento de pasar de ronda" });

    const winner = room.players.get(room.winnerToken);
    if (winner && winner.score >= room.targetScore) {
      room.phase = "ended";
      room.lastActivity = Date.now();
      broadcast(room);
      return json(res, 200, { ok: true });
    }

    // Rota el juez al siguiente jugador (orden de unión).
    const order = [...room.players.keys()];
    const idx = order.indexOf(room.judgeId);
    room.judgeId = order[(idx + 1) % order.length];

    // Descarta las cartas jugadas y rellena manos hasta 10.
    for (const s of room.labeled) {
      for (const c of s.cards) room.whiteDiscard.push(c);
    }
    for (const p of room.players.values()) refillHand(room, p);

    room.submissions.clear();
    room.labeled = [];
    room.winnerSubmissionId = null;
    room.winnerName = null;
    room.winnerToken = null;
    drawBlack(room);
    room.round += 1;
    room.phase = "playing";
    room.lastActivity = Date.now();
    broadcast(room);
    return json(res, 200, { ok: true });
  },

  restart(body, res) {
    const auth = getRoomAuth(body);
    if (auth.error) return json(res, auth.error.status, { error: auth.error.error });
    const { room } = auth;
    const hostErr = requireHost(room, null, body.token);
    if (hostErr) return json(res, hostErr.status, { error: hostErr.error });
    if (room.phase !== "ended") return json(res, 409, { error: "Solo se puede revancha al terminar" });

    for (const p of room.players.values()) {
      p.score = 0;
      p.hand = [];
    }
    room.submissions.clear();
    room.labeled = [];
    room.winnerSubmissionId = null;
    room.winnerName = null;
    room.winnerToken = null;
    room.blackCard = null;
    room.round = 0;
    room.phase = "lobby";
    room.lastActivity = Date.now();
    broadcast(room);
    return json(res, 200, { ok: true });
  },

  settings(body, res) {
    const auth = getRoomAuth(body);
    if (auth.error) return json(res, auth.error.status, { error: auth.error.error });
    const { room } = auth;
    const hostErr = requireHost(room, null, body.token);
    if (hostErr) return json(res, hostErr.status, { error: hostErr.error });
    const target = body.targetScore;
    if (!Number.isInteger(target) || target < MIN_TARGET || target > MAX_TARGET) {
      return json(res, 400, { error: "El puntaje objetivo va de " + MIN_TARGET + " a " + MAX_TARGET });
    }
    room.targetScore = target;
    room.lastActivity = Date.now();
    broadcast(room);
    return json(res, 200, { ok: true });
  },

  leave(body, res) {
    const auth = getRoomAuth(body);
    if (auth.error) return json(res, auth.error.status, { error: auth.error.error });
    const { room, player } = auth;

    room.players.delete(body.token);
    if (room.pendingHostTransfer) { clearTimeout(room.pendingHostTransfer); room.pendingHostTransfer = null; }
    room.submissions.delete(body.token);
    room.labeled = room.labeled.filter((s) => s.token !== body.token);

    if (room.players.size === 0) {
      rooms.delete(room.code);
      streams.delete(room.code);
      return json(res, 200, { ok: true });
    }

    if (room.hostId === body.token) {
      room.hostId = [...room.players.keys()][0];
    }
    if (room.judgeId === body.token) {
      room.judgeId = room.hostId;
    }
    if (room.phase === "playing" && room.submissions.size >= room.players.size - 1 && room.players.size - 1 > 0) {
      enterJudging(room);
    }
    room.lastActivity = Date.now();
    broadcast(room);
    return json(res, 200, { ok: true });
  },
};

/* ------------------------------------------------------------------ */
/* Router                                                              */
/* ------------------------------------------------------------------ */

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  const pathname = url.pathname;

  // Limpieza pasiva de salas viejas (chequeada en cada request).
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (now - room.lastActivity > ROOM_TTL_MS) {
      rooms.delete(code);
      streams.delete(code);
    }
  }

  if (pathname === "/api/stream" && req.method === "GET") {
    const code = String(url.searchParams.get("code") || "").trim().toUpperCase();
    const token = url.searchParams.get("token") || "";
    const room = rooms.get(code);
    const player = room && room.players.get(token);
    if (!room || !player) return json(res, 403, { error: "Sala o token inválido" });

    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    });
    res.flushHeaders();
    res.write(": conectado\n\n");

    touch(room, token);
    writeEvent(res, snapshotFor(room, token));

    if (!streams.has(code)) streams.set(code, new Map());
    const byToken = streams.get(code);
    if (!byToken.has(token)) byToken.set(token, new Set());
    byToken.get(token).add(res);

    const heartbeat = setInterval(() => {
      res.write(": ping\n\n");
    }, HEARTBEAT_MS);

    req.on("close", () => {
      clearInterval(heartbeat);
      const set = byToken.get(token);
      if (set) {
        set.delete(res);
        if (set.size === 0) byToken.delete(token);
      }
      if (byToken.size === 0) streams.delete(code);
      onDisconnect(code, token);
    });
    return;
  }

  if (pathname === "/api/state" && req.method === "POST") {
    return readBody(req)
      .then((buf) => {
        let body;
        try { body = JSON.parse(buf.toString("utf8") || "{}"); } catch (e) { return json(res, 400, { error: "JSON inválido" }); }
        const auth = getRoomAuth(body);
        if (auth.error) return json(res, auth.error.status, { error: auth.error.error });
        touch(auth.room, body.token);
        return json(res, 200, snapshotFor(auth.room, body.token));
      })
      .catch((e) => json(res, e.status || 500, { error: e.error || "Error interno" }));
  }

  if (pathname.startsWith("/api/") && req.method === "POST") {
    const actionName = pathname.slice("/api/".length);
    const action = actions[actionName];
    if (!action) return json(res, 404, { error: "Endpoint inexistente" });
    return readBody(req)
      .then((buf) => {
        let body;
        try { body = JSON.parse(buf.toString("utf8") || "{}"); } catch (e) { return json(res, 400, { error: "JSON inválido" }); }
        try {
          return action(body, res);
        } catch (e) {
          return json(res, 500, { error: "Error interno" });
        }
      })
      .catch((e) => json(res, e.status || 500, { error: e.error || "Error interno" }));
  }

  if (req.method === "GET" || req.method === "HEAD") {
    return serveStatic(res, pathname);
  }

  return json(res, 404, { error: "No encontrado" });
});

server.listen(PORT, HOST, () => {
  console.log("HDP — hasta donde puedas. Servidor local levantado.");
  console.log("Local:  http://localhost:" + PORT);
  for (const ip of lanIPs()) {
    console.log("Red:    http://" + ip + ":" + PORT);
  }
  console.log("(" + BLACK.length + " cartas negras, " + WHITE.length + " cartas blancas)");
});
