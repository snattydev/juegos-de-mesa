# HDP — Hasta donde puedas

Versión de mesa digital de HDP para juntadas: completás frases con cartas blancas y un juez elige la más graciosa. Se juega con el celular en la mano, todos conectados a la misma red WiFi.

Es un juego +18: humor zarpado argentino, pero sin violencia explícita ni sexo gráfico.

## Cómo se juega

1. **Uno levanta el servidor** en la compu (o en cualquier máquina) con `node server.js`.
2. **Entran todos desde el celular** a `http://IP-DE-LA-COMPU:3000`. La compu imprime la IP al arrancar.
3. **Uno crea la sala**, el resto entra con el código de 4 letras. De 3 a 12 personas.
4. **Cada ronda uno es el juez** y lee la frase en voz alta. Los demás eligen de su mano las cartas para completarla del modo más gracioso posible.
5. **El juez elige la que más le gusta**, sin saber de quién es. Quien la jugó suma un punto.
6. **El juez va rotando** y gana quien primero junta los puntos acordados (5 por defecto, configurable entre 3 y 10).

## Cómo levantarlo

Necesitás Node 22 (o más nuevo). No hay dependencias: solo la librería estándar.

```bash
node server.js
```

El servidor escucha en el puerto `3000` (cambiable con `PORT=3999 node server.js`) y, al arrancar, imprime:

```
Local:  http://localhost:3000
Red:    http://192.168.1.42:3000
```

**Para entrar desde el celular:** tiene que estar en la misma WiFi que la compu. Abrís el navegador y ponés la URL de la línea `Red:` (la IP de tu compu en la red). Si no aparece, mirá la IP con `ip addr` o `ipconfig` y probá esa.

## Decisiones del juego

- **El juez nunca ve los autores hasta el final.** Las respuestas se mezclan y se etiquetan A, B, C… Recién en el resultado se muestra quién jugó cada una.
- **El juez puede apurar.** Si alguien se colgó y no juega, el juez tiene "Ver respuestas" para seguir igual.
- **Cartas que faltan, se reciclan.** Cuando se agota un mazo, se rebaraja el descarte solo.
- **Se puede reconectar.** El código y el token se guardan en el navegador: si se corta, al volver seguís con tu mano y tu puntaje.
- **Si se cae el host, no se corta la partida.** El rol pasa solo al siguiente jugador conectado.
- **Sin cuentas ni métricas.** Todo vive en la memoria de la compu que levantó el server. Las salas inactivas se limpian solas a las 3 horas.
- **74 cartas negras y 244 blancas**, escritas en rioplatense. Los textos de la interfaz también, cálidos y breves.

## El mazo

- `data/cards.js`: las cartas. `BLACK` son las frases (con `pick` 1 o 2 para la cantidad de blancas) y `WHITE` las respuestas. Se puede agregar contenido ahí sin tocar el resto.
- El servidor reparte, mezcla y valida; los clientes solo reciben lo que les toca.

La idea de fondo: reírse de todo un rato, sin que nadie termine ofendido en serio.
