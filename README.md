# Juegos de mesa

Ocho juegos para juntadas, hechos para jugar desde el celular. Todos son sitios estáticos sin build: se abren con doble clic, se sirven desde la carpeta o se juegan online.

**Están publicados en <https://juegos-de-mesa-seven.vercel.app>**

## Juegos

| Juego | Para qué | Cómo se usa |
| --- | --- | --- |
| [En Palabras](en-palabras/) | Conversar de verdad, sin puntaje | Elegís un mazo y leés |
| [HDP](hdp/public/) | Cartas para completar frases, con juez y puntaje | De 3 a 12: alguien crea la sala y el resto entra con un código |
| [La Botella](botella/) | Ruleta de nombres y preguntas por intensidad | De 2 a 12: cargás los nombres y girás |
| [Charadas](charadas/) | Mímica contra reloj | Celular en la frente del que adivina; el grupo actúa. 60, 90 o 120 segundos |
| [Ahorcado](ahorcado/) | Palabra oculta y seis errores | Un celular para toda la mesa: eligen letras y adivinan juntos |
| [Yo Nunca](yo-nunca/) | Confesiones por niveles, con vidas | De 2 a 12: tocás tu nombre y perdés una vida |
| [¿Quién es más probable?](mas-probable/) | Votación secreta pasando el celular | De 3 a 12: cada uno vota en secreto |
| [Después de las doce](despues-de-las-doce/) | Verdades, retos y deseos | De a dos o en grupo, con tres intensidades |

## Publicado

El sitio es público y no hace falta cuenta para jugar. El proyecto de Vercel está conectado al repo `snattydev/juegos-de-mesa`: **cada push a `main` despliega solo**. `vercel deploy --prod` queda como salida manual para probar algo sin commitear.

El repo también es público: lo que se commitea se ve en GitHub.

## Convenciones

Cada juego vive en su carpeta y es independiente: `index.html`, `assets/app.js`, `assets/styles.css`, `data/*.js`, más `README.md` con sus decisiones. HDP usa `public/` como raíz porque se sirve tal cual. Sin dependencias, sin build, sin cuentas, sin métricas. Los textos de interfaz van en español rioplatense.

HDP juega entre varios celulares sin servidor: el que crea la sala hace de mesa y el resto se conecta con un código. Funciona en la misma red o a distancia, mientras el código se pueda pasar por mensaje.

Humor adulto: HDP, Yo Nunca y La Botella suben el tono en sus niveles más altos, con insinuación y sin explicitud. Después de las doce es el único que avisa que es para adultos, y lo hace en la intro del índice antes de entrar. Se juega con reglas de la casa: todo es oferta, se puede pasar y hay palabra de corte.

## Chequeos

```sh
node test/checks.js
```

Valida la estructura del repo, que los links del índice y de los README respondan, que los conteos que afirman los README coincidan con el código, y la sintaxis de todos los `.js`. Cada juego tiene además su propia suite, indicada en su README.
