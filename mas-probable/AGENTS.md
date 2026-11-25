# AGENTS.md

Sitio estático sin build ni dependencias. Se abre `index.html` directamente (`file://`) o desde `node ../scripts/serve.js`.

## Estructura

- `index.html`: seis vistas (inicio, consigna, intersticial, votación, revelado y ranking) y diálogo "Cómo se juega". Carga `../shared/theme.js`, `../shared/chrome.css` y `../shared/chrome.js`.
- `assets/app.js`: estado de la partida, DOM y lógica pura exportada en `window.MAS_PROBABLE_LOGIC`.
- `assets/styles.css`: estilos mobile-first con temas claro/oscuro.
- `data/prompts.js`: 100 consignas en `window.MAS_PROBABLE_DATA`.
- `test/game.test.js`: pruebas de contenido, mazo y conteo de votos.

## Convenciones

- Las consignas completan `"¿Quién es más probable que…?"`: empiezan en minúscula y no llevan puntuación final.
- El voto secreto depende de la pantalla intermedia (`#viewHandoff`) antes de entrar a votar; no la saltees.
- Toda lógica pura de conteo y ranking va en `MAS_PROBABLE_LOGIC` con pruebas en `test/game.test.js`.
- Todo color nuevo va en `:root` y `:root[data-theme="dark"]`. El tema y el botón de volver vienen de `../shared/`.
- Al terminar: `node test/game.test.js` y `node ../test/checks.js`.
