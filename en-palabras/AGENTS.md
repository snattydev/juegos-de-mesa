# AGENTS.md

Sitio estático sin build ni dependencias. Se abre `index.html` directamente (`file://`) o desde `node ../scripts/serve.js`.

## Estructura

- `index.html`: vistas (inicio, juego, diálogo "Cómo se juega"). Carga `../shared/theme.js`, `../shared/chrome.css` y `../shared/chrome.js`.
- `assets/app.js`: estado del juego, DOM y lógica pura de mazo exportada en `window.EN_PALABRAS_CORE`. Trata los mazos como inmutables.
- `assets/styles.css`: todo el estilo; temas claro/oscuro con variables CSS.
- `data/decks.js`: contenido en `window.EN_PALABRAS_DECKS`.
- `test/game.test.js`: pruebas de contenido y armado de mazos.

## Convenciones

- HTML/CSS/JS vanilla. No agregues dependencias ni tooling salvo que se pida.
- Textos de interfaz en español rioplatense, cálidos y breves. Identificadores en inglés.
- Cada mazo tiene 40 cartas únicas; mantené ese tamaño al agregar uno.
- Un mazo nuevo se agrega solo en `data/decks.js`: chips, orden y reparto se derivan.
- "Todos los mazos" reparte `MAX_ALL_CARDS` (100) cartas al azar; en el inicio solo se muestran los mazos individuales.
- Todo color nuevo va en `:root` y en `:root[data-theme="dark"]`. El tema y el botón de volver los provee `../shared/`.
- Mantené la interfaz mínima: una acción principal por pantalla, avance solo hacia adelante, sin puntaje.
- Al terminar: `node test/game.test.js` y `node ../test/checks.js`.
