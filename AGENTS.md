# AGENTS.md — Juegos de mesa

Sitio estático con nueve juegos de mesa para juntadas, pensado para celular y escritorio. No tiene build, dependencias ni bundler: se abre con doble clic (`file://`) o desde un servidor estático local (`node scripts/serve.js`).

> **Importante:** el repo está conectado a Vercel (`https://juegos-de-mesa-seven.vercel.app`). **Cada `git push` a `main` despliega en producción.** No hagas `git push` salvo que te lo pidan explícitamente.

## Mapa del repositorio

- [index.html](index.html): selector principal en grilla; renderiza las tarjetas desde [shared/games.js](shared/games.js).
- [shared/](shared/):
  - [shared/games.js](shared/games.js): catálogo único (`window.JUEGOS_CATALOG`) y helpers de rutas `resolveGameHref` / `resolveHubHref` compatibles con `file://` y HTTP.
  - [shared/theme.js](shared/theme.js): script síncrono para `<head>` que sincroniza `juegos-theme` en `localStorage` antes del primer paint (soporta `data-theme-mode="dark-only"`).
  - [shared/chrome.css](shared/chrome.css) y [shared/chrome.js](shared/chrome.js): montan `.theme-toggle` y `.hub-fab` + `#hubDialog`, ocultan el chrome flotante durante partidas activas y manejan el cierre por backdrop.
- `<slug>/`: cada juego vive aislado en su carpeta con la misma estructura:
  - `index.html`, `README.md`, `AGENTS.md`
  - `assets/app.js`, `assets/styles.css` (y opcionalmente módulos de lógica pura sin DOM)
  - `data/*.js`
  - `test/game.test.js`
- [scripts/serve.js](scripts/serve.js): servidor HTTP estático sin dependencias para probar en local y en la red WiFi.
- [test/checks.js](test/checks.js): verificación integral del repo (estructura, índice, links, conteos, coherencia, sintaxis y ejecución de todas las suites).
- [test/shared.test.js](test/shared.test.js): pruebas unitarias de `shared/`.
- [.githooks/](.githooks/): `commit-msg` (valida Conventional Commits) y `pre-commit` (corre `node test/checks.js`).

## Convenciones de código

1. **Cero dependencias, cero build:** HTML/CSS/JS vanilla y módulos estándar de Node (`node:*`) para tests y scripts. No agregues `package.json`, bundlers ni frameworks.
2. **Compatible con `file://` y HTTP:** usá `<script>` clásicos en orden (sin `type="module"` ni `fetch()` a archivos locales). Exponé datos en `window.<GLOBAL>` y lógica pura con soporte UMD (`module.exports` + `window.*`) cuando la testees desde Node.
3. **Idioma:** interfaz en español rioplatense cálido y breve (`vos`, `elegí`, `tocá`, `arrancás`). Identificadores de código y mensajes de commit en inglés (o español consistente cuando el alcance sea local), sin mezclar estilos.
4. **HTML coherente:**
   - `<html lang="es-AR">` (agregá `data-theme-mode="dark-only"` si el juego es solo oscuro).
   - Un solo `<main>` por página; las demás vistas usan `<section class="view ..." hidden>`.
   - Cargá `../shared/theme.js` en `<head>` (salvo en juegos `dark-only`) y `../shared/chrome.css` antes de `assets/styles.css`.
   - Cargá `../shared/chrome.js` al final de `<body>`. No dupliques `.theme-toggle` ni `#hubFab` a mano.
   - Footer exacto en la pantalla inicial: `<p class="credit">Proyecto hobby hecho con amor por <strong>snatty</strong>.</p>`.
   - Guardá `keydown` globales (como `Escape`) con `if (document.querySelector("dialog[open]")) return;` (o `JuegosChrome.hasOpenDialog()`) para que cerrar `#hubDialog` o `#howDialog` no cierre la partida.
5. **Temas claro y oscuro:** definí todos los colores como variables CSS en `:root` y `:root[data-theme="dark"]` (a menos que sea `dark-only`). Si tu fondo no usa `#F6F1E9`/`#12110F`, agregá `data-light` y `data-dark` en `<meta name="theme-color">`.
6. **Contenido adulto:** las etiquetas de intensidad nunca llevan `+18` ni rango etario; el único juego marcado para adultos es `despues-de-las-doce` en la intro del índice y sus reglas de la casa.

## Checklist para agregar un juego nuevo

1. Creá `<slug>/` con:
   - `<slug>/index.html`
   - `<slug>/assets/styles.css` y `<slug>/assets/app.js`
   - `<slug>/data/<dataset>.js`
   - `<slug>/README.md` (con `node test/game.test.js` y conteo exacto de ítems)
   - `<slug>/AGENTS.md`
   - `<slug>/test/game.test.js` (validando contenido sin duplicados ni placeholders + lógica pura)
2. Agregá la entrada correspondiente en [shared/games.js](shared/games.js).
3. Agregá la fila en la tabla de [README.md](README.md) y los chequeos de conteo del nuevo dataset en [test/checks.js](test/checks.js).
4. Corré `node test/checks.js` y probalo en el navegador desde `node scripts/serve.js` y abriendo `index.html` con `file://`.

## Flujo local y commits

Activar hooks una vez por clon:

```sh
git config core.hooksPath .githooks
```

Servir localmente (en `http://localhost:8080` o el puerto que pases):

```sh
node scripts/serve.js 8080
```

Correr toda la verificación del repo:

```sh
node test/checks.js
```

Todos los commits deben seguir Conventional Commits: `<type>(<scope>): <description>` (por ejemplo `feat(truco): add 40-card deck`, `fix(botella): prevent double spin`).
