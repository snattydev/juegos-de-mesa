# Contribuir a Juegos de mesa

¡Gracias por pasar! Este repo reúne juegos de mesa pensados para juntadas y celulares, sin cuentas, sin build y sin dependencias. Si querés sumar un juego nuevo o mejorar alguno existente (a mano o vibecodeando con un agente de IA), esta guía te deja todo listo en cinco minutos.

## Filosofía del proyecto

- **Cero dependencias, cero build:** HTML, CSS y JavaScript vanilla, más módulos estándar de Node (`node:*`) para tests y scripts. No agregues `package.json`, `node_modules`, bundlers ni frameworks.
- **Funciona con doble clic (`file://`) y por HTTP:** usá `<script>` clásicos en orden, sin `type="module"` ni `fetch()` a archivos locales.
- **Mobile-first y temas sincronizados:** diseño limpio para usar con una mano en la juntada, con tema claro/oscuro compartido desde [shared/](shared/) (salvo juegos pensados solo para noche).
- **Español rioplatense:** textos cálidos y breves (`vos`, `elegí`, `tocá`, `arrancás`). Identificadores de código y mensajes de commit en inglés (o español consistente).
- **Humor cuidado, sin cuentas ni métricas:** nada se sube ni se trackea; todo queda en memoria o `localStorage`. Evitá contenido cruel o explícito. Las etiquetas de intensidad nunca llevan `+18`; si un juego es para adultos, se aclara en la intro del índice y en sus reglas de la casa.

## Arranque local

1. Hacé un fork del repo y clonalo.
2. Activá los hooks locales (validan Conventional Commits y corren los chequeos antes de cada commit):

   ```sh
   git config core.hooksPath .githooks
   ```

3. Levantá el servidor estático local (funciona también desde el celular en la misma red WiFi):

   ```sh
   node scripts/serve.js 8080
   ```

4. Corré toda la verificación del repo:

   ```sh
   node test/checks.js
   ```

También podés probar abriendo [index.html](index.html) directamente con doble clic (`file://`) para comprobar que ningún link ni script dependa de un servidor.

## Cómo agregar un juego nuevo

Tomá como referencia un juego simple como [en-palabras/](en-palabras/) (cartas), [ahorcado/](ahorcado/) (lógica pura separada en módulo) o [incomodometro/](incomodometro/) (votación secreta).

### 1. Creá la carpeta `<slug>/`

```
<slug>/
├── index.html
├── README.md
├── AGENTS.md
├── assets/
│   ├── app.js
│   └── styles.css
├── data/
│   └── <dataset>.js
└── test/
    └── game.test.js
```

### 2. Usá el esqueleto estándar en `<slug>/index.html`

- `<html lang="es-AR">` (agregá `data-theme-mode="dark-only"` si el juego es solo oscuro).
- En `<head>`:
  - `<meta name="theme-color" content="#F6F1E9">` (agregá `data-light="..." data-dark="..."` si tu fondo usa otros colores; omitilo si es `dark-only`).
  - `<script src="../shared/theme.js"></script>` (salvo en juegos `dark-only`).
  - Tipografías `Fraunces` + `Inter` (como en los demás juegos) y `<link rel="stylesheet" href="../shared/chrome.css">` antes de `<link rel="stylesheet" href="assets/styles.css">`.
  - Favicon SVG inline con el monograma del juego.
- En `<body>`:
  - Un solo `<main>` para la vista inicial (`#viewHome` o `#viewSetup`); las vistas siguientes usan `<section class="view ..." hidden>`.
  - Footer exacto en la pantalla inicial: `<p class="credit">Proyecto hobby hecho con amor por <strong>snatty</strong>.</p>`.
  - Un diálogo `#howDialog` con "Cómo se juega".
  - Tus scripts (`data/*.js`, `assets/app.js`) y al final `<script src="../shared/chrome.js"></script>`.
  - No dupliques `.theme-toggle` ni `#hubFab` a mano: [shared/chrome.js](shared/chrome.js) los monta automáticamente.

### 3. Reglas de estilos y código

- **Variables CSS:** definí los colores en `:root` y `:root[data-theme="dark"]` (incluyendo `--bg`, `--surface`, `--ink`, `--muted`, `--line`, `--accent`) y respetá `prefers-reduced-motion`.
- **Datos y lógica testeable:** guardá las cartas/palabras en `<slug>/data/<dataset>.js` bajo `window.<GLOBAL>` y exportá las reglas puras con soporte UMD (`module.exports` + `window.*`) o guardando el DOM con `if (typeof document === "undefined") return;`.
- **Atajos de teclado:** si escuchás `keydown` globales (como `Escape`), cortá temprano con `if (document.querySelector("dialog[open]")) return;` o `JuegosChrome.hasOpenDialog()` para no salir de la partida al cerrar un diálogo.

### 4. Conectalo al catálogo y a los chequeos

1. Agregá la entrada del juego en [shared/games.js](shared/games.js) (`slug`, `title`, `mono`, `accent`, `monoBg`, `monoInk`, `meta`, `intro`, `darkOnly`, `players`, `dataFile`, `dataGlobal`).
2. Sumá la fila correspondiente en la tabla de [README.md](README.md).
3. Documentá reglas, conteo exacto y `node test/game.test.js` en `<slug>/README.md`, más las convenciones locales en `<slug>/AGENTS.md`.
4. Validá contenido sin duplicados ni placeholders y lógica pura en `<slug>/test/game.test.js`.
5. Sumá la verificación de conteos del nuevo dataset en [test/checks.js](test/checks.js).

## Vibecodear con un agente de IA

El repo ya trae contexto estructurado para agentes en [AGENTS.md](AGENTS.md), [CLAUDE.md](CLAUDE.md) y en el `AGENTS.md` de cada juego. Podés arrancar directamente con un prompt así:

> Leé `AGENTS.md` y creá un juego nuevo en `<slug>/` llamado "<Nombre>": [describí la mecánica, cantidad de jugadores, mazos e intensidad]. Respetá `shared/`, temas claro/oscuro, español rioplatense, agregalo a `shared/games.js`, `README.md` y `test/checks.js`, escribí `<slug>/test/game.test.js` y validá todo corriendo `node test/checks.js`.

## Commits y Pull Request

- Todos los commits siguen **Conventional Commits** (`<type>(<scope>): <description>`, validado por [.githooks/commit-msg](.githooks/commit-msg)), por ejemplo: `feat(truco): add 40-card deck and round scoring`.
- Antes de abrir tu PR:
  - Corré `node test/checks.js` y confirmá `0 fallas`.
  - Probá el juego en modo claro y oscuro desde `node scripts/serve.js` y abriendo `index.html` vía `file://`.
  - Revisá que no haya scroll accidental en celular ni texto en inglés en la interfaz.
