# Juegos de mesa

Pequeños juegos vibecodeados para juntadas. Todos son sitios estáticos sin build: se abren con doble clic o se sirven desde la carpeta. La excepción es **HDP**, que trae un servidor mínimo en Node para jugar entre varios celulares en la misma red.

## Juegos

| Juego | Para qué | Cómo se usa |
| --- | --- | --- |
| [En Palabras](en-palabras/) | Conversar de verdad, sin puntaje | Abrir `index.html` |
| [HDP](hdp/) | Cartas para completar frases, con juez y puntaje (3 a 12 jugadores) | `node hdp/server.js` y entrar desde el celular |
| [La Botella](botella/) | Ruleta de nombres y preguntas por intensidad | Abrir `index.html` en el celular |
| [Charadas](charadas/) | Mímica contra reloj | Abrir `index.html` en el celular |
| [Yo Nunca](yo-nunca/) | Confesiones por niveles, con vidas | Abrir `index.html` |
| [¿Quién es más probable?](mas-probable/) | Votación secreta pasando el celular | Abrir `index.html` |
| [Después de las doce](despues-de-las-doce/) | Verdades, retos y deseos; de a dos o en grupo | Abrir `index.html` |

## Publicado

El sitio vive en un proyecto privado de Vercel: cada juego queda en su carpeta y la raíz tiene un índice. HDP no viaja, porque necesita su servidor. Para publicar una versión nueva, `vercel deploy --prod` desde la raíz del repo.

## Convenciones

Cada juego vive en su carpeta y es independiente: `index.html`, `assets/app.js`, `assets/styles.css`, `data/*.js`, más `README.md` con sus propias decisiones. Sin dependencias, sin build, sin cuentas, sin métricas. Los textos de interfaz van en español rioplatense.

Humor adulto: HDP, Yo Nunca y La Botella tienen contenido +18. Después de las doce es para mayores y se juega con reglas de la casa: todo es oferta, se puede pasar y hay palabra de corte.
