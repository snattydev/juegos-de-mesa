# HDP — Hasta donde puedas

Versión de mesa digital de HDP para juntadas: completás frases con cartas blancas y un juez elige la más graciosa. Se juega con el celular en la mano.

Es un juego de juntada: humor picante argentino, pero sin explicitud.

## Cómo se juega

De 3 a 12 personas. Uno hace de mesa y el resto entra con un código.

1. **Uno crea la sala** desde su navegador, sin instalar nada, y recibe un código de 6 caracteres.
2. **El resto entra con ese código** (o con el link de la sala) poniendo su nombre.
3. **Cada ronda uno es el juez** y lee la frase en voz alta. Los demás eligen de su mano las cartas para completarla del modo más gracioso posible.
4. **El juez elige la que más le gusta**, sin saber de quién es. Quien la jugó suma un punto.
5. **El juez va rotando** y gana quien primero junta los puntos acordados (5 por defecto, configurable entre 3 y 10).

## Cómo conectarse

No hay servidor propio ni cuentas: el que crea la sala es el host y su navegador hace de mesa. Funciona entre celulares en la misma red o desde cualquier lado.

1. El host toca **Crear sala** y ve el código de 6 caracteres.
2. Les pasa ese código (o toca **Copiar link**) al resto.
3. Quien abre el link entra directo a la pantalla de invitación, pone su nombre y toca **Unirme a la sala** (sin escribir código ni ver la opción de crear otra). Si entra sin link, elige **Tengo un código**, escribe los 6 caracteres y pone su nombre.

Una vez que se conectan, toda la partida corre directo entre los navegadores por WebRTC.

## Cómo funciona

- **`assets/engine.js`**: el motor del juego (mazos, turnos, puntajes, validaciones). Corre en el navegador del host.
- **`assets/net.js`**: WebRTC. Cada jugador tiene su propio data channel contra el host; el host difunde el estado.
- **`assets/local.js`**: traduce las viejas llamadas `/api/...` a acciones del motor, así la interfaz no cambia.
- **`assets/app.js`**: la interfaz.
- **`AGENTS.md`**: convenciones para editarlo.
- **`test/game.test.js`**: pruebas del mazo y del motor, sin dependencias.

Los data channels no piden contexto seguro, así que funciona igual sobre `http://` en la red local que sobre el sitio publicado en `https://`.

## Decisiones del juego

- **El juez nunca ve los autores hasta el final.** Las respuestas se mezclan y se etiquetan A, B, C… Recién en el resultado se muestra quién jugó cada una.
- **Tiempo por ronda configurable.** Por defecto son 30 segundos (configurable en la sala entre 15s, 20s, 30s o libre). Si se acaba el tiempo con respuestas enviadas, pasa directo al juez; si nadie mandó nada, elige cartas al azar de cada mano para que la mesa no se trabe.
- **El juez puede apurar.** Si alguien se colgó y no juega, el juez tiene "Ver respuestas" para seguir igual.
- **Solo se renuevan las cartas jugadas.** Cada jugador arranca con 10 cartas y conserva las que no jugó en su mismo lugar; al pasar de ronda solo se reponen los espacios usados (marcados como *Nueva*). Cuando se agota un mazo, se rebaraja el descarte solo.
- **El host es la mesa.** Si cierra la pestaña, se corta la partida: es el que tiene el estado y los canales.
- **Sin cuentas ni métricas.** Nada sale de los navegadores: ni salas, ni puntajes, ni historial.
- **74 cartas negras y 244 blancas**, escritas en rioplatense. Los textos de la interfaz también, cálidos y breves.

## El mazo

- `data/cards.js`: las cartas. `BLACK` son las frases (con `pick` 1 o 2 para la cantidad de blancas) y `WHITE` las respuestas. Se puede agregar contenido ahí sin tocar el resto.

La idea de fondo: reírse de todo un rato, sin que nadie termine ofendido en serio.

## Verificación

```sh
node test/game.test.js
```
