# La Botella

La clásica botella, en versión digital: girás la rueda, la suerte elige a alguien y esa persona responde una pregunta. Sin puntos ni ganadores.

Sitio estático. Se abre `index.html` con doble clic o se sirve la carpeta. No hay build, dependencias ni instalación.

## Cómo se juega

1. **Cargá los nombres.** De 2 a 12 personas. Quedan guardados en el dispositivo (localStorage) para la próxima.
2. **Elegí la intensidad.** Suave (conocer al otro), Media (gustos, costumbres y algo de vergüenza) o Picante (para cuando ya hay confianza).
3. **Girá.** La rueda da varias vueltas y frena justo en un sector. Vibra en el celular si el navegador lo permite.
4. **Respondé en voz alta.** Después podés pedir otra pregunta o girar de nuevo. Cada mazo tiene 45 preguntas y no se repiten hasta agotarlo.

Son tres mazos de 45 preguntas, uno por intensidad.

## Estructura

```
botella/
├── index.html          vistas: inicio, juego, diálogo "Cómo se juega"
├── assets/
│   ├── app.js          estado del juego, DOM, animación del giro
│   ├── styles.css      todo el estilo, mobile-first
│   └── wheel.js        lógica pura de la rueda y de los mazos
├── data/
│   └── questions.js    window.BOTELLA_DECKS (tres mazos de 45)
└── test/
    └── run-tests.js    pruebas de contenido y de lógica
```

## Pruebas

```bash
node test/run-tests.js
```

Valida que cada mazo tiene 45 preguntas, que no hay repetidas dentro ni entre mazos, que `pickSector` devuelve índices válidos para 2 a 12 jugadores y que la rotación calculada deja el sector elegido exactamente bajo el puntero.

## Detalles de implementación

- La rueda se dibuja con `conic-gradient` y etiquetas rotadas: no hay imágenes.
- El ángulo final se calcula para que el centro del sector quede en el puntero, con `prefers-reduced-motion` respetado.
- Un solo viewport: `100dvh`, `overflow: hidden` y safe-area.
