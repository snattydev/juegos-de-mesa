# AGENTS.md

Sitio estático sin build ni dependencias. Se abre `index.html` directamente (`file://`) o desde `node ../scripts/serve.js`.

## Estructura

- `index.html`: vistas (inicio, juego, diálogo "Cómo se juega"). Carga `../shared/theme.js`, `../shared/chrome.css` y `../shared/chrome.js`.
- `assets/app.js`: estado del juego, DOM, animación del giro y persistencia de jugadores/intensidad en `localStorage`.
- `assets/wheel.js`: lógica pura de la rueda (`pickSector`, `rotationFor`, `sectorCenter`) y de mazos (`createDeck`, `shuffle`). Sin DOM.
- `assets/styles.css`: estilos mobile-first con paleta clara y oscura (`--paper` como superficie).
- `data/questions.js`: contenido en `window.BOTELLA_DECKS` (tres intensidades de 45 preguntas).
- `test/game.test.js`: pruebas de contenido, rueda y mazos.

## Convenciones

- HTML/CSS/JS vanilla. No agregues dependencias ni tooling salvo que se pida.
- Textos en español rioplatense; las preguntas terminan en `?` y no superan los 110 caracteres.
- Toda nueva lógica matemática de la rueda o reparto va en `assets/wheel.js` con sus pruebas en `test/game.test.js`.
- Respetá `prefers-reduced-motion` en el giro y las transiciones.
- El tema compartido y el botón de volver vienen de `../shared/`; no agregues toggles propios.
- Al terminar: `node test/game.test.js` y `node ../test/checks.js`.
