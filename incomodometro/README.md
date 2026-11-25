# El Incomodómetro

Juego de juntada con votación secreta. Se lee una situación, el celular circula de mano en mano y cada uno elige en secreto quién incomoda más cuando pasa eso. Al final se revelan los votos, un termómetro de incomodidad y un ranking acumulado de la partida.

## Cómo se juega

1. Anotá de 3 a 12 jugadores. La lista queda guardada en el navegador para la próxima.
2. Se muestra la situación: "¿Quién incomoda más cuando…?" Todos la leen en voz alta.
3. El celular arranca por el primero de la lista. Cada jugador toca un nombre en secreto, confirma y pasa el teléfono. Una pantalla intermedia tapa la elección anterior.
4. Cuando votaron todos, se revelan las barras ordenadas de más a menos votos, el más incomodante destacado y el termómetro: qué porcentaje de la mesa votó al mismo.
5. "Siguiente ronda" reparte otra situación. El botón del trofeo (o el final del mazo) muestra el ranking acumulado: cuántas veces cada uno se llevó la ronda por incómodo.

Son 80 situaciones: 80 rondas como máximo.

## Decisiones del juego

- **El voto es secreto de verdad.** Nadie ve la pantalla mientras otro elige: entre voto y voto hay un intersticial que nombra al siguiente y hay que tocar "Soy…" para entrar.
- **Se puede votar a uno mismo.** Es parte de la gracia y evita explicar por qué no.
- **El termómetro mide consenso, no maldad.** Es el porcentaje de la ronda que fue al más votado: unanimidad es incomodidad total, votos repartidos es mesa tibia. Sale de la lógica pura (`thermometerNote`) y está testeado por tramos.
- **Empate:** si dos o más comparten el máximo de votos, todos se llevan la ronda y suman uno en el ranking. La pantalla lo dice con todas las letras.
- **Sin repeticiones.** El mazo se mezcla al empezar y se consume; cuando se termina, la partida cierra con el ranking.
- **El orden de votación rota cada ronda.** El que arranca no es siempre el mismo.
- **Contenido:** incomodidad social, no crueldad. Las situaciones son papelones de convivencia (el que explica el chiste, el que pregunta cuánto ganás); nada de discapacidad, cuerpo ajeno ni humillación real.
- **Todo es local.** Sin cuentas, sin servidor, sin métricas. Solo se guardan los nombres de los jugadores en `localStorage`.
- **Una acción principal por pantalla.** Nada de menús ni ajustes en medio de la partida.

## Estructura

- `index.html`: las seis vistas (inicio, situación, intersticial, votación, revelado con termómetro y ranking) y el diálogo "Cómo se juega".
- `AGENTS.md`: convenciones para editarlo.
- `assets/app.js`: estado de la partida, DOM y la lógica pura de conteo y termómetro (`window.INCOMODOMETRO_LOGIC`).
- `assets/styles.css`: todo el estilo, mobile-first, con variables CSS.
- `data/prompts.js`: las 80 situaciones en `window.INCOMODOMETRO_DATA`.
- `test/game.test.js`: chequeos de contenido, conteo y termómetro, sin dependencias.

## Verificación

```sh
node test/game.test.js
```
