# Después de las doce

Un juego de cartas picante: verdades, retos y deseos para jugar en pareja o con un grupo de gente de confianza. La noche empieza cuando lo deciden ustedes.

> **Para adultos.** Es el juego más subido de tono del repo, de a dos o en grupo, con reglas de la casa a la vista. No tiene cuentas, no envía nada y no guarda historial.

## Qué es

Un mazo de 216 cartas repartidas en tres intensidades —**Previa**, **Caliente** y **Sin filtro**— y tres tipos por intensidad:

- **Verdad**: una confesión.
- **Reto**: una acción sugerida, que se acepta o se pasa.
- **Deseo**: un pedido o una pregunta íntima.

Cada carta está pensada para **pareja** (solo), para **grupo**, o para **ambos**; el mazo se filtra solo según el modo que elijas.

## Cómo se juega

El aviso de que es para adultos está en la intro del índice, antes de entrar. Adentro no hay compuerta.

1. Elegís modo: **Uno a uno** (turnos alternados) o **Grupo** (de 3 a 8, la app elige a quién le toca o lo eligen a mano).
2. Elegís la intensidad y empezás.
3. Se saca una carta por vez. Cada una se resuelve con uno de tres botones:
   - **Cumplida**: sube la tensión.
   - **Pasala**: avanza sin preguntar ni penalizar.
   - **Otra carta**: se descarta y se reparte otra.
4. Cuando la tensión llega al 100% se desbloquea una **carta final** del nivel. Después, la pantalla de cierre con el resumen (cumplidas, pasadas, descartadas y rondas).

No hay puntaje ni ganadores: la tensión es del grupo, no de nadie en particular.

## Reglas de la casa

- **Todo es opcional.** Nadie está obligado a nada.
- **Pasala no se justifica.** No se pregunta, no se insiste.
- **La palabra de corte es «pausa».** Se dice y se frena todo.
- **Nada se guarda ni se envía.** No hay cuentas ni historial.
- **Respeto siempre.** Nada coercitivo, nada degradante, nada con menores, nada de grabar, nada que exija alcohol.

## Cómo abrirlo

Está publicado junto al resto del sitio, o se abre `index.html` desde el disco. Es un sitio estático: no necesita servidor ni instalación.

## Decisiones del juego

- **Identidad de noche**: fondo casi negro con tinte vino, superficies oscuras, tinta hueso, acento coral y un dorado apagado.
- **Una carta por vez**, legible desde el celular, sin scroll de página.
- **El contenido escala de verdad**: Previa es tensión y química; Caliente es contacto y confesiones; Sin filtro es lo más zarpado que permite el marco (sugerente, nunca gráfico).
- **Sin duplicados** en todo el mazo; cada carta se lee sola, sin plantillas.
- **La carta final respeta el modo**: hay una versión para pareja y otra para grupo, porque "elegí a alguien" no se puede cumplir jugando de a dos.
- **Nombres del grupo** persistidos en `localStorage`, borrables en cualquier momento.

## Estructura

- `index.html`: vistas (setup, juego, cierre) y diálogos.
- `AGENTS.md`: convenciones para editarlo.
- `assets/app.js`: estado, flujo de cartas y lógica pura (`window.DESPUES_LOGIC`).
- `assets/styles.css`: paleta nocturna fija y diseño mobile-first.
- `data/cards.js`: 216 cartas y cartas finales en `window.DESPUES_DATA`.
- `test/game.test.js`: validación de mazo, audiencias y lógica pura.

## Verificación

```sh
node test/game.test.js
```
