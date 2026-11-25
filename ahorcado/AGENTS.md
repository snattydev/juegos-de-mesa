# AGENTS.md

Sitio estático sin build ni dependencias. Se abre `index.html` directamente (`file://`) o desde el servidor local (`node ../scripts/serve.js`).

## Estructura

- `index.html`: vistas (inicio, partida, diálogo "Cómo se juega"). Carga `../shared/theme.js`, `../shared/chrome.css` y `../shared/chrome.js`.
- `assets/app.js`: estado del juego, DOM, racha y récord en `localStorage`.
- `assets/rules.js`: reglas puras (rondas, aciertos, errores, destape). Sin DOM.
- `assets/styles.css`: estilos del juego; temas claro/oscuro con variables CSS.
- `data/words.js`: contenido en `window.AHORCADO_DATA`.
- `test/game.test.js`: pruebas de contenido y reglas.

## Convenciones

- HTML/CSS/JS vanilla. No agregues dependencias ni tooling salvo que se pida.
- Textos de interfaz en español rioplatense, cálidos y breves. Identificadores en inglés.
- Cada mazo tiene 40 palabras únicas; mantené ese tamaño al agregar uno.
- Las palabras van en mayúsculas, sin tildes, espacios ni guiones: el teclado es A-Z más Ñ.
- Un mazo nuevo se agrega solo en `data/words.js`: chips, orden y Mezcla se derivan.
- Mezcla se declara con `mixed: true`; nunca se detecta comparando el id.
- Toda regla nueva va en `rules.js` con su prueba en `test/game.test.js`, no en `app.js`.
- Todo color nuevo va en `:root` y en `:root[data-theme="dark"]`. El tema y el botón de volver los provee `../shared/`.
- Al terminar: `node test/game.test.js` y `node ../test/checks.js`.
