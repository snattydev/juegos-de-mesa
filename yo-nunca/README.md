# Yo Nunca

Juego de confesiones para juntadas. Un solo celular en la mesa: se lee una frase en voz alta, quien hizo la cosa toca su nombre y pierde una vida. Sin turnos, sin puntaje, sin ganador moral.

## Cómo se juega

1. Sumá de 2 a 12 jugadores y elegí la intensidad: **Suave**, **Media** o **Picante** (sin vueltas).
2. Elegí cuántas vidas arranca cada uno. Por defecto son 3.
3. Lean la frase de la tarjeta en voz alta. Quien la hizo toca su nombre en la lista y pierde una vida.
4. Si no querés admitirlo, no toques nada. **Pasar también es jugar**: nadie está obligado a confesar.
5. Cuando a alguien se le terminan las vidas queda como espectador. La partida termina cuando queda una sola persona con vidas o cuando se acaban las 120 frases.

No hay puntos ni ganador moral: solo se trata de sobrevivir. El nivel picante sube el tono, sin explicitud.

Sitio estático: se abre `index.html` con doble clic o se sirve la carpeta. Sin dependencias, cuentas ni servidores. Los nombres, la intensidad y las vidas se guardan solo en el `localStorage` de ese dispositivo.

## Contenido

`data/statements.js` define `window.YO_NUNCA_DATA` con tres listas de 120 frases:

- **Suave**: comida, pantallas, casa, transporte, trabajo, vergüenzas cotidianas, mentiras blancas, familia, sueño, mascotas, baile y compras.
- **Media**: alcohol, exs, mentiras grandes, plata, trabajo, fiestas, higiene, vínculos, familia, redes, travesuras y viajes.
- **Picante**: lugares, juguetes, fotos, fantasías, reencuentros, apps, oficina, cuerpo, vergüenzas, privacidad, amigos y después del encuentro.

Cada nivel tiene 120 frases únicas y completas. Los temas están separados a propósito para no repetir el mismo chiste en los tres niveles.

## Estructura

```
yo-nunca/
├── index.html          vistas de inicio, partida y cierre + diálogo
├── assets/
│   ├── app.js          estado, mazo y DOM
│   └── styles.css      todo el estilo
├── data/
│   └── statements.js   360 frases en window.YO_NUNCA_DATA
└── tests/
    └── check.js        verificación con Node, sin dependencias
```

## Verificación

```sh
node tests/check.js
```

El test carga `statements.js` y `app.js` en un contexto de Node sin DOM, valida 3 × 120 frases únicas (sin duplicados entre niveles ni placeholders) y simula 60 partidas completas para comprobar que el mazo barajado no repite cartas.

## Diseño

Mobile-first: la página no scrollea, la tarjeta, la grilla de jugadores y el botón principal se reparten el alto de la pantalla, y el botón de avance queda siempre al alcance del pulgar.
