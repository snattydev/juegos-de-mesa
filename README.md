# Juegos de mesa

Pequeños juegos vibecodeados para juntadas. Todos son sitios estáticos sin build: se abren con doble clic, se sirven desde la carpeta o se juegan online. **HDP** juega entre varios celulares sin servidor: el que crea la sala hace de mesa y el resto se conecta con un código.

**Están publicados en <https://juegos-de-mesa-seven.vercel.app>**

## Juegos

| Juego | Para qué | Cómo se usa |
| --- | --- | --- |
| [En Palabras](en-palabras/) | Conversar de verdad, sin puntaje | Elegís un mazo y leés |
| [HDP](hdp/public/) | Cartas para completar frases, con juez y puntaje (3 a 12 jugadores) | Alguien crea la sala y los demás entran con un código |
| [La Botella](botella/) | Ruleta de nombres y preguntas por intensidad | Cargás los nombres y girás |
| [Charadas](charadas/) | Mímica contra reloj | Celular en la frente, 60 segundos |
| [Yo Nunca](yo-nunca/) | Confesiones por niveles, con vidas | 2 a 12, tocás tu nombre |
| [¿Quién es más probable?](mas-probable/) | Votación secreta pasando el celular | De 3 a 12, voto secreto |
| [Después de las doce](despues-de-las-doce/) | Verdades, retos y deseos; de a dos o en grupo | Tres intensidades, con reglas de la casa |

## Publicado

El sitio vive en **<https://juegos-de-mesa-seven.vercel.app>** y es público: no hace falta cuenta para jugar. El proyecto de Vercel está conectado al repo `snattydev/juegos-de-mesa`, así que **cada push a `main` despliega solo**. No hay que correr nada a mano.

Para forzar un deploy sin commitear (o probar un cambio local antes de subirlo):

```
vercel deploy --prod
```

Cada juego queda en su carpeta y la raíz tiene el índice. El repo es público también, así que lo que se commitea se ve en GitHub.

## Convenciones

Cada juego vive en su carpeta y es independiente: `index.html`, `assets/app.js`, `assets/styles.css`, `data/*.js`, más `README.md` con sus propias decisiones. HDP usa `public/` como raíz porque se sirve tal cual. Sin dependencias, sin build, sin cuentas, sin métricas. Los textos de interfaz van en español rioplatense.

Humor adulto: HDP, Yo Nunca y La Botella suben el tono en sus niveles más altos, con insinuación y humor pero sin explicitud. Después de las doce es el único que avisa que es +18 en la intro del índice, y se juega con reglas de la casa: todo es oferta, se puede pasar y hay palabra de corte.
