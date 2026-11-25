/* Catálogo único de juegos del repo: lo usa el índice y también los chequeos
   bajo Node. Sin dependencias ni build. */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.JUEGOS_CATALOG = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var GAMES = [
    {
      slug: "en-palabras",
      title: "En Palabras",
      mono: "EP",
      monoSize: null,
      accent: "#8C3A2A",
      monoBg: "#1B1917",
      monoInk: "#F6F1E9",
      meta: "Cartas para conversar de verdad.",
      intro: "Cartas con preguntas para conversar de verdad. Elegís un mazo, leés la carta en voz alta y respondés. Sin puntaje: la gracia es la charla.",
      darkOnly: false,
      players: "2+",
      dataFile: "data/decks.js",
      dataGlobal: "EN_PALABRAS_DECKS"
    },
    {
      slug: "botella",
      title: "La Botella",
      mono: "B",
      monoSize: null,
      accent: "#B4553A",
      monoBg: "#B4553A",
      monoInk: "#FFF6EA",
      meta: "La ruleta elige quién responde.",
      intro: "Girás la rueda y la suerte elige a alguien, que responde una pregunta o se lleva un reto. De 2 a 12 personas y tres intensidades.",
      darkOnly: false,
      players: "2-12",
      dataFile: "data/questions.js",
      dataGlobal: "BOTELLA_DECKS"
    },
    {
      slug: "charadas",
      title: "Charadas",
      mono: "CH",
      monoSize: "0.88rem",
      accent: "#1F6B4B",
      monoBg: "#1B1917",
      monoInk: "#F6F1E9",
      meta: "Mímica contra reloj.",
      intro: "Mímica contra reloj con un solo celular: el que adivina se lo apoya en la frente y el grupo actúa. Sesenta, noventa o ciento veinte segundos.",
      darkOnly: false,
      players: "2+",
      dataFile: "data/words.js",
      dataGlobal: "CHARADAS_DATA"
    },
    {
      slug: "ahorcado",
      title: "Ahorcado",
      mono: "AH",
      monoSize: "0.88rem",
      accent: "#6B4A8A",
      monoBg: "#1B1917",
      monoInk: "#F6F1E9",
      meta: "Palabra oculta, seis errores.",
      intro: "El grupo adivina una palabra letra por letra. Cada error dibuja una parte del muñeco: a los seis se termina. Cuatro mazos para elegir y racha de palabras seguidas.",
      darkOnly: false,
      players: "2+",
      dataFile: "data/words.js",
      dataGlobal: "AHORCADO_DATA"
    },
    {
      slug: "yo-nunca",
      title: "Yo Nunca",
      mono: "YN",
      monoSize: "0.88rem",
      accent: "#78243A",
      monoBg: "#78243A",
      monoInk: "#FFF6EC",
      meta: "Confesiones con vidas.",
      intro: "Frases para completar en voz alta: quien hizo la cosa toca su nombre y pierde una vida. De 2 a 12 jugadores y tres intensidades.",
      darkOnly: false,
      players: "2-12",
      dataFile: "data/statements.js",
      dataGlobal: "YO_NUNCA_DATA"
    },
    {
      slug: "mas-probable",
      title: "¿Quién es más probable?",
      mono: "MP",
      monoSize: "0.88rem",
      accent: "#0F5B62",
      monoBg: "#0F5B62",
      monoInk: "#FFF9F0",
      meta: "Voto secreto, un celular.",
      intro: "Se lee una consigna, el celular circula y cada uno vota en secreto. Al final se revelan los votos y queda un ranking. De 3 a 12.",
      darkOnly: false,
      players: "3-12",
      dataFile: "data/prompts.js",
      dataGlobal: "MAS_PROBABLE_DATA"
    },
    {
      slug: "incomodometro",
      title: "El Incomodómetro",
      mono: "IN",
      monoSize: "0.82rem",
      accent: "#5C4A87",
      monoBg: "#5C4A87",
      monoInk: "#FFF9F0",
      meta: "Quién incomoda más.",
      intro: "Se lee una situación, el celular circula y cada uno vota en secreto quién incomoda más cuando pasa eso. Al final se revelan los votos, un termómetro de incomodidad y el ranking. De 3 a 12.",
      darkOnly: false,
      players: "3-12",
      dataFile: "data/prompts.js",
      dataGlobal: "INCOMODOMETRO_DATA"
    },
    {
      slug: "despues-de-las-doce",
      title: "Después de las doce",
      mono: "12",
      monoSize: "0.9rem",
      accent: "#E0604F",
      monoBg: "#140D10",
      monoInk: "#E0604F",
      meta: "Verdades, retos y deseos.",
      intro: "Verdades, retos y deseos para cuando la noche ya está avanzada. De a dos o en grupo, con tres intensidades. Pensado para +18, con gente de confianza: todo es opcional y la palabra de corte es «pausa».",
      darkOnly: true,
      players: "2-8",
      dataFile: "data/cards.js",
      dataGlobal: "DESPUES_DATA"
    },
    {
      slug: "hdp",
      title: "HDP",
      mono: "HDP",
      monoSize: "0.72rem",
      accent: "#E6A23C",
      monoBg: "#0F0E0C",
      monoInk: "#F3EDE4",
      meta: "Frases para completar. De 3 a 12.",
      intro: "Frases para completar con las cartas más picantes. Uno hace de juez y elige la más graciosa; gana quien junta más puntos. De 3 a 12, sin servidor: alguien crea la sala y los demás entran con un código.",
      darkOnly: true,
      players: "3-12",
      dataFile: "data/cards.js",
      dataGlobal: "HDP_DATA"
    }
  ];

  function resolveGameHref(slug, protocol) {
    var clean = String(slug || "").replace(/^\/+|\/+$/g, "");
    return protocol === "file:" ? clean + "/index.html" : clean + "/";
  }

  function resolveHubHref(protocol) {
    return protocol === "file:" ? "../index.html" : "../";
  }

  return {
    games: GAMES,
    resolveGameHref: resolveGameHref,
    resolveHubHref: resolveHubHref
  };
});
