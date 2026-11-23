"use strict";
// Partida completa contra el motor puro: lobby → jugar → juzgar → revelar → fin.
const E = require("../public/assets/engine.js");

let checks = 0, fails = 0;
function ok(name, cond, extra) {
  checks++;
  if (!cond) { fails++; console.log("✗ " + name + (extra ? " — " + extra : "")); }
  else console.log("✓ " + name);
}

const { room, token: host } = E.createRoom("Host");
ok("sala creada", room && room.code.length === 4, room && room.code);
ok("host conectado", room.players.get(host).connected === true);

const a = E.addPlayer(room, "Ana");
const b = E.addPlayer(room, "Beto");
ok("dos jugadores más", !!a.token && !!b.token);
ok("no arranca con 3", E.apply(room, host, "start").ok === true);

const snapHost = E.snapshotFor(room, host);
ok("fase playing", snapHost.phase === "playing");
ok("mano de 10", snapHost.hand.length === 10, String(snapHost.hand.length));
ok("carta negra con pick", snapHost.blackCard && snapHost.blackCard.pick >= 1);
ok("host es juez", snapHost.you.isJudge === true);

// El juez no juega.
ok("juez rechazado", E.apply(room, host, "play", { cardIds: [snapHost.hand[0].id] }).error === "El juez no juega cartas");

// Los dos no-jueces juegan el pick que pida la carta.
const pick = snapHost.blackCard.pick;
const snA = E.snapshotFor(room, a.token);
const snB = E.snapshotFor(room, b.token);
ok("jugada de Ana", E.apply(room, a.token, "play", { cardIds: snA.hand.slice(0, pick).map(c => c.id) }).ok === true);
ok("jugada repetida rechazada", !!E.apply(room, a.token, "play", { cardIds: snA.hand.slice(0, pick).map(c => c.id) }).error);
ok("jugada de Beto", E.apply(room, b.token, "play", { cardIds: snB.hand.slice(0, pick).map(c => c.id) }).ok === true);

const snJ = E.snapshotFor(room, host);
ok("pasó a judging", snJ.phase === "judging", snJ.phase);
ok("el juez ve 2 respuestas", snJ.submissions.length === 2, String(snJ.submissions && snJ.submissions.length));
ok("los demás no ven cartas", E.snapshotFor(room, a.token).submissions === undefined);

const winner = snJ.submissions[0].id;
ok("juez elige", E.apply(room, host, "judge", { submissionId: winner }).ok === true);
ok("fase reveal", E.snapshotFor(room, host).phase === "reveal");
ok("hay ganador con nombre", !!E.snapshotFor(room, a.token).winnerName);

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
ok("revncha vuelve a lobby", E.apply(room, host, "restart").ok === true && E.snapshotFor(room, host).phase === "lobby");
ok("scores en cero", E.snapshotFor(room, host).players.every(p => p.score === 0));
ok("settings fuera de rango rechazado", !!E.apply(room, host, "settings", { targetScore: 99 }).error);
ok("jugador puede salir", E.removePlayer(room, b.token).ok === true);
ok("sala queda con 2", room.players.size === 2);

console.log("\n" + checks + " chequeos, " + fails + " fallas.");
process.exit(fails ? 1 : 0);
