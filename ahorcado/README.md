# Ahorcado

El clásico juego de la palabra oculta, para jugar entre todos con un solo celular. La mesa dice letras, alguien las toca y la palabra se va armando. Seis errores y se termina.

Sitio estático: se abre `index.html` con doble clic o se sirve la carpeta. No hay build, dependencias ni cuentas.

## Cómo se juega

1. Elegís un mazo: **Animales**, **Comidas y bebidas**, **Lugares** u **Objetos**. **Mezcla** agarra de los cuatro.
2. Aparece una palabra tapada. El grupo elige una letra y alguien la toca en el teclado.
3. Si la letra está, se destapa en todas sus apariciones. Si no, se dibuja una parte del muñeco.
4. Con la palabra completa, ganan y la racha sube uno. Con seis errores, se muestra cuál era y la racha vuelve a cero.

La racha cuenta palabras seguidas sacadas entre todos; la mejor queda guardada en el dispositivo. Rendirse muestra la palabra y también corta la racha: es la salida para no quedarse trabados.

## Contenido

Cuatro mazos de 40 palabras (160 en total) más **Mezcla**, que es una categoría compuesta (`mixed: true`) y juega las 160 juntas. Todo vive en `data/words.js` (`window.AHORCADO_DATA`).

Las palabras van en mayúsculas, sin tildes, espacios ni guiones: el teclado es A-Z más Ñ, así que una tilde dejaría la palabra sin forma de completarse. «CAMALEÓN» se juega como **CAMALEON**.

## Estructura

```
ahorcado/
├── index.html          vistas: inicio, partida, diálogo "Cómo se juega"
├── assets/
│   ├── app.js          estado, DOM, racha y récord en localStorage
│   ├── rules.js        reglas puras: rondas, aciertos, errores, destape
│   └── styles.css      estilos, temas claro/oscuro, mobile-first
├── data/
│   └── words.js        window.AHORCADO_DATA (cuatro mazos de 40 + Mezcla)
└── test/
    └── run-tests.js    contenido y reglas
```

## Pruebas

```bash
node test/run-tests.js
```

Valida que cada mazo tenga 40 palabras, que no haya repetidas dentro ni entre mazos, que cada palabra se pueda escribir con el teclado del juego, y las reglas: la Ñ como letra aparte, seis errores para perder, el destape final y que una ronda terminada no acepte más letras.

## Detalles de implementación

- `rules.js` no toca el DOM: se exporta como módulo para los tests y como global para la página.
- El tamaño de la palabra se calcula según el ancho de la pantalla para que entre entera, incluso con las palabras largas de doce letras.
- Teclado físico para probar en la compu: cualquier letra juega, `Esc` vuelve al inicio.
- `prefers-reduced-motion` desactiva animaciones y el tema claro/oscuro se guarda por juego.
