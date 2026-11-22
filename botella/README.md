# La Botella

La clásica botella, en versión digital: girás la rueda, la suerte elige a alguien y esa persona responde una pregunta. Sin puntos ni ganadores.

Sitio estático. Se abre `index.html` con doble clic o se sirve la carpeta. No hay build, dependencias ni instalación.

## Cómo se juega

1. **Cargá los nombres.** De 2 a 12 personas. Quedan guardados en el dispositivo (localStorage) para la próxima.
2. **Elegí la intensidad.** Suave (conocer al otro), Media (gustos, costumbres y algo de vergüenza) o Picante (mayores de 18).
3. **Girá.** La rueda da varias vueltas y frena justo en un sector. Vibra en el celular si el navegador lo permite.
4. **Respondé en voz alta.** Después podés pedir otra pregunta o girar de nuevo. Cada mazo tiene 45 preguntas y no se repiten hasta agotarlo.

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
node --check assets/app.js
node --check assets/wheel.js
node --check data/questions.js
node test/run-tests.js
```

Las pruebas validan que cada mazo tiene 45 preguntas, que no hay repetidas dentro ni entre mazos, que `pickSector` devuelve índices válidos para 2 a 12 jugadores y que la rotación calculada deja el sector elegido exactamente bajo el puntero.

## Detalles de implementación

- La rueda se dibuja con `conic-gradient` (un sector por jugador, colores alternados y una unión fina del color del papel) y etiquetas rotadas. No hay imágenes.
- El giro es una transición de `transform/rotate` de ~4 s con `cubic-bezier`; el ángulo final se calcula para que el centro del sector quede en el puntero. Con `prefers-reduced-motion` la transición baja a 0,5 s y da una sola vuelta, pero cae igual de exacto.
- Un solo viewport: `100dvh`, `overflow: hidden` y safe-area. La lista de jugadores es lo único que puede scrollear, y solo en pantallas muy chicas.
- Sin módulos ES ni `fetch`: todo se carga con `<script>` para que funcione abriendo el archivo desde el disco.

## Créditos

Proyecto hobby hecho con amor por **snatty**.
