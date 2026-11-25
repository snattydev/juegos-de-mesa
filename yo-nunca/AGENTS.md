# AGENTS.md

Sitio estático sin build ni dependencias. Se abre `index.html` directamente (`file://`) o desde `node ../scripts/serve.js`.

## Estructura

- `index.html`: vistas (inicio, partida, cierre y diálogo "Cómo se juega"). Carga `../shared/theme.js`, `../shared/chrome.css` y `../shared/chrome.js`.
- `assets/app.js`: estado, DOM y lógica de mazo exportada en `window.YO_NUNCA_CORE` (`LEVELS`, `buildDeck`, `createRun`, `shuffle`).
- `assets/styles.css`: estilos mobile-first sin scroll de página, paleta crema/vino (claro) y cálida oscura (`#F4ECDF` / `#12100E`).
- `data/statements.js`: 360 frases en `window.YO_NUNCA_DATA` (`suave`, `media`, `picante`: 120 cada una).
- `test/game.test.js`: pruebas de contenido y simulaciones completas del mazo.

## Convenciones

- Cada frase empieza con `"Yo nunca… "`, termina con `.`, no supera los 110 caracteres y no lleva emojis ni placeholders.
- Los temas entre los tres niveles se mantienen separados para no repetir el mismo chiste.
- `<meta name="theme-color">` lleva `data-light="#F4ECDF"` y `data-dark="#12100E"` para que `../shared/theme.js` respete la paleta propia del juego.
- Toda lógica de mazo va en `YO_NUNCA_CORE` y se prueba en `test/game.test.js`.
- Al terminar: `node test/game.test.js` y `node ../test/checks.js`.
