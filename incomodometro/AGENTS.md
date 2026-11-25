# AGENTS.md

Sitio estático sin build ni dependencias. Se abre `index.html` directamente (`file://`) o desde `node ../scripts/serve.js`.

## Estructura

- `index.html`: seis vistas (inicio, situación, intersticial, votación, revelado con termómetro y ranking) y diálogo "Cómo se juega". Carga `../shared/theme.js`, `../shared/chrome.css` y `../shared/chrome.js`.
- `assets/app.js`: estado de la partida, DOM y lógica pura exportada en `window.INCOMODOMETRO_LOGIC` (`thermometerNote`, `countVotes`, `topIds`, `addRoundScores`, `rankScores`).
- `assets/styles.css`: estilos mobile-first con temas claro/oscuro.
- `data/prompts.js`: 80 situaciones en `window.INCOMODOMETRO_DATA`.
- `test/game.test.js`: pruebas de contenido, mazo, conteo de votos y tramos del termómetro.

## Convenciones

- Las situaciones completan `"¿Quién incomoda más cuando…?"`: empiezan en minúscula y no llevan puntuación final.
- Contenido: incomodidad social cotidiana, sin crueldad, violencia ni explicitud.
- Usá siempre vocabulario del juego (`situación` / `situaciones`, nunca `consigna`).
- Toda lógica de conteo o termómetro va en `INCOMODOMETRO_LOGIC` con pruebas en `test/game.test.js`.
- El tema y el botón de volver vienen de `../shared/`.
- Al terminar: `node test/game.test.js` y `node ../test/checks.js`.
