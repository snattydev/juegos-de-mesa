# ¿Quién es más probable?

Juego de juntada con votación secreta. Se lee una consigna, el celular circula de mano en mano y cada uno elige en secreto a quién le pega más. Al final se revelan los votos y queda un ranking acumulado de la partida.

## Cómo se juega

1. Anotá de 3 a 12 jugadores. La lista queda guardada en el navegador para la próxima.
2. Se muestra la consigna: "¿Quién es más probable que…?" Todos la leen en voz alta.
3. El celular arranca por el primero de la lista. Cada jugador toca un nombre en secreto, confirma y pasa el teléfono. Una pantalla intermedia tapa la elección anterior.
4. Cuando votaron todos, se revelan las barras ordenadas de más a menos votos, con el más votado destacado.
5. "Siguiente ronda" reparte otra consigna. El botón del trofeo (o el final del mazo) muestra el ranking acumulado: cuántas veces cada uno salió el más votado.

Son 100 consignas: 100 rondas como máximo.

## Decisiones del juego

- **El voto es secreto de verdad.** Nadie ve la pantalla mientras otro elige: entre voto y voto hay un intersticial que nombra al siguiente y hay que tocar "Soy…" para entrar.
- **Se puede votar a uno mismo.** Es parte de la gracia y evita explicar por qué no.
- **Empate:** si dos o más comparten el máximo de votos, todos se llevan la ronda y suman uno en el ranking. La pantalla lo dice con todas las letras.
- **Sin repeticiones.** El mazo se mezcla al empezar y se consume; cuando se termina, la partida cierra con el ranking.
- **El orden de votación rota cada ronda.** El que arranca no es siempre el mismo.
- **Todo es local.** Sin cuentas, sin servidor, sin métricas. Solo se guardan los nombres de los jugadores en `localStorage`.
- **Una acción principal por pantalla.** Nada de menús ni ajustes en medio de la partida.

## Estructura

- `index.html`: las seis vistas (inicio, consigna, intersticial, votación, revelado y ranking) y el diálogo "Cómo se juega".
- `AGENTS.md`: convenciones para editarlo.
- `assets/app.js`: estado de la partida, DOM y la lógica pura de conteo (`window.MAS_PROBABLE_LOGIC`).
- `assets/styles.css`: todo el estilo, mobile-first, con variables CSS.
- `data/prompts.js`: las 100 consignas en `window.MAS_PROBABLE_DATA`.
- `test/game.test.js`: chequeos de contenido y de conteo, sin dependencias.

## Verificación

```sh
node test/game.test.js
```
