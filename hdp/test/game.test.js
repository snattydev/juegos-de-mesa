"use strict";
// Pruebas de contenido y motor de HDP: node test/game.test.js
const C = require("../data/cards.js");
const E = require("../assets/engine.js");

let checks = 0, fails = 0;
function ok(name, cond, extra) {
  checks++;
  if (!cond) { fails++; console.log("✗ " + name + (extra ? " — " + extra : "")); }
  else console.log("✓ " + name);
}

function normalize(text) {
  return String(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Contenido del mazo
ok("74 cartas negras", Array.isArray(C.BLACK) && C.BLACK.length === 74, String(C.BLACK && C.BLACK.length));
ok("244 cartas blancas", Array.isArray(C.WHITE) && C.WHITE.length === 244, String(C.WHITE && C.WHITE.length));

const badBlack = C.BLACK.filter((card) => {
  if (!card || typeof card.text !== "string" || card.text.trim() === "") return true;
  const blanks = (card.text.match(/___/g) || []).length;
  return blanks < 1 || blanks !== card.pick;
});
ok("cada carta negra tiene pick igual a la cantidad de ___", badBlack.length === 0, String(badBlack.length));

const badWhite = C.WHITE.filter((text) => typeof text !== "string" || text.trim() === "");
ok("todas las cartas blancas son texto no vacío", badWhite.length === 0, String(badWhite.length));

const blackSeen = new Set();
const blackDups = C.BLACK.filter((card) => {
  const key = normalize(card.text);
  if (blackSeen.has(key)) return true;
  blackSeen.add(key);
  return false;
});
ok("cero duplicados en cartas negras", blackDups.length === 0, String(blackDups.length));

const whiteSeen = new Set();
const whiteDups = C.WHITE.filter((text) => {
  const key = normalize(text);
  if (whiteSeen.has(key)) return true;
  whiteSeen.add(key);
  return false;
});
ok("cero duplicados en cartas blancas", whiteDups.length === 0, String(whiteDups.length));

// Motor puro: lobby → jugar → juzgar → revelar → fin
const { room, token: host } = E.createRoom("Host");
ok("sala creada con código de 6 caracteres", room && room.code.length === 6 && /^[A-Z2-9]{6}$/.test(room.code), room && room.code);
ok("host conectado", room.players.get(host).connected === true);
ok("tiempo por ronda por defecto es 30s", E.snapshotFor(room, host).roundSeconds === 30);

const a = E.addPlayer(room, "Ana");
ok("no arranca con 2", !!E.apply(room, host, "start").error);

const b = E.addPlayer(room, "Beto");
ok("dos jugadores más", !!a.token && !!b.token);
ok("arranca con 3", E.apply(room, host, "start", { now: 1000 }).ok === true);

const snapHost = E.snapshotFor(room, host, 1000);
ok("fase playing", snapHost.phase === "playing");
ok("mano de 10", snapHost.hand.length === 10, String(snapHost.hand.length));
ok("ninguna carta marcada como nueva al empezar", snapHost.hand.every((c) => c.isNew === false));
ok("timer arranca en 30000ms", snapHost.roundRemainingMs === 30000, String(snapHost.roundRemainingMs));
ok("carta negra con pick", snapHost.blackCard && snapHost.blackCard.pick >= 1);
ok("host es juez", snapHost.you.isJudge === true);

// El juez no juega.
ok("juez rechazado", E.apply(room, host, "play", { cardIds: [snapHost.hand[0].id] }).error === "El juez no juega cartas");

// Los dos no-jueces juegan posiciones específicas del medio de la mano.
const pick = snapHost.blackCard.pick;
const snA = E.snapshotFor(room, a.token, 2000);
const snB = E.snapshotFor(room, b.token, 2000);
const hostRound1Ids = snapHost.hand.map((c) => c.id);
const anaRound1Ids = snA.hand.map((c) => c.id);
const anaPlayedIdx = pick === 1 ? [2] : [1, 4];
const anaPlayedIds = anaPlayedIdx.map((i) => anaRound1Ids[i]);

ok("jugada de Ana", E.apply(room, a.token, "play", { cardIds: anaPlayedIds }).ok === true);
ok("jugada repetida rechazada", !!E.apply(room, a.token, "play", { cardIds: anaPlayedIds }).error);
ok("jugada de Beto", E.apply(room, b.token, "play", { cardIds: snB.hand.slice(0, pick).map(c => c.id) }).ok === true);

const snJ = E.snapshotFor(room, host, 3000);
ok("pasó a judging", snJ.phase === "judging", snJ.phase);
ok("timer se detiene en judging", snJ.roundRemainingMs === null, String(snJ.roundRemainingMs));
ok("el juez ve 2 respuestas", snJ.submissions.length === 2, String(snJ.submissions && snJ.submissions.length));
ok("los demás no ven cartas", E.snapshotFor(room, a.token).submissions === undefined);

const winner = snJ.submissions[0].id;
ok("juez elige", E.apply(room, host, "judge", { submissionId: winner }).ok === true);
ok("fase reveal", E.snapshotFor(room, host).phase === "reveal");
ok("hay ganador con nombre", !!E.snapshotFor(room, a.token).winnerName);

// Pasar a ronda 2: solo se renuevan las cartas jugadas en el mismo lugar.
ok("pasa a ronda 2", E.apply(room, host, "next", { now: 10000 }).ok === true);
const snA2 = E.snapshotFor(room, a.token, 10000);
const snH2 = E.snapshotFor(room, host, 10000);
ok("Ana mantiene 10 cartas en ronda 2", snA2.hand.length === 10, String(snA2.hand.length));
ok(
  "Ana conserva cartas no jugadas en su lugar y solo renueva las usadas",
  snA2.hand.every((card, idx) => {
    if (anaPlayedIdx.includes(idx)) {
      return card.id !== anaRound1Ids[idx] && card.isNew === true;
    }
    return card.id === anaRound1Ids[idx] && card.isNew === false;
  })
);
ok(
  "Host (ex juez) conserva sus 10 cartas intactas sin marcar nuevas",
  snH2.hand.every((card, idx) => card.id === hostRound1Ids[idx] && card.isNew === false)
);

// Rondas hasta el objetivo.
let guard = 0;
while (E.snapshotFor(room, host).phase !== "ended" && guard++ < 40) {
  const s = E.snapshotFor(room, host);
  if (s.phase === "reveal") { E.apply(room, host, "next"); continue; }
  if (s.phase === "playing") {
    for (const p of [...room.players.values()]) {
      if (p.token === room.judgeId) continue;
      const sp = E.snapshotFor(room, p.token);
      const ids = sp.hand.slice(0, room.blackCard.pick).map(c => c.id);
      E.apply(room, p.token, "play", { cardIds: ids });
    }
    continue;
  }
  if (s.phase === "judging") {
    // Solo el juez ve las respuestas, y solo el juez puede elegir.
    const sj = E.snapshotFor(room, room.judgeId);
    if (host !== room.judgeId) {
      const rechazo = E.apply(room, host, "judge", { submissionId: sj.submissions[0].id });
      ok("host no-juez no puede juzgar", !!rechazo.error, rechazo.error);
    }
    E.apply(room, room.judgeId, "judge", { submissionId: sj.submissions[0].id });
    continue;
  }
  break;
}
const fin = E.snapshotFor(room, host);
ok("llegó a ended", fin.phase === "ended", fin.phase);
ok("scores ordenados", Array.isArray(fin.scores) && fin.scores.length === 3, JSON.stringify(fin.scores));
ok("alguien llegó al target", fin.scores[0].score >= room.targetScore, JSON.stringify(fin.scores[0]));
ok("revancha vuelve a lobby", E.apply(room, host, "restart").ok === true && E.snapshotFor(room, host).phase === "lobby");
ok("scores en cero", E.snapshotFor(room, host).players.every(p => p.score === 0));
ok("settings fuera de rango rechazado", !!E.apply(room, host, "settings", { targetScore: 99 }).error);
ok("timer fuera de rango rechazado", !!E.apply(room, host, "settings", { roundSeconds: 5 }).error);
ok("timer configurable a 15s", E.apply(room, host, "settings", { roundSeconds: 15 }).ok === true);

// Timer y timeout en sala dedicada.
const tRoomRes = E.createRoom("Mesa");
const tRoom = tRoomRes.room;
const tHost = tRoomRes.token;
const tA = E.addPlayer(tRoom, "Cami");
const tB = E.addPlayer(tRoom, "Lucho");
ok("configura timer de 20s", E.apply(tRoom, tHost, "settings", { roundSeconds: 20 }).ok === true);
ok("arranca con t0=1000", E.apply(tRoom, tHost, "start", { now: 1000 }).ok === true);
ok("queda 12000ms a mitad de ronda", E.snapshotFor(tRoom, tHost, 9000).roundRemainingMs === 12000);
ok("timeout antes de tiempo rechazado", !!E.apply(tRoom, tHost, "timeout", { now: 15000 }).error);
ok("timeout por no-host rechazado", !!E.apply(tRoom, tA.token, "timeout", { now: 25000 }).error);

// Parcial: solo Cami juega antes de tiempo, vence el reloj y pasa a judging con 1 respuesta.
const tPick = tRoom.blackCard.pick;
const tSnA = E.snapshotFor(tRoom, tA.token, 5000);
const tSnBBefore = E.snapshotFor(tRoom, tB.token, 5000);
E.apply(tRoom, tA.token, "play", { cardIds: tSnA.hand.slice(0, tPick).map((c) => c.id) });
ok("timeout con respuesta parcial avanza a judging", E.apply(tRoom, tHost, "timeout", { now: 21000 }).ok === true);
const tSnJudging = E.snapshotFor(tRoom, tHost, 21000);
ok("judging tras timeout marca timedOut=true", tSnJudging.phase === "judging" && tSnJudging.timedOut === true);
ok("solo entra la respuesta enviada", tSnJudging.submissions.length === 1);
ok(
  "quien no jugó conserva su mano intacta",
  E.snapshotFor(tRoom, tB.token, 21000).hand.every((c, idx) => c.id === tSnBBefore.hand[idx].id)
);
E.apply(tRoom, tHost, "judge", { submissionId: tSnJudging.submissions[0].id });
E.apply(tRoom, tHost, "next", { now: 30000 });

// Sin respuestas al vencer el reloj: auto-juega para los no-jueces y avanza a judging.
const tSnRound2 = E.snapshotFor(tRoom, tHost, 30000);
ok("timedOut se limpia en nueva ronda", tSnRound2.timedOut === false && tSnRound2.roundRemainingMs === 20000);
ok("timeout sin respuestas auto-juega y pasa a judging", E.apply(tRoom, tHost, "timeout", { now: 50000 }).ok === true);
const tSnAutoJudge = E.snapshotFor(tRoom, tRoom.judgeId, 50000);
ok("auto-timeout genera 2 respuestas", tSnAutoJudge.phase === "judging" && tSnAutoJudge.timedOut === true && tSnAutoJudge.submissions.length === 2);

// Modo sin límite (roundSeconds: 0)
ok("configura modo sin límite", E.apply(tRoom, tHost, "settings", { roundSeconds: 0 }).ok === true);
E.apply(tRoom, tRoom.judgeId, "judge", { submissionId: tSnAutoJudge.submissions[0].id });
E.apply(tRoom, tHost, "next", { now: 60000 });
ok("sin límite devuelve roundRemainingMs=null", E.snapshotFor(tRoom, tHost, 65000).roundRemainingMs === null);
ok("timeout en modo sin límite es rechazado", !!E.apply(tRoom, tHost, "timeout", { now: 999999 }).error);

ok("jugador puede salir", E.removePlayer(room, b.token).ok === true);
ok("sala queda con 2", room.players.size === 2);

console.log("\n" + checks + " chequeos, " + fails + " fallas.");
process.exit(fails ? 1 : 0);
