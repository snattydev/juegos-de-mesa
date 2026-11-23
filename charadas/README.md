# Charadas

Mímica contra reloj para jugar en grupo con un solo celular. El que actúa se apoya el teléfono en la frente con la pantalla hacia afuera: el grupo ve la palabra, da pistas y toca **Alcancé** o **Paso**. Sin puntos en contra, sin explicaciones largas.

Sitio estático: se abre `index.html` con doble clic o se sirve la carpeta. No hay build, dependencias ni cuentas.

## Cómo se juega

1. Elegís categoría y duración (60, 90 o 120 segundos).
2. Cuenta regresiva de 3 a 1 y arranca el reloj.
3. El grupo hace mímica. **Alcancé** suma uno; **Paso** no resta.
4. Al terminar el tiempo ves la lista de acertadas y salteadas, el total y la mejor marca de esa categoría.

Los récords se guardan por categoría en `localStorage`, junto con la última categoría y duración usadas.

### Sensor de inclinación (opcional)

En celulares compatibles aparece el interruptor **Inclinar para pasar**: inclinar el teléfono hacia abajo pasa la palabra. En iOS pide permiso explícito con `DeviceOrientationEvent.requestPermission()`.

Si el dispositivo no manda datos, el sensor se apaga solo. **Los botones nunca se desactivan**: el juego no depende del sensor.

## Contenido

4 mazos de 120 items: **Películas y series**, **Objetos**, **Animales** y **Acciones**. **Mezcla** no es un quinto mazo: es una categoría compuesta (`mixed: true`) que juega los 480 items juntos. Todo vive en `data/words.js` (`window.CHARADAS_DATA`).

## Estructura

```
charadas/
├── index.html          vistas: inicio, juego, fin, cuenta regresiva, diálogo
├── assets/app.js       estado, timer, sensor, récords, Wake Lock
├── assets/styles.css   estilos, temas claro/oscuro, mobile-first
├── data/words.js       contenido
└── AGENTS.md           convenciones para editarlo
```

## Detalles técnicos

- 100dvh, safe areas y cero scroll durante la partida.
- La tipografía de la palabra se ajusta por JS para que entre entera desde lejos.
- `prefers-reduced-motion` desactiva animaciones.
- Wake Lock mantiene la pantalla encendida mientras se juega; el timer se pausa si la pestaña pasa a segundo plano.
- Sin módulos ES ni `fetch`: abrir desde `file://` funciona igual.
- Teclado para probar en la compu: espacio o ↑ acierta, ↓ o → pasa, Esc termina.

## Verificación

```bash
node --check assets/app.js
node --check data/words.js
```
