"use strict";

/*
 * Transporte P2P de HDP por WebRTC con código de sala de 6 caracteres.
 * Sin servidor propio ni dependencias: el host crea la sala con su código de
 * 6 caracteres y los invitados se conectan ingresando ese código.
 *
 * La señalización inicial (oferta/respuesta SDP) viaja por:
 *   1. BroadcastChannel (instantáneo en el mismo navegador/origen).
 *   2. Canal público HTTPS/SSE (ntfy.sh por defecto, configurable con
 *      window.HDP_SIGNAL_URL) para conectar celulares distintos en WiFi o 4G/5G.
 *
 * Una vez establecido el WebRTC DataChannel, todo el juego corre P2P directo
 * entre el host y cada jugador.
 */
var HDP_NET = (function () {
  const ROOM_CODE_LENGTH = 6;
  const ROOM_CODE_RE = /^[A-Z2-9]{6}$/;
  const TOPIC_PREFIX = "jdm-hdp-v1-";
  const GATHER_TIMEOUT_MS = 2500;
  const SIGNAL_READY_TIMEOUT_MS = 900;
  const JOIN_TIMEOUT_MS = 15000;
  const ICE_SERVERS = [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  ];

  function signalBase() {
    if (typeof window !== "undefined" && typeof window.HDP_SIGNAL_URL === "string") {
      return window.HDP_SIGNAL_URL.replace(/\/+$/, "");
    }
    return "https://ntfy.sh";
  }

  /* ------------------------------------------------------------------ */
  /* Códigos                                                             */
  /* ------------------------------------------------------------------ */

  function normalizeRoomCode(raw) {
    return String(raw || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, ROOM_CODE_LENGTH);
  }

  function isValidRoomCode(code) {
    return ROOM_CODE_RE.test(normalizeRoomCode(code));
  }

  function randomId(len) {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const bytes = new Uint8Array(len);
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      crypto.getRandomValues(bytes);
    } else {
      for (let i = 0; i < len; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    let out = "";
    for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
    return out;
  }

  /* ------------------------------------------------------------------ */
  /* Señalización                                                        */
  /* ------------------------------------------------------------------ */

  function hostTopic(roomCode) {
    return TOPIC_PREFIX + roomCode + "-h";
  }

  function guestTopic(roomCode, peerId) {
    return TOPIC_PREFIX + roomCode + "-g-" + peerId;
  }

  function openBroadcast(roomCode, onMessage) {
    if (typeof BroadcastChannel !== "function") return null;
    try {
      const bc = new BroadcastChannel(TOPIC_PREFIX + roomCode);
      bc.onmessage = (event) => {
        if (event && event.data && typeof event.data === "object") {
          onMessage(event.data);
        }
      };
      return bc;
    } catch (_) {
      return null;
    }
  }

  function publishSignal(topic, payload) {
    const base = signalBase();
    if (!base || typeof fetch !== "function") return Promise.resolve();
    return fetch(base + "/" + encodeURIComponent(topic), {
      method: "POST",
      body: JSON.stringify(payload),
    }).catch(() => {});
  }

  function subscribeSignal(topic, onPayload, options) {
    const base = signalBase();
    const opts = options || {};
    if (!base || typeof EventSource !== "function") {
      return { ready: Promise.resolve(), close: () => {} };
    }

    const query = opts.since ? "?since=" + encodeURIComponent(opts.since) : "";
    let es = null;
    try {
      es = new EventSource(base + "/" + encodeURIComponent(topic) + "/sse" + query);
    } catch (_) {
      return { ready: Promise.resolve(), close: () => {} };
    }

    const ready = new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        resolve();
      };
      es.onopen = finish;
      setTimeout(finish, SIGNAL_READY_TIMEOUT_MS);
    });

    es.onmessage = (event) => {
      let envelope;
      try {
        envelope = JSON.parse(event.data);
      } catch (_) {
        return;
      }
      if (!envelope || envelope.event !== "message" || typeof envelope.message !== "string") {
        return;
      }
      let payload;
      try {
        payload = JSON.parse(envelope.message);
      } catch (_) {
        return;
      }
      if (payload && typeof payload === "object") onPayload(payload);
    };

    return {
      ready,
      close: () => {
        try {
          es.close();
        } catch (_) {}
      },
    };
  }

  /* ------------------------------------------------------------------ */
  /* ICE                                                                 */
  /* ------------------------------------------------------------------ */

  function waitForIce(pc) {
    if (pc.iceGatheringState === "complete") return Promise.resolve();
    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        pc.removeEventListener("icegatheringstatechange", check);
        resolve();
      };
      const check = () => {
        if (pc.iceGatheringState === "complete") finish();
      };
      pc.addEventListener("icegatheringstatechange", check);
      setTimeout(finish, GATHER_TIMEOUT_MS);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Host                                                                */
  /* ------------------------------------------------------------------ */

  function createHost(roomCode, options) {
    const code = normalizeRoomCode(roomCode);
    const handlers = options || {};
    const peers = new Map(); // peerId -> { pc, dc, open, meta }
    const seenOffers = new Set();
    let closed = false;

    function attachChannel(peer, dc) {
      peer.dc = dc;
      const markOpen = () => {
        if (peer.open) return;
        peer.open = true;
        if (handlers.onOpen) handlers.onOpen(peer);
        if (handlers.onPeers) handlers.onPeers(peers);
      };
      if (dc.readyState === "open") {
        markOpen();
      } else {
        dc.onopen = markOpen;
      }
      dc.onclose = () => {
        peer.open = false;
        if (handlers.onClose) handlers.onClose(peer);
        if (handlers.onPeers) handlers.onPeers(peers);
      };
      dc.onmessage = (event) => {
        let msg;
        try {
          msg = JSON.parse(event.data);
        } catch (_) {
          return;
        }
        if (handlers.onMessage) handlers.onMessage(peer, msg);
      };
    }

    async function handleOffer(msg) {
      if (closed || !msg || msg.t !== "offer") return;
      if (typeof msg.peerId !== "string" || typeof msg.sdp !== "string") return;
      if (seenOffers.has(msg.peerId)) return;
      seenOffers.add(msg.peerId);

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      const peer = { peerId: msg.peerId, pc, dc: null, open: false, meta: {} };
      peers.set(msg.peerId, peer);

      pc.ondatachannel = (event) => {
        attachChannel(peer, event.channel);
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
          peer.open = false;
          if (handlers.onClose) handlers.onClose(peer);
          if (handlers.onPeers) handlers.onPeers(peers);
        }
      };

      try {
        await pc.setRemoteDescription({ type: "offer", sdp: msg.sdp });
        await pc.setLocalDescription(await pc.createAnswer());
        await waitForIce(pc);
        if (closed) return;
        const answerPayload = {
          t: "answer",
          peerId: msg.peerId,
          sdp: pc.localDescription.sdp,
        };
        if (bc) {
          try {
            bc.postMessage(answerPayload);
          } catch (_) {}
        }
        publishSignal(guestTopic(code, msg.peerId), answerPayload);
      } catch (_) {
        drop(msg.peerId);
      }
    }

    const bc = openBroadcast(code, handleOffer);
    const sub = subscribeSignal(hostTopic(code), handleOffer);

    function send(peer, msg) {
      if (!peer || !peer.dc || peer.dc.readyState !== "open") return false;
      peer.dc.send(JSON.stringify(msg));
      return true;
    }

    function broadcast(msg) {
      let sent = 0;
      for (const peer of peers.values()) if (send(peer, msg)) sent++;
      return sent;
    }

    function drop(peerId) {
      const peer = peers.get(peerId);
      if (!peer) return;
      try {
        if (peer.dc) peer.dc.close();
        peer.pc.close();
      } catch (_) {}
      peers.delete(peerId);
      if (handlers.onPeers) handlers.onPeers(peers);
    }

    function close() {
      closed = true;
      sub.close();
      if (bc) {
        try {
          bc.close();
        } catch (_) {}
      }
      for (const peerId of [...peers.keys()]) drop(peerId);
    }

    return { code, peers, ready: sub.ready, send, broadcast, drop, close };
  }

  /* ------------------------------------------------------------------ */
  /* Invitado                                                            */
  /* ------------------------------------------------------------------ */

  async function joinByCode(roomCode, options) {
    const code = normalizeRoomCode(roomCode);
    if (!isValidRoomCode(code)) {
      return { error: "El código tiene que tener 6 caracteres" };
    }

    const handlers = options || {};
    const peerId = randomId(6);
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const channel = pc.createDataChannel("hdp", { ordered: true });
    let answered = false;
    let cleanedUp = false;

    function cleanupSignaling() {
      if (cleanedUp) return;
      cleanedUp = true;
      sub.close();
      if (bc) {
        try {
          bc.close();
        } catch (_) {}
      }
    }

    channel.onmessage = (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch (_) {
        return;
      }
      if (handlers.onMessage) handlers.onMessage(msg);
    };

    channel.onclose = () => {
      if (handlers.onClose) handlers.onClose();
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        if (handlers.onClose) handlers.onClose();
      }
    };

    async function handleAnswer(msg) {
      if (answered || !msg || msg.t !== "answer") return;
      if (msg.peerId !== peerId || typeof msg.sdp !== "string") return;
      if (pc.signalingState !== "have-local-offer") return;
      answered = true;
      try {
        await pc.setRemoteDescription({ type: "answer", sdp: msg.sdp });
      } catch (_) {
        answered = false;
      }
    }

    const bc = openBroadcast(code, handleAnswer);
    const sub = subscribeSignal(guestTopic(code, peerId), handleAnswer, { since: "10s" });

    const ready = new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanupSignaling();
        try {
          channel.close();
          pc.close();
        } catch (_) {}
        reject(new Error("No encontramos esa sala. Revisá el código de 6 caracteres."));
      }, JOIN_TIMEOUT_MS);

      const onOpen = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        cleanupSignaling();
        resolve(channel);
      };

      if (channel.readyState === "open") {
        onOpen();
      } else {
        channel.onopen = onOpen;
      }
    });

    try {
      await pc.setLocalDescription(await pc.createOffer());
      await Promise.all([waitForIce(pc), sub.ready]);
    } catch (e) {
      cleanupSignaling();
      try {
        channel.close();
        pc.close();
      } catch (_) {}
      return { error: "No se pudo preparar la conexión: " + e.message };
    }

    const offerPayload = {
      t: "offer",
      peerId,
      sdp: pc.localDescription.sdp,
    };

    if (bc) {
      try {
        bc.postMessage(offerPayload);
      } catch (_) {}
    }
    publishSignal(hostTopic(code), offerPayload);

    return {
      code,
      peerId,
      pc,
      channel,
      ready,
      send: (msg) => {
        if (!channel || channel.readyState !== "open") return false;
        channel.send(JSON.stringify(msg));
        return true;
      },
      close: () => {
        cleanupSignaling();
        try {
          channel.close();
          pc.close();
        } catch (_) {}
      },
    };
  }

  return {
    ROOM_CODE_LENGTH,
    normalizeRoomCode,
    isValidRoomCode,
    createHost,
    joinByCode,
    randomId,
  };
})();
