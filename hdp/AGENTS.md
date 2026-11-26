# AGENTS.md

Juego multijugador P2P sin servidor ni build (WebRTC data channels). Se abre `index.html` directamente (`file://`) o desde `node ../scripts/serve.js`.

## Estructura

- `index.html`: vistas (inicio, lobby, ronda, juez, judging, reveal, final y diálogo "Cómo se juega"). Solo oscuro (`data-theme-mode="dark-only"`). Carga `../shared/chrome.css` y `../shared/chrome.js`.
- `assets/engine.js`: motor puro del juego (`HDP_ENGINE`). Sin DOM, red ni disco.
- `assets/net.js`: transporte WebRTC con código de sala de 6 caracteres y señalización automática (`BroadcastChannel` + canal HTTPS/SSE `ntfy.sh`) (`HDP_NET`).
- `assets/local.js`: adaptador `/api/*` sobre `HDP_ENGINE` y `HDP_NET` (`HDP_BACKEND`).
- `assets/app.js` y `assets/styles.css`: interfaz nocturna fija.
- `data/cards.js`: 74 cartas negras (`pick` 1 o 2) y 244 blancas (`HDP_DATA` / `HDP_CARDS`).
- `test/game.test.js`: pruebas del mazo y partida completa contra `engine.js`.

## Convenciones

- No hay servidor Node ni polling HTTP: no reintroduzcas rutas `/api` reales ni `server.js`.
- Cada carta negra en `data/cards.js` debe tener tantos `___` como indica su propiedad `pick`.
- El juez nunca debe recibir autores ni tokens en `snapshotFor` durante la fase `judging`.
- El juego es `dark-only`; el botón de volver al índice viene de `../shared/chrome.js` y se oculta fuera de `#viewHome`.
- Al terminar: `node test/game.test.js` y `node ../test/checks.js`.
