# En Palabras

Cartas con preguntas para conversar de verdad. Pensado para una juntada distendida, sin puntaje ni ganadores.

## Cómo se juega

Elegís un mazo, leés la pregunta en voz alta y respondés. Después pasan a la siguiente. Eso es todo.

Son cuatro mazos de 40 preguntas: **Perspectiva**, **Presentación**, **Profundidad** y **Descomprimir**. "Todos los mazos" reparte 100 cartas al azar entre las 160.

## Decisiones del juego

- **Saltear una carta está bien.** Si una pregunta no va, la pasás y listo: esa libertad es parte de la gracia.
- **Sin respuestas correctas.** Cada uno contesta lo que quiere y hasta donde quiere.
- **Se juega en grupo o de a dos.** No hay turnos estrictos; el ritmo lo pone la mesa.
- **Cada mazo tiene sus preguntas únicas.** Ninguna se repite entre mazos.

## Estructura

- `index.html`: vistas (inicio, juego, diálogo "Cómo se juega").
- `AGENTS.md`: convenciones para editarlo.
- `assets/app.js`: estado, DOM y armado de mazos (`window.EN_PALABRAS_CORE`).
- `assets/styles.css`: estilos, temas claro/oscuro, mobile-first.
- `data/decks.js`: 4 mazos de 40 cartas en `window.EN_PALABRAS_DECKS`.
- `test/game.test.js`: validación de contenido y armado de mazos.

## Verificación

```sh
node test/game.test.js
```
