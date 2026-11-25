"use strict";

/*
 * Transporte P2P de HDP por WebRTC. Sin servidor y sin dependencias: el host
 * crea una oferta por jugador, se la pasa como texto, recibe la respuesta por
 * el mismo camino y desde ahí hablan por un data channel.
 *
 * El código es un texto portable (se puede mandar por WhatsApp):
 *   invitación  HDI1.<peerId>.<base64url del SDP>
 *   respuesta   HDA1.<peerId>.<base64url del SDP>
 *
 * Funciona en http:// sobre la LAN: no usa cámara ni micrófono, solo data
 * channels, que no requieren contexto seguro.
 */
var HDP_NET = (function () {
  const OFFER_PREFIX = "HDI1";
  const ANSWER_PREFIX = "HDA1";
  const GATHER_TIMEOUT_MS = 3000;

  /* ------------------------------------------------------------------ */
  /* Códigos                                                             */
  /* ------------------------------------------------------------------ */

  function b64url(text) {
    const bytes = new TextEncoder().encode(text);
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function unb64url(code) {
    const norm = code.replace(/-/g, "+").replace(/_/g, "/");
    const pad = norm + "===".slice((norm.length + 3) % 4);
    const bin = atob(pad);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
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

  function parseCode(code) {
    const parts = String(code || "").trim().split(".");
    if (parts.length !== 3) return null;
    if (parts[0] !== OFFER_PREFIX && parts[0] !== ANSWER_PREFIX) return null;
    if (!/^[A-Z2-9]{6}$/.test(parts[1])) return null;
    try {
      const data = JSON.parse(unb64url(parts[2]));
      if (!data || typeof data.s !== "string" || typeof data.t !== "string") return null;
      return { kind: parts[0], peerId: parts[1], description: data };
    } catch (e) {
      return null;
    }
  }

  /* ------------------------------------------------------------------ */
  /* SDP                                                                 */
  /* ------------------------------------------------------------------ */

  function sdpOf(pc) {
    return JSON.stringify({ t: pc.localDescription.type, s: pc.localDescription.sdp });
  }

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
      // Si la red es rara, seguimos con lo que haya: los candidatos host de la
      // LAN suelen estar listos enseguida.
      setTimeout(finish, GATHER_TIMEOUT_MS);
    });
  }

  /* ------------------------------------------------------------------ */
  /* Host                                                                */
  /* ------------------------------------------------------------------ */

  function createHost(options) {
    const handlers = options || {};
    const peers = new Map(); // peerId -> { pc, dc, open, meta }

    function makePeer(peerId) {
      const pc = new RTCPeerConnection({ iceServers: [] });
      const dc = pc.createDataChannel("hdp", { ordered: true });
      const peer = { peerId, pc, dc, open: false, meta: {} };
      peers.set(peerId, peer);

      dc.onopen = () => {
        peer.open = true;
        if (handlers.onOpen) handlers.onOpen(peer);
        if (handlers.onPeers) handlers.onPeers(peers);
      };
      dc.onclose = () => {
        peer.open = false;
        if (handlers.onClose) handlers.onClose(peer);
        if (handlers.onPeers) handlers.onPeers(peers);
      };
      dc.onmessage = (event) => {
        let msg;
        try {
          msg = JSON.parse(event.data);
        } catch (e) {
          return;
        }
        if (handlers.onMessage) handlers.onMessage(peer, msg);
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
          peer.open = false;
          if (handlers.onClose) handlers.onClose(peer);
          if (handlers.onPeers) handlers.onPeers(peers);
        }
      };
      return peer;
    }

    // Crea un peer nuevo y devuelve el código para pasarle al invitado.
    async function invite() {
      const peerId = randomId(6);
      const peer = makePeer(peerId);
      await peer.pc.setLocalDescription(await peer.pc.createOffer());
      await waitForIce(peer.pc);
      return { peerId, code: OFFER_PREFIX + "." + peerId + "." + b64url(sdpOf(peer.pc)) };
    }

    // Recibe el código de respuesta que devolvió el invitado.
    async function acceptAnswer(code) {
      const parsed = parseCode(code);
      if (!parsed) return { error: "El código no parece una respuesta" };
      if (parsed.kind !== ANSWER_PREFIX) return { error: "Eso es una invitación, no una respuesta" };
      const peer = peers.get(parsed.peerId);
      if (!peer) return { error: "Ese código no es de esta sesión (o ya lo usaste)" };
      if (peer.pc.signalingState !== "have-local-offer") return { error: "Ese jugador ya está conectado" };
      try {
        await peer.pc.setRemoteDescription({ type: parsed.description.t, sdp: parsed.description.s });
      } catch (e) {
        return { error: "No se pudo conectar: " + e.message };
      }
      return { ok: true, peerId: peer.peerId };
    }

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
        peer.dc.close();
        peer.pc.close();
      } catch (e) {}
      peers.delete(peerId);
      if (handlers.onPeers) handlers.onPeers(peers);
    }

    function close() {
      for (const peerId of [...peers.keys()]) drop(peerId);
    }

    return { peers, invite, acceptAnswer, send, broadcast, drop, close };
  }

  /* ------------------------------------------------------------------ */
  /* Invitado                                                            */
  /* ------------------------------------------------------------------ */

  async function join(code, options) {
    const handlers = options || {};
    const parsed = parseCode(code);
    if (!parsed) return { error: "El código no parece una invitación" };
    if (parsed.kind !== OFFER_PREFIX) return { error: "Eso es una respuesta, no una invitación" };

    const pc = new RTCPeerConnection({ iceServers: [] });
    let channel = null;
    const ready = new Promise((resolve) => {
      pc.ondatachannel = (event) => {
        channel = event.channel;
        attachChannel(channel);
        resolve(channel);
      };
    });

    function attachChannel(dc) {
      dc.onmessage = (event) => {
        let msg;
        try {
          msg = JSON.parse(event.data);
        } catch (e) {
          return;
        }
        if (handlers.onMessage) handlers.onMessage(msg);
      };
      dc.onclose = () => {
        if (handlers.onClose) handlers.onClose();
      };
    }

    try {
      await pc.setRemoteDescription({ type: parsed.description.t, sdp: parsed.description.s });
      await pc.setLocalDescription(await pc.createAnswer());
    } catch (e) {
      return { error: "No se pudo preparar la conexión: " + e.message };
    }

    await waitForIce(pc);
    const answerCode = ANSWER_PREFIX + "." + parsed.peerId + "." + b64url(sdpOf(pc));

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        if (handlers.onClose) handlers.onClose();
      }
    };

    return {
      pc,
      answerCode,
      // El canal no existe hasta que el host pega la respuesta: esperalo con esto.
      ready,
      get channel() {
        return channel;
      },
      send: (msg) => {
        if (!channel || channel.readyState !== "open") return false;
        channel.send(JSON.stringify(msg));
        return true;
      },
      close: () => {
        try {
          if (channel) channel.close();
          pc.close();
        } catch (e) {}
      },
    };
  }

  return {
    createHost,
    join,
    parseCode,
    randomId,
    sdpLength: (code) => String(code || "").length,
  };
})();
