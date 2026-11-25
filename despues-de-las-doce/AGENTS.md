# AGENTS.md

Sitio estático sin build ni dependencias. Se abre `index.html` directamente (`file://`) o desde `node ../scripts/serve.js`.

## Estructura

- `index.html`: vistas (setup, juego, cierre y diálogos de cómo jugar, reglas de la casa y selección manual). Solo oscuro (`data-theme-mode="dark-only"`). Carga `../shared/chrome.css` y `../shared/chrome.js`.
- `assets/app.js`: estado, turnos, flujo de cartas, persistencia de nombres de grupo y lógica pura en `window.DESPUES_LOGIC`.
- `assets/styles.css`: paleta nocturna fija (vino/coral/dorado). En pantallas `<= 860px`, `#viewGame .game-top` reserva `padding-right` para no chocar con `.rules-fab`.
- `data/cards.js`: 216 cartas (`previa`, `caliente`, `sin-filtro`) y `finalCards` en `window.DESPUES_DATA`.
- `test/game.test.js`: validación de conteos, audiencias (`solo`/`grupo`/`ambos`), cartas finales y `DESPUES_LOGIC`.

## Convenciones

- Este juego es `dark-only`: no agregues toggle ni variables de tema claro.
- Ninguna carta con `audience: "solo"` o `"ambos"` ni `finalCards.*.solo` puede exigir dinámica de grupo (`"elegí a alguien"`, `"alguien de acá"`, etc.).
- El botón `#setupBackBtn` delega en `window.JuegosChrome.openHubDialog` para confirmar antes de volver al índice.
- Mantené visibles las reglas de la casa y la palabra de corte «pausa». Sin contenido explícito ni coercitivo.
- Al terminar: `node test/game.test.js` y `node ../test/checks.js`.
