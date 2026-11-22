# AGENTS.md

Sitio estático sin build, dependencias ni tests. Se abre `index.html` directamente o se sirve la carpeta.

## Estructura

- `index.html`: vistas (inicio, juego, diálogo "Cómo se juega").
- `assets/app.js`: estado del juego y DOM. Trata los mazos como inmutables.
- `assets/styles.css`: todo el estilo; temas claro/oscuro con variables CSS.
- `data/decks.js`: contenido en `window.EN_PALABRAS_DECKS`.

## Convenciones

- HTML/CSS/JS vanilla. No agregues dependencias ni tooling salvo que se pida.
- Textos de interfaz en español rioplatense, cálidos y breves. Identificadores en inglés.
- Cada mazo tiene 40 preguntas únicas; mantené ese tamaño al agregar uno.
- Un mazo nuevo se agrega solo en `data/decks.js`: chips, orden y `ALL_CARDS` se derivan.
- "Todos los mazos" reparte `MAX_ALL_CARDS` (100) cartas al azar; en el inicio solo se muestran los mazos individuales.
- Todo color nuevo va en `:root` y en `[data-theme="dark"]`. El script del `<head>` evita el flash y el toggle persiste en `localStorage`.
- Mantené la interfaz mínima: una acción principal por pantalla, avance solo hacia adelante, sin puntaje.
- Al terminar: `node --check assets/app.js` y abrí la página para verificar ambos temas.
