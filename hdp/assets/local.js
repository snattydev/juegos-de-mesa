"use strict";

/*
 * Backend local de HDP: reemplaza HTTP + SSE por el motor en el navegador del
 * host y data channels para los invitados.
 *
 * El resto de la app sigue llamando a los mismos endpoints (/api/play,
 * /api/judge, ...). Acá se traducen a acciones del motor, así que la UI no
 * necesita saber si está hablando con un server o con un celular.
 */
var HDP_BACKEND = (function () {
  const ENGINE = window.HDP_ENGINE;
  const NET = window.HDP_NET;

  const state = {
    role: null, // "host" | "guest"
    room: null,
    hostToken: null,
    token: null,
    net: null,
    guest: null,
    guestCode: null,
    lastSnap: null,
    onState: null,
    pending: new Map(), // id -> {resolve, reject}
    seq: 0,
    roundTimer: null,
  };

  const peersByToken = new Map(); // token -> peer
  const tokensByPeer = new Map(); // peerId -> token

  /* ------------------------------------------------------------------ */
  /* Helpers                                                             */
  /* ------------------------------------------------------------------ */

  function apiError(message, status) {
    const err = new Error(message);
    err.status = status || 400;
    return err;
  }

  function nextId() {
    state.seq += 1;
    return "r" + state.seq;
  }

  function emit(snap) {
    state.lastSnap = snap;
    if (state.onState) state.onState(snap);
  }

  function actionFromPath(path) {
    return String(path || "").replace(/^\/api\//, "");
  }

  /* ------------------------------------------------------------------ */
  /* Host                                                                */
  /* ------------------------------------------------------------------ */

  function clearRoundTimer() {
    if (state.roundTimer) {
      clearTimeout(state.roundTimer);
      state.roundTimer = null;
    }
  }

  function syncRoundTimer() {
    clearRoundTimer();
    if (
      state.role !== "host" ||
      !state.room ||
      state.room.phase !== "playing" ||
      state.room.roundEndsAt === null
    ) {
      return;
    }
    const delay = Math.max(0, state.room.roundEndsAt - Date.now()) + 20;
    state.roundTimer = setTimeout(function () {
      state.roundTimer = null;
      if (!state.room || state.room.phase !== "playing" || state.room.roundEndsAt === null) return;
      if (state.room.roundEndsAt - Date.now() > 0) {
        syncRoundTimer();
        return;
      }
      const res = ENGINE.apply(state.room, state.hostToken, "timeout", { now: Date.now() });
      if (res && res.ok) broadcastStates();
    }, delay);
  }

  // Manda a cada jugador su propio estado.
  function broadcastStates() {
    if (!state.room) return;
    const now = Date.now();
    for (const [token, peer] of peersByToken) {
      const snap = ENGINE.snapshotFor(state.room, token, now);
      if (snap) state.net.send(peer, { t: "state", snap });
    }
    if (state.hostToken) emit(ENGINE.snapshotFor(state.room, state.hostToken, now));
    syncRoundTimer();
  }

  function hostOnMessage(peer, msg) {
    const room = state.room;
    if (!room || !msg || typeof msg !== "object") return;

    if (msg.t === "join") {
      if (tokensByPeer.has(peer.peerId)) {
        // Reconexión del mismo peer: le devolvemos su token.
        const token = tokensByPeer.get(peer.peerId);
        state.net.send(peer, { t: "hello", token });
        const snap = ENGINE.snapshotFor(room, token, Date.now());
        if (snap) state.net.send(peer, { t: "state", snap });
        return;
      }
      if (!ENGINE.validName(msg.name)) {
        state.net.send(peer, { t: "error", message: "Nombre de 1 a 16 caracteres" });
        return;
      }
      const added = ENGINE.addPlayer(room, msg.name);
      if (added.error) {
        state.net.send(peer, { t: "error", message: added.error });
        return;
      }
      peersByToken.set(added.token, peer);
      tokensByPeer.set(peer.peerId, added.token);
      peer.meta.token = added.token;
      state.net.send(peer, { t: "hello", token: added.token });
      broadcastStates();
      return;
    }

    const token = tokensByPeer.get(peer.peerId);
    if (!token) {
      state.net.send(peer, { t: "error", message: "Todavía no entraste a la sala" });
      return;
    }

    if (msg.t === "action") {
      const res = ENGINE.apply(room, token, msg.action, msg.payload || {});
      if (res.error) {
        state.net.send(peer, { t: "ack", id: msg.id, ok: false, error: res.error });
        return;
      }
      state.net.send(peer, { t: "ack", id: msg.id, ok: true });
      broadcastStates();
      return;
    }

    if (msg.t === "leave") {
      ENGINE.removePlayer(room, token);
      peersByToken.delete(token);
      tokensByPeer.delete(peer.peerId);
      state.net.drop(peer.peerId);
      broadcastStates();
    }
  }

  function hostCreate(name) {
    const created = ENGINE.createRoom(name);
    state.role = "host";
    state.room = created.room;
    state.hostToken = created.token;
    state.token = created.token;
    state.net = NET.createHost(state.room.code, {
      onMessage: hostOnMessage,
      onPeers: function () {
        // Si un peer se cae, el jugador queda desconectado pero la sala sigue.
        if (state.onPeers) state.onPeers();
      },
    });
    emit(ENGINE.snapshotFor(state.room, state.token));
    return { code: state.room.code, token: state.token };
  }

  function hostAct(path, body) {
    const action = actionFromPath(path);
    if (action === "state") return Promise.resolve(ENGINE.snapshotFor(state.room, state.token, Date.now()));
    if (action === "leave") {
      clearRoundTimer();
      if (state.net) state.net.close();
      state.room = null;
      return Promise.resolve({ ok: true });
    }
    const res = ENGINE.apply(state.room, state.token, action, body || {});
    if (res.error) return Promise.reject(apiError(res.error, res.status));
    broadcastStates();
    return Promise.resolve({ ok: true });
  }

  /* ------------------------------------------------------------------ */
  /* Invitado                                                            */
  /* ------------------------------------------------------------------ */

  function guestOnMessage(msg) {
    if (!msg || typeof msg !== "object") return;
    if (msg.t === "hello") {
      state.token = msg.token;
      if (state.onHello) state.onHello(msg.token);
      return;
    }
    if (msg.t === "state") {
      emit(msg.snap);
      return;
    }
    if (msg.t === "ack") {
      const pending = state.pending.get(msg.id);
      if (!pending) return;
      state.pending.delete(msg.id);
      if (msg.ok) pending.resolve({ ok: true });
      else pending.reject(apiError(msg.error || "No se pudo hacer eso"));
      return;
    }
    if (msg.t === "error") {
      if (state.onError) state.onError(msg.message);
    }
  }

  async function guestJoin(roomCode, name) {
    const displayName = String(name || "").trim();
    if (!ENGINE.validName(displayName)) {
      throw apiError("Nombre de 1 a 16 caracteres");
    }

    const guest = await NET.joinByCode(roomCode, { onMessage: guestOnMessage });
    if (guest.error) throw apiError(guest.error);
    state.role = "guest";
    state.guest = guest;
    state.guestCode = guest.code;

    try {
      await guest.ready;
    } catch (e) {
      if (state.guest === guest) {
        state.guest = null;
        state.role = null;
      }
      throw apiError(e && e.message ? e.message : "No se pudo conectar a la sala");
    }

    if (state.guest !== guest) {
      throw apiError("Conexión cancelada");
    }

    guest.send({ t: "join", name: displayName });
    return { code: guest.code };
  }

  function guestAct(path, body) {
    const action = actionFromPath(path);
    if (action === "state") return Promise.resolve(state.lastSnap);
    if (action === "leave") {
      if (state.guest) {
        state.guest.send({ t: "leave" });
        state.guest.close();
      }
      return Promise.resolve({ ok: true });
    }
    if (!state.guest) return Promise.reject(apiError("Sin conexión"));

    const id = nextId();
    return new Promise(function (resolve, reject) {
      state.pending.set(id, { resolve, reject });
      const sent = state.guest.send({ t: "action", id, action, payload: body || {} });
      if (!sent) {
        state.pending.delete(id);
        reject(apiError("El canal todavía no abrió"));
      }
      setTimeout(function () {
        if (!state.pending.has(id)) return;
        state.pending.delete(id);
        reject(apiError("El host no respondió"));
      }, 12000);
    });
  }

  /* ------------------------------------------------------------------ */
  /* API común                                                           */
  /* ------------------------------------------------------------------ */

  return {
    get role() {
      return state.role;
    },
    get room() {
      return state.room;
    },
    get snapshot() {
      return state.lastSnap;
    },
    get roomCode() {
      return state.room ? state.room.code : state.guestCode;
    },
    get token() {
      return state.token;
    },

    create: function (name) {
      return Promise.resolve(hostCreate(String(name || "").trim()));
    },

    join: function (roomCode, name) {
      return guestJoin(roomCode, name);
    },

    // Misma firma que el viejo authed(): /api/<accion> + body.
    act: function (path, body) {
      if (state.role === "host") return hostAct(path, body);
      if (state.role === "guest") return guestAct(path, body);
      return Promise.reject(apiError("Sin sala"));
    },

    subscribe: function (fn) {
      state.onState = fn;
      if (state.lastSnap) fn(state.lastSnap);
    },

    // Engancha el invitado que está esperando al host.
    afterJoin: function (h) {
      state.onHello = h && h.onHello;
      state.onError = h && h.onError;
    },

    reset: function () {
      clearRoundTimer();
      if (state.net) state.net.close();
      if (state.guest) state.guest.close();
      Object.assign(state, {
        role: null, room: null, hostToken: null, token: null,
        net: null, guest: null, guestCode: null, lastSnap: null, roundTimer: null,
      });
      peersByToken.clear();
      tokensByPeer.clear();
      state.pending.clear();
    },

    constants: ENGINE.constants,
  };
})();
