# Juegos de mesa

Nueve juegos para juntadas, hechos para jugar desde el celular. Todos son sitios estáticos sin build: se abren con doble clic, se sirven desde la carpeta o se juegan online.

**Están publicados en <https://juegos-de-mesa-seven.vercel.app>**

## Juegos

| Juego | Para qué | Cómo se usa |
| --- | --- | --- |
| [En Palabras](en-palabras/) | Conversar de verdad, sin puntaje | Elegís un mazo y leés |
| [HDP](hdp/) | Cartas para completar frases, con juez y puntaje | De 3 a 12: alguien crea la sala y el resto entra con un código |
| [La Botella](botella/) | Ruleta de nombres y preguntas por intensidad | De 2 a 12: cargás los nombres y girás |
| [Charadas](charadas/) | Mímica contra reloj | Celular en la frente del que adivina; el grupo actúa. 60, 90 o 120 segundos |
| [Ahorcado](ahorcado/) | Palabra oculta y seis errores | Un celular para toda la mesa: eligen letras y adivinan juntos |
| [Yo Nunca](yo-nunca/) | Confesiones por niveles, con vidas | De 2 a 12: tocás tu nombre y perdés una vida |
| [¿Quién es más probable?](mas-probable/) | Votación secreta pasando el celular | De 3 a 12: cada uno vota en secreto |
| [El Incomodómetro](incomodometro/) | Votación secreta para ver quién incomoda más, con termómetro | De 3 a 12: cada uno vota en secreto |
| [Después de las doce](despues-de-las-doce/) | Verdades, retos y deseos | De a dos o en grupo, con tres intensidades |

## Publicado

El sitio es público y no hace falta cuenta para jugar. El proyecto de Vercel está conectado al repo `snattydev/juegos-de-mesa`: **cada push a `main` despliega solo**. `vercel deploy --prod` queda como salida manual para probar algo sin commitear.

El repo también es público: lo que se commitea se ve en GitHub.

## Convenciones

Cada juego vive en su carpeta y comparte catálogo, tema y navegación desde `shared/` (`games.js`, `theme.js`, `chrome.css`, `chrome.js`): `index.html`, `assets/app.js`, `assets/styles.css`, `data/*.js`, `test/game.test.js`, `README.md` y `AGENTS.md`. Sin dependencias, sin build, sin cuentas, sin métricas. Los textos de interfaz van en español rioplatense.

Para desarrollar o sumar un juego nuevo, leé [AGENTS.md](AGENTS.md) (y [CLAUDE.md](CLAUDE.md)).

HDP juega entre varios celulares sin servidor: el que crea la sala hace de mesa y el resto se conecta con un código. Funciona en la misma red o a distancia, mientras el código se pueda pasar por mensaje.

Humor adulto: HDP, Yo Nunca y La Botella suben el tono en sus niveles más altos, con insinuación y sin explicitud. Después de las doce es el único que avisa que es para adultos, y lo hace en la intro del índice antes de entrar. Se juega con reglas de la casa: todo es oferta, se puede pasar y hay palabra de corte.

## Desarrollo local y chequeos

Para servir todo el sitio en local (y desde el celular en la misma red):

```sh
node scripts/serve.js 8080
```

Para activar los hooks de Conventional Commits y validación pre-commit:

```sh
git config core.hooksPath .githooks
```

Para correr todos los chequeos de coherencia, sintaxis y suites del repo:

```sh
node test/checks.js
```

Valida la estructura del repo, que los assets compartidos y los links del índice y de los `README`/`AGENTS` respondan, que los conteos que afirman los README coincidan con el código, la sintaxis de todos los `.js`, [test/shared.test.js](test/shared.test.js) y la suite `test/game.test.js` de cada uno de los nueve juegos.
