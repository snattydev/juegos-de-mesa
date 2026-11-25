# HDP — Hasta donde puedas

Versión de mesa digital de HDP para juntadas: completás frases con cartas blancas y un juez elige la más graciosa. Se juega con el celular en la mano.

Es un juego de juntada: humor picante argentino, pero sin explicitud.

## Cómo se juega

De 3 a 12 personas. Uno hace de mesa y el resto entra con un código.

1. **Uno crea la sala** desde su navegador, sin instalar nada.
2. **Invita al resto.** Por cada jugador genera una invitación, se la manda (WhatsApp, mail, lo que sea) y pega la respuesta que le devuelve. Con eso queda conectado.
3. **Cada ronda uno es el juez** y lee la frase en voz alta. Los demás eligen de su mano las cartas para completarla del modo más gracioso posible.
4. **El juez elige la que más le gusta**, sin saber de quién es. Quien la jugó suma un punto.
5. **El juez va rotando** y gana quien primero junta los puntos acordados (5 por defecto, configurable entre 3 y 10).

## Cómo conectarse

No hay servidor: el que crea la sala es el host y su navegador hace de mesa. Funciona entre dispositivos en la misma red o desde cualquier lado, mientras los códigos se puedan pasar por mensaje.

1. El host toca **Crear sala** y después **Generar invitación**.
2. Le pasa ese texto a un jugador. El jugador lo pega en **¿Te invitaron?**, pone su nombre y recibe un código de respuesta.
3. El jugador le devuelve ese código al host, el host lo pega en **Pegar respuesta** y toca **Conectar jugador**.

Son dos mensajes por jugador: uno de ida y uno de vuelta. Es el precio de no depender de ningún servidor.

## Cómo funciona

- **`assets/engine.js`**: el motor del juego (mazos, turnos, puntajes, validaciones). Corre en el navegador del host.
- **`assets/net.js`**: WebRTC. Cada jugador tiene su propio data channel contra el host; el host difunde el estado.
- **`assets/local.js`**: traduce las viejas llamadas `/api/...` a acciones del motor, así la interfaz no cambia.
- **`assets/app.js`**: la interfaz.
- **`test/engine.test.js`**: pruebas del motor, sin dependencias.

Los data channels no piden contexto seguro, así que funciona igual sobre `http://` en la red local que sobre el sitio publicado en `https://`.

## Decisiones del juego

- **El juez nunca ve los autores hasta el final.** Las respuestas se mezclan y se etiquetan A, B, C… Recién en el resultado se muestra quién jugó cada una.
- **El juez puede apurar.** Si alguien se colgó y no juega, el juez tiene "Ver respuestas" para seguir igual.
- **Cartas que faltan, se reciclan.** Cuando se agota un mazo, se rebaraja el descarte solo.
- **El host es la mesa.** Si cierra la pestaña, se corta la partida: es el que tiene el estado y los canales.
- **Sin cuentas ni métricas.** Nada sale de los navegadores: ni salas, ni puntajes, ni historial.
- **74 cartas negras y 244 blancas**, escritas en rioplatense. Los textos de la interfaz también, cálidos y breves.

## El mazo

- `data/cards.js`: las cartas. `BLACK` son las frases (con `pick` 1 o 2 para la cantidad de blancas) y `WHITE` las respuestas. Se puede agregar contenido ahí sin tocar el resto.

La idea de fondo: reírse de todo un rato, sin que nadie termine ofendido en serio.
