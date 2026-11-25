# AGENTS.md

Sitio estático sin build ni dependencias. Se abre `index.html` directamente (`file://`) o desde `node ../scripts/serve.js`.

## Estructura

- `index.html`: vistas (inicio, partida, fin, cuenta regresiva, pausa, diálogo "Cómo se juega"). Carga `../shared/theme.js`, `../shared/chrome.css` y `../shared/chrome.js`.
- `assets/app.js`: estado, timer, ajuste tipográfico (`fitWord`), sensor de inclinación, Wake Lock y `window.CharadasCore` (lógica pura sin DOM).
- `assets/styles.css`: estilos mobile-first, 100dvh sin scroll en partida, temas claro/oscuro.
- `data/words.js`: contenido en `window.CHARADAS_DATA` (4 categorías reales de 120 items + Mezcla).
- `test/game.test.js`: pruebas de contenido y de `CharadasCore` (`shuffle`, `buildPool`, `evaluateTilt`).

## Convenciones

- HTML/CSS/JS vanilla. Los textos en español rioplatense; identificadores en inglés.
- Mezcla se detecta por `mixed: true` en `data/words.js`, nunca por id hardcodeado.
- En el sensor de inclinación, `nextWord()` nunca debe reanclar `baseline`: volver al centro tras un gesto dispararía el gesto contrario. Los botones **Alcancé** y **Paso** nunca se desactivan.
- Toda lógica pura (filtrado de mazos, evaluación de inclinación) se exporta en `window.CharadasCore` y se testea en `test/game.test.js`.
- El tema y el botón de volver vienen de `../shared/`; en `#viewPlay` y `#viewEnd` se ocultan automáticamente.
- Al terminar: `node test/game.test.js` y `node ../test/checks.js`.
