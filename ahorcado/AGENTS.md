# AGENTS.md

Sitio estático sin build ni dependencias. Se abre `index.html` directamente o se sirve la carpeta.

## Estructura

- `index.html`: vistas (inicio, partida, resultado, diálogo "Cómo se juega").
- `assets/app.js`: estado del juego, DOM, racha y récord en `localStorage`.
- `assets/rules.js`: reglas puras (rondas, aciertos, errores, destape). Sin DOM.
- `assets/styles.css`: todo el estilo; temas claro/oscuro con variables CSS.
- `data/words.js`: contenido en `window.AHORCADO_DATA`.
- `test/run-tests.js`: contenido y reglas.

## Convenciones

- HTML/CSS/JS vanilla. No agregues dependencias ni tooling salvo que se pida.
- Textos de interfaz en español rioplatense, cálidos y breves. Identificadores en inglés.
- Cada mazo tiene 40 palabras únicas; mantené ese tamaño al agregar uno.
- Las palabras van en mayúsculas, sin tildes, espacios ni guiones: el teclado es A-Z más Ñ.
- Un mazo nuevo se agrega solo en `data/words.js`: chips, orden y Mezcla se derivan.
- Mezcla se declara con `mixed: true`; nunca se detecta comparando el id.
- Toda regla nueva va en `rules.js` con su prueba, no en `app.js`.
- Todo color nuevo va en `:root` y en `[data-theme="dark"]`. El script del `<head>` evita el flash.
- Al terminar: `node test/run-tests.js` y abrí la página para verificar ambos temas.
